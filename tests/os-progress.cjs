const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const M = require("../learning/os-quiz-model.js");
const source = fs.readFileSync(
  require.resolve("../learning/os-progress.js"),
  "utf8",
);
function boot(storage) {
  const status = { textContent: "" };
  const callbacks = {};
  const dialog = {
    returnValue: "reset",
    addEventListener: (name, fn) => (callbacks[name] = fn),
    showModal() {},
  };
  const reset = {
    addEventListener: (name, fn) => (callbacks[name] = fn),
    focus() {},
  };
  const window = { OSQuizModel: M, dispatchEvent() {} };
  const context = {
    window,
    localStorage: storage,
    Event: class {},
    document: {
      querySelectorAll: () => [],
      getElementById: (id) =>
        id === "storage-status"
          ? status
          : id === "reset-progress"
            ? reset
            : id === "reset-dialog"
              ? dialog
              : null,
    },
  };
  vm.runInNewContext(source, context);
  return { P: window.OSProgress, status, callbacks, dialog };
}
const blocked = boot({
  getItem() {
    throw Error("blocked");
  },
  setItem() {
    throw Error("blocked");
  },
  removeItem() {
    throw Error("blocked");
  },
});
blocked.P.state.attempt = M.createAttempt();
blocked.P.save();
assert.equal(blocked.P.state.attempt.ids.length, 10);
assert.match(blocked.status.textContent, /не сохранил/);
const broken = boot({
  getItem: () => "{broken",
  setItem() {},
  removeItem() {},
});
assert.equal(broken.P.state.attempt, null);
assert.match(broken.status.textContent, /устарел/);
const old = M.blank();
old.bankVersion = "old";
assert.equal(
  boot({ getItem: () => JSON.stringify(old) }).P.state.attempt,
  null,
);
let data = null;
const storage = {
  getItem: () => data,
  setItem: (_key, value) => (data = value),
  removeItem: () => (data = null),
};
const saved = boot(storage);
saved.P.state.completedTopics.push("memory");
saved.P.state.attempt = M.createAttempt();
saved.P.save();
const resumed = boot(storage);
assert.equal(resumed.P.state.completedTopics[0], "memory");
assert.equal(resumed.P.state.attempt.ids.length, 10);
// A cancelled reopening must not reuse the previous destructive return value.
resumed.callbacks.click();
assert.equal(resumed.dialog.returnValue, "");
resumed.callbacks.close();
assert.notEqual(data, null);
resumed.dialog.returnValue = "reset";
resumed.callbacks.close();
assert.equal(data, null);
assert.equal(resumed.P.state.attempt, null);
assert.equal(resumed.P.state.completedTopics.length, 0);
console.log(
  "PASS: OS progress blocked/corrupt/outdated storage, resume and confirmed-only reset",
);
