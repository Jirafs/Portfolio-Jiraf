import concurrent.futures
import http.client
import json
from pathlib import Path
import sqlite3
import tempfile
import threading
import unittest
from contextlib import closing

from main import OrbitServer


class APITest(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.database = Path(self.temp.name) / 'test.sqlite3'
        self.server = OrbitServer(0, self.database)
        self.thread = threading.Thread(target=self.server.serve_forever, daemon=True)
        self.thread.start()
        self.origin = f'http://127.0.0.1:{self.server.server_port}'

    def tearDown(self):
        self.server.shutdown()
        self.server.server_close()
        self.thread.join()
        self.temp.cleanup()

    def request(self, path, method='GET', data=None, cookie='', origin=True):
        conn = http.client.HTTPConnection('127.0.0.1', self.server.server_port, timeout=5)
        headers = {'Cookie': cookie}
        if method != 'GET':
            headers.update({'Content-Type': 'application/json', 'X-Orbit-Request': '1'})
            if origin:
                headers['Origin'] = self.origin
        conn.request(method, path, body=json.dumps(data) if data is not None else None, headers=headers)
        response = conn.getresponse()
        code, result, cookies = response.status, json.loads(response.read()), response.getheader('Set-Cookie')
        conn.close()
        return code, result, cookies

    def register(self, name='owner'):
        code, _, cookie = self.request('/api/register', 'POST', {'name': name, 'email': f'{name}@example.test', 'password': 'local-test-password-123'})
        self.assertEqual(code, 200)
        self.assertIn('HttpOnly', cookie)
        self.assertIn('SameSite=Strict', cookie)
        cookie = cookie.split(';')[0]
        session = self.request('/api/session', cookie=cookie)[1]
        return cookie, session['workspaces'][0]['id']

    def task(self, cookie, workspace, title='Задача'):
        code, _, _ = self.request('/api/tasks', 'POST', {'workspace': workspace, 'title': title, 'description': 'Описание', 'status': 'ready'}, cookie)
        self.assertEqual(code, 200)
        return self.request(f'/api/workspaces/{workspace}', cookie=cookie)[1]['tasks'][0]

    def test_sessions_passwords_logout_and_expiration(self):
        self.assertEqual(self.request('/api/session')[0], 401)
        cookie, workspace = self.register()
        with closing(sqlite3.connect(self.database)) as db, db:
            password = db.execute('SELECT password FROM users').fetchone()[0]
            token = db.execute('SELECT token FROM sessions').fetchone()[0]
        self.assertNotEqual(password, 'local-test-password-123')
        self.assertNotIn(cookie.split('=')[1], token)
        self.assertEqual(self.request('/api/login', 'POST', {'email': 'owner@example.test', 'password': 'incorrect-password'}, cookie)[0], 401)
        code, _, new_cookie = self.request('/api/login', 'POST', {'email': 'owner@example.test', 'password': 'local-test-password-123'})
        self.assertEqual(code, 200)
        self.assertEqual(self.request('/api/logout', 'POST', {}, cookie)[0], 200)
        self.assertEqual(self.request('/api/session', cookie=cookie)[0], 401)
        new_cookie = new_cookie.split(';')[0]
        with closing(sqlite3.connect(self.database)) as db, db:
            db.execute('UPDATE sessions SET expires=0')
        self.assertEqual(self.request('/api/session', cookie=new_cookie)[0], 401)

    def test_workspace_isolation_and_server_side_roles(self):
        owner, workspace = self.register()
        viewer, other = self.register('viewer')
        task = self.task(owner, workspace)
        self.assertEqual(self.request(f'/api/workspaces/{workspace}', cookie=viewer)[0], 404)
        self.assertEqual(self.request('/api/tasks', 'POST', {'workspace': workspace, 'title': 'attack', 'description': '', 'status': 'ready'}, viewer)[0], 404)
        self.assertEqual(self.request(f"/api/tasks/{task['id']}", 'DELETE', {'version': 1}, viewer)[0], 404)
        self.assertEqual(self.request('/api/members', 'POST', {'workspace': workspace, 'email': 'viewer@example.test', 'role': 'viewer'}, owner)[0], 200)
        self.assertEqual(self.request(f'/api/workspaces/{workspace}', cookie=viewer)[0], 200)
        update = {'title': 'Изменено', 'description': '', 'status': 'done', 'version': 1}
        self.assertEqual(self.request(f"/api/tasks/{task['id']}", 'PATCH', update, viewer)[0], 403)
        self.assertEqual(self.request('/api/members', 'POST', {'workspace': workspace, 'email': 'viewer@example.test', 'role': 'editor'}, viewer)[0], 403)
        self.assertEqual(self.request('/api/members', 'POST', {'workspace': workspace, 'email': 'viewer@example.test', 'role': 'editor'}, owner)[0], 200)
        self.assertEqual(self.request(f"/api/tasks/{task['id']}", 'PATCH', update, viewer)[0], 200)
        self.assertEqual(self.request('/api/members', 'POST', {'workspace': workspace, 'email': 'owner@example.test', 'role': 'viewer'}, owner)[0], 400)
        self.assertEqual(self.request(f'/api/workspaces/{other}', cookie=owner)[0], 404)

    def test_concurrent_edits_and_stale_delete(self):
        owner, workspace = self.register()
        task = self.task(owner, workspace)
        payload = {'title': 'Новая версия', 'description': '', 'status': 'done', 'version': 1}
        with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:
            results = list(pool.map(lambda _: self.request(f"/api/tasks/{task['id']}", 'PATCH', payload, owner)[0], range(2)))
        self.assertEqual(sorted(results), [200, 409])
        self.assertEqual(self.request(f"/api/tasks/{task['id']}", 'DELETE', {'version': 1}, owner)[0], 409)
        tasks = self.request(f'/api/workspaces/{workspace}', cookie=owner)[1]['tasks']
        self.assertEqual(tasks[0]['version'], 2)
        self.assertEqual(self.request(f"/api/tasks/{task['id']}", 'DELETE', {'version': 2}, owner)[0], 200)
        self.assertEqual(self.request(f'/api/workspaces/{workspace}', cookie=owner)[1]['tasks'], [])
        replacement = self.task(owner, workspace, 'Следующая задача')
        self.assertNotEqual(replacement['id'], task['id'])
        self.assertEqual(self.request(f"/api/tasks/{task['id']}", 'PATCH', payload, owner)[0], 404)

    def test_validation_origin_and_private_files(self):
        owner, workspace = self.register()
        data = {'workspace': workspace, 'title': '   ', 'description': '', 'status': 'ready'}
        self.assertEqual(self.request('/api/tasks', 'POST', data, owner)[0], 400)
        data['title'] = '<img src=x onerror=alert(1)>'
        data['status'] = []
        self.assertEqual(self.request('/api/tasks', 'POST', data, owner)[0], 400)
        data['status'] = 'ready'
        self.assertEqual(self.request('/api/tasks', 'POST', data, owner, origin=False)[0], 403)
        self.assertEqual(self.request('/api/tasks', 'POST', data, owner)[0], 200)
        stored = self.request(f'/api/workspaces/{workspace}', cookie=owner)[1]['tasks'][0]
        self.assertEqual(stored['title'], data['title'])
        for path in ['/server/data/orbit.sqlite3', '/server/main.py', '/.git/config', '/../../.git/config']:
            self.assertEqual(self.request(path)[0], 404)

    def test_auth_attempts_are_limited(self):
        for _ in range(12):
            self.assertEqual(self.request('/api/login', 'POST', {'email': 'unknown@example.test', 'password': 'invalid-password-123'})[0], 401)
        self.assertEqual(self.request('/api/login', 'POST', {'email': 'unknown@example.test', 'password': 'invalid-password-123'})[0], 429)

    def test_out_of_range_identifiers_return_json_errors(self):
        owner, workspace = self.register()
        task = self.task(owner, workspace)
        oversized = 2**63
        for value in (oversized, True, 0, -1):
            self.assertEqual(self.request('/api/tasks', 'POST', {
                'workspace': value, 'title': 'Нельзя сохранить', 'description': '', 'status': 'ready'
            }, owner)[0], 400)
        self.assertEqual(self.request(f'/api/workspaces/{oversized}', cookie=owner)[0], 400)
        self.assertEqual(self.request(f'/api/tasks/{oversized}', 'DELETE', {'version': 1}, owner)[0], 400)
        for path in ('/api/workspaces/', '/api/tasks/'):
            method, payload = ('GET', None) if 'workspaces' in path else ('DELETE', {'version': 1})
            self.assertEqual(self.request(path + '9' * 5000, method, payload, owner)[0], 400)
        self.assertEqual(self.request(f"/api/tasks/{task['id']}", 'DELETE', {'version': oversized}, owner)[0], 400)
        self.assertEqual(self.request(f'/api/workspaces/{workspace}', cookie=owner)[1]['tasks'][0]['id'], task['id'])


if __name__ == '__main__':
    unittest.main(verbosity=2)
