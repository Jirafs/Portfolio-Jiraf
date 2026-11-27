const studentProgress = (() => {
  const guestKey = 'portfolio-student-practice-v1';
  let storageKey = guestKey;
  const totals = { layout: 5, javascript: 5, xml: 5, html: 3, react: 3, php: 3 };
  function persist() {
    localStorage.setItem(storageKey, JSON.stringify([...completed]));
  }

  function load() {
    try {
      const saved = JSON.parse(localStorage.getItem(storageKey) || '[]');
      return new Set(Array.isArray(saved) ? saved.filter(id => typeof id === 'string') : []);
    } catch {
      return new Set();
    }
  }
  let completed = load();
  const statuses = new Map();
  for (const task of document.querySelectorAll('[data-task], [data-original-task]')) {
    const status = document.createElement('p');
    status.className = 'task-status';
    status.setAttribute('aria-live', 'polite');
    (task.querySelector('h2') || task).after(status);
    statuses.set(task.dataset.task || task.dataset.originalTask, status);
  }
  function render() {
    for (const [id, status] of statuses) {
      const passed = completed.has(id);
      status.textContent = passed ? 'Пройдено' : 'Ещё не пройдено';
      status.dataset.completed = String(passed);
    }
    for (const counter of document.querySelectorAll('[data-progress-for]')) {
      const group = counter.dataset.progressFor;
      const count = [...completed].filter(id => id.startsWith(group + '-')).length;
      counter.textContent = 'Пройдено ' + count + ' из ' + totals[group];
    }
  }
  window.addEventListener('storage', event => {
    if (event.key === storageKey || event.key === null) {
      completed = load();
      render();
    }
  });
  render();
  return {
    useAccount(userId) {
      storageKey = userId ? guestKey + ':' + userId : guestKey;
      completed = load();
      render();
    },
    ids() { return [...completed]; },
    merge(ids) {
      for (const id of ids) completed.add(id);
      try { persist(); } catch {}
      render();
    },
    complete(id) {
      if (!id) return;
      const initial = !completed.has(id);
      completed.add(id);
      try {
        for (const other of load()) completed.add(other);
        persist();
      } catch {
        const note = document.querySelector('[data-storage-note]');
        if (note) note.textContent = 'Хранилище браузера недоступно. После обновления отметки могут пропасть.';
      }
      render();
      if (initial) window.dispatchEvent(new CustomEvent('practice-completed', { detail: id }));
    },
  };
})();
