const menuButton = document.querySelector('.menu-toggle');
const nav = document.querySelector('.desktop-nav');
const revealItems = document.querySelectorAll('.reveal');

const projectData = {
  fitness: { title: 'FitClub Pro', index: '01 / 03', category: 'Спортивный комплекс', image: 'https://images.unsplash.com/photo-1571019614242-c5c5dee9f50b?auto=format&fit=crop&w=1600&q=85', intro: 'Система управления фитнес-клубом с записью на тренировки и подписками.', task: 'Создать платформу для онлайн-записи, управления абонементами и отслеживания прогресса клиентов.', result: '+25% продаж абонементов, автоматизация работы администраторов, интеграция с CRM.', year: '2025', role: 'PHP, MySQL, Bootstrap, Stripe' },
  kosmetica: { title: 'Kosmetica', index: '02 / 03', category: 'Косметический салон', image: 'https://images.unsplash.com/photo-1560066984-138dadb154c7?auto=format&fit=crop&w=1600&q=85', intro: 'Современный сайт для косметического салона с онлайн-записью.', task: 'Разработать систему бронирования услуг, управления клиентами и портфолио работ.', result: '+30% новых клиентов через онлайн-запись, удобное управление расписанием.', year: '2025', role: 'PHP, Laravel, REST API' },
  pulse: { title: 'Pulse Merch', index: '03 / 03', category: 'Интернет-магазин одежды', image: 'https://images.unsplash.com/photo-1441986300917-64674bd600d8?auto=format&fit=crop&w=1600&q=85', intro: 'Интернет-магазин мерча с каталогом товаров и корзиной покупок.', task: 'Создать полноценный e-commerce с каталогом, корзиной и интеграцией оплаты.', result: '+25% продаж через онлайн-канал, удобный интерфейс для клиентов.', year: '2025', role: 'PHP, JavaScript, MySQL, Payment Integration' }
};

const casePage = document.querySelector('.case-page');
if (casePage) {
  const requestedProject = new URLSearchParams(window.location.search).get('project');
  const defaultProject = Object.keys(projectData)[0];
  const projectKey = projectData[requestedProject] ? requestedProject : defaultProject;
  const project = projectData[projectKey];
  const projectOrder = Object.keys(projectData);
  const projectPosition = projectOrder.indexOf(projectKey);
  const previousKey = projectOrder[(projectPosition - 1 + projectOrder.length) % projectOrder.length];
  const nextKey = projectOrder[(projectPosition + 1) % projectOrder.length];
  document.title = `${project.title} — Jiraf`;
  document.querySelector('#case-index').textContent = project.index;
  document.querySelector('#case-category').textContent = project.category;
  document.querySelector('#case-title').textContent = project.title;
  document.querySelector('#case-image').src = project.image;
  document.querySelector('#case-image').alt = project.title;
  document.querySelector('#case-gallery-one').src = project.image;
  document.querySelector('#case-gallery-one').alt = `${project.title} — основной визуальный материал`;
  document.querySelector('#case-gallery-two').src = project.image.replace('w=1600', 'w=900&h=1100');
  document.querySelector('#case-gallery-two').alt = `${project.title} — деталь проекта`;
  document.querySelector('#case-intro').textContent = project.intro;
  document.querySelector('#case-statement').innerHTML = `${project.title} как цельный <em>опыт.</em>`;
  document.querySelector('#case-direction').textContent = `Работа с направлением «${project.category}», чтобы сделать задачу понятной и заметной.`;
  document.querySelector('#case-launch').textContent = project.result;
  document.querySelector('#case-prev').href = `project.html?project=${previousKey}`;
  document.querySelector('#case-prev').lastChild.textContent = projectData[previousKey].title;
  document.querySelector('#case-next').href = `project.html?project=${nextKey}`;
  document.querySelector('#case-next').lastChild.textContent = projectData[nextKey].title;
  document.querySelector('#case-task').textContent = project.task;
  document.querySelector('#case-result').textContent = project.result;
  document.querySelector('#case-year').textContent = project.year;
  document.querySelector('#case-role').textContent = project.role;
}

const yearElement = document.querySelector('#year');
if (yearElement) yearElement.textContent = new Date().getFullYear();

