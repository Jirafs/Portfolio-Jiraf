"""Orbit server demo. Standard-library Python + SQLite; binds to loopback only."""
import argparse
import hashlib
import hmac
import json
import re
import secrets
import sqlite3
import threading
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from contextlib import closing
from urllib.parse import urlsplit

ROOT = Path(__file__).resolve().parent.parent
PASSWORD_ROUNDS = 300_000
STATUSES = {'backlog', 'ready', 'progress', 'done'}
MAX_ID = 2**63 - 1  # SQLite INTEGER range


class APIError(Exception):
    def __init__(self, code, message):
        self.code, self.message = code, message


def password_hash(password, salt):
    return hashlib.pbkdf2_hmac('sha256', password.encode(), bytes.fromhex(salt), PASSWORD_ROUNDS).hex()


def initialize(path):
    with closing(sqlite3.connect(path)) as db, db:
        db.execute('PRAGMA journal_mode=WAL')
        db.executescript('''
        CREATE TABLE IF NOT EXISTS users(id INTEGER PRIMARY KEY, email TEXT UNIQUE NOT NULL, name TEXT NOT NULL, salt TEXT NOT NULL, password TEXT NOT NULL);
        CREATE TABLE IF NOT EXISTS sessions(token TEXT PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES users(id), expires REAL NOT NULL);
        CREATE TABLE IF NOT EXISTS workspaces(id INTEGER PRIMARY KEY, name TEXT NOT NULL);
        CREATE TABLE IF NOT EXISTS memberships(workspace_id INTEGER NOT NULL REFERENCES workspaces(id), user_id INTEGER NOT NULL REFERENCES users(id), role TEXT NOT NULL CHECK(role IN ('owner','editor','viewer')), PRIMARY KEY(workspace_id,user_id));
        CREATE TABLE IF NOT EXISTS tasks(id INTEGER PRIMARY KEY AUTOINCREMENT, workspace_id INTEGER NOT NULL REFERENCES workspaces(id), title TEXT NOT NULL, description TEXT NOT NULL DEFAULT '', status TEXT NOT NULL CHECK(status IN ('backlog','ready','progress','done')), version INTEGER NOT NULL DEFAULT 1);
        ''')


class OrbitServer(ThreadingHTTPServer):
    daemon_threads = True

    def __init__(self, port, database):
        self.database = str(database)
        initialize(self.database)
        self.attempts = {}
        self.attempts_lock = threading.Lock()
        super().__init__(('127.0.0.1', port), Handler)


