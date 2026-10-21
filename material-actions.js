/* Public file actions: no owner credentials are used for downloads or sharing. */
window.materialActions = {
  shareUrl(file, baseUrl) {
    const url = new URL('pedagog.html', baseUrl);
    url.searchParams.set('material', file.path);
    url.hash = 'methods';
    return url.href;
  },
  create(file, downloadUrl, shareUrl) {
    const actions = document.createElement('div');
    actions.className = 'material-actions';
    const download = document.createElement('button');
    download.type = 'button';
    download.textContent = 'Скачать файл';
    download.setAttribute('aria-label', `Скачать файл: ${file.title || file.name}`);
    const share = document.createElement('button');
    share.type = 'button';
    share.textContent = 'Скопировать ссылку';
    share.setAttribute('aria-label', `Скопировать ссылку на материал: ${file.title || file.name}`);
    const status = document.createElement('p');
    status.className = 'material-action-status';
    status.setAttribute('role', 'status');
    const manual = document.createElement('input');
    manual.type = 'text';
    manual.readOnly = true;
    manual.hidden = true;
    manual.setAttribute('aria-label', 'Ссылка на материал для копирования');
    const source = document.createElement('a');
    source.href = downloadUrl;
    source.target = '_blank';
    source.rel = 'noopener noreferrer';
    source.textContent = 'Открыть исходный файл ↗';
    source.hidden = true;
    download.addEventListener('click', async () => {
      if (download.disabled) return;
      download.disabled = true;
      download.setAttribute('aria-busy', 'true');
      source.hidden = true;
      status.textContent = 'Подготовка файла к скачиванию…';
      try {
        const response = await fetch(downloadUrl, { cache: 'no-store' });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const blob = await response.blob();
        const objectUrl = URL.createObjectURL(blob);
        try {
          const anchor = document.createElement('a');
          anchor.href = objectUrl;
          anchor.download = file.name;
          anchor.hidden = true;
          document.body.append(anchor);
          anchor.click();
          anchor.remove();
          status.textContent = 'Файл передан браузеру для скачивания.';
        } finally {
          setTimeout(() => URL.revokeObjectURL(objectUrl), 60000);
        }
      } catch (error) {
        status.textContent = `Не удалось скачать файл (${error.message}). Повторите попытку или откройте исходный файл.`;
        source.hidden = false;
      } finally {
        download.disabled = false;
        download.setAttribute('aria-busy', 'false');
      }
    });
    share.addEventListener('click', async () => {
      manual.hidden = true;
      try {
        if (!navigator.clipboard?.writeText) throw new Error('Clipboard unavailable');
        await navigator.clipboard.writeText(shareUrl);
        status.textContent = 'Ссылка на материал скопирована.';
      } catch {
        manual.value = shareUrl;
        manual.hidden = false;
        status.textContent = 'Выделенная ссылка готова для копирования вручную.';
        manual.focus();
        manual.select();
      }
    });
    actions.append(download, share, manual, source, status);
    return actions;
  }
};
