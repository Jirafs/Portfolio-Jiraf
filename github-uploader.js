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
  const groupSubjectSummary = document.querySelector('#group-subject-summary');
  let accessToken = '';
  let uploadManifest = [];
  let xlsxLibraryPromise;
  let pdfLibraryPromise;
  let summaryRenderId = 0;
  const summaryCache = new Map();
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

  function isManifestConflict(error) {
    return error.status === 409
      || (error.status === 422 && /does not match|sha/i.test(error.message));
  }

  async function updateManifest(updateFiles, message) {
    const maxAttempts = 3;
    for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
      const manifest = await getManifest();
      const nextFiles = updateFiles(manifest.files);
      if (JSON.stringify(nextFiles) === JSON.stringify(manifest.files)) return nextFiles;

      try {
        await saveManifest(nextFiles, manifest.sha, message);
        return nextFiles;
      } catch (error) {
        if (!isManifestConflict(error)) throw error;
        if (attempt === maxAttempts - 1) {
          error.message = `Список файлов несколько раз обновился одновременно. Обновите страницу и повторите действие. ${error.message}`;
          throw error;
        }
      }
    }
    throw new Error('Не удалось обновить список файлов после нескольких конфликтов.');
  }

  function encodePath(path) {
    return path.split('/').map(encodeURIComponent).join('/');
  }

  function publicFileUrl(path) {
    return `${rawRoot}/${encodePath(path)}`;
  }

  function githubPagesFileUrl(path) {
    return new URL(encodePath(path), config.pagesBaseUrl).href;
  }

  function publicFilePageUrl(path) {
    return `https://github.com/${encodeURIComponent(config.owner)}/${encodeURIComponent(config.repository)}/blob/${encodeURIComponent(config.branch)}/${encodePath(path)}`;
  }

  function fileViewUrl(file, rawUrl, extension) {
    if (['doc', 'docx', 'ppt', 'pptx', 'xls', 'xlsx'].includes(extension)) {
      return `https://view.officeapps.live.com/op/view.aspx?src=${encodeURIComponent(rawUrl)}`;
    }
    if (extension === 'pdf') {
      return githubPagesFileUrl(file.path);
    }
    if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'txt', 'md'].includes(extension)) {
      return rawUrl;
    }
    return publicFilePageUrl(file.path);
  }

  function loadXlsxLibrary() {
    if (window.XLSX) return Promise.resolve(window.XLSX);
    if (xlsxLibraryPromise) return xlsxLibraryPromise;

    xlsxLibraryPromise = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = 'https://cdn.sheetjs.com/xlsx-0.20.3/package/dist/xlsx.full.min.js';
      script.integrity = 'sha384-EnyY0/GSHQGSxSgMwaIPzSESbqoOLSexfnSMN2AP+39Ckmn92stwABZynq1JyzdT';
      script.crossOrigin = 'anonymous';
      script.async = true;
      script.onload = () => {
        if (window.XLSX) resolve(window.XLSX);
        else reject(new Error('Библиотека чтения Excel загрузилась без API XLSX.'));
      };
      script.onerror = () => reject(new Error('Не удалось загрузить библиотеку чтения Excel.'));
      document.head.append(script);
    });
    return xlsxLibraryPromise;
  }

  function loadPdfLibrary() {
    if (window.pdfjsLib) return Promise.resolve(window.pdfjsLib);
    if (pdfLibraryPromise) return pdfLibraryPromise;

    pdfLibraryPromise = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
      script.integrity = 'sha512-q+4liFwdPC/bNdhUpZx6aXDx/h77yEQtn4I1slHydcbZK34nLaR3cAeYSJshoxIOq3mjEf7xJE8YWIUHMn+oCQ==';
      script.crossOrigin = 'anonymous';
      script.async = true;
      script.onload = () => {
        if (!window.pdfjsLib) {
          pdfLibraryPromise = undefined;
          reject(new Error('Загрузилась библиотека PDF, но её API недоступно.'));
          return;
        }
        window.pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
        resolve(window.pdfjsLib);
      };
      script.onerror = () => {
        pdfLibraryPromise = undefined;
        reject(new Error('Не удалось загрузить библиотеку для просмотра PDF.'));
      };
      document.head.append(script);
    });
    return pdfLibraryPromise;
  }

  function cellText(value) {
    return value == null ? '' : String(value).trim();
  }

  function normalizedHeader(value) {
    return cellText(value).toLocaleLowerCase('ru-RU').replace(/ё/g, 'е').replace(/[^a-zа-я0-9]/g, '');
  }

  function groupSubjectsFromWorkbook(bytes) {
    const workbook = window.XLSX.read(bytes, { type: 'array', cellDates: false });
    const groupAliases = new Set(['группа', 'учебнаягруппа', 'названиегруппы', 'номергр', 'кодгруппы', 'group', 'class']);
    const subjectAliases = new Set(['предмет', 'дисциплина', 'наименованиепредмета', 'названиепредмета', 'учебныйпредмет', 'subject', 'course']);
    const excludedWideHeaders = /фио|студент|обучающ|фамил|имя|отчеств|оценк|балл|итого|всего|преподавател|семестр|курс|год|дат|номер|количество|час|код|№/i;
    const subjectsByGroup = new Map();

    function addSubject(group, subject) {
      const groupName = cellText(group);
      const subjectNames = cellText(subject).split(/[;\n|]+/).map((name) => name.trim()).filter(Boolean);
      if (!groupName || /^(итого|всего|total)$/i.test(groupName) || !subjectNames.length) return;
      if (!subjectsByGroup.has(groupName)) subjectsByGroup.set(groupName, new Set());
      subjectNames.forEach((name) => subjectsByGroup.get(groupName).add(name));
    }

    for (const sheetName of workbook.SheetNames) {
      const rows = window.XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { header: 1, defval: '', raw: false });
      const headerIndex = rows.slice(0, 30).findIndex((row) => {
        const headers = row.map(normalizedHeader);
        return headers.some((header) => groupAliases.has(header));
      });

      if (headerIndex >= 0) {
        const headers = rows[headerIndex].map(normalizedHeader);
        const groupColumn = headers.findIndex((header) => groupAliases.has(header));
        const subjectColumn = headers.findIndex((header) => subjectAliases.has(header));
        const rawHeaders = rows[headerIndex].map(cellText);
        let previousGroup = '';

        for (const row of rows.slice(headerIndex + 1)) {
          const group = cellText(row[groupColumn]) || previousGroup;
          if (cellText(row[groupColumn])) previousGroup = group;
          if (!group) continue;

          if (subjectColumn >= 0) {
            addSubject(group, row[subjectColumn]);
          } else {
            row.forEach((value, column) => {
              const subject = rawHeaders[column];
              if (column !== groupColumn && subject && !excludedWideHeaders.test(subject) && cellText(value)) {
                addSubject(group, subject);
              }
            });
          }
        }
        continue;
      }

      const matrixHeaderIndex = rows.slice(0, 30).findIndex((row) => {
        const headers = row.map(cellText);
        return headers.length > 1
          && subjectAliases.has(normalizedHeader(headers[0]))
          && headers.slice(1).some((header) => /^\d{3,6}[а-яa-z]?$/i.test(header));
      });
      if (matrixHeaderIndex < 0) continue;

      const headers = rows[matrixHeaderIndex].map(cellText);
      for (const row of rows.slice(matrixHeaderIndex + 1)) {
        const subject = cellText(row[0]);
        if (!subject) continue;
        headers.slice(1).forEach((group, index) => {
          if (cellText(row[index + 1])) addSubject(group, subject);
        });
      }
    }

    if (!subjectsByGroup.size) {
      throw new Error('Не найдены данные для сводки. Нужны столбцы «Группа» и «Предмет»/«Дисциплина» либо предметы в заголовках столбцов.');
    }
    return [...subjectsByGroup.entries()]
      .map(([group, subjects]) => ({ group, subjects: [...subjects].sort((a, b) => a.localeCompare(b, 'ru')) }))
      .sort((a, b) => a.group.localeCompare(b.group, 'ru', { numeric: true }));
  }

  async function extractGroupSubjects(file) {
    const xlsx = await loadXlsxLibrary();
    const bytes = await file.arrayBuffer();
    return groupSubjectsFromWorkbook(bytes);
  }

  function mergeGroupSubjects(files) {
    const merged = new Map();
    files.forEach((file) => {
      if (!Array.isArray(file.groupSubjects)) return;
      file.groupSubjects.forEach(({ group, subjects }) => {
        const groupName = cellText(group);
        if (!groupName || !Array.isArray(subjects)) return;
        if (!merged.has(groupName)) merged.set(groupName, new Set());
        subjects.map(cellText).filter(Boolean).forEach((subject) => merged.get(groupName).add(subject));
      });
    });
    return [...merged.entries()]
      .map(([group, subjects]) => ({ group, subjects: [...subjects].sort((a, b) => a.localeCompare(b, 'ru')) }))
      .sort((a, b) => a.group.localeCompare(b.group, 'ru', { numeric: true }));
  }

  function renderGroupSubjectTable(groups, errors) {
    if (!groupSubjectSummary) return;
    groupSubjectSummary.replaceChildren();

    if (!groups.length) {
      const message = document.createElement('p');
      message.className = 'group-subject-empty';
      message.textContent = errors.length
        ? `Не удалось построить сводку: ${errors.join(' ')}`
        : 'Сводка появится после загрузки Excel-таблицы с группами и предметами.';
      groupSubjectSummary.append(message);
      return;
    }

    const wrapper = document.createElement('div');
    wrapper.className = 'group-subject-table-wrap';
    const table = document.createElement('table');
    table.className = 'group-subject-table';
    table.setAttribute('aria-label', 'Сводка учебных предметов по группам из Excel');
    const head = document.createElement('thead');
    const heading = document.createElement('tr');
    ['Группа', 'Предметы'].forEach((label) => {
      const cell = document.createElement('th');
      cell.scope = 'col';
      cell.textContent = label;
      heading.append(cell);
    });
    head.append(heading);
    const body = document.createElement('tbody');
    groups.forEach(({ group, subjects }) => {
      const row = document.createElement('tr');
      const groupCell = document.createElement('th');
      groupCell.scope = 'row';
      groupCell.textContent = group;
      const subjectsCell = document.createElement('td');
      subjectsCell.textContent = subjects.join(', ');
      row.append(groupCell, subjectsCell);
      body.append(row);
    });
    table.append(head, body);
    wrapper.append(table);
    groupSubjectSummary.append(wrapper);

    if (errors.length) {
      const note = document.createElement('p');
      note.className = 'group-subject-empty';
      note.textContent = `Некоторые таблицы не вошли в сводку: ${errors.join(' ')}`;
      groupSubjectSummary.append(note);
    }
  }

  async function loadLegacyGroupSubjects(file) {
    if (summaryCache.has(file.path)) return summaryCache.get(file.path);
    const request = (async () => {
      const response = await fetch(githubPagesFileUrl(file.path), { cache: 'no-store' });
      if (!response.ok) throw new Error(`не удалось открыть ${file.name} (${response.status})`);
      return extractGroupSubjects(new File([await response.arrayBuffer()], file.name));
    })();
    summaryCache.set(file.path, request);
    return request;
  }

  async function renderGroupSubjectSummary(files) {
    if (!groupSubjectSummary) return;
    const renderId = ++summaryRenderId;
    const spreadsheets = files.filter((file) => /\.(xlsx|xls)$/i.test(file.name));
    if (!spreadsheets.length) {
      renderGroupSubjectTable([], []);
      return;
    }

    groupSubjectSummary.textContent = 'Формирую сводку из Excel…';
    const errors = [];
    for (const file of spreadsheets) {
      if (Array.isArray(file.groupSubjects)) continue;
      try {
        file.groupSubjects = await loadLegacyGroupSubjects(file);
      } catch (error) {
        errors.push(`${file.name}: ${error.message}`);
      }
      if (renderId !== summaryRenderId) return;
    }
    if (renderId !== summaryRenderId) return;
    renderGroupSubjectTable(mergeGroupSubjects(spreadsheets), errors);
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

  function createPreview(file, url, extension) {
    const preview = document.createElement('div');
    preview.className = 'upload-preview';
    preview.hidden = true;

    if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(extension)) {
      const image = document.createElement('img');
      image.alt = `Предпросмотр файла ${file.name}`;
      image.loading = 'lazy';
      image.hidden = true;
      preview.append(image);
      return { element: preview, open: () => { image.src = url; } };
    }

    const frame = document.createElement('iframe');
    frame.className = 'upload-preview-frame';
    frame.title = `Предпросмотр файла ${file.name}`;
    frame.loading = 'lazy';
    frame.referrerPolicy = 'no-referrer';

    if (extension === 'pdf') {
      const pagesUrl = githubPagesFileUrl(file.path);
      const toolbar = document.createElement('div');
      toolbar.className = 'pdf-preview-toolbar';
      const previousButton = document.createElement('button');
      previousButton.type = 'button';
      previousButton.textContent = 'Предыдущая';
      previousButton.disabled = true;
      const pageLabel = document.createElement('span');
      pageLabel.className = 'pdf-preview-page';
      pageLabel.textContent = 'Загрузка PDF…';
      const nextButton = document.createElement('button');
      nextButton.type = 'button';
      nextButton.textContent = 'Следующая';
      nextButton.disabled = true;
      const message = document.createElement('p');
      message.className = 'pdf-preview-message';
      message.setAttribute('role', 'status');
      const openLink = document.createElement('a');
      openLink.href = pagesUrl;
      openLink.target = '_blank';
      openLink.rel = 'noopener noreferrer';
      openLink.textContent = 'Открыть PDF отдельно';
      openLink.hidden = true;
      const canvas = document.createElement('canvas');
      canvas.className = 'pdf-preview-canvas';
      canvas.setAttribute('aria-label', `Страница PDF: ${file.name}`);
      toolbar.append(previousButton, pageLabel, nextButton);
      preview.append(toolbar, message, openLink, canvas);

      let pdfDocument;
      let pdfLoadPromise;
      let currentPage = 1;
      let rendering = false;
      let renderPending = false;

      async function renderPage() {
        if (!pdfDocument || rendering) {
          renderPending = Boolean(pdfDocument);
          return;
        }
        rendering = true;
        renderPending = false;
        previousButton.disabled = currentPage <= 1;
        nextButton.disabled = currentPage >= pdfDocument.numPages;
        pageLabel.textContent = `Страница ${currentPage} из ${pdfDocument.numPages}`;
        message.textContent = 'Отрисовка страницы…';
        try {
          const page = await pdfDocument.getPage(currentPage);
          const baseViewport = page.getViewport({ scale: 1 });
          const availableWidth = Math.max(280, preview.clientWidth - 24);
          const scale = Math.min(1.75, availableWidth / baseViewport.width);
          const viewport = page.getViewport({ scale });
          const outputScale = Math.min(window.devicePixelRatio || 1, 2);
          const context = canvas.getContext('2d');
          canvas.width = Math.floor(viewport.width * outputScale);
          canvas.height = Math.floor(viewport.height * outputScale);
          canvas.style.width = `${Math.floor(viewport.width)}px`;
          canvas.style.height = `${Math.floor(viewport.height)}px`;
          await page.render({
            canvasContext: context,
            viewport,
            transform: outputScale === 1 ? null : [outputScale, 0, 0, outputScale, 0, 0]
          }).promise;
          message.textContent = '';
        } catch (error) {
          message.textContent = `Не удалось отобразить страницу PDF: ${error.message}`;
          console.error(`Ошибка предпросмотра PDF «${file.name}»:`, error);
        } finally {
          rendering = false;
          if (renderPending) renderPage();
        }
      }

      previousButton.addEventListener('click', () => {
        if (currentPage > 1) {
          currentPage -= 1;
          renderPage();
        }
      });
      nextButton.addEventListener('click', () => {
        if (pdfDocument && currentPage < pdfDocument.numPages) {
          currentPage += 1;
          renderPage();
        }
      });
      window.addEventListener('resize', renderPage);

      return {
        element: preview,
        open: () => {
          if (pdfDocument || pdfLoadPromise) return pdfLoadPromise;
          message.textContent = 'Загрузка PDF…';
          pdfLoadPromise = (async () => {
            try {
              const [pdfjsLib, response] = await Promise.all([
                loadPdfLibrary(),
                fetch(pagesUrl, { cache: 'no-store' })
              ]);
              if (!response.ok) throw new Error(`Не удалось загрузить файл (${response.status}).`);
              pdfDocument = await pdfjsLib.getDocument({ data: await response.arrayBuffer() }).promise;
              previousButton.disabled = false;
              nextButton.disabled = false;
              await renderPage();
            } catch (error) {
              pdfLoadPromise = undefined;
              message.textContent = `Не удалось открыть PDF: ${error.message}`;
              openLink.hidden = false;
              console.error(`Ошибка загрузки PDF «${file.name}»:`, error);
            }
          })();
          return pdfLoadPromise;
        }
      };
    } else if (extension === 'txt' || extension === 'md') {
      frame.src = url;
    } else if (['doc', 'docx', 'ppt', 'pptx', 'xls', 'xlsx'].includes(extension)) {
      frame.src = `https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(url)}`;
    } else {
      return null;
    }

    preview.append(frame);
    return { element: preview, open() {} };
  }

  function renderFile(file, type, list, ownerMode) {
    const item = document.createElement('li');
    item.className = 'upload-item';
    const content = document.createElement('div');
    content.className = 'document-content';
    const link = document.createElement('a');
    const url = publicFileUrl(file.path);
    const extension = file.name.toLowerCase().split('.').pop();
    link.href = fileViewUrl(file, url, extension);
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    link.textContent = `${file.name} (${formatSize(file.size)})`;
    content.append(link);

    const preview = createPreview(file, url, extension);
    if (preview) {
      const togglePreview = document.createElement('button');
      togglePreview.className = 'document-preview-toggle';
      togglePreview.type = 'button';
      togglePreview.textContent = 'Просмотреть на странице';
      togglePreview.setAttribute('aria-expanded', 'false');
      togglePreview.addEventListener('click', () => {
        const isOpening = preview.element.hidden;
        preview.element.hidden = !isOpening;
        togglePreview.setAttribute('aria-expanded', String(isOpening));
        togglePreview.textContent = isOpening ? 'Скрыть просмотр' : 'Просмотреть на странице';
        if (isOpening) preview.open();
      });
      content.append(togglePreview, preview.element);
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
    renderGroupSubjectSummary(files);
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
    let groupSubjects;
    let summaryWarning = '';
    if (extension === 'xlsx' || extension === 'xls') {
      try {
        groupSubjects = await extractGroupSubjects(file);
      } catch (error) {
        summaryWarning = ` Файл сохранён, но сводка не сформирована: ${error.message}`;
        console.error(`Не удалось сформировать сводку из ${file.name}:`, error);
      }
    }
    const safeName = file.name.replace(/[\\/]/g, '_');
    const path = `${config.uploadDirectory}/${type}/${Date.now()}-${crypto.randomUUID()}-${safeName}`;
    const uploaded = await putFile(file, path);
    const entry = { type, name: file.name, path, size: file.size, sha: uploaded.content.sha };
    if (groupSubjects) entry.groupSubjects = groupSubjects;
    let nextFiles;

    try {
      nextFiles = await updateManifest(
        (files) => files.some((item) => item.path === path) ? files : [...files, entry],
        `Опубликован файл: ${file.name}`
      );
    } catch (error) {
      try {
        await deleteFile(entry);
      } catch (rollbackError) {
        error.message += ' Не удалось отменить загрузку; файл сохранён в репозитории без записи в списке.';
        console.error('Ошибка отмены неудачной публикации файла:', rollbackError);
      }
      throw error;
    }

    uploadManifest = nextFiles;
    renderManifest(uploadManifest, true);
    showStatus(`Файл «${file.name}» загружен в GitHub и опубликован.${summaryWarning}`);
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
      const nextFiles = await updateManifest(
        (files) => files.filter((entry) => entry.path !== file.path),
        `Удалён файл: ${file.name}`
      );
      try {
        await deleteFile(file);
      } catch (error) {
        try {
          await updateManifest(
            (files) => files.some((entry) => entry.path === file.path) ? files : [...files, file],
            `Восстановлена запись файла: ${file.name}`
          );
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
