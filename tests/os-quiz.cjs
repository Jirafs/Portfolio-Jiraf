const assert = require("node:assert/strict");
const M = require("../learning/os-quiz-model.js");
assert.equal(M.questions.length, 20);
assert.equal(new Set(M.questions.map((q) => q.id)).size, 20);
for (const q of M.questions) {
  assert.ok(M.topics.some((t) => t.id === q.topic));
  assert.equal(q.options.length, 4);
  assert.equal(new Set(q.options).size, 4);
  assert.ok(Number.isInteger(q.correct) && q.correct >= 0 && q.correct < 4);
  assert.ok(q.explanation.length > 60 && q.source);
}
for (let i = 0; i < 100; i++) {
  const a = M.createAttempt();
  assert.equal(new Set(a.ids).size, 10);
  for (const t of M.topics)
    assert.equal(a.ids.filter((id) => M.byId[id].topic === t.id).length, 2);
  assert.ok(M.validAttempt(a));
}
const state = M.blank();
state.attempt = M.createAttempt();
assert.deepEqual(M.score(state.attempt).wrong, state.attempt.ids);
assert.equal(M.score(state.attempt).skipped, 10);
assert.equal(M.complete(state).correct, 0);
assert.equal(M.score(state.best).correct, 0);
state.attempt = M.createAttempt();
for (const id of state.attempt.ids)
  state.attempt.answers[id] = M.byId[id].correct;
assert.equal(M.complete(state).percent, 100);
const best = JSON.stringify(state.best);
state.attempt = M.createAttempt();
const [correct, wrong, ...skips] = state.attempt.ids;
state.attempt.answers[correct] = M.byId[correct].correct;
state.attempt.answers[wrong] = (M.byId[wrong].correct + 1) % 4;
const result = M.complete(state);
assert.equal(result.correct, 1);
assert.equal(result.skipped, 8);
assert.deepEqual(result.wrong, [wrong, ...skips]);
assert.equal(JSON.stringify(state.best), best);
state.attempt = M.createAttempt(result.wrong);
assert.equal(state.attempt.mode, "retry");
assert.deepEqual([...state.attempt.ids].sort(), [...result.wrong].sort());
for (const id of state.attempt.ids)
  state.attempt.answers[id] = M.byId[id].correct;
M.complete(state);
assert.equal(JSON.stringify(state.best), best);
state.completedTopics = ["memory"];
assert.deepEqual(M.restore(JSON.stringify(state)), state);
const corrupt = (change) => {
  const s = JSON.parse(JSON.stringify(state));
  change(s);
  assert.throws(() => M.restore(JSON.stringify(s)));
};
corrupt((s) => (s.bankVersion = "old"));
corrupt((s) => (s.version = 99));
corrupt((s) => (s.attempt.ids[0] = "__proto__"));
corrupt((s) => s.attempt.ids.push(s.attempt.ids[0]));
corrupt((s) => (s.attempt.answers[s.attempt.ids[0]] = 4));
corrupt((s) => (s.attempt.answers.extra = 1));
corrupt((s) => (s.attempt.index = -1));
corrupt((s) => (s.best.mode = "retry"));
corrupt((s) => (s.last.finished = false));
corrupt((s) => (s.completedTopics = ["unknown"]));
corrupt((s) => (s.completedTopics = ["memory", "memory"]));
assert.throws(() => M.restore("{broken"));
assert.throws(() => M.createAttempt([]));
assert.throws(() => M.createAttempt(["__proto__", "unknown"]));
const partial = M.blank();
partial.attempt = M.createAttempt();
partial.attempt.index = 4;
partial.attempt.answers[partial.attempt.ids[4]] = 2;
assert.deepEqual(M.restore(JSON.stringify(partial)), partial);
console.log(
  "PASS: OS question coverage, balanced attempts, scoring, retries, best result and versioned progress validation",
);
