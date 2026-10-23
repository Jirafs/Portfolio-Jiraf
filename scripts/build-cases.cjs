const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const root = path.resolve(__dirname, "..");
const source = fs.readFileSync(path.join(root, "script.js"), "utf8");
const ctx = {
  document: {
    documentElement: { classList: { add() {} } },
    querySelector() {
      return null;
    },
    querySelectorAll() {
      return [];
    },
  },
};
vm.createContext(ctx);
vm.runInContext(
  source.slice(0, source.indexOf("const casePage =")) +
    ";globalThis.projects=projectData;globalThis.steps=projectTrySteps;",
  ctx,
);
const base = "https://jirafs.github.io/Portfolio-Jiraf/";
const escape = (value) =>
  String(value).replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
const template = fs.readFileSync(path.join(root, "project.html"), "utf8");
const keys = Object.keys(ctx.projects);
fs.mkdirSync(path.join(root, "cases"), { recursive: true });
for (const [key, project] of Object.entries(ctx.projects)) {
  let html = template
    .replace("<head>", '<head>\n  <base href="../">')
    .replace(
      'class="site-shell case-page"',
      `class="site-shell case-page" data-project="${key}"`,
    )
    .replace('href="#case-main"', `href="cases/${key}.html#case-main"`);
  function text(id, value) {
    const regex = new RegExp(
      '(<([a-z0-9]+)[^>]*\\bid="' + id + '"[^>]*>)[\\s\\S]*?(<\\/\\2>)',
    );
    html = html.replace(
      regex,
      (_, open, tag, close) => open + escape(value) + close,
    );
  }
  function attr(id, name, value) {
    const regex = new RegExp('<[a-z][^>]*\\bid="' + id + '"[^>]*>');
    html = html.replace(regex, (tag) => {
      const old = new RegExp("\\b" + name + '="[^"]*"');
      return old.test(tag)
        ? tag.replace(old, `${name}="${escape(value)}"`)
        : tag.replace(/\s*\/?>(?=$)/, ` ${name}="${escape(value)}">`);
    });
  }
  for (const [id, value] of Object.entries({
    "case-title": project.title,
    "case-category": project.category,
    "case-index": project.index,
    "case-intro": project.intro,
    "case-task": project.task,
    "case-result": project.result,
    "case-year": project.year,
    "case-role": project.role,
    "case-level": `${project.level} · ${project.pages}`,
    "case-system": project.system,
    "case-direction": project.task,
    "case-next-step": project.next,
    "case-launch": project.result,
    "case-boundary": project.boundary,
    "case-functions": project.features.map((f) => "✓ " + f).join("\n"),
    "case-try": ctx.steps[key].map((s, i) => `${i + 1}. ${s}`).join("\n\n"),
    "case-screen-one-label": project.detailTitle,
    "case-screen-two-label": project.mobileTitle,
  }))
    text(id, value);
  text("case-statement", `${project.title}: решения и поведение`);
  for (const [id, value] of Object.entries({
    "case-demo": `demos/${key}/index.html`,
    "case-start": `demos/${key}/${project.detail}`,
    "case-screen-one-link": `demos/${key}/${project.detail}`,
    "case-screen-two-link": `demos/${key}/${project.mobilePage}`,
  }))
    attr(id, "href", value);
  for (const [id, value] of Object.entries({
    "case-image": project.image,
    "case-gallery-one": `demos/screens/${key}-detail.jpg`,
    "case-gallery-two": `demos/screens/${key}-mobile.jpg`,
  }))
    attr(id, "src", value);
  attr("case-image", "alt", `${project.title}: главный экран`);
  attr("case-gallery-one", "alt", `${project.title}: ${project.detailTitle}`);
  attr("case-gallery-two", "alt", `${project.title}: ${project.mobileTitle}`);
  const index = keys.indexOf(key);
  for (const [id, offset] of [
    ["case-prev", -1],
    ["case-next", 1],
  ]) {
    const other = keys[(index + offset + keys.length) % keys.length];
    attr(id, "href", `cases/${other}.html`);
    html = html.replace(
      new RegExp(
        '(<a[^>]*id="' + id + '"[^>]*><small>)(.*?)(</small>)[\\s\\S]*?(</a>)',
      ),
      (_, a, label, b, c) =>
        a + label + b + escape(ctx.projects[other].title) + c,
    );
  }
  const url = base + `cases/${key}.html`;
  html = html
    .replace(
      /<title>[\s\S]*?<\/title>/,
      `<title>${escape(project.title)} — кейс Jiraf</title>`,
    )
    .replace(
      /<meta name="description" content="[^"]*"\s*\/?>/,
      `<meta name="description" content="${escape(project.intro)}">`,
    )
    .replace(
      /<link rel="canonical" href="[^"]*"\s*\/?>/,
      `<link rel="canonical" href="${url}">`,
    )
    .replace(
      /<meta property="og:title" content="[^"]*"\s*\/?>/,
      `<meta property="og:title" content="${escape(project.title)} — кейс Jiraf">`,
    )
    .replace(
      /<meta property="og:url" content="[^"]*"\s*\/?>/,
      `<meta property="og:url" content="${url}">`,
    )
    .replace(
      /<meta property="og:image" content="[^"]*"\s*\/?>/,
      `<meta property="og:image" content="${base + project.image}">`,
    );
  html = html.replace(
    "</head>",
    `<meta property="og:description" content="${escape(project.intro)}"><meta property="og:locale" content="ru_RU"><meta name="twitter:card" content="summary_large_image"><meta name="twitter:title" content="${escape(project.title)} — кейс Jiraf"><meta name="twitter:description" content="${escape(project.intro)}"><meta name="twitter:image" content="${base + project.image}"></head>`,
  );
  fs.writeFileSync(path.join(root, "cases", key + ".html"), html);
}
const urls = [
  "",
  "about.html",
  "pedagog.html",
  ...keys.map((key) => `cases/${key}.html`),
];
fs.writeFileSync(
  path.join(root, "sitemap.xml"),
  '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
    urls.map((url) => `  <url><loc>${base + url}</loc></url>`).join("\n") +
    "\n</urlset>\n",
);
fs.writeFileSync(
  path.join(root, "robots.txt"),
  "User-agent: *\nAllow: /\nSitemap: " + base + "sitemap.xml\n",
);
console.log("Built four static cases with individual metadata and sitemap.");