const cloudClient = window.supabase && window.supabaseConfig?.url && window.supabaseConfig?.key
  ? window.supabase.createClient(window.supabaseConfig.url, window.supabaseConfig.key)
  : null;

// --- Облачное хранилище файлов (Supabase Storage + таблица метаданных) ---
const storageBuckets = window.supabaseConfig?.buckets || {};
const filesTable = window.supabaseConfig?.filesTable || 'portfolio_files';

// Делает имя файла безопасным для ключа в бакете: уникальный префикс + имя без опасных символов.
function buildStoragePath(file) {
  const safeName = file.name
    .normalize('NFKD')
    .replace(/[^a-zA-Z0-9._-]+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(-80) || 'file';
  const unique = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  return `${unique}-${safeName}`;
}

// Загружает файл в бакет и возвращает публичную ссылку.
async function uploadFileToCloud(bucket, file) {
  if (!cloudClient || !bucket) throw new Error('storage-unavailable');
  const path = buildStoragePath(file);
  const { error } = await cloudClient.storage.from(bucket).upload(path, file, {
    cacheControl: '3600',
    upsert: false,
    contentType: file.type || undefined
  });
  if (error) throw error;
  const { data } = cloudClient.storage.from(bucket).getPublicUrl(path);
  return { path, publicUrl: data.publicUrl };
}

// Сохраняет метаданные файла в таблицу, чтобы его видели все посетители.
async function saveFileRecord(record) {
  if (!cloudClient) throw new Error('storage-unavailable');
  const { error } = await cloudClient.from(filesTable).insert(record);
  if (error) throw error;
}

// Удаляет файл из бакета и его запись из таблицы (только владелец).
async function deleteFileFromCloud(bucket, path) {
  if (!cloudClient) return;
  if (path) await cloudClient.storage.from(bucket).remove([path]);
}

async function deleteFileRecord(id) {
  if (!cloudClient) return;
  await cloudClient.from(filesTable).delete().eq('id', id);
}

// Полное удаление: сначала метаданные в таблице, потом файл в бакете.
async function removeCloudRecord(id, bucket, path) {
  if (!cloudClient || !id) return;
  try {
    await deleteFileRecord(id);
    await deleteFileFromCloud(bucket, path);
  } catch (error) {
    console.error('Не удалось удалить файл из облака:', error);
  }
}

// Читает опубликованные файлы из таблицы (доступно любому посетителю, если настроен RLS).
async function loadPublishedFiles() {
  if (!cloudClient) return [];
  const { data, error } = await cloudClient.from(filesTable).select('*').order('created_at', { ascending: false });
  if (error) {
    console.error('Не удалось получить список файлов из Supabase:', error);
    return [];
  }
  return data || [];
}

const cloudToggle = document.querySelector('#cloud-toggle');
const cloudContent = document.querySelector('#cloud-content');

cloudToggle?.addEventListener('click', () => {
  const isExpanded = cloudToggle.getAttribute('aria-expanded') === 'true';
  cloudToggle.setAttribute('aria-expanded', String(!isExpanded));
  if (cloudContent) {
    cloudContent.hidden = isExpanded;
  }
});

const ownerEmails = (window.supabaseConfig?.ownerEmails || []).map((email) => String(email).toLowerCase());
const cloudForm = document.querySelector('#cloud-form');
const cloudStatus = document.querySelector('#cloud-status');
const cloudLogout = document.querySelector('#cloud-logout');
const cloudReset = document.querySelector('#cloud-password-reset');
const cloudLoginButton = document.querySelector('#cloud-login-submit');
const cloudAccess = document.querySelector('#cloud-access');

function isOwnerAccount(email) {
  return ownerEmails.includes(String(email || '').toLowerCase());
}

function renderCloudState(session, isLoading = false) {
  const isAuthenticated = Boolean(session);
  const isOwner = isOwnerAccount(session?.user?.email);

  document.body.classList.toggle('cloud-authenticated', isOwner);

  if (cloudForm) cloudForm.hidden = isAuthenticated;
  if (cloudLogout) cloudLogout.hidden = !isAuthenticated;

  if (cloudStatus) {
    if (isLoading) {
      cloudStatus.textContent = 'Проверяю вход...';
    } else if (isOwner) {
      cloudStatus.textContent = `Выполнен вход: ${session.user.email}`;
    } else if (isAuthenticated) {
      cloudStatus.textContent = 'Вход выполнен, но у этого аккаунта нет доступа владельца.';
    } else {
      cloudStatus.textContent = '';
    }
  }

  return isOwner;
}

cloudForm?.addEventListener('submit', async (event) => {
  event.preventDefault();
  event.stopPropagation();
  if (!cloudClient) {
    if (cloudStatus) cloudStatus.textContent = 'Сервис входа недоступен.';
    return;
  }

  renderCloudState(undefined, true);
  const email = document.querySelector('#cloud-email')?.value.trim();
  const password = document.querySelector('#cloud-password')?.value;

  const { data, error } = await cloudClient.auth.signInWithPassword({ email, password });

  if (error) {
    if (cloudStatus) {
      cloudStatus.textContent = error.code === 'invalid_credentials'
        ? 'Неверный email или пароль.'
        : 'Не удалось войти. Попробуйте ещё раз.';
    }
    return;
  }

  if (!isOwnerAccount(data.session?.user?.email)) {
    await cloudClient.auth.signOut();
    if (cloudStatus) cloudStatus.textContent = 'Этот аккаунт не имеет доступа владельца.';
    return;
  }

  renderCloudState(data.session);
});

cloudLogout?.addEventListener('click', async () => {
  if (!cloudClient) return;
  await cloudClient.auth.signOut();
});

const googleLoginButton = document.querySelector('#google-login');

googleLoginButton?.addEventListener('click', async () => {
  if (!cloudClient) {
    if (cloudStatus) cloudStatus.textContent = 'Сервис входа недоступен.';
    return;
  }
  renderCloudState(undefined, true);
  const redirectUrl = `${window.location.origin}${window.location.pathname}`;
  const { data, error } = await cloudClient.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: redirectUrl } });
  if (error) {
    if (cloudStatus) cloudStatus.textContent = 'Не удалось войти через Google.';
  }
});

