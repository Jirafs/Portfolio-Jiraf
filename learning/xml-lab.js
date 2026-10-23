(() => {
  "use strict";
  const M = globalThis.XMLLabModel;
  const $ = (s) => document.querySelector(s);
  const editor = $("#xml-source");
  if (!M || !editor) return;
  const key = "jiraf.xml-lab.v1";
  let active = "movies",
    drafts = {},
    replacement = null,
    readVersion = 0;
  try {
    const raw = localStorage.getItem(key);
    if (raw) {
      const saved = M.validateDraft(JSON.parse(raw));
      active = saved.active;
      drafts = saved.drafts;
      $("#draft-status").textContent = "Восстановлен сохранённый черновик.";
    }
  } catch {
    $("#draft-status").textContent =
      "Не удалось прочитать черновик. Открыт исходный пример; сохранение оставлено без изменений.";
  }
  function sourceFor(id) {
    return Object.hasOwn(drafts, id) ? drafts[id] : M.config(id).example;
  }
  function count() {
    $("#source-count").textContent =
      `Строк: ${editor.value.split("\n").length} · символов: ${editor.value.length} / 50 000`;
  }
  function pending(clear = false) {
    $("#run-status").className = "status";
    const message =
      "Данные изменились. Нажмите «Запустить», чтобы обновить результат.";
    if ($("#run-status").textContent !== message)
      $("#run-status").textContent = message;
    $("#lab-criteria").replaceChildren();
    $("#criteria-summary").textContent = "Изменения ещё не проверены.";
    if (clear) {
      $("#table-result").replaceChildren();
    }
    count();
  }
  function selectCase() {
    const c = M.config(active);
    $("#lab-case").value = active;
    editor.value = sourceFor(active);
    $("#schema-note").textContent =
      `Корень <${c.root}>, запись <${c.record}>. Поля: ${c.fields.map(([tag, label]) => `${label} <${tag}>`).join(", ")}.`;
    pending(true);
  }
  function node(tag, text) {
    const el = document.createElement(tag);
    if (text !== undefined) el.textContent = text;
    return el;
  }
  function run() {
    const c = M.config(active);
    const result = $("#table-result");
    const criteria = $("#lab-criteria");
    result.replaceChildren();
    criteria.replaceChildren();
    try {
      const rows = M.parse(editor.value, active);
      const wrap = node("div");
      wrap.className = "table-wrap";
      wrap.tabIndex = 0;
      wrap.setAttribute("role", "region");
      wrap.setAttribute("aria-label", `Таблица: ${c.name}`);
      const table = node("table");
      table.append(node("caption", `${c.name} · записей: ${rows.length}`));
      const head = node("thead"),
        headRow = node("tr");
      c.fields.forEach(([, label]) => {
        const th = node("th", label);
        th.scope = "col";
        headRow.append(th);
      });
      head.append(headRow);
      const body = node("tbody");
      rows.forEach((row) => {
        const tr = node("tr");
        c.fields.forEach(([key]) => tr.append(node("td", row[key])));
        body.append(tr);
      });
      table.append(head, body);
      wrap.append(table);
      result.append(wrap);
      const checks = M.criteria(active, rows);
      checks.forEach((check) => {
        const li = node("li", `${check.passed ? "✓" : "○"} ${check.text}`);
        li.className = check.passed ? "passed" : "pending";
        criteria.append(li);
      });
      const passed = checks.filter((c) => c.passed).length;
      $("#criteria-summary").textContent =
        `Выполнено условий: ${passed} из ${checks.length}.`;
      $("#run-status").className = "status";
      $("#run-status").textContent =
        `XML проверен. В таблице ${rows.length} записей.`;
    } catch (error) {
      $("#run-status").className = "status error";
      $("#run-status").textContent = error.message;
      $("#criteria-summary").textContent =
        "Исправьте ошибку и запустите проверку ещё раз.";
    }
    if (window.matchMedia("(max-width: 850px)").matches)
      $("#result-panel").scrollIntoView({ block: "start" });
  }
  $("#lab-case").addEventListener("change", () => {
    readVersion++;
    drafts[active] = editor.value;
    active = $("#lab-case").value;
    selectCase();
  });
  editor.addEventListener("input", () => {
    readVersion++;
    drafts[active] = editor.value;
    pending();
  });
  editor.addEventListener("keydown", (event) => {
    if ((event.ctrlKey || event.metaKey) && event.key === "Enter") {
      event.preventDefault();
      run();
    }
  });
  $("#run-xml").addEventListener("click", run);
  function loadExample(broken) {
    readVersion++;
    const c = M.config(active);
    const source = broken
      ? c.example.replace(`</${c.record}>`, `</${c.record}-wrong>`)
      : c.example;
    if (editor.value === c.example) {
      editor.value = source;
      drafts[active] = source;
      readVersion++;
      pending(true);
      return;
    }
    replacement = { active, source };
    $("#replace-dialog").returnValue = "cancel";
    $("#replace-dialog").showModal();
  }
  $("#load-example").addEventListener("click", () => loadExample(false));
  $("#load-broken").addEventListener("click", () => loadExample(true));
  $("#replace-dialog").addEventListener("close", () => {
    if (
      $("#replace-dialog").returnValue === "replace" &&
      replacement &&
      replacement.active === active
    ) {
      readVersion++;
      editor.value = replacement.source;
      drafts[active] = editor.value;
      pending(true);
      editor.focus();
    }
    replacement = null;
  });
  $("#save-draft").addEventListener("click", () => {
    drafts[active] = editor.value;
    try {
      const saved = M.validateDraft({ version: 1, active, drafts });
      localStorage.setItem(key, JSON.stringify(saved));
      $("#draft-status").textContent = "Черновик сохранён на этом устройстве.";
    } catch {
      $("#draft-status").textContent =
        "Браузер не сохранил черновик. Скачайте XML, чтобы продолжить позже.";
    }
  });
  $("#download-xml").addEventListener("click", () => {
    const url = URL.createObjectURL(
      new Blob([editor.value], { type: "application/xml;charset=utf-8" }),
    );
    const link = node("a");
    link.href = url;
    link.download = `${active}.xml`;
    document.body.append(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    $("#draft-status").textContent =
      "XML передан браузеру для скачивания. Чтобы проверить его структуру, нажмите «Запустить».";
  });
  $("#xml-file").addEventListener("change", async (event) => {
    const input = event.currentTarget;
    const file = input.files[0];
    if (!file) return;
    const version = ++readVersion;
    const caseAtStart = active;
    try {
      if (!/\.xml$/i.test(file.name))
        throw new Error("Выберите файл с расширением .xml.");
      if (file.size > 100000)
        throw new Error(
          "Файл больше 100 КБ. Откройте небольшой учебный пример.",
        );
      const source = await file.text();
      if (version !== readVersion || active !== caseAtStart) return;
      if (source.length > 50000)
        throw new Error("В файле больше 50 000 символов.");
      if (source.includes("\uFFFD"))
        throw new Error(
          "Не удалось прочитать текст. Сохраните XML в кодировке UTF-8.",
        );
      editor.value = source;
      drafts[active] = source;
      pending(true);
      $("#draft-status").textContent =
        `Открыт файл «${file.name}». Проверьте выбранный пример и нажмите «Запустить».`;
    } catch (error) {
      if (version === readVersion)
        $("#draft-status").textContent = error.message;
    } finally {
      if (version === readVersion) input.value = "";
    }
  });
  selectCase();
  $("#lab-app").hidden = false;
})();
