const fs = require("node:fs");
const path = require("node:path");
const lessons = require("../learning/os-lessons.json");
const topics = require("../learning/os-quiz-model.js").topics;
function buildLessons({ out, layout, esc, list, scripts }) {
  for (const [index, lesson] of lessons.entries()) {
    const topic = topics.find((t) => t.id === lesson.id);
    const previous = lessons[index - 1];
    const next = lessons[index + 1];
    const href = (l) => `os-lesson-${l.id}.html`;
    const nav = `<nav class="lesson-nav" aria-label="Занятия по ОС">${lessons.map((l, i) => `<a href="${href(l)}"${l.id === lesson.id ? ' aria-current="page"' : ""}><span>${String(i + 1).padStart(2, "0")}</span>${esc(topics.find((t) => t.id === l.id).title)}</a>`).join("")}</nav>`;
    const body = `<p class="breadcrumbs"><a href="operating-systems.html#topics">Операционные системы</a> / Занятие ${index + 1}</p>
<section class="hero lesson-hero"><p class="eyebrow">Занятие ${String(index + 1).padStart(2, "0")} / 05</p><h1>${esc(topic.title)}</h1><p class="lead">${esc(lesson.subtitle)}</p><div class="actions"><a class="button" href="#practice">К самостоятельной работе ↓</a><a class="button secondary" href="os-quiz.html">Тест по ОС →</a></div></section>
<div class="lesson-layout"><aside class="lesson-sidebar"><p class="eyebrow">Маршрут по дисциплине</p>${nav}<p class="note" id="topic-progress" role="status"></p><p class="note" id="storage-status" role="status"></p></aside><div class="lesson-content">
<section class="panel lesson-goal"><h2>Цель занятия</h2><p>${esc(lesson.goal)}</p><p class="note"><strong>Перед началом:</strong> ${esc(lesson.prerequisites)}</p></section>
<nav class="lesson-contents" aria-label="На этой странице"><a href="#theory">Теория</a><a href="#example">Пример</a><a href="#practice">Задание</a><a href="#self-check">Самопроверка</a><a href="#sources">Материалы</a></nav>
<section class="section" id="theory"><p class="eyebrow">Разберитесь в понятиях</p><h2>Коротко о главном</h2>${lesson.theory.map((t) => `<article><h3>${esc(t.title)}</h3><p>${esc(t.text)}</p></article>`).join("")}</section>
<section class="section" id="example"><p class="eyebrow">Разобранный пример</p><h2>${esc(lesson.example.title)}</h2><p>${esc(lesson.example.context)}</p><ol class="lesson-steps">${lesson.example.steps.map((s) => `<li>${esc(s)}</li>`).join("")}</ol><p class="practice">${esc(lesson.example.conclusion)}</p></section>
<section class="section" id="practice"><p class="eyebrow">Самостоятельная работа</p><h2>Примените на практике</h2><p class="lead">${esc(lesson.task)}</p>${list(lesson.steps)}<div class="panel"><h3>Что подготовить</h3><p>${esc(lesson.deliverable)}</p><p class="note">Ответ подготовьте в своём документе или тетради. Эта страница не отправляет работу преподавателю.</p></div><h3>Критерии проверки</h3>${list(lesson.criteria)}</section>
<section class="section lesson-self-check" id="self-check"><p class="eyebrow">Сначала ответьте самостоятельно</p><h2>Проверьте понимание</h2>${lesson.checks.map((c) => `<details><summary>${esc(c.question)}</summary><p>${esc(c.answer)}</p></details>`).join("")}<p class="practice"><strong>Частая ошибка.</strong> ${esc(lesson.pitfall)}</p><button class="secondary" type="button" data-topic-toggle="${lesson.id}" aria-pressed="false" hidden>Отметить тему пройденной</button><noscript><p class="note">Для сохранения отметок нужен JavaScript. Теория, задания и ответы доступны без него.</p></noscript><p class="note">Отметку вы ставите самостоятельно после выполнения задания. Она хранится в текущем браузере и не является оценкой.</p></section>
<section class="section" id="sources"><h2>Материалы и источники</h2><p>Занятие развивает темы опубликованного банка заданий № ${esc(lesson.sourceNumbers)}. Примеры и задания подготовлены для самостоятельной работы.</p><p><a href="../uploads/documents/operating-systems-test-bank-2026.docx" download>Скачать банк заданий по ОС · DOCX ↓</a></p><ul class="source-links">${lesson.sources.map((s) => `<li><a href="${esc(s.url)}" target="_blank" rel="noopener noreferrer">${esc(s.title)} ↗</a></li>`).join("")}</ul></section>
<nav class="section lesson-pagination" aria-label="Продолжить занятия">${previous ? `<a class="button secondary" href="${href(previous)}">← ${esc(topics.find((t) => t.id === previous.id).title)}</a>` : '<a class="button secondary" href="operating-systems.html#topics">← К дисциплине</a>'}${next ? `<a class="button" href="${href(next)}">${esc(topics.find((t) => t.id === next.id).title)} →</a>` : '<a class="button" href="os-quiz.html">Пройти итоговую самопроверку →</a>'}</nav></div></div>${scripts}`;
    fs.writeFileSync(
      path.join(out, href(lesson)),
      layout(
        `os-lesson-${lesson.id}`,
        `${topic.title}: занятие по ОС`,
        lesson.goal,
        body,
      ),
    );
  }
}
module.exports = { buildLessons };