class Handler(BaseHTTPRequestHandler):
    server_version = 'OrbitDemo'

    def log_message(self, fmt, *args):
        # Do not record passwords, request bodies, session tokens or query strings.
        pass

    def respond(self, code, value, cookie=None):
        data = json.dumps(value, ensure_ascii=False).encode()
        self.send_response(code)
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self.send_header('Cache-Control', 'no-store')
        self.send_header('X-Content-Type-Options', 'nosniff')
        self.send_header('Content-Length', str(len(data)))
        if cookie:
            self.send_header('Set-Cookie', cookie)
        self.end_headers()
        self.wfile.write(data)

    def session_token(self):
        cookies = self.headers.get('Cookie', '').split(';')
        raw = next((part.strip().split('=', 1)[1] for part in cookies if part.strip().startswith('orbit_session=')), '')
        return hashlib.sha256(raw.encode()).hexdigest()

    def user(self, db):
        row = db.execute('SELECT u.id,u.email,u.name FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token=? AND s.expires>?', (self.session_token(), time.time())).fetchone()
        if row is None:
            raise APIError(401, 'Войдите в аккаунт.')
        return dict(row)

    def role(self, db, user_id, workspace, write=False, owner=False):
        row = db.execute('SELECT role FROM memberships WHERE workspace_id=? AND user_id=?', (workspace, user_id)).fetchone()
        if row is None:
            raise APIError(404, 'Пространство не найдено.')
        if (write and row['role'] == 'viewer') or (owner and row['role'] != 'owner'):
            raise APIError(403, 'Недостаточно прав для этого действия.')
        return row['role']

    def body(self):
        origin = f'http://127.0.0.1:{self.server.server_port}'
        if self.headers.get('Origin') != origin or self.headers.get('X-Orbit-Request') != '1':
            raise APIError(403, 'Недопустимый источник запроса.')
        if self.headers.get_content_type() != 'application/json':
            raise APIError(415, 'Ожидается JSON.')
        try:
            length = int(self.headers.get('Content-Length', '0'))
        except ValueError:
            raise APIError(400, 'Некорректный размер запроса.')
        if length < 0 or length > 32_768:
            raise APIError(413, 'Слишком большой запрос.')
        try:
            value = json.loads(self.rfile.read(length))
        except (ValueError, UnicodeError):
            raise APIError(400, 'Некорректный JSON.')
        if not isinstance(value, dict):
            raise APIError(400, 'Ожидается объект.')
        return value

    def text(self, body, key, maximum, minimum=1):
        value = body.get(key)
        if not isinstance(value, str) or not minimum <= len(value.strip()) <= maximum:
            raise APIError(400, f'Проверьте поле «{key}»: от {minimum} до {maximum} символов.')
        return value.strip()

    def integer(self, body, key):
        value = body.get(key)
        if type(value) is not int or not 1 <= value <= MAX_ID:
            raise APIError(400, f'Некорректное поле «{key}».')
        return value

    def path_id(self, value):
        # Reject before int(): very long URL numbers can exceed Python's digit limit.
        if len(value) > 19:
            raise APIError(400, 'Некорректный идентификатор.')
        return self.integer({'id': int(value)}, 'id')

    def limit_auth(self):
        now = time.time()
        key = self.client_address[0]
        with self.server.attempts_lock:
            attempts = [t for t in self.server.attempts.get(key, []) if now - t < 60]
            if len(attempts) >= 12:
                raise APIError(429, 'Слишком много попыток. Повторите через минуту.')
            self.server.attempts[key] = attempts + [now]

    def handle_api(self):
        path = urlsplit(self.path).path
        body = self.body() if self.command != 'GET' else {}
        with closing(sqlite3.connect(self.server.database, timeout=10)) as db, db:
            db.row_factory = sqlite3.Row
            db.execute('PRAGMA foreign_keys=ON')
            if self.command != 'GET':
                db.execute('BEGIN IMMEDIATE')
            if path in ('/api/register', '/api/login') and self.command == 'POST':
                self.limit_auth()
                email = self.text(body, 'email', 200).lower()
                if not re.fullmatch(r'[^\s@]+@[^\s@]+\.[^\s@]+', email):
                    raise APIError(400, 'Проверьте email.')
                password = body.get('password')
                if not isinstance(password, str) or not 12 <= len(password) <= 128:
                    raise APIError(400, 'Пароль должен содержать от 12 до 128 символов.')
                if path == '/api/register':
                    name = self.text(body, 'name', 80)
                    salt = secrets.token_hex(16)
                    try:
                        user_id = db.execute('INSERT INTO users(email,name,salt,password) VALUES(?,?,?,?)', (email, name, salt, password_hash(password, salt))).lastrowid
                    except sqlite3.IntegrityError:
                        raise APIError(409, 'Невозможно создать аккаунт с этим email.')
                    workspace = db.execute('INSERT INTO workspaces(name) VALUES(?)', ('Моё пространство',)).lastrowid
                    db.execute('INSERT INTO memberships VALUES(?,?,?)', (workspace, user_id, 'owner'))
                else:
                    row = db.execute('SELECT * FROM users WHERE email=?', (email,)).fetchone()
                    calculated = password_hash(password, row['salt'] if row else '00' * 16)
                    if row is None or not hmac.compare_digest(calculated, row['password']):
                        raise APIError(401, 'Неверный email или пароль.')
                    user_id = row['id']
                token = secrets.token_urlsafe(32)
                db.execute('DELETE FROM sessions WHERE expires<=?', (time.time(),))
                db.execute('INSERT INTO sessions VALUES(?,?,?)', (hashlib.sha256(token.encode()).hexdigest(), user_id, time.time() + 86400))
                db.commit()
                return self.respond(200, {'ok': True}, f'orbit_session={token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=86400')
            user = self.user(db)
            if path == '/api/logout' and self.command == 'POST':
                db.execute('DELETE FROM sessions WHERE token=?', (self.session_token(),))
                db.commit()
                return self.respond(200, {'ok': True}, 'orbit_session=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0')
            if path == '/api/session' and self.command == 'GET':
                workspaces = [dict(r) for r in db.execute('SELECT w.id,w.name,m.role FROM workspaces w JOIN memberships m ON m.workspace_id=w.id WHERE m.user_id=? ORDER BY w.id', (user['id'],))]
                return self.respond(200, {'user': user, 'workspaces': workspaces})
            workspace_match = re.fullmatch(r'/api/workspaces/(\d+)', path)
            if workspace_match and self.command == 'GET':
                workspace = self.path_id(workspace_match[1])
                role = self.role(db, user['id'], workspace)
                tasks = [dict(r) for r in db.execute('SELECT id,title,description,status,version FROM tasks WHERE workspace_id=? ORDER BY id DESC', (workspace,))]
                members = [dict(r) for r in db.execute('SELECT u.name,u.email,m.role FROM memberships m JOIN users u ON u.id=m.user_id WHERE m.workspace_id=? ORDER BY u.id', (workspace,))]
                return self.respond(200, {'tasks': tasks, 'members': members, 'role': role})
            if path == '/api/members' and self.command == 'POST':
                workspace = self.integer(body, 'workspace')
                self.role(db, user['id'], workspace, owner=True)
                email = self.text(body, 'email', 200).lower()
                role = body.get('role')
                if role not in ('editor', 'viewer'):
                    raise APIError(400, 'Выберите роль редактора или наблюдателя.')
                member = db.execute('SELECT id FROM users WHERE email=?', (email,)).fetchone()
                if member is None:
                    raise APIError(404, 'Пользователь должен сначала создать аккаунт.')
                existing = db.execute('SELECT role FROM memberships WHERE workspace_id=? AND user_id=?', (workspace, member['id'])).fetchone()
                if existing and existing['role'] == 'owner':
                    raise APIError(400, 'Нельзя изменить роль владельца.')
                db.execute('INSERT INTO memberships VALUES(?,?,?) ON CONFLICT(workspace_id,user_id) DO UPDATE SET role=excluded.role', (workspace, member['id'], role))
                db.commit()
                return self.respond(200, {'ok': True})
            task_match = re.fullmatch(r'/api/tasks/(\d+)', path)
            if (path == '/api/tasks' and self.command == 'POST') or (task_match and self.command in ('PATCH', 'DELETE')):
                if task_match:
                    task_id = self.path_id(task_match[1])
                    task = db.execute('SELECT * FROM tasks WHERE id=?', (task_id,)).fetchone()
                    if task is None:
                        raise APIError(404, 'Задача не найдена.')
                    workspace = task['workspace_id']
                else:
                    workspace = self.integer(body, 'workspace')
                self.role(db, user['id'], workspace, write=True)
                if task_match and self.integer(body, 'version') != task['version']:
                    raise APIError(409, 'Задача уже изменена. Обновите доску и повторите правку.')
                if self.command == 'DELETE':
                    db.execute('DELETE FROM tasks WHERE id=?', (task['id'],))
                else:
                    title = self.text(body, 'title', 160)
                    description = self.text(body, 'description', 3000, minimum=0)
                    status = body.get('status')
                    if not isinstance(status, str) or status not in STATUSES:
                        raise APIError(400, 'Неизвестный статус.')
                    if task_match:
                        db.execute('UPDATE tasks SET title=?,description=?,status=?,version=version+1 WHERE id=?', (title, description, status, task['id']))
                    else:
                        db.execute('INSERT INTO tasks(workspace_id,title,description,status) VALUES(?,?,?,?)', (workspace, title, description, status))
                db.commit()
                return self.respond(200, {'ok': True})
            raise APIError(404, 'Маршрут не найден.')

    def do_GET(self):
        if urlsplit(self.path).path.startswith('/api/'):
            return self.dispatch()
        files = {'/': ('fullstack.html', 'text/html'), '/fullstack.html': ('fullstack.html', 'text/html'), '/fullstack.js': ('fullstack.js', 'text/javascript'), '/fullstack.css': ('fullstack.css', 'text/css')}
        item = files.get(urlsplit(self.path).path)
        if item is None:
            return self.respond(404, {'error': 'Страница не найдена.'})
        data = (ROOT / item[0]).read_bytes()
        self.send_response(200)
        self.send_header('Content-Type', item[1] + '; charset=utf-8')
        self.send_header('Content-Length', str(len(data)))
        self.send_header('X-Content-Type-Options', 'nosniff')
        self.send_header('Content-Security-Policy', "default-src 'self'; style-src 'self'; script-src 'self'; connect-src 'self'; img-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'")
        self.send_header('Cache-Control', 'no-store')
        self.end_headers()
        self.wfile.write(data)

    def dispatch(self):
        try:
            self.handle_api()
        except APIError as error:
            self.respond(error.code, {'error': error.message})
        except (sqlite3.Error, OSError):
            self.respond(500, {'error': 'Не удалось сохранить данные. Повторите позже.'})

    do_POST = dispatch
    do_PATCH = dispatch
    do_DELETE = dispatch


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--port', type=int, default=8787)
    parser.add_argument('--database', type=Path, default=Path(__file__).parent / 'data' / 'orbit.sqlite3')
    args = parser.parse_args()
    args.database.parent.mkdir(parents=True, exist_ok=True)
    server = OrbitServer(args.port, args.database)
    print(f'Orbit: http://127.0.0.1:{server.server_port}', flush=True)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()
