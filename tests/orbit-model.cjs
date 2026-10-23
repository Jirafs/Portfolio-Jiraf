const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const path = require("node:path");
const context = {};
vm.createContext(context);
vm.runInContext(
  fs.readFileSync(path.join(__dirname, "../demos/orbit/model.js"), "utf8"),
  context,
);
const M = context.OrbitModel;
const now = new Date("2026-10-22T10:00:00Z");
const seed = M.validate(M.seed(now));
assert.equal(seed.tasks.length, 12);
assert.equal(M.metrics(seed.tasks, "2026-10-22").overdue, 1);
const task = {
  id: "new",
  title: "  Проверить интерфейс  ",
  description: "Тест",
  project: "web",
  assignee: "max",
  status: "ready",
  priority: "high",
  due: "2026-10-25",
  estimate: 2,
  checklist: [{ id: "check", text: "На телефоне", done: false }],
};
const created = M.upsert(seed, task, now);
assert.equal(created.tasks.length, 13);
assert.equal(seed.tasks.length, 12);
assert.equal(
  created.tasks.find((t) => t.id === "new").title,
  "Проверить интерфейс",
);
const done = M.move(created, "new", "done", now);
assert.equal(
  M.metrics(done.tasks, "2026-10-22").done,
  M.metrics(seed.tasks, "2026-10-22").done + 1,
);
assert.equal(M.remove(done, "new", now).tasks.length, 12);
assert.throws(() => M.move(seed, "missing", "done"));
assert.throws(() => M.move(seed, seed.tasks[0].id, "__proto__"));
assert.throws(() => M.upsert(seed, { ...task, due: "2026-02-30" }, now));
assert.throws(() => M.upsert(seed, { ...task, project: "unknown" }, now));
assert.throws(() => M.upsert(seed, { ...task, estimate: -1 }, now));
assert.throws(() => M.validate({ ...seed, tasks: [null] }));
assert.throws(() =>
  M.validate({ ...seed, tasks: [...seed.tasks, seed.tasks[0]] }),
);
const html = M.upsert(
  seed,
  { ...task, title: "<img src=x onerror=alert(1)>" },
  now,
);
assert.equal(html.tasks.at(-1).title, "<img src=x onerror=alert(1)>");
assert.equal(M.metrics([]).percent, 0);
assert.equal(M.validate(JSON.parse(JSON.stringify(created))).tasks.length, 13);
console.log(
  "PASS: Orbit create/update/move/delete, immutable state, derived metrics, round-trip export, invalid references/dates/duplicates rejected",
);
