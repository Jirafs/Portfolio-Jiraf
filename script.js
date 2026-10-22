document.documentElement.classList.add('js');
const menuButton = document.querySelector('.menu-toggle');
const nav = document.querySelector('.desktop-nav');
const revealItems = document.querySelectorAll('.reveal');

const projectData = {
  "kosmetica": {
    "title": "Kosmetica",
    "index": "01 / 04",
    "category": "Сайт студии ухода",
    "level": "01 · Базовый",
    "pages": "4 страницы",
    "image": "demos/screens/kosmetica-desktop.jpg",
    "intro": "Сайт услуг с ясной структурой: знакомство со студией, выбор процедуры и демонстрационная запись.",
    "task": "Помочь посетителю выбрать услугу и перейти к записи без лишних шагов.",
    "result": "Каталог услуг, информация о студии и форма выбора услуги, специалиста и времени.",
    "role": "HTML · CSS · JavaScript",
    "system": "Семантические страницы, адаптивная сетка, переиспользуемые стили и обработка формы.",
    "next": "Подключение реального расписания и отправки заявок на сервер.",
    "features": [
      "Адаптивная вёрстка четырёх страниц",
      "Переход от услуги к заполненной форме",
      "Выбор специалиста и времени",
      "Расчёт стоимости демо-записи"
    ],
    "detail": "services.html",
    "detailTitle": "Страница услуг",
    "mobilePage": "booking.html",
    "mobileTitle": "Запись на телефоне",
    "boundary": "Форма демонстрирует сценарий записи. Заявки не отправляются, реальное расписание не подключено.",
    "year": "2026"
  },
  "fitness": {
    "title": "FitClub Pro",
    "index": "02 / 04",
    "category": "Сервис фитнес-клуба",
    "level": "02 · Средний",
    "pages": "5 страниц",
    "image": "demos/screens/fitness-desktop.jpg",
    "intro": "Из презентационного сайта — в сервис: расписание тренировок, фильтры и личный план занятий.",
    "task": "Объединить выбор направления, тренера и расписания в один последовательный сценарий.",
    "result": "Посетитель фильтрует занятия, переходит от тренера к расписанию и сохраняет тренировки в свой план.",
    "role": "HTML · CSS · JavaScript · localStorage",
    "system": "Общее состояние личного плана между страницами и фильтрация расписания по нескольким условиям.",
    "next": "Серверное расписание, учёт свободных мест и подтверждение реальной записи.",
    "features": [
      "Фильтры по дню и направлению",
      "Переход от тренера к его занятиям",
      "Сохранение личного плана тренировок",
      "Удаление занятий из плана"
    ],
    "detail": "schedule.html",
    "detailTitle": "Расписание с фильтрами",
    "mobilePage": "schedule.html",
    "mobileTitle": "Расписание на телефоне",
    "boundary": "Личный план сохраняется в браузере. Места в настоящем клубе не бронируются.",
    "year": "2026"
  },
  "pulse": {
    "title": "Pulse Merch",
    "index": "03 / 04",
    "category": "Интернет-магазин",
    "level": "03 · Продвинутый",
    "pages": "7 страниц",
    "image": "demos/screens/pulse-desktop.jpg",
    "intro": "Полный клиентский сценарий магазина: от поиска вещи и выбора размера до корзины и демо-квитанции.",
    "task": "Связать каталог, избранное, размеры, корзину, промокод и оформление заказа.",
    "result": "Корзина пересчитывает стоимость, скидку и доставку; выбранные товары доступны после обновления страницы.",
    "role": "HTML · CSS · JavaScript · Web Storage",
    "system": "Состояние товаров между страницами, идентификация позиций по размеру и производные расчёты корзины.",
    "next": "Подключение каталога, склада, серверных заказов и платёжного провайдера.",
    "features": [
      "Поиск и фильтры каталога",
      "Избранное и выбор размера",
      "Корзина с количеством и пересчётом суммы",
      "Промокод PULSE10 и доставка",
      "Оформление без платежей и демо-квитанция"
    ],
    "detail": "catalog.html",
    "detailTitle": "Каталог и выбор товаров",
    "mobilePage": "catalog.html",
    "mobileTitle": "Каталог на телефоне",
    "boundary": "Это демонстрационный магазин. Оплата, отправка заказа и реальные остатки отсутствуют.",
    "year": "2026"
  },
  "orbit": {
    "title": "Orbit Workspace",
    "index": "04 / 04",
    "category": "Управление проектами",
    "level": "04 · Сложный",
    "pages": "5 разделов",
    "image": "demos/screens/orbit-desktop.jpg",
    "intro": "Приложение для команды: задачи, канбан-доска, чек-листы, сроки и аналитика из общего набора данных.",
    "task": "Спроектировать связанное приложение с несколькими сущностями и согласованным состоянием на пяти экранах.",
    "result": "Создание, редактирование и удаление задач, перенос между статусами, расчёт показателей, импорт и экспорт пространства.",
    "role": "HTML · CSS · JavaScript · DOM API · Web Storage",
    "system": "Отдельная модель данных с валидацией, вычисляемая аналитика, журнал действий и синхронизация вкладок через storage events.",
    "next": "Серверная база, аккаунты, права доступа и совместная работа в реальном времени.",
    "features": [
      "CRUD задач и канбан с перетаскиванием",
      "Исполнители, приоритеты, сроки и чек-листы",
      "Поиск и пять совместимых фильтров",
      "Аналитика по текущим задачам",
      "Создание проектов и участников",
      "Проверяемый импорт и экспорт JSON"
    ],
    "detail": "board.html",
    "detailTitle": "Канбан-доска",
    "mobilePage": "board.html",
    "mobileTitle": "Редактирование задачи на телефоне",
    "boundary": "Сложное клиентское демо. Данные хранятся локально; серверная синхронизация, авторизация и права доступа не реализованы.",
    "year": "2026"
  }
};

