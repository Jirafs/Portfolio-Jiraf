(() => {
  const config = window.githubUploadConfig;
  const form = document.querySelector('#cloud-form');
  const tokenInput = document.querySelector('#github-token');
  const loginButton = form?.querySelector('button[type="submit"]');
  const logoutButton = document.querySelector('#cloud-logout');
  const status = document.querySelector('#cloud-status');
  const uploadStatus = document.querySelector('#upload-status');
  const documentInput = document.querySelector('#document-input');
  const certificateInput = document.querySelector('#certificate-input');
  const dropzone = document.querySelector('#upload-dropzone');
  const documentList = document.querySelector('#upload-list');
  const certificateList = document.querySelector('#certificate-list');
  let accessToken = '';
  let uploadManifest = [];
  const allowedExtensions = {
    documents: new Set(['pdf', 'doc', 'docx', 'txt', 'ppt', 'pptx', 'xls', 'xlsx', 'odt', 'rtf', 'md']),
    certificates: new Set(['jpg', 'jpeg', 'png', 'gif', 'webp', 'pdf'])
  };

  if (!config) {
    showStatus('Не настроено подключение к GitHub.');
    return;
  }

  const apiRoot = `https://api.github.com/repos/${encodeURIComponent(config.owner)}/${encodeURIComponent(config.repository)}`;
  const rawRoot = `https://raw.githubusercontent.com/${encodeURIComponent(config.owner)}/${encodeURIComponent(config.repository)}/${encodeURIComponent(config.branch)}`;

  function showStatus(message, error) {
    if (status) status.textContent = message;
    if (uploadStatus) uploadStatus.textContent = message;
    if (error) console.error(message, error);
  }

  function setAuthenticated(isAuthenticated, login = '') {
    document.body.classList.toggle('github-authenticated', isAuthenticated);
    if (form) form.hidden = isAuthenticated;
    if (logoutButton) logoutButton.hidden = !isAuthenticated;
    if (tokenInput) tokenInput.value = '';
    if (status && isAuthenticated) status.textContent = `Вход выполнен как @${login}. Токен хранится только в этой вкладке.`;
  }

  function apiFetch(path, options = {}, token = accessToken) {
    const headers = new Headers(options.headers || {});
    headers.set('Accept', 'application/vnd.github+json');
    headers.set('X-GitHub-Api-Version', '2022-11-28');
    if (token) headers.set('Authorization', `Bearer ${token}`);
    const url = path.startsWith('https://api.github.com/')
      ? path
      : `https://api.github.com${path}`;
    return fetch(url, { ...options, headers, cache: 'no-store' });
  }

  async function responseJson(response) {
    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
      let message = body.message || `GitHub API вернул ошибку ${response.status}.`;
      if (message.includes('Resource not accessible by personal access token')) {
        const requiredPermissions = response.headers.get('X-Accepted-GitHub-Permissions');
        const requiredPermission = requiredPermissions || 'Contents: write';
        message += ` Для этой операции GitHub требует разрешение ${requiredPermission}. Проверьте fine-grained token: владелец ресурса — Jirafs, в выбранных репозиториях есть Portfolio-Jiraf, а Contents имеет право Read and write. Если изменили разрешения токена, войдите снова с обновлённым токеном.`;
      }
      const requestId = response.headers.get('X-GitHub-Request-Id');
      if (requestId) message += ` Код запроса GitHub: ${requestId}.`;
      const error = new Error(message);
      error.status = response.status;
      throw error;
    }
    return body;
  }

  async function getManifest(token = '') {
    const manifestPath = encodePath(config.manifest);
    const response = await apiFetch(`${apiRoot}/contents/${manifestPath}?ref=${encodeURIComponent(config.branch)}`, {}, token);
    if (response.status === 404) return { sha: null, files: [] };

    const data = await responseJson(response);
    const decoded = new TextDecoder().decode(Uint8Array.from(atob(data.content.replace(/\s/g, '')), (character) => character.charCodeAt(0)));
    const files = JSON.parse(decoded);
    if (!Array.isArray(files)) throw new Error('Список файлов в GitHub имеет неверный формат.');
    return { sha: data.sha, files };
  }

  async function saveManifest(files, sha, message) {
    const bytes = new TextEncoder().encode(JSON.stringify(files, null, 2) + '\n');
    let binary = '';
    for (let offset = 0; offset < bytes.length; offset += 0x8000) {
      binary += String.fromCharCode(...bytes.subarray(offset, offset + 0x8000));
    }
    const body = { message, content: btoa(binary), branch: config.branch };
    if (sha) body.sha = sha;

    const response = await apiFetch(`${apiRoot}/contents/${encodePath(config.manifest)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    return responseJson(response);
  }

  function encodePath(path) {
    return path.split('/').map(encodeURIComponent).join('/');
  }

  function publicFileUrl(path) {
    return `${rawRoot}/${encodePath(path)}`;
  }

  async function encodeFile(file) {
    const bytes = new Uint8Array(await file.arrayBuffer());
    let binary = '';
    for (let offset = 0; offset < bytes.length; offset += 0x8000) {
      binary += String.fromCharCode(...bytes.subarray(offset, offset + 0x8000));
    }
    return btoa(binary);
  }

  async function putFile(file, path) {
    const response = await apiFetch(`${apiRoot}/contents/${encodePath(path)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: `Добавлен файл портфолио: ${file.name}`,
        content: await encodeFile(file),
        branch: config.branch
      })
    });
    return responseJson(response);
  }

  async function deleteFile(file) {
    const response = await apiFetch(`${apiRoot}/contents/${encodePath(file.path)}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: `Удалён файл портфолио: ${file.name}`,
        sha: file.sha,
        branch: config.branch
      })
    });
    return responseJson(response);
  }

  function formatSize(size) {
    if (size < 1024) return `${size} Б`;
    if (size < 1024 * 1024) return `${Math.ceil(size / 1024)} КБ`;
    return `${(size / (1024 * 1024)).toFixed(1)} МБ`;
  }

  function renderFile(file, type, list, ownerMode) {
    const item = document.createElement('li');
    item.className = 'upload-item';
    const content = document.createElement('div');
    content.className = 'document-content';
    const link = document.createElement('a');
    const url = publicFileUrl(file.path);
    link.href = url;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    link.textContent = `${file.name} (${formatSize(file.size)})`;
    content.append(link);

    const download = document.createElement('a');
    download.href = url;
    download.download = file.name;
    download.rel = 'noopener noreferrer';
    download.className = 'document-download';
    download.textContent = 'Скачать';
    content.append(download);

    if (type === 'certificates') {
      const extension = file.name.toLowerCase().split('.').pop();
      if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(extension)) {
        const image = document.createElement('img');
        image.src = url;
        image.alt = `Предпросмотр сертификата ${file.name}`;
        image.hidden = true;
        link.setAttribute('aria-expanded', 'false');
        link.addEventListener('click', (event) => {
          event.preventDefault();
          image.hidden = !image.hidden;
          link.setAttribute('aria-expanded', String(!image.hidden));
        });
        content.append(image);
      } else if (extension === 'pdf') {
        const preview = document.createElement('iframe');
        preview.className = 'certificate-preview';
        preview.src = url;
        preview.title = `Предпросмотр сертификата ${file.name}`;
        preview.hidden = true;
        link.setAttribute('aria-expanded', 'false');
        link.addEventListener('click', (event) => {
          event.preventDefault();
          preview.hidden = !preview.hidden;
          link.setAttribute('aria-expanded', String(!preview.hidden));
        });
        content.append(preview);
      }
    }

    if (ownerMode) {
      const remove = document.createElement('button');
      remove.className = 'upload-remove owner-only';
      remove.type = 'button';
      remove.textContent = '×';
      remove.setAttribute('aria-label', `Удалить ${file.name}`);
      remove.addEventListener('click', () => removeFromGitHub(file, item));
      item.append(content, remove);
    } else {
      item.append(content);
    }
    list.append(item);
  }

  function renderManifest(files, ownerMode = false) {
    if (documentList) documentList.replaceChildren();
    if (certificateList) certificateList.replaceChildren();
    files.forEach((file) => {
      if (file.type === 'documents' && documentList) renderFile(file, 'documents', documentList, ownerMode);
      if (file.type === 'certificates' && certificateList) renderFile(file, 'certificates', certificateList, ownerMode);
    });
    if (uploadStatus && !files.length) uploadStatus.textContent = 'Здесь появятся опубликованные материалы.';
  }

  async function refreshManifest(ownerMode = false) {
    const response = await fetch(`${rawRoot}/${encodePath(config.manifest)}?t=${Date.now()}`, { cache: 'no-store' });
    if (response.status === 404) {
      uploadManifest = [];
    } else if (!response.ok) {
      throw new Error(`Не удалось прочитать список файлов (${response.status}).`);
    } else {
      const files = await response.json();
      if (!Array.isArray(files)) throw new Error('Список файлов в GitHub имеет неверный формат.');
      uploadManifest = files;
    }
    renderManifest(uploadManifest, ownerMode);
  }

  async function login(token) {
    const user = await responseJson(await apiFetch('/user', {}, token));
    if (user.login?.toLowerCase() !== config.ownerLogin.toLowerCase()) {
      throw new Error(`Войдите в GitHub под владельцем репозитория @${config.ownerLogin}.`);
    }
    const repository = await responseJson(await apiFetch(`/repos/${encodeURIComponent(config.owner)}/${encodeURIComponent(config.repository)}`, {}, token));
    if (repository.permissions?.push === false) {
      throw new Error('У токена нет права записи в этот репозиторий.');
    }

    const manifest = await getManifest(token);
    accessToken = token;
    uploadManifest = manifest.files;
    setAuthenticated(true, user.login);
    renderManifest(uploadManifest, true);
  }

  async function writeFile(file, type) {
    if (!accessToken) throw new Error('Сначала войдите в GitHub.');
    if (file.size > config.maxFileSize) throw new Error('Максимальный размер файла — 10 МБ.');
    const extension = file.name.toLowerCase().split('.').pop();
    if (!allowedExtensions[type]?.has(extension)) throw new Error('Этот формат файла не поддерживается.');
    const manifest = await getManifest();
    const safeName = file.name.replace(/[\\/]/g, '_');
    const path = `${config.uploadDirectory}/${type}/${Date.now()}-${crypto.randomUUID()}-${safeName}`;
    const uploaded = await putFile(file, path);
    const entry = { type, name: file.name, path, size: file.size, sha: uploaded.content.sha };

    try {
      await saveManifest([...manifest.files, entry], manifest.sha, `Опубликован файл: ${file.name}`);
    } catch (error) {
      try {
        await deleteFile(entry);
      } catch (rollbackError) {
        error.message += ' Не удалось отменить загрузку; файл сохранён в репозитории без записи в списке.';
        console.error('Ошибка отмены неудачной публикации файла:', rollbackError);
      }
      throw error;
    }

    uploadManifest = [...manifest.files, entry];
    renderManifest(uploadManifest, true);
    showStatus(`Файл «${file.name}» загружен в GitHub и опубликован.`);
  }

  async function handleFiles(files, type) {
    if (!accessToken) {
      showStatus('Для загрузки войдите в GitHub как владелец репозитория.');
      return;
    }
    for (const file of Array.from(files || [])) {
      try {
        await writeFile(file, type);
      } catch (error) {
        showStatus(`Не удалось загрузить «${file.name}»: ${error.message}`, error);
      }
    }
  }

  async function removeFromGitHub(file, item) {
    if (!accessToken) {
      showStatus('Для удаления войдите в GitHub как владелец репозитория.');
      return;
    }
    try {
      const manifest = await getManifest();
      const nextFiles = manifest.files.filter((entry) => entry.path !== file.path);
      await saveManifest(nextFiles, manifest.sha, `Удалён файл: ${file.name}`);
      try {
        await deleteFile(file);
      } catch (error) {
        try {
          const latest = await getManifest();
          await saveManifest([...latest.files, file], latest.sha, `Восстановлена запись файла: ${file.name}`);
        } catch (rollbackError) {
          error.message += ' Не удалось восстановить файл в списке; проверьте uploads.json в GitHub.';
          console.error('Ошибка восстановления манифеста после неудачного удаления:', rollbackError);
        }
        throw error;
      }
      uploadManifest = nextFiles;
      item.remove();
      showStatus(`Файл «${file.name}» удалён из GitHub.`);
    } catch (error) {
      showStatus(`Не удалось удалить «${file.name}»: ${error.message}`, error);
    }
  }

  form?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const token = tokenInput?.value.trim();
    if (!token) {
      showStatus('Вставьте GitHub fine-grained token.');
      return;
    }
    if (loginButton) loginButton.disabled = true;
    showStatus('Проверяю GitHub-аккаунт и права доступа...');
    try {
      await login(token);
    } catch (error) {
      accessToken = '';
      setAuthenticated(false);
      showStatus(`Не удалось войти: ${error.message}`, error);
    } finally {
      if (loginButton) loginButton.disabled = false;
    }
  });

  logoutButton?.addEventListener('click', () => {
    accessToken = '';
    setAuthenticated(false);
    showStatus('Вы вышли из GitHub.');
  });

  documentInput?.addEventListener('change', (event) => {
    handleFiles(event.currentTarget.files, 'documents');
    event.currentTarget.value = '';
  });
  certificateInput?.addEventListener('change', (event) => {
    handleFiles(event.currentTarget.files, 'certificates');
    event.currentTarget.value = '';
  });

  dropzone?.addEventListener('dragover', (event) => {
    event.preventDefault();
    dropzone.classList.add('is-dragover');
  });
  dropzone?.addEventListener('dragleave', () => dropzone.classList.remove('is-dragover'));
  dropzone?.addEventListener('drop', (event) => {
    event.preventDefault();
    dropzone.classList.remove('is-dragover');
    handleFiles(event.dataTransfer?.files, 'documents');
  });

  refreshManifest().catch((error) => showStatus(`Не удалось загрузить список файлов: ${error.message}`, error));
})();