cloudReset?.addEventListener('click', async (event) => {
  event.preventDefault();
  event.stopPropagation();
  if (!cloudClient) {
    if (cloudStatus) cloudStatus.textContent = 'Сервис входа недоступен.';
    return;
  }

  const email = document.querySelector('#cloud-email')?.value.trim();
  if (!email) {
    if (cloudStatus) cloudStatus.textContent = 'Введите email, чтобы восстановить пароль.';
    return;
  }

  const redirectTo = `${window.location.origin}${window.location.pathname}#cloud-access`;
  if (cloudStatus) cloudStatus.textContent = 'Отправляю письмо...';
  const { error } = await cloudClient.auth.resetPasswordForEmail(email, { redirectTo });
  if (cloudStatus) {
    cloudStatus.textContent = error
      ? 'Не удалось отправить письмо. Попробуйте ещё раз.'
      : 'Письмо для восстановления пароля отправлено.';
  }
});

cloudClient?.auth.onAuthStateChange((_event, session) => renderCloudState(session));
cloudClient?.auth.getSession().then(({ data }) => {
  const session = data.session;
  if (session && !isOwnerAccount(session.user?.email)) {
    cloudClient.auth.signOut();
    return;
  }
  renderCloudState(session);
}).catch(() => {});

const documentInput = document.querySelector('#document-input');
const uploadDropzone = document.querySelector('#upload-dropzone');
const uploadList = document.querySelector('#upload-list');
const uploadedDocuments = new Map();
const storageRequest = indexedDB.open('jiraf-portfolio', 1);
storageRequest.onupgradeneeded = () => storageRequest.result.createObjectStore('uploads', { keyPath: 'id' });
const storageReady = new Promise((resolve, reject) => {
  storageRequest.onsuccess = () => resolve(storageRequest.result);
  storageRequest.onerror = () => reject(storageRequest.error);
});

