const fs = require("node:fs");
const path = require("node:path");
const courses = require("../learning/courses.json");
const lessons = require("../learning/os-lessons.json");
const topics = require("../learning/os-quiz-model.js").topics;
const labels = {
  course: "Дисциплина",
  lesson: "Занятие",
  practice: "Практикум",
  test: "Тест",
  document: "Файл",
};
const items = [
  ...courses.map((c) => ({
    id: c.id,
    title: c.title,
    description: c.intro,
    course: c.id,
    kind: "course",
    href: c.id + ".html",
    search: [
      c.title,
      c.tag,
      ...c.outcomes,
      ...c.route.flatMap((r) => [r.title, r.text]),
    ].join(" "),
  })),
  ...lessons.map((l) => ({
    id: "lesson-" + l.id,
    title: topics.find((t) => t.id === l.id).title,
    description: l.goal,
    course: "operating-systems",
    kind: "lesson",
    href: `os-lesson-${l.id}.html`,
    search: [
      l.subtitle,
      l.task,
      l.example.title,
      ...l.example.steps,
      ...l.theory.flatMap((t) => [t.title, t.text]),
      ...l.checks.flatMap((c) => [c.question, c.answer]),
    ].join(" "),
  })),
  {
    id: "xml-lab",
    title: "Практикум XML",
    description:
      "Редактор XML с проверкой структуры, таблицей, открытием файла и сохранением черновика.",
    course: "xml",
    kind: "practice",
    href: "xml-lab.html",
    search: "DOMParser фильмы расписание товары лабораторная работа",
  },
  {
    id: "os-quiz",
    title: "Тест по операционным системам",
    description:
      "10 вопросов из пяти тем. Разбор ответов, повторение ошибок и сохранение попытки в браузере.",
    course: "operating-systems",
    kind: "test",
    href: "os-quiz.html",
    search: "самопроверка процессы память файлы права доступ",
  },
  ...courses.flatMap((c) =>
    c.materials.map((m, i) => ({
      id: `${c.id}-file-${i}`,
      title: m.title,
      description: m.description,
      course: c.id,
      kind: "document",
      href: m.href,
      format: m.format,
      search: m.format,
    })),
  ),
].map((item) => ({
  ...item,
  search: `${item.search} ${courses.find((c) => c.id === item.course).title} ${{ react: "реакт React JavaScript JS", xml: "XML", "operating-systems": "ОС OS операционная система" }[item.course]} ${item.kind === "document" ? "документ скачать" : labels[item.kind]}`,
}));
function buildCatalog({ out, layout, esc }) {
  const options = courses
    .map((c) => `<option value="${c.id}">${esc(c.title)}</option>`)
    .join("");
  const kindOptions = Object.entries(labels)
    .map(([value, label]) => `<option value="${value}">${label}</option>`)
    .join("");
  const cards = items
    .map(
      (item) =>
        `<article class="card catalog-card" data-catalog-item data-course="${item.course}" data-kind="${item.kind}" data-search="${esc(item.search)}"><p class="eyebrow">${labels[item.kind]} / ${esc(courses.find((c) => c.id === item.course).title)}</p><h3>${esc(item.title)}</h3><p class="catalog-description">${esc(item.description)}</p>${item.format ? `<p class="note">${esc(item.format)}</p>` : ""}<a class="button secondary" href="${esc(item.href)}"${item.kind === "document" ? " download" : ""}>${item.kind === "document" ? "Скачать файл ↓" : "Открыть →"}</a></article>`,
    )
    .join("");
  const body = `<p class="breadcrumbs"><a href="index.html">Учебный раздел</a> / Каталог</p><section class="hero lab-hero"><p class="eyebrow">Материалы / занятия / практика</p><h1>Найдите нужную тему.</h1><p class="lead">Дисциплины, занятия, практикумы, тесты и файлы для скачивания — в одном месте.</p><p class="note">Поиск охватывает названия, описания и тексты занятий. Файлы Office находятся по названию и описанию; их содержимое не индексируется.</p></section>
<form class="panel catalog-filters" id="catalog-filters" role="search" aria-label="Поиск по учебному разделу" hidden><div class="field catalog-query"><label for="catalog-query">Что изучаем?</label><input type="search" id="catalog-query" name="q" maxlength="120" placeholder="Например: память, JSX, DOCX" autocomplete="off" aria-controls="catalog-results"></div><div class="field"><label for="catalog-course">Дисциплина</label><select id="catalog-course" name="course"><option value="">Все дисциплины</option>${options}</select></div><div class="field"><label for="catalog-kind">Тип материала</label><select id="catalog-kind" name="kind"><option value="">Все типы</option>${kindOptions}</select></div><div class="actions catalog-filter-actions"><button class="secondary" type="button" data-catalog-reset>Сбросить фильтры</button><button class="secondary" type="button" id="catalog-share">Скопировать ссылку на подборку</button></div></form>
<p class="note" id="catalog-share-status" role="status"></p><div class="panel" id="catalog-share-fallback" hidden><label class="field" for="catalog-link">Ссылка на подборку<input id="catalog-link" type="text" readonly></label><p class="note">Скопируйте ссылку вручную. Она сохраняет текущий запрос и фильтры.</p></div>
<noscript><p class="status">Все материалы доступны ниже. Для поиска и фильтров включите JavaScript.</p></noscript><section class="section" aria-labelledby="catalog-heading"><h2 id="catalog-heading">Учебные материалы</h2><p id="catalog-count" role="status" aria-live="polite">Всего материалов: ${items.length}.</p><div id="catalog-results" class="catalog-grid">${cards}</div><div class="panel" id="catalog-empty" hidden><h3>Ничего не найдено</h3><p>Попробуйте более короткий запрос или снимите фильтр дисциплины и типа.</p><button type="button" data-catalog-reset>Показать все материалы</button></div></section><script src="catalog-model.js?v=1"></script><script src="catalog.js?v=1"></script>`;
  fs.writeFileSync(
    path.join(out, "catalog.html"),
    layout(
      "catalog",
      "Каталог учебных материалов",
      "Поиск по дисциплинам, занятиям, практикумам, тестам и материалам для скачивания.",
      body,
    ),
  );
}
module.exports = { items, buildCatalog };
