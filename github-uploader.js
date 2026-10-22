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
  const certificateDropzone = document.querySelector('#certificate-dropzone');
  const studentCertificateStatus = document.querySelector('#student-certificate-status');
  const studentCertificateForm = document.querySelector('#student-certificate-form');
  const studentCertificateFileInput = document.querySelector('#student-certificate-file');
  const studentCertificateSearch = document.querySelector('#student-certificate-search');
  const studentCertificateGroupFilter = document.querySelector('#student-certificate-group-filter');
  const groupExcelInput = document.querySelector('#group-excel-input');
  const groupExcelList = document.querySelector('#group-excel-list');
  const groupExcelStatus = document.querySelector('#group-excel-status');
  const groupExcelDropzone = document.querySelector('#group-excel-dropzone');
  const dropzone = document.querySelector('#upload-dropzone');
  const documentList = document.querySelector('#upload-list');
  const certificateList = document.querySelector('#certificate-list');
  const materialSearch = document.querySelector('#material-search');
  const materialCategoryFilter = document.querySelector('#material-category-filter');
  const materialTypeFilter = document.querySelector('#material-type-filter');
  const materialResultsCount = document.querySelector('#material-results-count');
  const materialEmpty = document.querySelector('#material-empty');
  const materialSort = document.querySelector('#material-sort');
  const materialReset = document.querySelector('#material-reset');
  const documentCategory = document.querySelector('#document-category');
  const announcementList = document.querySelector('#announcement-list');
  const announcementStatus = document.querySelector('#announcement-status');
  const announcementForm = document.querySelector('#announcement-form');
  const groupSubjectSummary = document.querySelector('#group-subject-summary');
  const groupAttendanceSummary = document.querySelector('#group-attendance-summary');
  const performanceTableBody = document.querySelector('#performance-table-body');
  const performanceTableFoot = document.querySelector('#performance-table-foot');
  const performanceChartDetails = document.querySelector('#performance-chart-details');
  const performanceChart = document.querySelector('#performance-chart');
  const performanceAddButton = document.querySelector('#performance-add-group');
  const performanceActionsHeading = document.querySelector('#performance-actions-heading');
  const performanceStatus = document.querySelector('#performance-status');
  const groupAttendanceStatus = document.querySelector('#group-attendance-status');
  let accessToken = '';
  let uploadManifest = [];
  let manifestVersion = 0;
  let announcements = [];
  let groupPerformance = [];
  let editingPerformanceGroup = null;
  let addingPerformanceGroup = false;
  let editingPerformanceDraft = null;
  let savingPerformance = false;
  let attendanceSummaries = [];
  let studentCertificates = [];
  let xlsxLibraryPromise;
  let pdfLibraryPromise;
  let summaryRenderId = 0;
  const summaryCache = new Map();
  const allowedExtensions = {
    documents: new Set(['pdf', 'doc', 'docx', 'txt', 'ppt', 'pptx', 'xls', 'xlsx', 'odt', 'rtf', 'md']),
    certificates: new Set(['jpg', 'jpeg', 'png', 'gif', 'webp', 'pdf']),
    'student-certificates': new Set(['jpg', 'jpeg', 'png', 'gif', 'webp', 'pdf']),
    'group-data': new Set(['xls', 'xlsx', 'pdf'])
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

  function showToast(message, type = 'success') {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = message;

    container.appendChild(toast);

    setTimeout(() => {
      toast.classList.add('toast-show');
    }, 10);

    setTimeout(() => {
      toast.classList.remove('toast-show');
      setTimeout(() => toast.remove(), 300);
    }, 3000);
  }

  function showLoading(show = true) {
    const overlay = document.getElementById('loading-overlay');
    if (overlay) overlay.hidden = !show;
  }

  function setAuthenticated(isAuthenticated, login = '') {
    document.body.classList.toggle('github-authenticated', isAuthenticated);
    if (form) form.hidden = isAuthenticated;
    if (logoutButton) logoutButton.hidden = !isAuthenticated;
    if (dropzone) dropzone.hidden = !isAuthenticated;
    if (groupExcelDropzone) groupExcelDropzone.hidden = !isAuthenticated;
    if (certificateDropzone) certificateDropzone.hidden = !isAuthenticated;
    if (studentCertificateForm) studentCertificateForm.hidden = !isAuthenticated;
    if (performanceAddButton) performanceAddButton.hidden = !isAuthenticated;
    if (performanceActionsHeading) performanceActionsHeading.hidden = !isAuthenticated;
    if (announcementForm) announcementForm.hidden = !isAuthenticated;
    if (tokenInput) tokenInput.value = '';
    renderGroupPerformance();
    renderAnnouncements(isAuthenticated);
    renderStudentCertificates();
    if (isAuthenticated) showStatus(`Вход выполнен как @${login}. Токен хранится только в этой вкладке.`);
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

  function validateGroupPerformance(groups) {
    if (!Array.isArray(groups)) throw new Error('Сводка по группам в GitHub имеет неверный формат.');
    const names = new Set();
    groups.forEach((item) => {
      if (!item || typeof item.group !== 'string' || !item.group.trim()
        || (item.subject != null && typeof item.subject !== 'string')
        || !Number.isInteger(item.students) || item.students < 1
        || !['success', 'quality', 'average'].every((key) => Number.isFinite(item[key]))
        || item.success < 0 || item.success > 100
        || item.quality < 0 || item.quality > 100
        || (item.trained != null && (!Number.isFinite(item.trained) || item.trained < 0 || item.trained > 100))
        || item.average < 0 || item.average > 5) {
        throw new Error('В сводке найдена группа с неверными показателями.');
      }
      const key = performanceKey(item.group, item.subject);
      if (names.has(key)) throw new Error(`Группа «${item.group}» с этим предметом повторяется в сводке.`);
      names.add(key);
    });
    return groups.map((item) => ({ ...item, subject: item.subject?.trim() || '', trained: item.trained ?? null }));
  }

  function performanceKey(group, subject = '') {
    return `${group.trim().toLocaleLowerCase('ru-RU')}\u0000${(subject || '').trim().toLocaleLowerCase('ru-RU')}`;
  }

  function decodeBase64Json(content) {
    const bytes = Uint8Array.from(atob(content.replace(/\s/g, '')), (character) => character.charCodeAt(0));
    return JSON.parse(new TextDecoder().decode(bytes));
  }

  async function getGroupPerformance(token = accessToken) {
    const path = encodePath(config.groupPerformanceFile);
    const response = await apiFetch(`${apiRoot}/contents/${path}?ref=${encodeURIComponent(config.branch)}`, {}, token);
    if (response.status === 404) return { sha: null, groups: [] };
    const data = await responseJson(response);
    return { sha: data.sha, groups: validateGroupPerformance(decodeBase64Json(data.content)) };
  }

  async function refreshGroupPerformance() {
    const response = await fetch(`${rawRoot}/${encodePath(config.groupPerformanceFile)}?t=${Date.now()}`, { cache: 'no-store' });
    if (!response.ok) throw new Error(`Не удалось загрузить сводку по группам (${response.status}).`);
    groupPerformance = validateGroupPerformance(await response.json());
    renderGroupPerformance();
  }

  async function updateGroupPerformance(updateGroups, message) {
    const maxAttempts = 3;
    for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
      const current = await getGroupPerformance();
      const nextGroups = validateGroupPerformance(updateGroups(current.groups));
      const bytes = new TextEncoder().encode(JSON.stringify(nextGroups, null, 2) + '\n');
      let binary = '';
      for (let offset = 0; offset < bytes.length; offset += 0x8000) {
        binary += String.fromCharCode(...bytes.subarray(offset, offset + 0x8000));
      }
      const body = { message, content: btoa(binary), branch: config.branch };
      if (current.sha) body.sha = current.sha;

      try {
        const response = await apiFetch(`${apiRoot}/contents/${encodePath(config.groupPerformanceFile)}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body)
        });
        await responseJson(response);
        return nextGroups;
      } catch (error) {
        if (!isManifestConflict(error)) throw error;
        if (attempt === maxAttempts - 1) {
          error.message = `Сводка несколько раз обновилась одновременно. Обновите страницу и повторите действие. ${error.message}`;
          throw error;
        }
      }
    }
    throw new Error('Не удалось обновить сводку после нескольких конфликтов.');
  }

  function validateGroupAttendance(summaries) {
    if (!Array.isArray(summaries)) throw new Error('Сводка посещаемости в GitHub имеет неверный формат.');
    summaries.forEach((item) => {
      if (!item || typeof item.group !== 'string' || !item.group.trim()
        || typeof item.subject !== 'string' || !item.subject.trim()
        || (item.period != null && typeof item.period !== 'string')
        || !Number.isInteger(item.studentCount) || item.studentCount < 1
        || !Number.isInteger(item.sessionCount) || item.sessionCount < 1
        || !Number.isInteger(item.dateCount) || item.dateCount < 1
        || !Number.isInteger(item.absenceCount) || item.absenceCount < 0
        || !Number.isFinite(item.attendancePercent) || item.attendancePercent < 0 || item.attendancePercent > 100) {
        throw new Error('В сводке посещаемости найдена запись с неверными показателями.');
      }
    });
    return summaries;
  }

  async function getGroupAttendance(token = accessToken) {
    const path = encodePath(config.groupAttendanceFile);
    const response = await apiFetch(`${apiRoot}/contents/${path}?ref=${encodeURIComponent(config.branch)}`, {}, token);
    if (response.status === 404) return { sha: null, summaries: [] };
    const data = await responseJson(response);
    return { sha: data.sha, summaries: validateGroupAttendance(decodeBase64Json(data.content)) };
  }

  async function refreshGroupAttendance() {
    const response = await fetch(`${rawRoot}/${encodePath(config.groupAttendanceFile)}?t=${Date.now()}`, { cache: 'no-store' });
    if (response.status === 404) {
      attendanceSummaries = [];
    } else if (!response.ok) {
      throw new Error(`Не удалось загрузить сводку посещаемости (${response.status}).`);
    } else {
      attendanceSummaries = validateGroupAttendance(await response.json());
    }
    renderGroupAttendanceSummary();
  }

  function validateAnnouncements(items) {
    if (!Array.isArray(items)) throw new Error('Список объявлений в GitHub имеет неверный формат.');
    items.forEach((item) => {
      const date = typeof item?.date === 'string' ? new Date(`${item.date}T00:00:00Z`) : null;
      if (!item || typeof item.id !== 'string' || !item.id.trim()
        || typeof item.title !== 'string' || !item.title.trim() || item.title.length > 100
        || typeof item.message !== 'string' || !item.message.trim() || item.message.length > 1000
        || !date || Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== item.date) {
        throw new Error('В списке объявлений найдена запись с неверными данными.');
      }
    });
    return items;
  }

  function validateStudentCertificates(items) {
    if (!Array.isArray(items)) throw new Error('Список сертификатов студентов в GitHub имеет неверный формат.');
    items.forEach((item) => {
      if (!item || typeof item.id !== 'string' || !item.id.trim()
        || typeof item.studentName !== 'string' || !item.studentName.trim() || item.studentName.length > 200
        || typeof item.group !== 'string' || !item.group.trim() || item.group.length > 50
        || typeof item.achievement !== 'string' || !item.achievement.trim() || item.achievement.length > 200
        || typeof item.date !== 'string' || !item.date.trim()
        || (item.filePath != null && typeof item.filePath !== 'string')) {
        throw new Error('В списке сертификатов студентов найдена запись с неверными данными.');
      }
    });
    return items;
  }

  function todayIsoDate() {
    const now = new Date();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${now.getFullYear()}-${month}-${day}`;
  }

  function renderUpcomingDates() {
    const upcomingList = document.querySelector('#upcoming-dates');
    const upcomingEmpty = document.querySelector('#upcoming-dates-empty');
    if (!upcomingList) return;

    const today = todayIsoDate();
    const upcoming = [...announcements]
      .filter((item) => item.date >= today)
      .sort((a, b) => a.date.localeCompare(b.date))
      .slice(0, 5);

    upcomingList.replaceChildren();
    upcoming.forEach((announcement) => {
      const item = document.createElement('a');
      item.className = 'upcoming-date-item';
      item.href = '#announcements';
      const date = document.createElement('time');
      date.dateTime = announcement.date;
      date.textContent = new Date(`${announcement.date}T00:00:00`).toLocaleDateString('ru-RU', {
        day: 'numeric',
        month: 'long'
      });
      const title = document.createElement('strong');
      title.textContent = announcement.title;
      item.append(date, title);
      upcomingList.append(item);
    });

    if (upcomingEmpty) upcomingEmpty.hidden = upcoming.length > 0;
  }

  function renderAnnouncements(ownerMode = Boolean(accessToken)) {
    if (!announcementList) return;
    announcementList.replaceChildren();
    const today = todayIsoDate();
    const sorted = [...announcements].sort((a, b) => b.date.localeCompare(a.date));
    sorted.forEach((announcement) => {
      const item = document.createElement('article');
      item.className = 'announcement-item';
      if (announcement.date >= today) item.classList.add('is-upcoming');
      const heading = document.createElement('div');
      heading.className = 'announcement-heading';
      const title = document.createElement('h3');
      title.textContent = announcement.title;
      heading.append(title);
      if (announcement.date >= today) {
        const badge = document.createElement('span');
        badge.className = 'announcement-badge';
        badge.textContent = 'Скоро';
        heading.append(badge);
      }
      if (ownerMode) {
        const remove = document.createElement('button');
        remove.className = 'announcement-remove';
        remove.type = 'button';
        remove.textContent = 'Удалить';
        remove.setAttribute('aria-label', `Удалить объявление «${announcement.title}»`);
        remove.addEventListener('click', () => removeAnnouncement(announcement, remove));
        heading.append(remove);
      }
      const date = document.createElement('time');
      date.className = 'announcement-date';
      date.dateTime = announcement.date;
      date.textContent = new Date(`${announcement.date}T00:00:00`).toLocaleDateString('ru-RU');
      const message = document.createElement('p');
      message.className = 'announcement-message';
      message.textContent = announcement.message;
      item.append(heading, date, message);
      announcementList.append(item);
    });
    if (announcementStatus) {
      announcementStatus.hidden = sorted.length > 0;
      announcementStatus.textContent = 'Объявлений пока нет.';
    }
    renderUpcomingDates();
  }

  async function getAnnouncements(token = accessToken) {
    const path = encodePath(config.announcementsFile);
    const response = await apiFetch(`${apiRoot}/contents/${path}?ref=${encodeURIComponent(config.branch)}`, {}, token);
    if (response.status === 404) return { sha: null, items: [] };
    const data = await responseJson(response);
    return { sha: data.sha, items: validateAnnouncements(decodeBase64Json(data.content)) };
  }

  async function refreshAnnouncements() {
    const response = await fetch(`${rawRoot}/${encodePath(config.announcementsFile)}?t=${Date.now()}`, { cache: 'no-store' });
    if (response.status === 404) {
      announcements = [];
    } else if (!response.ok) {
      throw new Error(`Не удалось загрузить объявления (${response.status}).`);
    } else {
      announcements = validateAnnouncements(await response.json());
    }
    renderAnnouncements();
  }

  async function updateAnnouncements(updateItems, message) {
    const maxAttempts = 3;
    for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
      const current = await getAnnouncements();
      const nextItems = validateAnnouncements(updateItems(current.items));
      const bytes = new TextEncoder().encode(JSON.stringify(nextItems, null, 2) + '\n');
      let binary = '';
      for (let offset = 0; offset < bytes.length; offset += 0x8000) {
        binary += String.fromCharCode(...bytes.subarray(offset, offset + 0x8000));
      }
      try {
        const response = await apiFetch(`${apiRoot}/contents/${encodePath(config.announcementsFile)}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            message,
            content: btoa(binary),
            branch: config.branch,
            ...(current.sha ? { sha: current.sha } : {})
          })
        });
        await responseJson(response);
        return nextItems;
      } catch (error) {
        if (!isManifestConflict(error)) throw error;
        if (attempt === maxAttempts - 1) {
          error.message = `Объявления несколько раз обновились одновременно. Обновите страницу и повторите действие. ${error.message}`;
          throw error;
        }
      }
    }
    throw new Error('Не удалось обновить объявления после нескольких конфликтов.');
  }

  async function getStudentCertificates(token = accessToken) {
    const path = encodePath(config.studentCertificatesFile);
    const response = await apiFetch(`${apiRoot}/contents/${path}?ref=${encodeURIComponent(config.branch)}`, {}, token);
    if (response.status === 404) return { sha: null, items: [] };
    const data = await responseJson(response);
    return { sha: data.sha, items: validateStudentCertificates(decodeBase64Json(data.content)) };
  }

  async function refreshStudentCertificates() {
    const response = await fetch(`${rawRoot}/${encodePath(config.studentCertificatesFile)}?t=${Date.now()}`, { cache: 'no-store' });
    if (response.status === 404) {
      studentCertificates = [];
    } else if (!response.ok) {
      throw new Error(`Не удалось загрузить сертификаты студентов (${response.status}).`);
    } else {
      studentCertificates = validateStudentCertificates(await response.json());
    }
    renderStudentCertificates();
  }

  async function updateStudentCertificates(updateItems, message) {
    const maxAttempts = 3;
    for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
      const current = await getStudentCertificates();
      const nextItems = validateStudentCertificates(updateItems(current.items));
      const bytes = new TextEncoder().encode(JSON.stringify(nextItems, null, 2) + '\n');
      let binary = '';
      for (let offset = 0; offset < bytes.length; offset += 0x8000) {
        binary += String.fromCharCode(...bytes.subarray(offset, offset + 0x8000));
      }
      try {
        const response = await apiFetch(`${apiRoot}/contents/${encodePath(config.studentCertificatesFile)}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            message,
            content: btoa(binary),
            branch: config.branch,
            ...(current.sha ? { sha: current.sha } : {})
          })
        });
        await responseJson(response);
        return nextItems;
      } catch (error) {
        if (!isManifestConflict(error)) throw error;
        if (attempt === maxAttempts - 1) {
          error.message = `Сертификаты студентов несколько раз обновились одновременно. Обновите страницу и повторите действие. ${error.message}`;
          throw error;
        }
      }
    }
    throw new Error('Не удалось обновить сертификаты студентов после нескольких конфликтов.');
  }

  async function removeAnnouncement(announcement, button) {
    if (!accessToken || !window.confirm(`Удалить объявление «${announcement.title}»?`)) return;
    button.disabled = true;
    try {
      announcements = await updateAnnouncements(
        (items) => items.filter((item) => item.id !== announcement.id),
        `Удалено объявление: ${announcement.title}`
      );
      renderAnnouncements(true);
    } catch (error) {
      button.disabled = false;
      if (announcementStatus) {
        announcementStatus.hidden = false;
        announcementStatus.textContent = `Не удалось удалить объявление: ${error.message}`;
      }
      console.error('Не удалось удалить объявление:', error);
    }
  }

  function renderStudentCertificates() {
    const list = document.querySelector('#student-certificate-list');
    const status = document.querySelector('#student-certificate-status');
    const empty = document.querySelector('#student-certificate-empty');
    const count = document.querySelector('#student-certificate-count');
    const groupFilter = document.querySelector('#student-certificate-group-filter');
    if (!list) return;
    list.replaceChildren();
    const ownerMode = Boolean(accessToken);
    const searchQuery = studentCertificateSearch?.value.trim().toLocaleLowerCase('ru-RU') || '';
    const selectedGroup = groupFilter?.value || 'all';

    // Update group filter options
    if (groupFilter) {
      const currentOptions = [...groupFilter.options].map(opt => opt.value);
      const allGroups = [...new Set(studentCertificates.map(c => c.group.trim()))].sort((a, b) => a.localeCompare(b, 'ru'));
      allGroups.forEach(group => {
        if (!currentOptions.includes(group)) {
          const option = document.createElement('option');
          option.value = group;
          option.textContent = group;
          groupFilter.appendChild(option);
        }
      });
    }

    const filtered = [...studentCertificates]
      .sort((a, b) => b.date.localeCompare(a.date))
      .filter(cert => {
        const matchesSearch = !searchQuery || cert.studentName.toLocaleLowerCase('ru-RU').includes(searchQuery);
        const matchesGroup = selectedGroup === 'all' || cert.group === selectedGroup;
        return matchesSearch && matchesGroup;
      });

    filtered.forEach((certificate) => {
      const item = document.createElement('article');
      item.className = 'student-certificate-item';
      const heading = document.createElement('div');
      heading.className = 'student-certificate-heading';
      const studentName = document.createElement('h3');
      studentName.textContent = certificate.studentName;
      heading.append(studentName);
      if (ownerMode) {
        const editButton = document.createElement('button');
        editButton.className = 'student-certificate-edit';
        editButton.type = 'button';
        editButton.textContent = 'Изменить';
        editButton.setAttribute('aria-label', `Изменить сертификат студента «${certificate.studentName}»`);
        editButton.addEventListener('click', () => editStudentCertificate(certificate, editButton));
        const remove = document.createElement('button');
        remove.className = 'student-certificate-remove';
        remove.type = 'button';
        remove.textContent = 'Удалить';
        remove.setAttribute('aria-label', `Удалить сертификат студента «${certificate.studentName}»`);
        remove.addEventListener('click', () => removeStudentCertificate(certificate, remove));
        heading.append(editButton, remove);
      }
      const meta = document.createElement('div');
      meta.className = 'student-certificate-meta';
      const group = document.createElement('span');
      group.className = 'student-certificate-group';
      group.textContent = certificate.group;
      const date = document.createElement('time');
      date.className = 'student-certificate-date';
      date.dateTime = certificate.date;
      date.textContent = new Date(`${certificate.date}T00:00:00`).toLocaleDateString('ru-RU');
      meta.append(group, date);
      const achievement = document.createElement('p');
      achievement.className = 'student-certificate-achievement';
      achievement.textContent = certificate.achievement;
      item.append(heading, meta, achievement);

      // Add file link if exists
      if (certificate.filePath) {
        const fileLink = document.createElement('a');
        fileLink.className = 'student-certificate-file-link';
        fileLink.href = publicFileUrl(certificate.filePath);
        fileLink.target = '_blank';
        fileLink.rel = 'noopener noreferrer';
        fileLink.textContent = '📄 Открыть файл сертификата';
        item.append(fileLink);
      }

      list.append(item);
    });

    if (status) {
      status.hidden = studentCertificates.length > 0;
      status.textContent = 'Сертификаты студентов появятся здесь после публикации владельцем сайта.';
    }

    if (empty) {
      empty.hidden = filtered.length > 0 || studentCertificates.length === 0;
    }

    if (count) {
      count.textContent = filtered.length > 0
        ? `Показано ${filtered.length} из ${studentCertificates.length} сертификатов`
        : '';
    }
  }

  async function removeStudentCertificate(certificate, button) {
    if (!accessToken || !window.confirm(`Удалить сертификат студента «${certificate.studentName}»?`)) return;
    button.disabled = true;
    showLoading(true);
    try {
      studentCertificates = await updateStudentCertificates(
        (items) => items.filter((item) => item.id !== certificate.id),
        `Удалён сертификат студента: ${certificate.studentName}`
      );
      // Delete file if exists
      if (certificate.filePath) {
        try {
          await deleteFile({ path: certificate.filePath, sha: certificate.fileSha });
        } catch (fileError) {
          console.warn('Не удалось удалить файл сертификата:', fileError);
        }
      }

      renderStudentCertificates();
      showToast('Сертификат студента удалён', 'success');
    } catch (error) {
      button.disabled = false;
      const status = document.querySelector('#student-certificate-status');
      if (status) {
        status.hidden = false;
        status.textContent = `Не удалось удалить сертификат: ${error.message}`;
      }
      showToast('Не удалось удалить сертификат', 'error');
      console.error('Не удалось удалить сертификат студента:', error);
    } finally {
      showLoading(false);
    }
  }

  function editStudentCertificate(certificate, button) {
    if (!accessToken) return;
    const form = document.querySelector('#student-certificate-form');
    if (!form) return;

    form.scrollIntoView({ behavior: 'smooth', block: 'center' });

    document.querySelector('#student-name').value = certificate.studentName;
    document.querySelector('#student-group').value = certificate.group;
    document.querySelector('#student-achievement').value = certificate.achievement;
    document.querySelector('#student-date').value = certificate.date;

    const submitButton = form.querySelector('button[type="submit"]');
    submitButton.textContent = 'Сохранить изменения';
    submitButton.dataset.editingId = certificate.id;

    const cancelButton = document.createElement('button');
    cancelButton.type = 'button';
    cancelButton.className = 'btn btn-secondary';
    cancelButton.textContent = 'Отмена';
    cancelButton.style.marginLeft = '10px';
    cancelButton.addEventListener('click', () => {
      form.reset();
      submitButton.textContent = 'Добавить сертификат';
      delete submitButton.dataset.editingId;
      cancelButton.remove();
    });

    submitButton.parentNode.insertBefore(cancelButton, submitButton.nextSibling);
  }

  announcementForm?.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (!accessToken) return;
    const submitButton = announcementForm.querySelector('button[type="submit"]');
    if (submitButton) submitButton.disabled = true;
    const data = new FormData(announcementForm);
    const announcement = {
      id: globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      title: String(data.get('title') || '').trim(),
      date: String(data.get('date') || ''),
      message: String(data.get('message') || '').trim()
    };
    try {
      announcements = await updateAnnouncements(
        (items) => [announcement, ...items],
        `Опубликовано объявление: ${announcement.title}`
      );
      renderAnnouncements(true);
      announcementForm.reset();
      if (announcementStatus) {
        announcementStatus.hidden = false;
        announcementStatus.textContent = 'Объявление опубликовано.';
      }
    } catch (error) {
      if (announcementStatus) {
        announcementStatus.hidden = false;
        announcementStatus.textContent = `Не удалось опубликовать объявление: ${error.message}`;
      }
      console.error('Не удалось опубликовать объявление:', error);
    } finally {
      if (submitButton) submitButton.disabled = false;
    }
  });

  studentCertificateForm?.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (!accessToken) return;
    const submitButton = studentCertificateForm.querySelector('button[type="submit"]');
    if (submitButton) submitButton.disabled = true;
    const data = new FormData(studentCertificateForm);
    const editingId = submitButton.dataset.editingId;
    const file = studentCertificateFileInput?.files[0];

    const certificate = {
      id: editingId || (globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`),
      studentName: String(data.get('studentName') || '').trim(),
      group: String(data.get('group') || '').trim(),
      achievement: String(data.get('achievement') || '').trim(),
      date: String(data.get('date') || '')
    };

    try {
      // Upload file if provided
      if (file) {
        if (file.size > config.maxFileSize) throw new Error('Максимальный размер файла — 10 МБ.');
        const extension = file.name.toLowerCase().split('.').pop();
        if (!allowedExtensions['student-certificates']?.has(extension)) {
          throw new Error('Этот формат файла не поддерживается.');
        }

        const safeName = file.name.replace(/[\\/]/g, '_');
        const path = `${config.uploadDirectory}/student-certificates/${Date.now()}-${crypto.randomUUID()}-${safeName}`;
        onStage('Передача файла в GitHub…');
    const uploaded = await putFile(file, path);
    onStage('Файл передан. Сохранение описания и публикация…');
        certificate.filePath = path;
        certificate.fileSha = uploaded.content.sha;
      }

      const previousCertificate = studentCertificates.find(item => item.id === editingId);
      studentCertificates = await updateStudentCertificates(
        (items) => {
          if (editingId) {
            // Update existing
            const existing = items.find(item => item.id === editingId);
            if (existing) {
              return items.map(item => item.id === editingId ? { ...certificate, filePath: file ? certificate.filePath : existing.filePath, fileSha: file ? certificate.fileSha : existing.fileSha } : item);
            }
          }
          // Add new
          return [certificate, ...items];
        },
        editingId ? `Изменён сертификат студента: ${certificate.studentName}` : `Добавлен сертификат студента: ${certificate.studentName}`
      );

      if (file && previousCertificate?.filePath && previousCertificate.filePath !== certificate.filePath) {
        try {
          await deleteFile({ path: previousCertificate.filePath, sha: previousCertificate.fileSha });
        } catch (error) {
          console.warn('Сертификат сохранён, но старый файл остался в репозитории:', error);
        }
      }
      renderStudentCertificates();
      studentCertificateForm.reset();
      submitButton.textContent = 'Добавить сертификат';
      delete submitButton.dataset.editingId;
      const cancelButton = studentCertificateForm.querySelector('button[type="button"]');
      if (cancelButton) cancelButton.remove();

      const status = document.querySelector('#student-certificate-status');
      if (status) {
        status.hidden = false;
        status.textContent = editingId ? 'Сертификат студента изменён.' : 'Сертификат студента добавлен.';
      }
      showToast(editingId ? 'Сертификат студента изменён' : 'Сертификат студента добавлен', 'success');
    } catch (error) {
      const status = document.querySelector('#student-certificate-status');
      if (status) {
        status.hidden = false;
        status.textContent = `Не удалось сохранить сертификат: ${error.message}`;
      }
      showToast('Не удалось сохранить сертификат', 'error');
      console.error('Не удалось сохранить сертификат студента:', error);
    } finally {
      if (submitButton) submitButton.disabled = false;
    }
  });
  async function updateGroupAttendance(updateSummaries, message) {
    const maxAttempts = 3;
    for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
      const current = await getGroupAttendance();
      const nextSummaries = validateGroupAttendance(updateSummaries(current.summaries));
      const bytes = new TextEncoder().encode(JSON.stringify(nextSummaries, null, 2) + '\n');
      let binary = '';
      for (let offset = 0; offset < bytes.length; offset += 0x8000) {
        binary += String.fromCharCode(...bytes.subarray(offset, offset + 0x8000));
      }
      const body = { message, content: btoa(binary), branch: config.branch };
      if (current.sha) body.sha = current.sha;

      try {
        const response = await apiFetch(`${apiRoot}/contents/${encodePath(config.groupAttendanceFile)}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body)
        });
        await responseJson(response);
        return nextSummaries;
      } catch (error) {
        if (!isManifestConflict(error)) throw error;
        if (attempt === maxAttempts - 1) {
          error.message = `Сводка посещаемости несколько раз обновилась одновременно. Обновите страницу и повторите действие. ${error.message}`;
          throw error;
        }
      }
    }
    throw new Error('Не удалось обновить сводку посещаемости после нескольких конфликтов.');
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

  function attendanceSummariesFromWorkbook(bytes, fileName) {
    const workbook = window.XLSX.read(bytes, { type: 'array', cellDates: false });
    const dateHeaderPattern = /^\d{1,2}\s*(?:янв|фев|мар|апр|ма[йя]|июн|июл|авг|сен|сент|окт|ноя|дек)\.?$/i;
    const numericDatePattern = /^\d{1,2}[./-]\d{1,2}(?:[./-]\d{2,4})?$/;
    const groupPattern = /(?:^|[^0-9А-ЯЁA-Z])([0-9А-ЯЁA-Z]{2,12}-\d{3,6}[А-ЯЁA-Z]?)(?=$|[^0-9А-ЯЁA-Z])/i;
    const summaries = [];

    for (const sheetName of workbook.SheetNames) {
      const rows = window.XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], {
        header: 1,
        defval: '',
        raw: false
      });
      const dateHeaders = rows.slice(0, 30)
        .map((row, index) => ({
          index,
          columns: row.reduce((columns, value, column) => {
            const label = cellText(value);
            if (dateHeaderPattern.test(label) || numericDatePattern.test(label)) {
              columns.push({ column, label: normalizedHeader(label) });
            }
            return columns;
          }, [])
        }))
        .filter(({ columns }) => columns.length >= 3)
        .sort((left, right) => right.columns.length - left.columns.length);
      if (!dateHeaders.length) continue;

      const header = dateHeaders[0];
      const students = rows.slice(header.index + 1).filter((row) =>
        /^\d+$/.test(cellText(row[0])) && /\p{L}{2,}/u.test(cellText(row[1]))
      );
      if (students.length < 2) continue;

      const headerText = rows.slice(0, header.index).flat().map(cellText).find((value) => groupPattern.test(value))
        || fileName;
      const fileTitle = fileName.replace(/\.[^.]+$/, '').replace(/^\d{4}-\d{4}[_\s-]*/, '').replace(/_/g, ' ').trim();
      const fileGroupMatch = fileTitle.match(groupPattern);
      const headerGroupMatch = headerText.match(groupPattern);
      const groupMatch = fileGroupMatch || headerGroupMatch;
      if (!groupMatch) continue;
      const group = groupMatch[1];
      function subjectAfterGroup(title, match) {
        const titleIndex = title.indexOf(match[1]) + match[1].length;
        return title.slice(titleIndex)
          .replace(/^[\s:—–-]+/, '')
          .replace(/\s*\([^)]*\)/g, '')
          .replace(/[\s_-]*(?:i{1,3}|iv|v|\d+)\s*полугодие.*$/i, '')
          .trim();
      }
      const filenameSubject = fileGroupMatch
        ? subjectAfterGroup(fileTitle, fileGroupMatch)
        : '';
      const headerSubject = headerGroupMatch
        ? subjectAfterGroup(headerText, headerGroupMatch)
        : '';
      const subject = filenameSubject || headerSubject || sheetName;
      const periodMatch = fileName.match(/(?:^|[_\s-])((?:i{1,3}|iv|v|\d+)\s*полугодие)/i);
      const period = periodMatch ? periodMatch[1].replace(/\s+/g, ' ').trim() : '';
      let absenceCount = 0;
      let recordedMarks = 0;

      students.forEach((row) => {
        header.columns.forEach(({ column }) => {
          const mark = cellText(row[column]);
          if (!mark) return;
          recordedMarks += 1;
          if (/^н$/i.test(mark)) absenceCount += 1;
        });
      });

      if (!recordedMarks) continue;
      summaries.push({
        fileName,
        group,
        subject,
        period,
        studentCount: students.length,
        sessionCount: header.columns.length,
        dateCount: new Set(header.columns.map(({ label }) => label)).size,
        recordedMarks,
        unmarkedCells: students.length * header.columns.length - recordedMarks,
        possibleMarks: students.length * header.columns.length,
        absenceCount,
        attendancePercent: Math.round(((students.length * header.columns.length - absenceCount) / (students.length * header.columns.length)) * 1000) / 10
      });
    }

    return summaries;
  }

  async function extractAttendanceSummaries(file) {
    await loadXlsxLibrary();
    return attendanceSummariesFromWorkbook(await file.arrayBuffer(), file.name);
  }

  async function extractPerformanceSummaryFromPdf(file) {
    const pdfjs = await loadPdfLibrary();
    const document = await pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise;
    const pageItems = [];
    for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
      const page = await document.getPage(pageNumber);
      const content = await page.getTextContent();
      pageItems.push(content.items
        .filter((item) => typeof item.str === 'string' && item.str.trim())
        .map((item) => ({
          page: pageNumber,
          text: item.str.trim(),
          x: item.transform[4],
          y: item.transform[5]
        })));
    }

    const groupMatch = file.name.match(/(?:^|[^0-9А-ЯЁA-Z])(\d{1,2}\s*[А-ЯЁA-Z]{2,8}\s*-\s*\d{3,5}[А-ЯЁA-Z]?)(?=$|[^0-9А-ЯЁA-Z])/i);
    if (!groupMatch) {
      throw new Error('Добавьте код группы в имя PDF-файла, например «Ведомость 2ИСИП-123.pdf».');
    }
    const group = groupMatch[1].replace(/\s+/g, '').toLocaleUpperCase('ru-RU');
    const documentGroups = [...new Set(pageItems.flat().flatMap((item) =>
      [...item.text.matchAll(/(?:^|[^0-9А-ЯЁA-Z])(\d{1,2}\s*[А-ЯЁA-Z]{2,8}\s*-\s*\d{3,5}[А-ЯЁA-Z]?)(?=$|[^0-9А-ЯЁA-Z])/gi)]
        .map((match) => match[1].replace(/\s+/g, '').toLocaleUpperCase('ru-RU'))
    ))];
    const groupSuffix = group.match(/-(\d{3,5})[А-ЯЁA-Z]?$/)?.[1];
    const conflictingGroup = documentGroups.find((candidate) =>
      candidate !== group && candidate.match(/-(\d{3,5})[А-ЯЁA-Z]?$/)?.[1] === groupSuffix
    );
    const groupWarning = conflictingGroup
      ? `Имя файла указывает на группу «${group}», но в PDF указана группа «${conflictingGroup}». Проверьте ведомость.`
      : '';

    const firstPageItems = pageItems[0] || [];
    const subjectLines = new Map();
    firstPageItems.forEach((item) => {
      const lineY = Math.round(item.y / 3) * 3;
      if (!subjectLines.has(lineY)) subjectLines.set(lineY, []);
      subjectLines.get(lineY).push(item);
    });
    const lines = [...subjectLines.entries()]
      .map(([y, items]) => ({
        y,
        text: items.sort((left, right) => left.x - right.x).map((item) => item.text).join(' ').replace(/\s+/g, ' ').trim()
      }))
      .sort((left, right) => right.y - left.y);
    const subjectLineIndex = lines.findIndex(({ text }) => /(?:учебная\s+)?дисциплина/i.test(text));
    let subject = '';
    if (subjectLineIndex >= 0) {
      subject = lines[subjectLineIndex].text
        .replace(/^.*?(?:учебная\s+)?дисциплина\s*:?\s*/i, '')
        .trim();
      if (!subject) {
        const nextLine = lines
          .filter((line, index) => index !== subjectLineIndex)
          .filter((line) => Math.abs(line.y - lines[subjectLineIndex].y) <= 18)
          .map((line) => line.text)
          .find((text) => /[А-ЯЁA-Z]{3,}/i.test(text) && !/дисциплина|группа|семестр/i.test(text));
        subject = nextLine || '';
      }
    }
    if (!subject) {
      throw new Error('В PDF не удалось определить название дисциплины из реквизита «Учебная дисциплина».');
    }

    const headers = pageItems.flat().filter((item) => normalizedHeader(item.text) === 'оценка');
    if (!headers.length) {
      throw new Error('В PDF не найден столбец «Оценка». Проверьте, что это ведомость с итоговыми оценками.');
    }
    const gradeX = headers.reduce((sum, item) => sum + item.x, 0) / headers.length;
    const headerYs = new Map(headers.map((item) => [item.page, item.y]));
    const gradesByRow = new Map();
    pageItems.flat().forEach((item) => {
      const gradeMatch = item.text.match(/^([2-5])(?:\s*\([^)]*\))?$/);
      if (!gradeMatch || Math.abs(item.x - gradeX) > 80 || item.y < 80
        || (headerYs.has(item.page) && Math.abs(item.y - headerYs.get(item.page)) < 20)) return;
      const key = `${item.page}:${Math.round(item.y)}`;
      const grade = Number(gradeMatch[1]);
      const distance = Math.abs(item.x - gradeX);
      const current = gradesByRow.get(key);
      if (!current || distance < current.distance) {
        gradesByRow.set(key, { grade, distance });
      } else if (distance === current.distance && grade !== current.grade) {
        throw new Error('В PDF найдены разные оценки в одной строке; не удалось однозначно разобрать ведомость.');
      }
    });

    const grades = [...gradesByRow.values()].map(({ grade }) => grade);
    if (!grades.length) {
      throw new Error('Не удалось извлечь оценки 2–5 из PDF. Проверьте, что текст ведомости выделяется, а оценки указаны в столбце «Оценка».');
    }
    const passed = grades.filter((grade) => grade >= 3).length;
    const quality = grades.filter((grade) => grade >= 4).length;
    return {
      group,
      subject,
      groupWarning,
      students: grades.length,
      success: Math.round((passed / grades.length) * 1000) / 10,
      quality: Math.round((quality / grades.length) * 1000) / 10,
      average: Math.round((grades.reduce((sum, grade) => sum + grade, 0) / grades.length) * 10) / 10
    };
  }

  function renderGroupAttendanceSummary() {
    if (!groupAttendanceSummary) return;
    groupAttendanceSummary.replaceChildren();

    if (!attendanceSummaries.length) {
      const empty = document.createElement('p');
      empty.className = 'group-subject-empty';
      empty.textContent = 'Посещаемость появится после загрузки журнала успеваемости Excel владельцем сайта.';
      groupAttendanceSummary.append(empty);
      return;
    }

    attendanceSummaries.forEach((summary) => {
      const article = document.createElement('article');
      article.className = 'group-attendance-result';
      const headingRow = document.createElement('div');
      headingRow.className = 'group-attendance-heading';
      const heading = document.createElement('h4');
      heading.textContent = `${summary.group} — ${summary.subject}${summary.period ? ` — ${summary.period}` : ''}`;
      headingRow.append(heading);
      if (accessToken) {
        const removeButton = document.createElement('button');
        removeButton.className = 'group-attendance-remove';
        removeButton.type = 'button';
        removeButton.textContent = 'Удалить';
        removeButton.setAttribute('aria-label', `Удалить сводку посещаемости ${summary.group} — ${summary.subject}`);
        removeButton.addEventListener('click', () => deleteGroupAttendance(summary));
        headingRow.append(removeButton);
      }
      const metrics = document.createElement('dl');
      metrics.className = 'group-attendance-metrics';
      const values = [
        ['Студентов', summary.studentCount],
        ['Занятий в журнале', summary.sessionCount],
        ['Дат занятий', summary.dateCount],
        ['Всего ячеек', summary.possibleMarks],
        ['Отметок обработано', summary.recordedMarks],
        ['Пустых ячеек', summary.unmarkedCells],
        ['Пропусков «Н»', summary.absenceCount],
        ['Посещаемость', `${summary.attendancePercent}%`]
      ];

      values.forEach(([label, value]) => {
        const metric = document.createElement('div');
        metric.className = 'group-attendance-metric';
        const term = document.createElement('dt');
        term.textContent = label;
        const description = document.createElement('dd');
        description.textContent = value;
        metric.append(term, description);
        metrics.append(metric);
      });

      const note = document.createElement('p');
      note.className = 'group-attendance-note';
      note.textContent = 'Опубликованы только сводные цифры; исходный Excel, ФИО и индивидуальные отметки в GitHub не загружались. «Н» считается пропуском, пустые ячейки и оценки — нет.';
      const attendanceChart = createMetricBar('Посещаемость', summary.attendancePercent, `${summary.attendancePercent}%`);
      attendanceChart.classList.add('attendance-chart');
      article.append(headingRow, attendanceChart, metrics, note);
      groupAttendanceSummary.append(article);
    });
  }

  async function deleteGroupAttendance(summary) {
    if (!accessToken) return;
    if (!window.confirm(`Удалить сводку посещаемости группы «${summary.group} — ${summary.subject}»?`)) return;
    if (groupAttendanceStatus) groupAttendanceStatus.textContent = `Удаляю сводку группы «${summary.group}»…`;
    try {
      attendanceSummaries = await updateGroupAttendance(
        (summaries) => {
          if (!summaries.some((item) => item.group === summary.group && item.subject === summary.subject && item.period === summary.period)) {
            throw new Error('Эта сводка уже удалена. Обновите страницу.');
          }
          return summaries.filter((item) => item.group !== summary.group || item.subject !== summary.subject || item.period !== summary.period);
        },
        `Удалена сводка посещаемости группы: ${summary.group}`
      );
      renderGroupAttendanceSummary();
      if (groupAttendanceStatus) groupAttendanceStatus.textContent = `Сводка группы «${summary.group}» удалена.`;
    } catch (error) {
      if (groupAttendanceStatus) groupAttendanceStatus.textContent = `Не удалось удалить сводку: ${error.message}`;
      console.error(`Не удалось удалить сводку посещаемости группы «${summary.group}»:`, error);
    }
  }

  function performanceCell(value) {
    const cell = document.createElement('td');
    cell.textContent = value;
    return cell;
  }

  function createMetricBar(label, value, valueText = `${value}%`) {
    const row = document.createElement('div');
    row.className = 'comparison-metric';
    const name = document.createElement('span');
    name.className = 'comparison-metric-label';
    name.textContent = label;
    const progress = document.createElement('progress');
    progress.max = 100;
    progress.value = Math.min(100, Math.max(0, value));
    progress.setAttribute('aria-label', `${label}: ${valueText}`);
    const output = document.createElement('span');
    output.className = 'comparison-metric-value';
    output.textContent = valueText;
    row.append(name, progress, output);
    return row;
  }

  function renderPerformanceChart(groups) {
    if (!performanceChart || !performanceChartDetails) return;
    performanceChart.replaceChildren();
    performanceChartDetails.hidden = groups.length === 0;
    groups.forEach((item) => {
      const card = document.createElement('article');
      card.className = 'comparison-group';
      const heading = document.createElement('h4');
      heading.textContent = `${item.group}${item.subject ? ` — ${item.subject}` : ''}`;
      card.append(heading);
      card.append(
        createMetricBar('Успеваемость', item.success),
        createMetricBar('Качество знаний', item.quality)
      );
      if (item.trained != null) card.append(createMetricBar('Обученность', item.trained));
      const average = document.createElement('p');
      average.className = 'comparison-average';
      average.textContent = `Средний балл: ${item.average.toLocaleString('ru-RU', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} из 5`;
      card.append(average);
      performanceChart.append(card);
    });
  }

  function performanceInput(field, value, label) {
    const input = document.createElement('input');
    input.type = ['group', 'subject'].includes(field) ? 'text' : 'number';
    input.value = value == null ? '' : value;
    input.dataset.field = field;
    input.setAttribute('aria-label', label);
    if (field === 'students') {
      input.min = '1';
      input.step = '1';
    } else if (field === 'average') {
      input.min = '0';
      input.max = '5';
      input.step = '0.1';
    } else if (!['group', 'subject'].includes(field)) {
      input.min = '0';
      input.max = '100';
      input.step = '0.1';
    }
    return input;
  }

  function performanceActionButton(label, className, handler, disabled = false) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = className;
    button.textContent = label;
    button.disabled = disabled;
    button.addEventListener('click', handler);
    return button;
  }

  function readPerformanceRow(row) {
    const inputs = [...row.querySelectorAll('[data-field]')];
    if (inputs.some((input) => !['subject', 'trained'].includes(input.dataset.field) && !input.value.trim())) {
      throw new Error('Заполните группу, количество студентов и все показатели.');
    }
    const values = Object.fromEntries(inputs.map((input) => [
      input.dataset.field,
      ['group', 'subject'].includes(input.dataset.field) ? input.value.trim()
        : input.dataset.field === 'trained' && !input.value.trim() ? null
          : Number(input.value)
    ]));
    if (!values.group || !Number.isInteger(values.students) || values.students < 1
      || !['success', 'quality', 'average'].every((key) => Number.isFinite(values[key]))
      || values.success < 0 || values.success > 100
      || values.quality < 0 || values.quality > 100
      || (values.trained !== null && (!Number.isFinite(values.trained) || values.trained < 0 || values.trained > 100))
      || values.average < 0 || values.average > 5) {
      throw new Error('Заполните группу, целое число студентов, успеваемость и качество от 0 до 100, и средний балл от 0 до 5. Обученность можно оставить пустой.');
    }
    return values;
  }

  async function savePerformanceRow(row, originalItem) {
    if (!accessToken || savingPerformance) return;
    let updated;
    let saved = false;
    try {
      updated = readPerformanceRow(row);
      editingPerformanceDraft = updated;
      savingPerformance = true;
      if (performanceStatus) performanceStatus.textContent = 'Сохраняю сводку в GitHub…';
      renderGroupPerformance();
      groupPerformance = await updateGroupPerformance((groups) => {
        const currentIndex = originalItem
          ? groups.findIndex((item) => performanceKey(item.group, item.subject) === performanceKey(originalItem.group, originalItem.subject))
          : -1;
        if (originalItem && currentIndex < 0) {
          throw new Error(`Группа «${originalItem.group} — ${originalItem.subject || 'без предмета'}» уже удалена из сводки. Обновите страницу.`);
        }
        if (groups.some((item, index) => index !== currentIndex
          && performanceKey(item.group, item.subject) === performanceKey(updated.group, updated.subject))) {
          throw new Error(`Группа «${updated.group}» с предметом «${updated.subject || 'без предмета'}» уже есть в сводке.`);
        }
        if (currentIndex < 0) return [...groups, updated];
        return groups.map((item, index) => index === currentIndex ? updated : item);
      }, `${originalItem ? 'Изменена' : 'Добавлена'} сводка группы: ${updated.group}${updated.subject ? ` — ${updated.subject}` : ''}`);
      saved = true;
      editingPerformanceGroup = null;
      addingPerformanceGroup = false;
      editingPerformanceDraft = null;
      if (performanceStatus) performanceStatus.textContent = `Сводка группы «${updated.group}${updated.subject ? ` — ${updated.subject}` : ''}» сохранена в GitHub.`;
    } catch (error) {
      if (performanceStatus) performanceStatus.textContent = `Не удалось сохранить группу: ${error.message}`;
      console.error('Не удалось сохранить сводку по группам:', error);
    } finally {
      savingPerformance = false;
      if (saved) renderGroupPerformance();
      else setPerformanceControlsDisabled(false);
    }
  }

  async function deletePerformanceGroup(item) {
    if (!accessToken || savingPerformance) return;
    const key = performanceKey(item.group, item.subject);
    const label = `${item.group}${item.subject ? ` — ${item.subject}` : ''}`;
    if (!window.confirm(`Удалить группу «${label}» из сводной таблицы?`)) return;
    let deleted = false;
    try {
      savingPerformance = true;
      if (performanceStatus) performanceStatus.textContent = `Удаляю группу «${label}» из сводки…`;
      setPerformanceControlsDisabled(true);
      groupPerformance = await updateGroupPerformance((groups) => {
        if (!groups.some((current) => performanceKey(current.group, current.subject) === key)) {
          throw new Error(`Группа «${label}» уже отсутствует в сводке.`);
        }
        return groups.filter((current) => performanceKey(current.group, current.subject) !== key);
      }, `Удалена группа из сводки: ${label}`);
      deleted = true;
      if (performanceStatus) performanceStatus.textContent = `Группа «${label}» удалена из сводной таблицы.`;
    } catch (error) {
      if (performanceStatus) performanceStatus.textContent = `Не удалось удалить группу: ${error.message}`;
      console.error(`Не удалось удалить группу «${label}» из сводки:`, error);
    } finally {
      savingPerformance = false;
      if (deleted) renderGroupPerformance();
      else setPerformanceControlsDisabled(false);
    }
  }

  function setPerformanceControlsDisabled(disabled) {
    performanceTableBody?.querySelectorAll('button, input').forEach((control) => {
      control.disabled = disabled;
    });
    if (performanceAddButton) performanceAddButton.disabled = disabled;
  }

  function renderGroupPerformance() {
    if (!performanceTableBody || !performanceTableFoot) return;
    const ownerMode = Boolean(accessToken);
    if (performanceAddButton) performanceAddButton.hidden = !ownerMode || addingPerformanceGroup || editingPerformanceGroup !== null;
    if (performanceActionsHeading) performanceActionsHeading.hidden = !ownerMode;
    performanceTableBody.replaceChildren();
    performanceTableFoot.replaceChildren();

    const groups = groupPerformance;
    renderPerformanceChart(groups);
    groups.forEach((item) => {
      const row = document.createElement('tr');
      const isEditing = ownerMode && editingPerformanceGroup === performanceKey(item.group, item.subject);
      if (isEditing) {
        const editedItem = editingPerformanceDraft || item;
        const fields = [
          ['group', editedItem.group, 'Название группы'],
          ['subject', editedItem.subject || '', `Предмет группы ${item.group}`],
          ['students', editedItem.students, `Количество студентов в группе ${item.group}`],
          ['success', editedItem.success, `Успеваемость группы ${item.group}, процентов`],
          ['quality', editedItem.quality, `Качество знаний группы ${item.group}, процентов`],
          ['trained', editedItem.trained, `Обученность группы ${item.group}, процентов`],
          ['average', editedItem.average, `Средний балл группы ${item.group}`]
        ];
        fields.forEach(([field, value, label]) => {
          const cell = document.createElement('td');
          cell.append(performanceInput(field, value, label));
          row.append(cell);
        });
        const actions = document.createElement('td');
        actions.className = 'performance-row-actions';
        actions.append(
          performanceActionButton('Сохранить', 'performance-save-button', () => savePerformanceRow(row, addingPerformanceGroup ? null : item), savingPerformance),
          performanceActionButton('Отмена', 'performance-cancel-button', () => {
            editingPerformanceGroup = null;
            addingPerformanceGroup = false;
            editingPerformanceDraft = null;
            renderGroupPerformance();
          }, savingPerformance)
        );
        row.append(actions);
      } else {
        row.append(
          performanceCell(item.group),
          performanceCell(item.subject || '—'),
          performanceCell(String(item.students)),
          performanceCell(`${item.success}%`),
          performanceCell(`${item.quality}%`),
          performanceCell(item.trained == null ? '—' : `${item.trained}%`),
          performanceCell(item.average.toLocaleString('ru-RU', { minimumFractionDigits: 1, maximumFractionDigits: 1 }))
        );
        if (ownerMode) {
          const actions = document.createElement('td');
          actions.className = 'performance-row-actions';
          actions.append(
            performanceActionButton('Изменить', 'performance-edit-button', () => {
              editingPerformanceGroup = performanceKey(item.group, item.subject);
              addingPerformanceGroup = false;
              editingPerformanceDraft = null;
              renderGroupPerformance();
              performanceTableBody.querySelector('[data-field="group"]')?.focus();
            }, savingPerformance || editingPerformanceGroup !== null || addingPerformanceGroup),
            performanceActionButton(
              'Удалить',
              'performance-delete-button',
              () => deletePerformanceGroup(item),
              savingPerformance || editingPerformanceGroup !== null || addingPerformanceGroup
            )
          );
          row.append(actions);
        }
      }
      performanceTableBody.append(row);
    });

    if (ownerMode && addingPerformanceGroup) {
      const row = document.createElement('tr');
      const draft = editingPerformanceDraft || {};
      const fields = [
        ['group', draft.group || '', 'Название новой группы'],
        ['subject', draft.subject || '', 'Предмет группы'],
        ['students', draft.students ?? '', 'Количество студентов в группе'],
        ['success', draft.success ?? '', 'Успеваемость группы, процентов'],
        ['quality', draft.quality ?? '', 'Качество знаний группы, процентов'],
        ['trained', draft.trained ?? '', 'Обученность группы, процентов'],
        ['average', draft.average ?? '', 'Средний балл группы']
      ];
      fields.forEach(([field, value, label]) => {
        const cell = document.createElement('td');
        cell.append(performanceInput(field, value, label));
        row.append(cell);
      });
      const actions = document.createElement('td');
      actions.className = 'performance-row-actions';
      actions.append(
        performanceActionButton('Сохранить', 'performance-save-button', () => savePerformanceRow(row, null), savingPerformance),
        performanceActionButton('Отмена', 'performance-cancel-button', () => {
          addingPerformanceGroup = false;
          editingPerformanceDraft = null;
          renderGroupPerformance();
        }, savingPerformance)
      );
      row.append(actions);
      performanceTableBody.append(row);
    }

    if (!groups.length && !addingPerformanceGroup) {
      const row = document.createElement('tr');
      const message = document.createElement('td');
      message.colSpan = ownerMode ? 8 : 7;
      message.textContent = 'В сводной таблице пока нет групп.';
      row.append(message);
      performanceTableBody.append(row);
    }

    const totals = groups.reduce((result, item) => {
      result.students += item.students;
      result.success += item.success * item.students;
      result.quality += item.quality * item.students;
      if (item.trained != null) {
        result.trained += item.trained * item.students;
        result.trainedStudents += item.students;
      }
      result.average += item.average * item.students;
      return result;
    }, { students: 0, success: 0, quality: 0, trained: 0, trainedStudents: 0, average: 0 });
    const totalRow = document.createElement('tr');
    const totalValues = groups.length
      ? [
          'Итого',
          '',
          String(totals.students),
          `${Math.floor(totals.success / totals.students)}%`,
          `${Math.floor(totals.quality / totals.students)}%`,
          totals.trainedStudents ? `${Math.floor(totals.trained / totals.trainedStudents)}%` : '—',
          (totals.average / totals.students).toLocaleString('ru-RU', { minimumFractionDigits: 1, maximumFractionDigits: 1 })
        ]
      : ['Итого', '', '0', '—', '—', '—', '—'];
    totalValues.forEach((value) => {
      const cell = document.createElement('th');
      cell.scope = 'row';
      cell.textContent = value;
      totalRow.append(cell);
    });
    if (ownerMode) totalRow.append(document.createElement('th'));
    performanceTableFoot.append(totalRow);
    ['success', 'quality', 'trained', 'average'].forEach((key, index) => {
      const output = document.querySelector(`[data-performance-metric="${key}"]`);
      if (output) output.textContent = totalValues[index + 3];
    });
  }

  performanceAddButton?.addEventListener('click', () => {
    if (!accessToken || savingPerformance) return;
    editingPerformanceGroup = null;
    addingPerformanceGroup = true;
    editingPerformanceDraft = null;
    renderGroupPerformance();
    performanceTableBody.querySelector('[data-field="group"]')?.focus();
  });

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

    if (extension === 'txt' || extension === 'md') {
      const text = document.createElement('pre');
      text.setAttribute('aria-label', `Предпросмотр файла ${file.name}`);
      text.setAttribute('role', 'status');
      Object.assign(text.style, {
        whiteSpace: 'pre-wrap', overflowWrap: 'anywhere',
        padding: '16px', margin: '0', maxHeight: '480px', overflow: 'auto'
      });
      preview.append(text);
      let textPromise;
      return {
        element: preview,
        open() {
          if (textPromise) return textPromise;
          text.textContent = 'Загрузка текста…';
          textPromise = fetch(url, { cache: 'no-store' })
            .then(async (response) => {
              if (!response.ok) throw new Error(`HTTP ${response.status}`);
              text.textContent = await response.text();
            })
            .catch((error) => {
              text.textContent = `Не удалось прочитать файл: ${error.message}. Закройте просмотр и откройте снова или используйте ссылку на файл.`;
              textPromise = undefined;
            });
          return textPromise;
        }
      };
    }

    if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(extension)) {
      const image = document.createElement('img');
      image.alt = `Предпросмотр файла ${file.name}`;
      image.loading = 'lazy';
      image.hidden = true;
      preview.append(image);
      return { element: preview, open: () => { image.hidden = false; image.src = url; } };
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
    } else if (['doc', 'docx', 'ppt', 'pptx', 'xls', 'xlsx'].includes(extension)) {
      const viewerUrl = `https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(url)}`;
      const help = document.createElement('p');
      help.className = 'office-preview-help';
      help.textContent = 'Просмотр через Microsoft Office. Если документ не отображается, повторите загрузку просмотра или откройте его отдельно.';
      const actions = document.createElement('div');
      actions.className = 'office-preview-actions';
      const reload = document.createElement('button');
      reload.type = 'button';
      reload.textContent = 'Загрузить просмотр заново';
      reload.addEventListener('click', () => { frame.src = viewerUrl; });
      const external = document.createElement('a');
      external.href = `https://view.officeapps.live.com/op/view.aspx?src=${encodeURIComponent(url)}`;
      external.target = '_blank';
      external.rel = 'noopener noreferrer';
      external.textContent = 'Открыть просмотр отдельно ↗';
      actions.append(reload, external);
      preview.append(help, actions, frame);
      let opened = false;
      return { element: preview, open() {
        if (opened) return;
        opened = true;
        frame.src = viewerUrl;
      } };
    } else {
      return null;
    }

    preview.append(frame);
    return { element: preview, open() {} };
  }

  function renderFile(file, type, list, ownerMode) {
    const item = document.createElement('li');
    item.className = 'upload-item';
    const extension = file.name.toLowerCase().split('.').pop();
    item.dataset.extension = extension;
    item.dataset.search = window.materialEditor.search(file);
    item.dataset.category = file.category || 'other';
    item.dataset.title = file.title || file.name;
    item.dataset.publishedAt = String(window.materialEditor.publicationTime(file));
    item.dataset.path = file.path;
    const content = document.createElement('div');
    content.className = 'document-content';
    const link = document.createElement('a');
    const url = publicFileUrl(file.path);
    link.href = fileViewUrl(file, url, extension);
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    link.textContent = type === 'documents' ? file.title || file.name : `${file.name} (${formatSize(file.size)})`;
    content.append(link);

    if (type === 'documents') {
      const info = document.createElement('p');
      info.className = 'material-file-info';
      const published = window.materialEditor.publicationTime(file);
      info.textContent = `${extension.toUpperCase()} · ${formatSize(file.size)} · `;
      if (published) {
        const date = document.createElement('time');
        date.dateTime = new Date(published).toISOString();
        date.textContent = `Опубликовано ${new Date(published).toLocaleDateString('ru-RU', {timeZone:'Europe/Moscow'})}`;
        info.append(date);
      } else {
        info.append(document.createTextNode('Дата публикации не указана'));
      }
      content.append(info);
      for (const value of [file.description, [file.subject, file.group].filter(Boolean).join(' · '), file.title ? file.name : '']) {
        if (!value) continue;
        const detail = document.createElement('p');
        detail.className = 'material-detail';
        detail.textContent = value;
        content.append(detail);
      }
    }

    // Add category badge
    const categoryNames = {
      lesson: 'Уроки',
      methodical: 'Методические разработки',
      practical: 'Практические задания',
      test: 'Тесты и контрольные',
      other: 'Другое'
    };
    const categoryBadge = document.createElement('span');
    categoryBadge.className = 'document-category-badge';
    categoryBadge.textContent = categoryNames[file.category] || 'Другое';
    content.append(categoryBadge);

    if (type === 'documents') {
      content.append(window.materialActions.create(file, url, window.materialActions.shareUrl(file, config.pagesBaseUrl)));
    }

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
      if (type === 'documents') {
        const edit = document.createElement('button');
        edit.type = 'button';
        edit.className = 'document-preview-toggle owner-only';
        edit.textContent = 'Редактировать сведения';
        edit.addEventListener('click', () => {
          if (content.querySelector('.material-editor')) return;
          const editor = window.materialEditor.create({ ...file, title: file.title || file.name }, 'Сведения о материале');
          editor.cancel.addEventListener('click', () => { editor.form.remove(); edit.focus(); });
          editor.form.addEventListener('submit', async (event) => {
            event.preventDefault();
            if (!accessToken) { editor.status.textContent = 'Сначала войдите в GitHub.'; return; }
            try {
              const metadata = editor.read();
              editor.busy(true);
              editor.status.textContent = 'Сохранение сведений в GitHub…';
              uploadManifest = await updateManifest((files) => {
                if (!files.some((entry) => entry.path === file.path)) throw new Error('Материал уже удалён. Обновите страницу.');
                return files.map((entry) => entry.path === file.path ? { ...entry, ...metadata, updatedAt: new Date().toISOString() } : entry);
              }, `Обновлены сведения: ${metadata.title}`);
              renderManifest(uploadManifest, Boolean(accessToken));
              showStatus('Сведения сохранены. Файл остался прежним.');
            } catch (error) {
              editor.status.textContent = `Не удалось сохранить: ${error.message}`;
              editor.busy(false);
            }
          });
          content.append(editor.form);
          editor.focus();
        });
        content.append(edit);
      }
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

  function filterDocuments() {
    if (!documentList) return;
    const query = window.materialEditor.normalize(materialSearch?.value).trim();
    const terms = query.split(/\s+/).filter(Boolean);
    const selectedCategory = materialCategoryFilter?.value || 'all';
    const selectedType = materialTypeFilter?.value || 'all';
    const extensionsByType = {
      pdf: ['pdf'],
      office: ['doc', 'docx', 'odt', 'rtf', 'xls', 'xlsx'],
      presentation: ['ppt', 'pptx'],
      text: ['md', 'txt']
    };
    const items = [...documentList.querySelectorAll('.upload-item')];
    let visible = 0;
    items.forEach((item) => {
      const matchesQuery = terms.every((term) => item.dataset.search?.includes(term));
      const matchesCategory = selectedCategory === 'all' || item.dataset.category === selectedCategory;
      const matchesType = selectedType === 'all'
        || extensionsByType[selectedType]?.includes(item.dataset.extension);
      item.hidden = !(matchesQuery && matchesCategory && matchesType);
      if (!item.hidden) visible += 1;
    });
    if (materialResultsCount) {
      materialResultsCount.textContent = items.length
        ? `Показано ${visible} из ${items.length} материалов`
        : 'Материалов пока нет.';
    }
    if (materialEmpty) materialEmpty.hidden = visible > 0 || items.length === 0;
    if (materialReset) materialReset.hidden = !query && selectedCategory === 'all' && selectedType === 'all';
    const order = materialSort?.value || 'newest';
    const previousOrder = [...items];
    items.sort((first, second) => window.materialEditor.compare(
      { title: first.dataset.title, publishedAt: Number(first.dataset.publishedAt) ? new Date(Number(first.dataset.publishedAt)).toISOString() : '' },
      { title: second.dataset.title, publishedAt: Number(second.dataset.publishedAt) ? new Date(Number(second.dataset.publishedAt)).toISOString() : '' },
      order
    ));
    if (items.some((item, index) => item !== previousOrder[index])) documentList.append(...items);
  }

  function renderManifest(files, ownerMode = false) {
    manifestVersion += 1;
    materialLoadState.hidden = true;
    documentList?.setAttribute('aria-busy', 'false');
    if (documentList) documentList.replaceChildren();
    if (certificateList) certificateList.replaceChildren();
    if (groupExcelList) groupExcelList.replaceChildren();
    files.forEach((file) => {
      if (file.type === 'documents' && documentList) renderFile(file, 'documents', documentList, ownerMode);
      if (file.type === 'certificates' && certificateList) renderFile(file, 'certificates', certificateList, ownerMode);
      if (file.type === 'group-data' && groupExcelList) renderFile(file, 'group-data', groupExcelList, ownerMode);
    });
    filterDocuments();
    renderGroupSubjectSummary(files);
    if (uploadStatus && !files.length) uploadStatus.textContent = 'Здесь появятся опубликованные материалы.';
  }

  async function refreshManifest() {
    const version = manifestVersion;
    const token = accessToken;
    let files;
    if (token) {
      files = (await getManifest(token)).files;
    } else {
      const response = await fetch(`${rawRoot}/${encodePath(config.manifest)}?t=${Date.now()}`, { cache: 'no-store' });
      if (response.status === 404) files = [];
      else if (!response.ok) throw new Error(`Не удалось прочитать список файлов (${response.status}).`);
      else files = await response.json();
    }
    // A slow public response must not overwrite a newer login or publication.
    if (version !== manifestVersion || token !== accessToken) return;
    if (!Array.isArray(files)) throw new Error('Список файлов в GitHub имеет неверный формат.');
    uploadManifest = files;
    renderManifest(uploadManifest, Boolean(accessToken));
    if (!accessToken && uploadStatus) uploadStatus.textContent = '';
    revealSharedMaterial();
  }

  let materialLoadPromise;
  const materialLoadState = document.createElement('div');
  materialLoadState.className = 'material-load-state';
  materialLoadState.hidden = true;
  const materialLoadMessage = document.createElement('p');
  materialLoadMessage.setAttribute('role', 'status');
  const materialRetry = document.createElement('button');
  materialRetry.type = 'button';
  materialRetry.textContent = 'Повторить загрузку материалов';
  materialRetry.hidden = true;
  materialRetry.addEventListener('click', loadMaterials);
  materialLoadState.append(materialLoadMessage, materialRetry);
  documentList?.before(materialLoadState);

  function loadMaterials() {
    if (materialLoadPromise) return materialLoadPromise;
    const version = manifestVersion;
    materialLoadState.hidden = false;
    materialLoadMessage.textContent = 'Загружаю опубликованные материалы…';
    materialRetry.hidden = true;
    documentList?.setAttribute('aria-busy', 'true');
    if (!accessToken && uploadStatus) uploadStatus.textContent = '';
    materialLoadPromise = (async () => {
      try {
        await refreshManifest();
        materialLoadState.hidden = true;
      } catch (error) {
        if (version !== manifestVersion) {
          materialLoadState.hidden = true;
          return;
        }
        materialLoadMessage.textContent = `Не удалось загрузить материалы: ${error.message}. Проверьте соединение и повторите попытку.`;
        materialRetry.hidden = false;
      } finally {
        documentList?.setAttribute('aria-busy', 'false');
        materialLoadPromise = undefined;
      }
    })();
    return materialLoadPromise;
  }

  let sharedMaterialOpened = false;
  function revealSharedMaterial() {
    if (sharedMaterialOpened || !documentList) return;
    const path = new URLSearchParams(window.location.search).get('material');
    if (!path) return;
    sharedMaterialOpened = true;
    const item = [...documentList.querySelectorAll('.upload-item')].find((entry) => entry.dataset.path === path);
    const notice = document.createElement('p');
    notice.className = 'material-shared-notice';
    notice.setAttribute('role', 'status');
    if (item) {
      notice.textContent = 'Материал по вашей ссылке выделен в списке.';
      item.classList.add('material-shared');
      item.tabIndex = -1;
      item.focus({ preventScroll: true });
      item.scrollIntoView({ block: 'center', behavior: 'instant' });
    } else {
      notice.textContent = 'Материал по этой ссылке не найден. Возможно, он удалён. Остальные материалы доступны ниже.';
    }
    documentList.before(notice);
  }

  async function login(token) {
    showLoading(true);
    try {
      const user = await responseJson(await apiFetch('/user', {}, token));
      if (user.login?.toLowerCase() !== config.ownerLogin.toLowerCase()) {
        throw new Error(`Войдите в GitHub под владельцем репозитория @${config.ownerLogin}.`);
      }
      const repository = await responseJson(await apiFetch(`/repos/${encodeURIComponent(config.owner)}/${encodeURIComponent(config.repository)}`, {}, token));
      if (repository.permissions?.push === false) {
        throw new Error('У токена нет права записи в этот репозиторий.');
      }

      const manifest = await getManifest(token);
      const [performance, attendance, studentCerts] = await Promise.all([
        getGroupPerformance(token),
        getGroupAttendance(token),
        getStudentCertificates(token)
      ]);
      accessToken = token;
      uploadManifest = manifest.files;
      groupPerformance = performance.groups;
      attendanceSummaries = attendance.summaries;
      studentCertificates = studentCerts.items;
      setAuthenticated(true, user.login);
      renderManifest(uploadManifest, true);
    } finally {
      showLoading(false);
    }
  }

  async function writeFile(file, type, metadata, onStage = () => {}) {
    if (!accessToken) throw new Error('Сначала войдите в GitHub.');
    if (file.size > config.maxFileSize) throw new Error('Максимальный размер файла — 10 МБ.');
    const extension = file.name.toLowerCase().split('.').pop();
    if (!allowedExtensions[type]?.has(extension)) throw new Error('Этот формат файла не поддерживается.');
    const materialMetadata = type === 'documents'
      ? window.materialEditor.metadata(metadata || { title: file.name, category: documentCategory?.value })
      : null;
    if (type === 'group-data' && extension === 'pdf') {
      const imported = await extractPerformanceSummaryFromPdf(file);
      if (imported.groupWarning && !window.confirm(`${imported.groupWarning}\n\nПродолжить, используя группу из имени файла?`)) {
        if (groupExcelStatus) groupExcelStatus.textContent = 'Загрузка сводки PDF отменена. Проверьте код группы в имени файла и самой ведомости.';
        return;
      }
      const key = performanceKey(imported.group, imported.subject);
      const existing = groupPerformance.find((item) => performanceKey(item.group, item.subject) === key);
      const summary = {
        group: imported.group,
        subject: imported.subject,
        students: imported.students,
        success: imported.success,
        quality: imported.quality,
        average: imported.average,
        trained: existing?.trained ?? null
      };
      groupPerformance = await updateGroupPerformance(
        (groups) => [
          ...groups.filter((item) => performanceKey(item.group, item.subject) !== key),
          summary
        ],
        `Обновлена успеваемость группы: ${summary.group} — ${summary.subject}`
      );
      renderGroupPerformance();
      if (groupExcelStatus) {
        groupExcelStatus.textContent = `Успеваемость «${summary.group} — ${summary.subject}» рассчитана по ${summary.students} оценкам и сохранена в сводке GitHub. PDF, ФИО и индивидуальные оценки не загружались.`;
      }
      return;
    }
    let groupSubjects;
    let summaryWarning = '';
    if (extension === 'xlsx' || extension === 'xls') {
      if (type === 'group-data') {
        try {
          const attendance = await extractAttendanceSummaries(file);
          if (attendance.length) {
            const publicSummaries = attendance.map(({ group, subject, period, studentCount, sessionCount, dateCount, recordedMarks, unmarkedCells, possibleMarks, absenceCount, attendancePercent }) => ({
              group,
              subject,
              period,
              studentCount,
              sessionCount,
              dateCount,
              recordedMarks,
              unmarkedCells,
              possibleMarks,
              absenceCount,
              attendancePercent
            }));
            attendanceSummaries = await updateGroupAttendance(
              (summaries) => [
                ...summaries.filter((current) => !publicSummaries.some((next) =>
                  current.group === next.group
                  && current.subject === next.subject
                  && current.period === next.period
                )),
                ...publicSummaries
              ],
              `Обновлена сводка посещаемости группы: ${publicSummaries.map((summary) => summary.group).join(', ')}`
            );
            renderGroupAttendanceSummary();
            if (groupExcelStatus) {
              groupExcelStatus.textContent = `Сводка посещаемости группы «${attendance.map((summary) => summary.group).join(', ')}» сохранена в GitHub. Исходный Excel, ФИО и индивидуальные отметки не загружались.`;
            }
            return;
          }
        } catch (error) {
          throw new Error(`Не удалось прочитать журнал посещаемости: ${error.message}`);
        }
      }
      try {
        groupSubjects = await extractGroupSubjects(file);
      } catch (error) {
        if (type === 'group-data') {
          throw new Error(`Формат Excel не распознан. Нужна таблица «группа → предмет» или журнал с датами занятий, номерами студентов и ФИО. ${error.message}`);
        }
        summaryWarning = ` Файл сохранён, но сводка не сформирована: ${error.message}`;
        console.error(`Не удалось сформировать сводку из ${file.name}:`, error);
      }
    }
    const safeName = file.name.replace(/[\\/]/g, '_');
    const path = `${config.uploadDirectory}/${type}/${Date.now()}-${crypto.randomUUID()}-${safeName}`;
    onStage('Передача файла в GitHub…');
    const uploaded = await putFile(file, path);
    onStage('Файл передан. Сохранение описания и публикация…');
    const entry = { type, name: file.name, path, size: file.size, sha: uploaded.content.sha };
    if (type === 'documents') {
      Object.assign(entry, materialMetadata, { publishedAt: new Date().toISOString() });
    }
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
    const successMessage = `Файл «${file.name}» загружен в GitHub и опубликован.${summaryWarning}`;
    if (type === 'group-data' && groupExcelStatus) groupExcelStatus.textContent = successMessage;
    else showStatus(successMessage);
  }

  let documentDraft = null;
  function prepareDocuments(files) {
    if (!accessToken) { showStatus('Для загрузки войдите в GitHub.'); return; }
    if (documentDraft) { showStatus('Сначала опубликуйте или отмените выбранные материалы.'); documentDraft.focus(); return; }
    const queue = Array.from(files || []);
    if (!queue.length) return;
    let index = 0;
    function next() {
      if (index >= queue.length) {
        documentDraft = null;
        showStatus(`Публикация завершена. Сохранено файлов: ${queue.length}.`);
        document.querySelector('label[for="document-input"]')?.focus();
        return;
      }
      const file = queue[index];
      const extension = file.name.toLowerCase().split('.').pop();
      if (file.size > config.maxFileSize || !allowedExtensions.documents.has(extension)) {
        showStatus(`Файл «${file.name}» не добавлен: разрешены документы до 10 МБ. Выберите файлы заново.`);
        documentDraft = null;
        return;
      }
      const editor = window.materialEditor.create({ title: file.name, category: documentCategory?.value }, `Файл ${index + 1} из ${queue.length}: ${file.name}`);
      documentDraft = editor;
      editor.save.textContent = 'Опубликовать материал';
      editor.cancel.textContent = 'Отменить оставшиеся';
      editor.cancel.addEventListener('click', () => {
        editor.form.remove();
        documentDraft = null;
        showStatus(`Публикация отменена. Уже сохранено файлов: ${index}.`);
      });
      editor.form.addEventListener('submit', async (event) => {
        event.preventDefault();
        try {
          const metadata = editor.read();
          editor.busy(true);
          editor.status.textContent = 'Подготовка файла…';
          await writeFile(file, 'documents', metadata, (message) => { editor.status.textContent = message; });
          editor.form.remove();
          index += 1;
          next();
        } catch (error) {
          editor.status.textContent = `Не удалось опубликовать: ${error.message}. Сведения сохранены в форме — можно повторить попытку.`;
          editor.busy(false);
        }
      });
      dropzone.after(editor.form);
      editor.focus();
    }
    next();
  }

  async function handleFiles(files, type) {
    if (!accessToken) {
      const message = 'Для загрузки войдите в GitHub как владелец репозитория.';
      if (type === 'group-data' && groupExcelStatus) groupExcelStatus.textContent = message;
      else showStatus(message);
      return;
    }
    for (const file of Array.from(files || [])) {
      try {
        await writeFile(file, type);
      } catch (error) {
        const message = `Не удалось загрузить «${file.name}»: ${error.message}`;
        if (type === 'group-data' && groupExcelStatus) {
          groupExcelStatus.textContent = message;
          console.error(message, error);
        } else showStatus(message, error);
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
      const message = `Файл «${file.name}» удалён из GitHub.`;
      if (file.type === 'group-data' && groupExcelStatus) groupExcelStatus.textContent = message;
      else showStatus(message);
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
    prepareDocuments(event.currentTarget.files);
    event.currentTarget.value = '';
  });
  certificateInput?.addEventListener('change', (event) => {
    handleFiles(event.currentTarget.files, 'certificates');
    event.currentTarget.value = '';
  });
  groupExcelInput?.addEventListener('change', (event) => {
    handleFiles(event.currentTarget.files, 'group-data');
    event.currentTarget.value = '';
  });
  studentCertificateSearch?.addEventListener('input', renderStudentCertificates);
  studentCertificateGroupFilter?.addEventListener('change', renderStudentCertificates);
  materialSearch?.addEventListener('input', filterDocuments);
  materialCategoryFilter?.addEventListener('change', filterDocuments);
  materialTypeFilter?.addEventListener('change', filterDocuments);
  materialSort?.addEventListener('change', filterDocuments);
  materialReset?.addEventListener('click', () => {
    if (materialSearch) materialSearch.value = '';
    if (materialCategoryFilter) materialCategoryFilter.value = 'all';
    if (materialTypeFilter) materialTypeFilter.value = 'all';
    filterDocuments();
    materialSearch?.focus();
  });

  dropzone?.addEventListener('dragover', (event) => {
    event.preventDefault();
    dropzone.classList.add('is-dragover');
  });
  dropzone?.addEventListener('dragleave', () => dropzone.classList.remove('is-dragover'));
  dropzone?.addEventListener('drop', (event) => {
    event.preventDefault();
    dropzone.classList.remove('is-dragover');
    prepareDocuments(event.dataTransfer?.files);
  });

  loadMaterials();
  refreshGroupPerformance().catch((error) => {
    if (performanceStatus) performanceStatus.textContent = `Не удалось загрузить сводку по группам: ${error.message}`;
    console.error('Не удалось загрузить сводку по группам:', error);
  });
  refreshGroupAttendance().catch((error) => {
    if (groupAttendanceStatus) groupAttendanceStatus.textContent = `Не удалось загрузить сводку посещаемости: ${error.message}`;
    console.error('Не удалось загрузить сводку посещаемости:', error);
  });
  refreshAnnouncements().catch((error) => {
    if (announcementStatus) {
      announcementStatus.hidden = false;
      announcementStatus.textContent = `Не удалось загрузить объявления: ${error.message}`;
    }
    console.error('Не удалось загрузить объявления:', error);
  });
  refreshStudentCertificates().catch((error) => {
    if (studentCertificateStatus) {
      studentCertificateStatus.hidden = false;
      studentCertificateStatus.textContent = `Не удалось загрузить сертификаты студентов: ${error.message}`;
    }
    console.error('Не удалось загрузить сертификаты студентов:', error);
  });
})();