const casePage = document.querySelector('.case-page');
if (casePage) {
  const requestedProject = new URLSearchParams(window.location.search).get('project');
  const projectKey = Object.hasOwn(projectData, requestedProject) ? requestedProject : 'fitness';
  const project = projectData[projectKey];
  const projectOrder = Object.keys(projectData);
  const projectPosition = projectOrder.indexOf(projectKey);
  const previousKey = projectOrder[(projectPosition - 1 + projectOrder.length) % projectOrder.length];
  const nextKey = projectOrder[(projectPosition + 1) % projectOrder.length];
  document.title = `${project.title} — Jiraf`;
  document.querySelector('#case-demo').href = `demos/${projectKey}/index.html`;
  document.querySelector('#case-index').textContent = project.index;
  document.querySelector('#case-category').textContent = project.category;
  document.querySelector('#case-title').textContent = project.title;
  document.querySelector('#case-image').src = project.image;
  document.querySelector('#case-image').alt = project.title;
  document.querySelector('#case-gallery-one').src = `demos/screens/${projectKey}-detail.jpg`;
  document.querySelector('#case-gallery-one').alt = `${project.title} — ${project.detailTitle}`;
  document.querySelector('#case-gallery-two').src = `demos/screens/${projectKey}-mobile.jpg`;
  document.querySelector('#case-gallery-two').alt = `${project.title} — ${project.mobileTitle}`;
  document.querySelector('#case-intro').textContent = project.intro;
  document.querySelector('#case-statement').innerHTML = `${project.title} как цельный <em>опыт.</em>`;
  document.querySelector('#case-direction').textContent = project.task;
  document.querySelector('#case-launch').textContent = project.result;
  document.querySelector('#case-prev').href = `project.html?project=${previousKey}`;
  document.querySelector('#case-prev').lastChild.textContent = projectData[previousKey].title;
  document.querySelector('#case-next').href = `project.html?project=${nextKey}`;
  document.querySelector('#case-next').lastChild.textContent = projectData[nextKey].title;
  document.querySelector('#case-task').textContent = project.task;
  document.querySelector('#case-result').textContent = project.result;
  document.querySelector('#case-year').textContent = project.year;
  document.querySelector('#case-role').textContent = project.role;
  document.querySelector('#case-level').textContent = `${project.level} · ${project.pages}`;
  document.querySelector('#case-system').textContent = project.system;
  document.querySelector('#case-next-step').textContent = project.next;
  document.querySelector('#case-boundary').textContent = project.boundary;
  document.querySelector('#case-functions').textContent = project.features.map(feature => '✓ ' + feature).join('\n');
  document.querySelector('#case-screen-one-label').textContent = project.detailTitle;
  document.querySelector('#case-screen-two-label').textContent = project.mobileTitle;
  document.querySelector('#case-screen-one-link').href = `demos/${projectKey}/${project.detail}`;
  document.querySelector('#case-screen-two-link').href = `demos/${projectKey}/${project.mobilePage}`;

}

const yearElement = document.querySelector('#year');
if (yearElement) yearElement.textContent = new Date().getFullYear();

const cloudToggle = document.querySelector('#cloud-toggle');
const cloudContent = document.querySelector('#cloud-content');

cloudToggle?.addEventListener('click', () => {
  const isExpanded = cloudToggle.getAttribute('aria-expanded') === 'true';
  cloudToggle.setAttribute('aria-expanded', String(!isExpanded));
  if (cloudContent) {
    cloudContent.hidden = isExpanded;
  }
});

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
