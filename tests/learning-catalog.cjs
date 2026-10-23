const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const M = require("../learning/catalog-model.js");
const { items } = require("../scripts/build-learning-catalog.cjs");
const courses = require("../learning/courses.json");
const lessons = require("../learning/os-lessons.json");
assert.equal(
  items.length,
  courses.length +
    lessons.length +
    2 +
    courses.reduce((n, c) => n + c.materials.length, 0),
);
assert.equal(new Set(items.map((i) => i.id)).size, items.length);
assert.equal(
  items.length,
  14,
  "Every currently published learning resource is indexed",
);
assert.equal(new Set(items.map((i) => i.href)).size, items.length);
for (const course of courses) {
  const entry = items.find((i) => i.id === course.id);
  assert.equal(entry.title, course.title);
  assert.equal(entry.description, course.intro);
  for (const material of course.materials) {
    const document = items.find((i) => i.href === material.href);
    assert.equal(document.course, course.id);
    assert.equal(document.kind, "document");
    assert.equal(document.title, material.title);
    assert.equal(document.description, material.description);
    assert.equal(document.format, material.format);
  }
}
for (const lesson of lessons) {
  const entry = items.find((i) => i.id === `lesson-${lesson.id}`);
  assert.equal(entry.course, "operating-systems");
  assert.equal(entry.kind, "lesson");
  assert.equal(entry.description, lesson.goal);
  assert.equal(entry.href, `os-lesson-${lesson.id}.html`);
}
for (const item of items)
  assert.ok(
    fs.existsSync(path.resolve(__dirname, "../learning", item.href)),
    item.href,
  );
const find = (filters) => items.filter((i) => M.matches(i, filters));
assert.equal(find({}).length, items.length);
assert.equal(find({ course: "xml", kind: "document" }).length, 2);
assert.equal(find({ q: "DOCX", kind: "document" }).length, 3);
assert.equal(find({ q: "PPTX" }).length, 1);
assert.equal(find({ course: "react", kind: "lesson" }).length, 0);
assert.equal(
  find({ q: "rOuNd rObIn", kind: "lesson" })[0].id,
  "lesson-processes",
);
assert.equal(find({ q: "7620", kind: "lesson" })[0].id, "lesson-memory");
assert.deepEqual(
  find({ q: "деталей кэширования", kind: "lesson" }).map((i) => i.id),
  ["lesson-basics"],
);
assert.deepEqual(
  find({ q: "короткое объяснение отказа", kind: "lesson" }).map((i) => i.id),
  ["lesson-basics"],
);
assert.ok(find({ q: "ОС" }).every((i) => i.course === "operating-systems"));
assert.equal(find({ q: "несуществующийматериал" }).length, 0);
assert.equal(M.matches({ title: "Учёт потока" }, { q: "учет" }), true);
assert.equal(
  M.matches({ title: "Процесс поток" }, { q: "процесс память" }),
  false,
);
assert.equal(M.matches({ title: "Запрос" }, { q: "ОС" }), false);
const state = {
  q: "память & <script> ? + #",
  course: "operating-systems",
  kind: "lesson",
};
assert.deepEqual(M.fromSearch(M.toSearch(state)), state);
assert.deepEqual(M.fromSearch("?course=unknown&kind=unknown&q=XML"), {
  q: "XML",
  course: "",
  kind: "",
});
assert.equal(M.state({ q: "x".repeat(500) }).q.length, 120);
const html = fs.readFileSync(
  path.resolve(__dirname, "../learning/catalog.html"),
  "utf8",
);
assert.equal((html.match(/data-catalog-item /g) || []).length, items.length);
assert.ok(html.includes("<noscript>"));
console.log(
  "PASS: catalog coverage, existing targets, combined filters, lesson body search, Unicode and share URL round-trip",
);