function saveUpload(record) {
  return storageReady.then((database) => new Promise((resolve, reject) => {
    const transaction = database.transaction('uploads', 'readwrite');
    transaction.objectStore('uploads').put(record);
    transaction.oncomplete = resolve;
    transaction.onerror = () => reject(transaction.error);
  }));
}

function deleteUpload(id) {
  return storageReady.then((database) => database.transaction('uploads', 'readwrite').objectStore('uploads').delete(id));
}

function getUploads() {
  return storageReady.then((database) => new Promise((resolve, reject) => {
    const request = database.transaction('uploads').objectStore('uploads').getAll();
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  }));
}

// Показывает статус загрузки/ошибки рядом со списком документов.
function setUploadStatus(message, isError = false) {
  if (!cloudStatus) return;
  cloudStatus.textContent = message;
  cloudStatus.style.color = isError ? 'var(--orange)' : '';
}

function renderDocuments(files, shouldSave = true) {
  Array.from(files).forEach((file) => {
    const documentId = `${file.name}-${file.size}-${file.lastModified}`;
    if (uploadedDocuments.has(documentId)) return;
    const documentUrl = URL.createObjectURL(file);
    uploadedDocuments.set(documentId, documentUrl);

    // Ссылка на скачивание из облака появится после успешной загрузки.
    let cloudDownloadLink = null;
    if (shouldSave) {
      setUploadStatus(`Загружаю «${file.name}»...`);
      uploadFileToCloud(storageBuckets.documents, file).then(({ path, publicUrl }) =>
        saveFileRecord({
          kind: 'document',
          file_name: file.name,
          file_size: file.size,
          file_type: file.type || '',
          bucket: storageBuckets.documents,
          storage_path: path,
          public_url: publicUrl
        }).then(() => {
          if (cloudDownloadLink) cloudDownloadLink.href = publicUrl;
          setUploadStatus(`«${file.name}» опубликован.`);
        })
      ).catch((error) => {
        console.error('Не удалось загрузить документ в облако:', error);
        setUploadStatus('Не удалось загрузить файл в облако. Проверьте настройки Supabase.', true);
      });
    }

    const item = document.createElement('li');
    item.className = 'upload-item';
    item.dataset.documentId = documentId;
    const documentContent = document.createElement('div');
    documentContent.className = 'document-content';
    const link = document.createElement('a');
    link.href = documentUrl;
    link.textContent = `${file.name} (${Math.ceil(file.size / 1024)} КБ)`;
    const preview = document.createElement('div');
    preview.className = 'document-preview';
    const isWordDocument = file.name.toLowerCase().endsWith('.docx');
    if (!isWordDocument) link.download = file.name;
    if (isWordDocument) {
      preview.classList.add('is-visible');
      link.setAttribute('aria-expanded', 'true');
      link.title = 'Открыть или скрыть чтение документа';
      link.addEventListener('click', (event) => {
        event.preventDefault();
        const isVisible = preview.classList.toggle('is-visible');
        link.setAttribute('aria-expanded', String(isVisible));
      });
      const downloadLink = document.createElement('a');
      downloadLink.href = documentUrl;
      downloadLink.download = file.name;
      downloadLink.className = 'document-download';
      downloadLink.textContent = 'Скачать';
      cloudDownloadLink = downloadLink;
      documentContent.append(downloadLink);
      preview.innerHTML = '<span class="document-preview-loading">Читаю документ...</span>';
      if (window.mammoth) {
        file.arrayBuffer().then((arrayBuffer) => window.mammoth.convertToHtml({ arrayBuffer })).then((result) => {
          const previewDocument = new DOMParser().parseFromString(result.value, 'text/html');
          previewDocument.querySelectorAll('script,style,iframe,object,embed').forEach((element) => element.remove());
          preview.innerHTML = previewDocument.body.innerHTML || '<span class="document-preview-loading">В документе нет текста.</span>';
        }).catch(() => {
          preview.innerHTML = '<span class="document-preview-loading">Не удалось прочитать этот DOCX.</span>';
        });
      } else {
        preview.innerHTML = '<span class="document-preview-loading">Для чтения нужен доступ к конвертеру Word.</span>';
      }
    }
    documentContent.append(link, preview);
    const removeButton = document.createElement('button');
    removeButton.className = 'upload-remove owner-only';
    removeButton.type = 'button';
    removeButton.setAttribute('aria-label', `Удалить ${file.name}`);
    removeButton.textContent = '×';
    removeButton.addEventListener('click', () => {
      URL.revokeObjectURL(documentUrl);
      uploadedDocuments.delete(documentId);
      deleteUpload(`document-${documentId}`).catch(() => {});
      removeCloudRecord(item.dataset.recordId, storageBuckets.documents, item.dataset.storagePath);
      item.remove();
    });
    item.append(documentContent, removeButton);
    uploadList.append(item);
  });
}

