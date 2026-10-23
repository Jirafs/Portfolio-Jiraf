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
  const context = {
    window: { LearningCatalog: M, addEventListener() {} },
    document: { getElementById: (id) => nodes[id], querySelectorAll: () => [] },
    location,
    URL,
    URLSearchParams,
    history: { replaceState() {} },
    navigator: { clipboard: { writeText: (value) => clipboardWrite(value) } },
  };
  vm.runInNewContext(
    fs.readFileSync(path.resolve(__dirname, "../learning/catalog.js"), "utf8"),
    context,
  );
  assert.equal(nodes["catalog-query"].value, "XML");
  await nodes["catalog-share"].events.click();
  assert.equal(nodes["catalog-share-fallback"].hidden, false);
  assert.equal(nodes["catalog-link"].value, location.href);
  assert.equal(nodes["catalog-share"].disabled, false);
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
    "PASS: catalog clipboard fallback, stale share feedback and success",
  );
}
checkSharing().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
