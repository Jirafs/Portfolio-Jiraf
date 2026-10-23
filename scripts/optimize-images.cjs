const fs = require("node:fs");
const path = require("node:path");
const sharp = require("sharp");
const root = path.resolve(__dirname, "..");
async function run() {
  const sources = [
    ...fs
      .readdirSync(path.join(root, "demos/assets"))
      .filter((n) => n.endsWith(".png"))
      .map((n) => "demos/assets/" + n),
    "assets/workspace.jpg",
  ];
  let before = 0,
    after = 0;
  for (const source of sources) {
    const file = path.join(root, source);
    const target = file.replace(/\.(png|jpg)$/i, ".webp");
    await sharp(file).webp({ quality: 84, effort: 5 }).toFile(target);
    before += fs.statSync(file).size;
    after += fs.statSync(target).size;
  }
  function walk(folder) {
    for (const entry of fs.readdirSync(folder, { withFileTypes: true })) {
      if ([".git", "node_modules", "uploads", "fonts"].includes(entry.name))
        continue;
      const file = path.join(folder, entry.name);
      if (entry.isDirectory()) {
        walk(file);
        continue;
      }
      if (!/\.(html|css|js)$/.test(entry.name)) continue;
      let text = fs.readFileSync(file, "utf8");
      for (const source of sources) {
        const basename = path.basename(source);
        text = text
          .split(basename)
          .join(basename.replace(/\.(png|jpg)$/i, ".webp"));
      }
      fs.writeFileSync(file, text);
    }
  }
  walk(root);
  // Reserve the layout of locally hosted raster images before they finish downloading.
  async function dimensions(folder) {
    for (const entry of fs.readdirSync(folder, { withFileTypes: true })) {
      if ([".git", "node_modules", "uploads"].includes(entry.name)) continue;
      const file = path.join(folder, entry.name);
      if (entry.isDirectory()) {
        await dimensions(file);
        continue;
      }
      if (!entry.name.endsWith(".html")) continue;
      let text = fs.readFileSync(file, "utf8");
      const tags = [...text.matchAll(/<img\b[^>]*>/g)];
      for (const match of tags) {
        const src = match[0].match(/\bsrc="([^"?#]+)"/);
        if (!src || /^[a-z]+:/i.test(src[1]) || /\bwidth=/.test(match[0]))
          continue;
        const image = path.resolve(path.dirname(file), src[1]);
        if (!fs.existsSync(image)) continue;
        const meta = await sharp(image).metadata();
        let tag = match[0].replace(
          /\s*\/?>(?=$)/,
          ` width="${meta.width}" height="${meta.height}">`,
        );
        if (!/\bdecoding=/.test(tag))
          tag = tag.replace(">", ' decoding="async">');
        text = text.replace(match[0], tag);
      }
      fs.writeFileSync(file, text);
    }
  }
  await dimensions(root);
  console.log(
    `Image transfer sources: ${before} → ${after} bytes (${Math.round((1 - after / before) * 100)}% smaller). Originals retained.`,
  );
}
run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