documentInput?.addEventListener('change', (event) => renderDocuments(event.target.files));
uploadDropzone?.addEventListener('dragover', (event) => {
  event.preventDefault();
  uploadDropzone.classList.add('is-dragover');
});
uploadDropzone?.addEventListener('dragleave', () => uploadDropzone.classList.remove('is-dragover'));
uploadDropzone?.addEventListener('drop', (event) => {
  event.preventDefault();
  uploadDropzone.classList.remove('is-dragover');
  renderDocuments(event.dataTransfer.files);
});

const certificateInput = document.querySelector('#certificate-input');
const certificateList = document.querySelector('#certificate-list');
const certificateUrls = new Map();

function renderCertificates(files, shouldSave = true) {
  Array.from(files).forEach((file) => {
    const certificateId = `${file.name}-${file.size}-${file.lastModified}`;
    if (certificateUrls.has(certificateId)) return;
    const certificateUrl = URL.createObjectURL(file);
    certificateUrls.set(certificateId, certificateUrl);

    // Загрузка сертификата в облако + публикация для посетителей.
    let cloudDownloadLink = null;
    if (shouldSave) {
      setUploadStatus(`Загружаю «${file.name}»...`);
      uploadFileToCloud(storageBuckets.certificates, file).then(({ path, publicUrl }) =>
        saveFileRecord({
          kind: 'certificate',
          file_name: file.name,
          file_size: file.size,
          file_type: file.type || '',
          bucket: storageBuckets.certificates,
          storage_path: path,
          public_url: publicUrl
        }).then(() => {
          if (cloudDownloadLink) cloudDownloadLink.href = publicUrl;
          setUploadStatus(`«${file.name}» опубликован.`);
        })
      ).catch((error) => {
        console.error('Не удалось загрузить сертификат в облако:', error);
        setUploadStatus('Не удалось загрузить файл в облако. Проверьте настройки Supabase.', true);
      });
    }

    const item = document.createElement('li');
    const link = document.createElement('a');
    link.href = certificateUrl;
    link.textContent = `${file.name} (${Math.ceil(file.size / 1024)} КБ)`;
    link.setAttribute('aria-expanded', 'false');
    link.title = 'Открыть или скрыть сертификат';
    link.addEventListener('click', (event) => {
      event.preventDefault();
      const isExpanded = item.classList.toggle('is-expanded');
      link.setAttribute('aria-expanded', String(isExpanded));
      const imagePreview = item.querySelector('img');
      const pdfPreview = item.querySelector('iframe');
      if (imagePreview) imagePreview.hidden = !isExpanded;
      if (pdfPreview) pdfPreview.hidden = !isExpanded;
    });
    item.append(link);
    const downloadLink = document.createElement('a');
    downloadLink.href = certificateUrl;
    downloadLink.download = file.name;
    downloadLink.className = 'document-download';
    downloadLink.textContent = 'Скачать';
    cloudDownloadLink = downloadLink;
    item.append(downloadLink);
    if (file.type.startsWith('image/')) {
      const image = document.createElement('img');
      image.src = certificateUrl;
      image.alt = `Предпросмотр сертификата ${file.name}`;
      item.append(image);
    } else if (file.type === 'application/pdf') {
      const pdfPreview = document.createElement('iframe');
      pdfPreview.className = 'certificate-preview';
      pdfPreview.src = certificateUrl;
      pdfPreview.title = `Предпросмотр сертификата ${file.name}`;
      pdfPreview.hidden = true;
      item.append(pdfPreview);
    }
    const removeButton = document.createElement('button');
    removeButton.className = 'upload-remove owner-only';
    removeButton.type = 'button';
    removeButton.setAttribute('aria-label', `Удалить сертификат ${file.name}`);
    removeButton.textContent = '×';
    removeButton.addEventListener('click', () => {
      URL.revokeObjectURL(certificateUrl);
      certificateUrls.delete(certificateId);
      deleteUpload(`certificate-${certificateId}`).catch(() => {});
      removeCloudRecord(item.dataset.recordId, storageBuckets.certificates, item.dataset.storagePath);
      item.remove();
    });
    item.append(removeButton);
    certificateList.append(item);
  });
}

