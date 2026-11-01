(() => {
  const form = document.querySelector('#project-brief');
  if (!form) return;
  form.addEventListener('submit', async event => {
    event.preventDefault();
    const idea = form.querySelector('#brief-idea').value.trim();
    const status = form.querySelector('#brief-status');
    if (!idea) {
      status.textContent = 'Коротко опишите идею проекта.';
      form.querySelector('#brief-idea').focus();
      return;
    }
    const kind = form.querySelector('#brief-kind').value;
    const deadline = form.querySelector('#brief-deadline').value.trim();
    const text = `Здравствуйте, Даниил! Хочу обсудить проект.\n\nНаправление: ${kind}\nИдея и задача: ${idea}${deadline ? '\nЖелаемый срок: ' + deadline : ''}`;
    const fallback = form.querySelector('#brief-fallback');
    try {
      await navigator.clipboard.writeText(text);
      fallback.hidden = true;
      status.textContent = 'Описание скопировано. Откройте Telegram и отправьте его в сообщении.';
    } catch {
      fallback.value = text;
      fallback.hidden = false;
      fallback.focus();
      fallback.select();
      status.textContent = 'Скопируйте готовый текст из поля ниже и отправьте его в Telegram.';
    }
  });
})();
