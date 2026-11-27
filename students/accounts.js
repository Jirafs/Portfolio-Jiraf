import { projectUrl, publishableKey, openRegistration } from './auth-config.js';

const container = document.querySelector('[data-account-panel]');
const message = container.querySelector('[role="status"]');
const login = container.querySelector('#practice-login');
const register = container.querySelector('#practice-register');
const logout = container.querySelector('#practice-logout');
const teacher = container.querySelector('#practice-teacher');
const groups = { layout: 'CSS', javascript: 'JavaScript', xml: 'XML', html: 'HTML', react: 'React', php: 'PHP' };
let client;
let activeUser = null;
let ready = false;
let sessionVersion = 0;

function report(text) {
  message.textContent = text;
}

function updateControls(user) {
  login.hidden = !!user;
  register.hidden = !!user || !openRegistration;
  logout.hidden = !user;
  teacher.hidden = true;
  teacher.replaceChildren();
}

async function loadAll(table, columns, order) {
  const rows = [];
  for (let start = 0; ; start += 500) {
    let query = client.from(table).select(columns);
    for (const column of order) query = query.order(column);
    const { data, error } = await query.range(start, start + 499);
    if (error) throw error;
    rows.push(...data);
    if (data.length < 500) return rows;
  }
}

async function teacherReport(version) {
  const [profiles, completions] = await Promise.all([
    loadAll('practice_profiles', 'user_id,display_name,group_name', ['user_id']),
    loadAll('practice_completions', 'user_id,task_id,completed_at', ['user_id', 'task_id']),
  ]);
  if (version !== sessionVersion) return;
  const byStudent = new Map();
  for (const row of completions) {
    if (!byStudent.has(row.user_id)) byStudent.set(row.user_id, []);
    byStudent.get(row.user_id).push(row);
  }
  const heading = document.createElement('h2');
  heading.textContent = 'Кабинет преподавателя';
  const table = document.createElement('table');
  const head = table.createTHead().insertRow();
  for (const label of ['Студент', 'Группа', ...Object.values(groups), 'Последняя отметка']) {
    const cell = document.createElement('th');
    cell.scope = 'col';
    cell.textContent = label;
    head.append(cell);
  }
  const body = table.createTBody();
  const formatter = new Intl.DateTimeFormat('ru-RU', { dateStyle: 'medium', timeStyle: 'short' });
  profiles.sort((a, b) => a.group_name.localeCompare(b.group_name, 'ru') || a.display_name.localeCompare(b.display_name, 'ru'));
  for (const profile of profiles) {
    const rows = byStudent.get(profile.user_id) || [];
    const counts = Object.keys(groups).map(group => rows.filter(row => row.task_id.startsWith(group + '-')).length);
    const last = rows.reduce((latest, row) => Math.max(latest, Date.parse(row.completed_at)), 0);
    const line = body.insertRow();
    for (const value of [profile.display_name, profile.group_name, ...counts, last ? formatter.format(last) : '—']) {
      line.insertCell().textContent = value;
    }
  }
  const note = document.createElement('p');
  note.textContent = profiles.length ? 'Отметки формируются автопроверкой практикума.' : 'Студенты ещё не зарегистрированы.';
  const refresh = document.createElement('button');
  refresh.type = 'button';
  refresh.textContent = 'Обновить таблицу';
  refresh.addEventListener('click', () => teacherReport(version).catch(() => report('Таблицу не удалось обновить.')));
  teacher.replaceChildren(heading, note, refresh, table);
  teacher.hidden = false;
}

async function save(ids, userId) {
  if (!ids.length) return;
  const { error } = await client.from('practice_completions').upsert(
    ids.map(task_id => ({ user_id: userId, task_id })),
    { onConflict: 'user_id,task_id', ignoreDuplicates: true },
  );
  if (error) throw error;
}

async function activate(user) {
  const userId = user?.id ?? null;
  if (userId === activeUser && ready) return;
  const version = ++sessionVersion;
  activeUser = userId;
  ready = false;
  studentProgress.useAccount(userId);
  updateControls(user);
  if (!user) {
    report('Войдите, чтобы сохранять результаты. Пока вход доступен для выданных учётных записей.');
    return;
  }
  report('Синхронизация прогресса…');
  const role = await client.from('practice_teachers').select('user_id').eq('user_id', userId).maybeSingle();
  if (version !== sessionVersion) return;
  if (role.error) throw role.error;
  if (role.data) {
    await teacherReport(version);
    if (version === sessionVersion) report('Вы вошли как преподаватель.');
    return;
  }
  const { display_name, group_name } = user.user_metadata ?? {};
  if (!display_name || !group_name) {
    const existing = await client.from('practice_profiles').select('user_id').eq('user_id', userId).maybeSingle();
    if (version !== sessionVersion) return;
    if (existing.error || !existing.data) {
      report('Профиль ещё не настроен. Обратитесь к преподавателю.');
      return;
    }
  } else {
  const profile = await client.from('practice_profiles').upsert(
    { user_id: userId, display_name, group_name },
    { onConflict: 'user_id', ignoreDuplicates: true },
  );
  if (version !== sessionVersion) return;
  if (profile.error) throw profile.error;
  }
  const remote = await client.from('practice_completions').select('task_id').eq('user_id', userId);
  if (version !== sessionVersion) return;
  if (remote.error) throw remote.error;
  studentProgress.merge(remote.data.map(row => row.task_id));
  await save(studentProgress.ids(), userId);
  if (version !== sessionVersion) return;
  ready = true;
  report('Вы вошли. Прогресс синхронизирован.');
}

async function submit(event, action) {
  event.preventDefault();
  const form = event.currentTarget;
  const button = form.querySelector('button');
  button.disabled = true;
  try {
    const data = new FormData(form);
    const result = await action(data);
    if (result.error) {
      report('Не удалось выполнить запрос. Проверьте данные и повторите попытку.');
      return;
    }
    form.reset();
    if (!result.data.session) report('Проверьте почту и подтвердите регистрацию.');
  } catch {
    report('Сервис временно недоступен. Повторите попытку.');
  } finally {
    button.disabled = false;
  }
}

async function connect() {
  if (!projectUrl || !publishableKey) return;
  container.hidden = false;
  const { createClient } = await import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.49.4/+esm');
  client = createClient(projectUrl, publishableKey, openRegistration);
  login.addEventListener('submit', event => submit(event, data => client.auth.signInWithPassword({
    email: data.get('email').trim(), password: data.get('password'),
  })));
  register.addEventListener('submit', event => submit(event, data => client.auth.signUp({
    email: data.get('email').trim(),
    password: data.get('password'),
    options: {
      emailRedirectTo: new URL('./', location.href).href,
      data: { display_name: data.get('name').trim(), group_name: data.get('group').trim() },
    },
  })));
  logout.addEventListener('click', async () => {
    const { error } = await client.auth.signOut();
    if (error) report('Не удалось выйти. Повторите попытку.');
  });
  window.addEventListener('practice-completed', event => {
    if (!ready || !activeUser) return;
    const userId = activeUser;
    save([event.detail], userId).catch(() => {
      if (userId === activeUser) report('Отметка сохранена в браузере. Синхронизация повторится при открытии страницы.');
    });
  });
  client.auth.onAuthStateChange((_event, session) => {
    setTimeout(() => activate(session?.user).catch(() => report('Не удалось синхронизировать аккаунт. Обновите страницу.')), 0);
  });
}

connect().catch(() => report('Не удалось подключиться к сервису аккаунтов.'));
