const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const context = {};
vm.createContext(context);
for (const file of ["model.js", "store.js"])
  vm.runInContext(
    fs.readFileSync(path.join(__dirname, "../demos/orbit", file), "utf8"),
    context,
  );
const M = context.OrbitModel;
const Store = context.OrbitStore;
let raw = null;
let blocked = false;
const storage = {
  getItem: () => raw,
  setItem: (key, value) => {
    if (blocked) throw Error("Quota");
    raw = value;
  },
};
const create = () => Store.create(storage, "test", M);
const a = create(),
  b = create();
const initial = a.snapshot();
const task = { ...initial.tasks[0], id: "new-a", title: "Задача A" };
a.commit((latest) => M.upsert(latest, task));
b.commit((latest) =>
  M.upsert(latest, { ...task, id: "new-b", title: "Задача B" }),
);
assert.equal(
  JSON.parse(raw).tasks.length,
  14,
  "A stale tab must preserve other tasks already saved",
);
const current = a.refresh().tasks[0];
const signature = JSON.stringify(current);
b.commit((latest) => M.upsert(latest, { ...current, title: "Изменено в B" }));
const before = raw;
assert.throws(
  () =>
    a.commit(
      (latest) => M.upsert(latest, { ...current, title: "Старая форма A" }),
      { expectedTask: { id: current.id, signature } },
    ),
  /другой вкладке/,
);
assert.equal(raw, before, "Rejected edits must not change persisted data");
assert.throws(
  () =>
    a.commit((latest) => M.remove(latest, current.id), {
      expectedTask: { id: current.id, signature },
    }),
  /другой вкладке/,
);

const memory = create();
blocked = true;
const result = memory.commit((latest) =>
  M.upsert(latest, { ...task, id: "memory-1" }),
);
assert.equal(result.durable, false);
memory.commit((latest) => M.upsert(latest, { ...task, id: "memory-2" }));
assert.ok(memory.snapshot().tasks.some((t) => t.id === "memory-1"));
blocked = false;
memory.commit((latest) => latest);
assert.ok(JSON.parse(raw).tasks.some((t) => t.id === "memory-2"));

const dirty = create();
blocked = true;
dirty.commit((latest) => M.upsert(latest, { ...task, id: "unsaved" }));
blocked = false;
b.commit((latest) => M.upsert(latest, { ...task, id: "external" }));
assert.throws(() => dirty.commit((latest) => latest), /несохранённые/);

raw = "{broken json";
const damaged = create();
assert.match(damaged.warning(), /повреждено/);
assert.equal(damaged.original(), raw);
assert.throws(
  () => damaged.commit((latest) => M.upsert(latest, task)),
  /повреждено/,
);
assert.equal(raw, "{broken json");
damaged.commit(() => M.seed(), { replace: true });
assert.equal(JSON.parse(raw).tasks.length, 12);
raw = null;
assert.equal(damaged.refresh().tasks.length, 12);
console.log(
  "PASS: stale-tab merge, task edit/delete conflicts, blocked storage recovery, unsaved conflict and corrupt-data preservation",
);
