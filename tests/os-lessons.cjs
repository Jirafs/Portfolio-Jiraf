const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const root = path.resolve(__dirname, "../learning");
const lessons = require("../learning/os-lessons.json");
const model = require("../learning/os-quiz-model.js");
assert.deepEqual(
  lessons.map((l) => l.id),
  model.topics.map((t) => t.id),
);
for (const question of model.questions)
  assert.ok(lessons.some((l) => l.id === question.topic));
// Catch broken deep links across generated course, lesson and review targets.
for (const file of fs
  .readdirSync(root)
  .filter((f) => f.endsWith(".html") && f !== "os-quiz-body.html")) {
  const html = fs.readFileSync(path.join(root, file), "utf8");
  for (const match of html.matchAll(/href="([^"?]*\.html)?#([^"?]+)"/g)) {
    if (match[1] && /^(https?:|mailto:)/.test(match[1])) continue;
    const target = path.resolve(root, match[1] || file);
    assert.ok(
      fs.readFileSync(target, "utf8").includes(`id="${match[2]}"`),
      `${file}: missing fragment ${match[0]}`,
    );
  }
}
for (const lesson of lessons) {
  const html = fs.readFileSync(
    path.join(root, `os-lesson-${lesson.id}.html`),
    "utf8",
  );
  for (const id of ["theory", "example", "practice", "self-check", "sources"])
    assert.ok(html.includes(`id="${id}"`));
  assert.ok(html.includes(`data-topic-toggle="${lesson.id}"`));
  assert.ok(lesson.sources.length && lesson.checks.length >= 2);
  assert.ok(html.includes('href="os-quiz.html"'));
}
console.log(
  "PASS: all OS quiz topics have lessons, deep links resolve, lesson progression uses existing topic IDs",
);
