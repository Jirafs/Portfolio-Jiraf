const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { spawnSync } = require("node:child_process");
const assert = require("node:assert/strict");
const root = path.resolve(__dirname, "..");
function localReference(file, value, base) {
  if (!value || /^(?:[a-z][a-z0-9+.-]*:|\/\/|#)/i.test(value)) return;
  const resource = value.split(/[?#]/)[0];
  if (!resource) return;
  const absolute = resource.startsWith("/Portfolio-Jiraf/")
    ? path.join(root, resource.slice("/Portfolio-Jiraf/".length))
    : resource.startsWith("/")
      ? path.join(root, resource.slice(1))
      : path.resolve(base || path.dirname(file), decodeURIComponent(resource));
  assert.ok(
    fs.existsSync(absolute),
    `${path.relative(root, file)}: missing ${value}`,
  );
}
function walk(folder) {
  for (const entry of fs.readdirSync(folder, { withFileTypes: true })) {
    if ([".git", "node_modules", "uploads"].includes(entry.name)) continue;
    const file = path.join(folder, entry.name);
    if (entry.isDirectory()) {
      walk(file);
      continue;
    }
    if (entry.name.endsWith(".js") || entry.name.endsWith(".cjs"))
      new vm.Script(fs.readFileSync(file, "utf8"), { filename: file });
    if (entry.name.endsWith(".html")) {
      const source = fs.readFileSync(file, "utf8");
      const baseHref = source.match(/<base\b[^>]*href="([^"]+)"/i)?.[1];
      const base = baseHref
        ? baseHref.startsWith("/Portfolio-Jiraf/")
          ? root
          : path.resolve(path.dirname(file), baseHref)
        : undefined;
      const ids = [...source.matchAll(/\bid="([^"]+)"/g)].map((m) => m[1]);
      assert.equal(
        new Set(ids).size,
        ids.length,
        `${entry.name}: duplicate IDs`,
      );
      for (const match of source.matchAll(/(?:src|href)="([^"]+)"/g))
        localReference(file, match[1], base);
      for (const match of source.matchAll(
        /<script\b([^>]*)>([\s\S]*?)<\/script>/g,
      ))
        if (!/src=|application\/ld\+json/.test(match[1]))
          new vm.Script(match[2], { filename: file });
    }
    if (entry.name.endsWith(".css"))
      for (const match of fs
        .readFileSync(file, "utf8")
        .matchAll(/url\(\s*['"]?([^'"\s)]+)['"]?\s*\)/g))
        localReference(file, match[1]);
  }
}
walk(root);
console.log("PASS: JavaScript syntax, unique HTML IDs and local asset links");
for (const file of fs
  .readdirSync(path.join(root, "tests"))
  .filter((f) => f.endsWith(".cjs"))
  .sort()) {
  const result = spawnSync(process.execPath, [path.join(root, "tests", file)], {
    stdio: "inherit",
    cwd: root,
  });
  if (result.status !== 0) process.exit(result.status || 1);
}