certificateInput?.addEventListener('change', (event) => renderCertificates(event.target.files));

// --- Публичные записи из облака: те же элементы, но с ссылками Supabase ---

function renderCloudDocument(record) {
  const sizeKb = record.file_size ? Math.ceil(record.file_size / 1024) : 0;
  const item = document.createElement('li');
  item.className = 'upload-item';
  item.dataset.recordId = record.id;
  item.dataset.storagePath = record.storage_path || '';
  const content = document.createElement('div');
  content.className = 'document-content';
  const link = document.createElement('a');
  link.href = record.public_url;
  link.target = '_blank';
  link.rel = 'noreferrer';
  link.textContent = sizeKb ? `${record.file_name} (${sizeKb} КБ)` : record.file_name;
  const downloadLink = document.createElement('a');
  downloadLink.href = record.public_url;
  downloadLink.download = record.file_name;
  downloadLink.className = 'document-download';
  downloadLink.textContent = 'Скачать';
  content.append(link, downloadLink);
  const removeButton = document.createElement('button');
  removeButton.className = 'upload-remove owner-only';
  removeButton.type = 'button';
  removeButton.setAttribute('aria-label', `Удалить ${record.file_name}`);
  removeButton.textContent = '×';
  removeButton.addEventListener('click', () => {
    removeCloudRecord(record.id, record.bucket, record.storage_path);
    item.remove();
  });
  item.append(content, removeButton);
  uploadList.append(item);
}

function renderCloudCertificate(record) {
  const sizeKb = record.file_size ? Math.ceil(record.file_size / 1024) : 0;
  const item = document.createElement('li');
  item.dataset.recordId = record.id;
  item.dataset.storagePath = record.storage_path || '';
  const link = document.createElement('a');
  link.href = record.public_url;
  link.textContent = sizeKb ? `${record.file_name} (${sizeKb} КБ)` : record.file_name;
  link.setAttribute('aria-expanded', 'false');
  link.title = 'Открыть или скрыть сертификат';
  link.addEventListener('click', (event) => {
    event.preventDefault();
    const isExpanded = item.classList.toggle('is-expanded');
    link.setAttribute('aria-expanded', String(isExpanded));
    const imagePreview = item.querySelector('img');
    const pdfPreview = item.querySelector('iframe');
    if (imagePreview) imagePreview.hidden = !isExpanded;
    if (pdfPreview) pdfPreview.hidden = !isExpanded;
  });
  item.append(link);
  const downloadLink = document.createElement('a');
  downloadLink.href = record.public_url;
  downloadLink.download = record.file_name;
  downloadLink.className = 'document-download';
  downloadLink.textContent = 'Скачать';
  item.append(downloadLink);
  const fileType = record.file_type || '';
  if (fileType.startsWith('image/')) {
    const image = document.createElement('img');
    image.src = record.public_url;
    image.alt = `Сертификат ${record.file_name}`;
    image.hidden = true;
    item.append(image);
  } else if (fileType === 'application/pdf' || /[.]pdf$/i.test(record.file_name || '')) {
    const pdfPreview = document.createElement('iframe');
    pdfPreview.className = 'certificate-preview';
    pdfPreview.src = record.public_url;
    pdfPreview.title = `Предпросмотр сертификата ${record.file_name}`;
    pdfPreview.hidden = true;
    item.append(pdfPreview);
  }
  const removeButton = document.createElement('button');
  removeButton.className = 'upload-remove owner-only';
  removeButton.type = 'button';
  removeButton.setAttribute('aria-label', `Удалить сертификат ${record.file_name}`);
  removeButton.textContent = '×';
  removeButton.addEventListener('click', () => {
    removeCloudRecord(record.id, record.bucket, record.storage_path);
    item.remove();
  });
  item.append(removeButton);
  certificateList.append(item);
}

