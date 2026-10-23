const fs = require("node:fs");
const path = require("node:path");
const root = path.resolve(__dirname, "..");
const out = path.join(root, "learning");
const courses = JSON.parse(
  fs.readFileSync(path.join(out, "courses.json"), "utf8"),
);
const esc = (v) =>
  String(v).replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
const links = [
  ["index", "Все дисциплины"],
  ...courses.map((c) => [
    c.id,
    c.id === "operating-systems"
      ? "Операционные системы"
      : c.id === "react"
        ? "React"
        : "XML",
  ]),
  ["xml-lab", "Практикум XML"],
];
function layout(id, title, description, body) {
  const canonical =
    "https://jirafs.github.io/Portfolio-Jiraf/learning/" + id + ".html";
  return `<!doctype html><html lang="ru"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(title)} — учебный раздел Jiraf</title><meta name="description" content="${esc(description)}"><link rel="canonical" href="${canonical}"><meta property="og:title" content="${esc(title)} — учебный раздел Jiraf"><meta property="og:description" content="${esc(description)}"><meta property="og:url" content="${canonical}"><meta property="og:type" content="website"><meta property="og:image" content="https://jirafs.github.io/Portfolio-Jiraf/assets/lesson-xml-2026/lesson-xml-teacher.webp"><link rel="stylesheet" href="learning.css?v=1"></head><body><a class="button skip" href="#main">К содержимому</a><div class="shell"><header class="topbar"><a class="brand" href="../pedagog.html">JIRAF<span> / учебный раздел</span></a><nav aria-label="Учебные разделы">${links.map(([key, label]) => `<a href="${key}.html"${key === id ? ' aria-current="page"' : ""}>${label}</a>`).join("")}</nav></header><main id="main">${body}</main><footer class="footer"><span>Михайлов Даниил Николаевич · учебные материалы</span><a href="../pedagog.html#methods">Педагогический сайт</a><a href="mailto:dnmikhajlov@fa.ru">dnmikhajlov@fa.ru ↗</a></footer></div></body></html>\n`;
}
const list = (items) =>
  `<ul class="checks">${items.map((t) => `<li>${esc(t)}</li>`).join("")}</ul>`;
const courseCards = courses
  .map(
    (c) =>
      `<article class="card course-card"><span class="course-number">${c.number} / ${esc(c.tag)}</span><h3>${esc(c.title)}</h3><p>${esc(c.intro)}</p><p class="note">Перед началом: ${esc(c.prerequisites)}</p><a class="button" href="${c.id}.html">Открыть дисциплину ↗</a></article>`,
  )
  .join("");