// Exercise clipboard rejection and a stale asynchronous result without browser globals.
const vm = require("node:vm");
async function checkSharing() {
  const nodes = {};
  for (const id of [
    "catalog-filters",
    "catalog-query",
    "catalog-course",
    "catalog-kind",
    "catalog-count",
    "catalog-empty",
    "catalog-share-status",
    "catalog-share-fallback",
    "catalog-share",
    "catalog-link",
  ]) {
    nodes[id] = {
      value: "",
      hidden: false,
      textContent: "",
      events: {},
      addEventListener(name, fn) {
        this.events[name] = fn;
      },
      focus() {},
      select() {},
    };
  }
  const location = {
    href: "https://example.test/learning/catalog.html?q=XML",
    search: "?q=XML",
  };
  let clipboardWrite = () => Promise.reject(Error("denied"));
  const cards = items.map((item) => ({
    hidden: false,
    dataset: { search: item.search, course: item.course, kind: item.kind },
    querySelector: (selector) => ({
      textContent: selector === "h3" ? item.title : item.description,
    }),
  }));
  const reset = {
    addEventListener(name, fn) {
      this[name] = fn;
    },
  };
  const windowEvents = {};
  let rejectHistory = false;
  const context = {
    window: {
      LearningCatalog: M,
      addEventListener(name, fn) {
        windowEvents[name] = fn;
      },
    },
    document: {
      getElementById: (id) => nodes[id],
      querySelectorAll: (selector) =>
        selector === "[data-catalog-item]" ? cards : [reset],
    },
    location,
    URL,
    URLSearchParams,
    history: {
      replaceState(_state, _title, url) {
        if (rejectHistory) throw Error("blocked history");
        location.href = url.href;
        location.search = url.search;
      },
    },
    navigator: { clipboard: { writeText: (value) => clipboardWrite(value) } },
  };
  vm.runInNewContext(
    fs.readFileSync(path.resolve(__dirname, "../learning/catalog.js"), "utf8"),
    context,
  );
  assert.equal(nodes["catalog-query"].value, "XML");
  assert.equal(cards.filter((card) => !card.hidden).length, 4);
  assert.equal(nodes["catalog-filters"].hidden, false);
  assert.equal(nodes["catalog-empty"].hidden, true);
  nodes["catalog-course"].value = "react";
  nodes["catalog-course"].events.change();
  assert.equal(cards.filter((card) => !card.hidden).length, 0);
  assert.equal(nodes["catalog-empty"].hidden, false);
  assert.equal(new URL(location.href).searchParams.get("course"), "react");
  reset.click();
  assert.equal(cards.filter((card) => !card.hidden).length, items.length);
  assert.equal(nodes["catalog-empty"].hidden, true);
  assert.equal(location.search, "");
  location.search = "?course=xml&kind=document&q=DOCX";
  location.href = `https://example.test/learning/catalog.html${location.search}`;
  windowEvents.popstate();
  assert.equal(nodes["catalog-kind"].value, "document");
  assert.equal(cards.filter((card) => !card.hidden).length, 1);
  rejectHistory = true;
  nodes["catalog-query"].value = "PPTX";
  nodes["catalog-query"].events.input();
  assert.equal(cards.filter((card) => !card.hidden).length, 1);
  assert.equal(cards.find((card) => !card.hidden).dataset.course, "xml");
  rejectHistory = false;
  nodes["catalog-query"].events.input();
  await nodes["catalog-share"].events.click();
  assert.equal(nodes["catalog-share-fallback"].hidden, false);
  assert.equal(nodes["catalog-link"].value, location.href);
  assert.equal(nodes["catalog-share"].disabled, false);
  clipboardWrite = () => Promise.resolve();
  await nodes["catalog-share"].events.click();
  assert.equal(nodes["catalog-share-fallback"].hidden, true);
  assert.match(nodes["catalog-share-status"].textContent, /скопирована/);
  let resolve;
  clipboardWrite = () => new Promise((r) => (resolve = r));
  const pending = nodes["catalog-share"].events.click();
  nodes["catalog-query"].value = "React";
  nodes["catalog-query"].events.input();
  resolve();
  await pending;
  assert.equal(nodes["catalog-share-status"].textContent, "");
  assert.equal(nodes["catalog-share-fallback"].hidden, true);
  clipboardWrite = () => Promise.resolve();
  await nodes["catalog-share"].events.click();
  assert.match(nodes["catalog-share-status"].textContent, /скопирована/);
  console.log(
    "PASS: catalog real-card filtering, reset, history restoration, denied history and clipboard races",
  );
}
checkSharing().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