// Загружает опубликованные файлы при открытии страницы — для всех посетителей.
async function renderCloudFiles() {
  if (!cloudClient || !uploadList) return;
  const records = await loadPublishedFiles();
  records.filter((record) => record.kind === 'document').forEach(renderCloudDocument);
  records.filter((record) => record.kind === 'certificate').forEach(renderCloudCertificate);
}

const achievementForm = document.querySelector('#achievement-form');
const achievementList = document.querySelector('#achievement-list');
achievementForm?.addEventListener('submit', (event) => {
  event.preventDefault();
  const title = document.querySelector('#achievement-title').value.trim();
  const year = document.querySelector('#achievement-year').value.trim();
  const description = document.querySelector('#achievement-description').value.trim();
  addAchievement(title, year, description);
  achievementForm.reset();
});

function saveAchievements() {
  const achievements = Array.from(achievementList.querySelectorAll('.achievement-content')).map((entry) => ({
    title: entry.querySelector('strong').textContent,
    description: entry.querySelector('small').textContent
  }));
  localStorage.setItem('jiraf-achievements', JSON.stringify(achievements));
}

function addAchievement(title, year, description, shouldSave = true) {
  const item = document.createElement('li');
  const content = document.createElement('div');
  content.className = 'achievement-content';
  content.setAttribute('role', 'button');
  content.setAttribute('tabindex', '0');
  content.setAttribute('aria-expanded', 'false');
  const heading = document.createElement('strong');
  heading.textContent = year ? `${title} / ${year}` : title;
  const details = document.createElement('small');
  details.textContent = description;
  details.hidden = true;
  const toggleAchievement = () => {
    details.hidden = !details.hidden;
    content.setAttribute('aria-expanded', String(!details.hidden));
  };
  content.addEventListener('click', toggleAchievement);
  content.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      toggleAchievement();
    }
  });
  content.append(heading, details);
  const removeButton = document.createElement('button');
  removeButton.className = 'upload-remove owner-only';
  removeButton.type = 'button';
  removeButton.setAttribute('aria-label', `Удалить достижение ${title}`);
  removeButton.textContent = '×';
  removeButton.addEventListener('click', () => {
    item.remove();
    saveAchievements();
  });
  item.append(content, removeButton);
  achievementList.append(item);
  if (shouldSave) saveAchievements();
}

// Основной источник — облако: его видят все посетители.
// Если Supabase недоступен, показываем локальные файлы из IndexedDB (только владельцу).
renderCloudFiles().then(() => {
  if (cloudClient) return;
  return getUploads().then((uploads) => {
    uploads.filter((upload) => upload.kind === 'document').forEach((upload) => renderDocuments([upload.file], false));
    uploads.filter((upload) => upload.kind === 'certificate').forEach((upload) => renderCertificates([upload.file], false));
  });
}).catch(() => {});

try {
  JSON.parse(localStorage.getItem('jiraf-achievements') || '[]').forEach((achievement) => {
    const [title, year] = achievement.title.split(' / ');
    addAchievement(title, year, achievement.description, false);
  });
} catch (error) {
  localStorage.removeItem('jiraf-achievements');
}

menuButton?.addEventListener('click', () => {
  const isOpen = menuButton.getAttribute('aria-expanded') === 'true';
  menuButton.setAttribute('aria-expanded', String(!isOpen));
  nav.classList.toggle('nav-open', !isOpen);
});

nav?.querySelectorAll('a').forEach((link) => {
  link.addEventListener('click', () => {
    menuButton?.setAttribute('aria-expanded', 'false');
    nav.classList.remove('nav-open');
  });
});

const observer = new IntersectionObserver((entries) => {
  entries.forEach((entry) => {
    if (entry.isIntersecting) {
      entry.target.classList.add('visible');
      observer.unobserve(entry.target);
    }
  });
}, { threshold: 0.12 });

revealItems.forEach((item) => observer.observe(item));