fs.writeFileSync(
  path.join(out, "index.html"),
  layout(
    "index",
    "С чего начать обучение",
    "Дисциплины, задания и материалы преподавателя: React, XML, операционные системы.",
    `<section class="hero"><p class="eyebrow">Студентам / материалы и практика</p><h1>От темы —<br>к своему решению.</h1><p class="lead">Выберите дисциплину, пройдите маршрут и проверьте работу по понятным критериям. Материалы для скачивания собраны на странице каждой темы.</p><div class="actions"><a class="button" href="xml-lab.html">Попробовать практикум XML →</a><a class="button secondary" href="#courses">Выбрать дисциплину ↓</a></div></section><section class="section" id="courses"><h2>Три направления для практики</h2><div class="grid">${courseCards}</div></section><section class="section feature"><img src="../assets/lesson-xml-2026/lesson-xml-teacher.webp" alt="Разбор практического кейса на открытом занятии по XML" width="1920" height="1080" loading="lazy" decoding="async"><div><p class="eyebrow">Практика без установки программ</p><h2>Измените XML.<br>Увидьте результат.</h2><p class="muted">Три примера, редактор, проверка структуры и таблица из ваших данных. Можно открыть свой XML, сохранить черновик и скачать результат.</p><a class="button" href="xml-lab.html">Открыть практикум ↗</a></div></section><section class="section two"><div><h2>Как работать с материалами</h2><ol class="checks"><li>Проверьте, какие знания нужны перед началом.</li><li>Изучите материал и выполните задание.</li><li>Пройдите самопроверку и подготовьте результат.</li></ol></div><div class="panel"><h3>Нужна помощь?</h3><p>Напишите тему, что уже получилось и на каком шаге возникла трудность. Для вопроса по коду приложите небольшой воспроизводимый пример.</p><a href="mailto:dnmikhajlov@fa.ru">Написать преподавателю ↗</a></div></section>`,
  ),
);
for (const c of courses) {
  const route = `<ol class="route">${c.route.map((r) => `<li><h3>${esc(r.title)}</h3><p class="muted">${esc(r.text)}</p><p class="practice"><strong>Попробуйте:</strong> ${esc(r.practice)}</p></li>`).join("")}</ol>`;
  const materials = c.materials
    .map(
      (m) =>
        `<article><h3>${esc(m.title)}</h3><p class="note">${esc(m.format)}</p><p>${esc(m.description)}</p><a href="${m.href}" download>Скачать материал ↓</a></article>`,
    )
    .join("");
  const next = courses.find((x) => x.id === c.next);
  fs.writeFileSync(
    path.join(out, c.id + ".html"),
    layout(
      c.id,
      c.title,
      c.intro,
      `<p class="breadcrumbs"><a href="index.html">Все дисциплины</a> / ${esc(c.title)}</p><section class="hero"><p class="eyebrow">${c.number} / ${esc(c.tag)}</p><h1>${esc(c.title)}</h1><p class="lead">${esc(c.intro)}</p><div class="actions">${c.id === "xml" ? '<a class="button" href="xml-lab.html">Запустить практикум XML →</a>' : ""}<a class="button ${c.id === "xml" ? "secondary" : ""}" href="#materials">Материалы для скачивания ↓</a><a class="button secondary" href="#assignment">Перейти к заданию</a></div></section><section class="section two"><article class="panel"><h2>Перед началом</h2><p>${esc(c.prerequisites)}</p><p class="note">Маршрут помогает организовать самостоятельную работу с опубликованными материалами.</p></article><article><h2>Что вы освоите</h2>${list(c.outcomes)}</article></section><section class="section"><p class="eyebrow">Порядок самостоятельной работы</p><h2>Пройдите тему по шагам</h2>${route}</section><section class="section two" id="assignment"><article class="panel"><p class="eyebrow">Итоговая практика</p><h2>Что подготовить</h2><p>${esc(c.assignment)}</p>${c.id === "xml" ? '<a class="button" href="xml-lab.html">Выполнить в практикуме ↗</a>' : ""}</article><article><h2>Критерии самопроверки</h2>${list(c.criteria)}</article></section><section class="section" id="materials"><h2>Материалы дисциплины</h2><div class="material-list">${materials}</div></section><section class="section"><p class="eyebrow">Продолжить обучение</p><h2>${esc(next.title)}</h2><p class="muted">Выберите следующую тему или вернитесь к общему списку.</p><div class="actions"><a class="button" href="${next.id}.html">Открыть дисциплину ↗</a><a class="button secondary" href="index.html">Все дисциплины</a></div></section>`,
    ),
  );
}
const lab = `<p class="breadcrumbs"><a href="xml.html">XML и веб-приложения</a> / Практикум</p><section class="hero lab-hero"><p class="eyebrow">Лабораторная работа / XML → таблица</p><h1>Измените данные.<br>Проверьте результат.</h1><p class="lead">Выберите пример, добавьте третью запись и нажмите «Запустить». Практикум проверит XML и построит таблицу.</p><p class="note">Файлы обрабатываются в браузере. Черновик сохраняется на этом устройстве по кнопке «Сохранить черновик».</p></section><noscript><p class="status error">Для работы редактора включите JavaScript. <a href="xml.html#materials">Материалы занятия доступны для скачивания.</a></p></noscript><div id="lab-app" hidden><div class="lab-controls"><label class="field" for="lab-case">Пример<select id="lab-case"><option value="movies">Фильмы</option><option value="schedule">Расписание</option><option value="products">Товары</option></select></label><button class="secondary" id="load-example" type="button">Загрузить исходный пример</button><button class="secondary" id="load-broken" type="button">Пример с ошибкой</button></div><div class="lab-layout"><section class="panel" aria-label="Редактор XML"><label class="editor-label" for="xml-source">Ваш XML</label><p class="schema-note" id="schema-note"></p><textarea id="xml-source" maxlength="50000" spellcheck="false" autocapitalize="off" autocomplete="off" aria-describedby="schema-note editor-meta"></textarea><div class="editor-meta" id="editor-meta"><span id="source-count"></span><span>Ctrl / ⌘ + Enter — запустить</span></div><div class="lab-actions"><button id="run-xml" type="button">Запустить →</button><button id="save-draft" class="secondary" type="button">Сохранить черновик</button><button id="download-xml" class="secondary" type="button">Скачать XML</button></div><label class="field" for="xml-file">Открыть XML с устройства <span class="note">UTF-8, до 100 КБ</span><input class="file-input" id="xml-file" type="file" accept=".xml,application/xml,text/xml"></label><p class="status" id="draft-status" role="status"></p></section><section class="panel" id="result-panel" aria-labelledby="result-heading"><h2 id="result-heading">Результат</h2><p class="status" id="run-status" role="status">Нажмите «Запустить», чтобы получить таблицу.</p><div id="table-result"></div><h3>Самопроверка</h3><p class="note" id="criteria-summary">После запуска здесь появятся условия задания.</p><ul class="criteria" id="lab-criteria"></ul><a class="note" href="#xml-source">Вернуться к XML ↑</a></section></div><section class="section lab-notes"><h2>Подсказки к работе</h2><details><summary>Как добавить третью запись?</summary><p>Скопируйте один блок записи целиком, вставьте его перед закрывающим тегом корня и измените значения полей. В примере «Фильмы» запись — это блок от <code>&lt;movie&gt;</code> до <code>&lt;/movie&gt;</code>.</p></details><details><summary>Почему XML не разбирается?</summary><p>У XML должен быть один корень. Имена открывающего и закрывающего тега совпадают с учётом регистра. Значения атрибутов заключаются в кавычки; символ <code>&amp;</code> в тексте записывается как <code>&amp;amp;</code>.</p></details><details><summary>Что проверяет практикум?</summary><p>Синтаксис XML, корень, обязательные поля и значения года, цены или времени. Условия задания — не менее трёх записей и разные названия. Для каждого примера используется своя небольшая структура; пространства имён и DTD в неё не входят.</p></details><details><summary>Как продолжить работу после перезагрузки?</summary><p>Сохраните черновик на этом устройстве или скачайте XML. При следующем открытии практикум восстановит сохранённые примеры. Переключение между примерами сохраняет текущий текст в памяти до закрытия страницы.</p></details><p><a href="xml.html#assignment">Полное задание и материалы занятия →</a></p></section></div><dialog class="replace-dialog" id="replace-dialog" aria-labelledby="replace-title"><h2 id="replace-title">Заменить текст в редакторе?</h2><p>Текущая версия отличается от исходного примера. Сохраните черновик или скачайте XML, если хотите оставить свою работу.</p><form method="dialog"><div class="actions"><button value="cancel" class="secondary" autofocus>Отмена</button><button value="replace">Заменить пример</button></div></form></dialog>`;
fs.writeFileSync(
  path.join(out, "xml-lab.html"),
  layout(
    "xml-lab",
    "Практикум XML",
    "Интерактивный редактор XML: фильмы, расписание и товары. Проверка ошибок, вывод таблицы, черновик и скачивание.",
    lab,
  ).replace(
    "</body>",
    '<script src="xml-model.js?v=1"></script><script src="xml-lab.js?v=1"></script></body>',
  ),
);
console.log("Built learning hub, three courses and XML practice.");
