const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const root = path.resolve(__dirname, "..");
for (const key of ["kosmetica", "fitness", "pulse", "orbit"]) {
  const html = fs.readFileSync(path.join(root, "cases", key + ".html"), "utf8");
  assert.ok(html.includes(`data-project="${key}"`));
  assert.ok(html.includes('<base href="../">'));
  assert.ok(
    html.includes(`https://jirafs.github.io/Portfolio-Jiraf/cases/${key}.html`),
  );
  assert.match(html, /id="case-title">[^<]+</);
  assert.match(html, /id="case-try">1\. [\s\S]+?2\. /);
  assert.ok(html.includes(`href="demos/${key}/`));
  assert.match(html, /name="twitter:card" content="summary_large_image"/);
  assert.ok(!html.includes('id="case-intro"></p>'));
}
console.log(
  "PASS: four pre-rendered cases, independent metadata and demo routes",
);
