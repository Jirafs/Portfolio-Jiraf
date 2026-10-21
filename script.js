document.documentElement.classList.add('js');
const menuButton = document.querySelector('.menu-toggle');
const nav = document.querySelector('.desktop-nav');
const revealItems = document.querySelectorAll('.reveal');

const projectData = {
  fitness: { title: 'FitClub Pro', index: '01 / 03', category: 'Спортивный комплекс', image: 'demos/previews/fitness.svg', intro: 'Демонстрационный сайт фитнес-клуба с расписанием и выбором тренировки.', task: 'Показать расписание, направления занятий и сценарий выбора тренировки.', result: 'Фильтр расписания, выбор тренировки и подтверждение демо-записи без отправки данных.', year: '2026', role: 'HTML, CSS, JavaScript · интерактивное демо' },
  kosmetica: { title: 'Kosmetica', index: '02 / 03', category: 'Косметический салон', image: 'demos/previews/kosmetica.svg', intro: 'Демонстрационный сайт студии ухода с выбором услуги, специалиста и времени.', task: 'Показать услуги студии и сценарий выбора услуги, специалиста и времени.', result: 'Выбор услуги, специалиста и времени с расчётом стоимости демо-записи.', year: '2026', role: 'HTML, CSS, JavaScript · интерактивное демо' },
  pulse: { title: 'Pulse Merch', index: '03 / 03', category: 'Интернет-магазин одежды', image: 'demos/previews/pulse.svg', intro: 'Демонстрационный магазин мерча с каталогом, размерами и корзиной.', task: 'Показать каталог одежды, выбор размеров и расчёт корзины без реальной оплаты.', result: 'Фильтры каталога, выбор размеров, сортировка и корзина с сохранением на устройстве.', year: '2026', role: 'HTML, CSS, JavaScript · интерактивное демо' }
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
