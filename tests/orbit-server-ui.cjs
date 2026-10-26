const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

function element() {
  return {
    children: [],
    listeners: {},
    value: "",
    textContent: "",
    hidden: false,
    append(...nodes) {
      this.children.push(...nodes);
    },
    replaceChildren(...nodes) {
      this.children = nodes;
    },
    setAttribute() {},
    focus() {},
    addEventListener(name, callback) {
      this.listeners[name] = callback;
    },
    reset() {
      for (const field of this.fields || []) field.value = "";
    },
    showModal() {
      this.open = true;
    },
    close() {
      this.open = false;
    },
  };
}
async function main() {
  const nodes = new Map();
  const get = (selector) => {
    if (!nodes.has(selector)) nodes.set(selector, element());
    return nodes.get(selector);
  };
  const forms = {
    "#auth-form": ["#auth-name", "#auth-email", "#auth-password"],
    "#task-form": ["#task-title", "#task-description", "#task-status"],
    "#member-form": ["#member-email", "#member-role"],
    "#edit-form": ["#edit-name", "#edit-description", "#edit-status"],
  };
  for (const [form, fields] of Object.entries(forms))
    get(form).fields = fields.map(get);
  let reply = true,
    requests = [],
    handler;
  const task = {
    id: 1,
    title: "Первая версия",
    description: "",
    status: "ready",
    version: 1,
  };
  const data = { role: "owner", members: [], tasks: [task] };
  const ctx = {
    document: {
      querySelector: get,
      createElement: element,
      querySelectorAll: () => [...nodes.values()],
    },
    location: { hostname: "example.test" },
    confirm: () => reply,
    fetch: async (url, options) => {
      requests.push({ url, options });
      return handler(url, options);
    },
  };
  const response = (value, status = 200) => ({
    ok: status === 200,
    status,
    json: async () => value,
  });
  handler = (url) =>
    response(
      url === "/api/session"
        ? {
            user: { name: "Owner", email: "owner@example.test" },
            workspaces: [{ id: 1, name: "Личное" }],
          }
        : url.includes("/workspaces/")
          ? data
          : { ok: true },
    );
  vm.runInNewContext(
    fs.readFileSync(
      path.join(__dirname, "../demos/orbit/fullstack.js"),
      "utf8",
    ),
    ctx,
  );
  const trigger = async (selector, event = "click") => {
    get(selector).listeners[event]({ preventDefault() {} });
    await new Promise((resolve) => setImmediate(resolve));
  };
  await trigger("#auth-form", "submit");
  const column = get("#board").children.find((c) =>
    c.children.some((child) =>
      child.children?.some((t) => t.textContent === task.title),
    ),
  );
  const card = column.children.find((child) =>
    child.children?.some((t) => t.textContent === task.title),
  );
  card.children.find((child) => child.listeners.click).listeners.click();
  get("#edit-name").value = "Мой черновик";
  handler = () => response({ error: "Конфликт версии" }, 409);
  await trigger("#edit-form", "submit");
  assert.equal(get("#edit-reload").hidden, false);
  assert.equal(get("#edit-name").value, "Мой черновик");
  reply = false;
  const before = requests.length;
  await trigger("#edit-reload");
  assert.equal(
    requests.length,
    before,
    "Cancel must keep draft without refreshing",
  );
  assert.equal(get("#edit-name").value, "Мой черновик");
  reply = true;
  handler = () =>
    response({
      ...data,
      tasks: [{ ...task, title: "Чужая новая версия", version: 2 }],
    });
  await trigger("#edit-reload");
  assert.equal(get("#edit-name").value, "Чужая новая версия");
  assert.equal(get("#edit-reload").hidden, true);
  handler = (url, options) => {
    assert.equal(
      JSON.parse(options.body).version,
      2,
      "Retry must use refreshed version",
    );
    throw new TypeError("offline");
  };
  get("#edit-name").value = "Повторная правка";
  await trigger("#edit-form", "submit");
  assert.equal(
    get("#edit-name").value,
    "Повторная правка",
    "Network failure must preserve draft",
  );
  reply = false;
  const beforeDelete = requests.length;
  await trigger("#task-delete");
  assert.equal(
    requests.length,
    beforeDelete,
    "Declined deletion must not call server",
  );
  for (const fields of Object.values(forms))
    for (const field of fields) get(field).value = "private";
  handler = () => response({ error: "Сессия истекла" }, 401);
  await trigger("#edit-form", "submit");
  for (const fields of Object.values(forms))
    for (const field of fields) assert.equal(get(field).value, "");
  assert.equal(get("#edit-dialog").open, false);
  assert.equal(get("#board").children.length, 0);
  assert.equal(get("#members").children.length, 0);
  assert.equal(get("#account-name").textContent, "");
  assert.equal(get("#auth").hidden, false);
  console.log(
    "PASS: Orbit conflict draft recovery, network retry, deletion confirmation and session privacy",
  );
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
