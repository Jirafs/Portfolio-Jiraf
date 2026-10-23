const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const ctx = {};
vm.createContext(ctx);
vm.runInContext(
  fs.readFileSync(path.join(__dirname, "../learning/xml-model.js"), "utf8"),
  ctx,
);
const M = ctx.XMLLabModel;
assert.throws(() => M.guard(""), /Редактор пуст/);
assert.throws(() => M.guard("x".repeat(50001)), /50 000/);
assert.throws(
  () =>
    M.parse(
      '<!DOCTYPE movies SYSTEM "https://example.invalid/a"><movies/>',
      "movies",
    ),
  /DOCTYPE/,
);
assert.throws(() => M.guard('<!ENTITY x "value">'), /ENTITY/);
assert.throws(() => M.config("__proto__"), /Выберите/);
assert.throws(
  () => M.validateRows("movies", [{ title: "Фильм", year: "2026.5" }]),
  /год/,
);
assert.throws(
  () => M.validateRows("products", [{ name: "Товар", price: "-10" }]),
  /цена/,
);
assert.throws(
  () => M.validateRows("products", [{ name: "Товар", price: "Infinity" }]),
  /цена/,
);
assert.equal(
  M.validateRows("products", [{ name: "Товар", price: "25,50" }])[0].price,
  "25,50",
);
assert.throws(
  () =>
    M.validateRows("schedule", [
      { subject: "Тема", day: "День", time: "25:00" },
    ]),
  /время/,
);
assert.throws(() => M.validateRows("movies", []), /хотя бы/);
assert.throws(
  () =>
    M.validateRows("movies", Array(101).fill({ title: "Фильм", year: "2026" })),
  /100 записей/,
);
const rows = M.validateRows("movies", [
  { title: " A ", year: "2020" },
  { title: "B", year: "2021" },
  { title: "C", year: "2022" },
]);
assert.equal(rows[0].title, "A");
assert.ok(M.criteria("movies", rows).every((c) => c.passed));
assert.equal(M.criteria("movies", [rows[0], rows[0]])[3].passed, false);
assert.equal(
  M.validateDraft({ version: 1, active: "movies", drafts: { movies: "" } })
    .drafts.movies,
  "",
);
assert.throws(
  () => M.validateDraft({ version: 2, active: "movies", drafts: {} }),
  /формат/,
);
assert.throws(
  () =>
    M.validateDraft({
      version: 1,
      active: "movies",
      drafts: { movies: "x".repeat(50001) },
    }),
  /размер/,
);
console.log(
  "PASS: XML input bounds, DTD rejection before parsing, required values, year/price/time checks, exercise criteria and draft validation",
);
