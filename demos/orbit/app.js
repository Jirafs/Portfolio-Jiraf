(() => {
  "use strict";
  const M = globalThis.OrbitModel;
  const key = "jiraf.orbit.v1";
  const $ = (selector) => document.querySelector(selector);
  const node = OrbitUI.node.bind(OrbitUI);
  const button = OrbitUI.button.bind(OrbitUI);
  const confirmAction = OrbitUI.confirmAction.bind(OrbitUI);
  const store = OrbitStore.create(
    {
      getItem: (key) => localStorage.getItem(key),
      setItem: (key, value) => localStorage.setItem(key, value),
    },
    key,
    M,
  );
  let state = store.snapshot();
  function storageNotice(message = store.warning()) {
    $("#storage-note").hidden = !message;
    $("#storage-note").textContent = message;
  }
  storageNotice();
  const page = document.body.dataset.page;
  const today = M.isoDay(new Date());
  const screen = $("#screen");
  const dialog = $("#task-dialog");
  const form = $("#task-form");
  let editingId = null;
  let editingSignature = "";
  let toastTimer;
  function notify(message) {
    $("#toast").textContent = message;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      $("#toast").textContent = "";
    }, 5000);
  }
  function save(change, message, options = {}) {
    const result = store.commit(change, options);
    state = result.state;
    storageNotice();
    render();
    notify(
      result.durable
        ? message
        : `${message} Пока только в памяти этой вкладки.`,
    );
  }
  function option(select, value, text) {
    const opt = node("option", "", text);
    opt.value = value;
    select.append(opt);
  }
  function options(select, rows, first) {
    const previous = select.value;
    select.replaceChildren();
    if (first) option(select, "all", first);
    rows.forEach((r) => option(select, r.id, r.name));
    if ([...select.options].some((o) => o.value === previous))
      select.value = previous;
  }
  function populate() {
    options($("#project-filter"), state.projects, "Все проекты");
    options($("#assignee-filter"), state.members, "Все исполнители");
    options(form.elements.project, state.projects);
    options(form.elements.assignee, state.members);
  }
  populate();
  const params = new URLSearchParams(location.search);
  for (const [param, id] of [
    ["project", "project-filter"],
    ["assignee", "assignee-filter"],
    ["status", "status-filter"],
    ["due", "due-filter"],
  ]) {
    const value = params.get(param);
    const el = $("#" + id);
    if (value && [...el.options].some((o) => o.value === value))
      el.value = value;
  }
  function filtered() {
    const q = $("#task-search").value.trim().toLocaleLowerCase("ru");
    return state.tasks.filter((t) => {
      const project = state.projects.find((p) => p.id === t.project);
      const person = state.members.find((m) => m.id === t.assignee);
      const match = [t.title, t.description, project.name, person.name]
        .join(" ")
        .toLocaleLowerCase("ru")
        .includes(q);
      return (
        match &&
        [
          ["project-filter", "project"],
          ["assignee-filter", "assignee"],
          ["status-filter", "status"],
          ["priority-filter", "priority"],
        ].every(
          ([id, field]) =>
            $("#" + id).value === "all" || $("#" + id).value === t[field],
        ) &&
        ($("#due-filter").value === "all" ||
          (t.status !== "done" &&
            ($("#due-filter").value === "overdue"
              ? t.due < today
              : t.due >= today &&
                t.due <= M.isoDay(new Date(Date.now() + 7 * 86400000)))))
      );
    });
  }
  function badge(text, cls = "") {
    return node("span", `badge ${cls}`, text);
  }
  function avatar(member) {
    const el = node(
      "span",
      "avatar",
      member.name
        .split(" ")
        .map((w) => w[0])
        .slice(0, 2)
        .join(""),
    );
    el.style.background = member.color;
    el.title = member.name;
    return el;
  }
  function empty(
    parent,
    text = "Задач не найдено. Измените фильтры или создайте новую задачу.",
  ) {
    parent.append(node("p", "empty", text));
  }
  function taskCard(task) {
    const card = node("article", "task-card");
    card.draggable = true;
    card.dataset.taskId = task.id;
    card.addEventListener("dragstart", (event) => {
      event.dataTransfer.setData("text/plain", task.id);
      event.dataTransfer.effectAllowed = "move";
      card.classList.add("dragging");
    });
    card.addEventListener("dragend", () => card.classList.remove("dragging"));
    const project = state.projects.find((p) => p.id === task.project);
    const top = node("div", "task-top");
    const tag = badge(project.name);
    tag.style.setProperty("--project", project.color);
    top.append(tag, badge(M.priorities[task.priority], task.priority));
    const heading = node("h3");
    heading.append(button(task.title, () => openTask(task.id), "task-title"));
    const foot = node("div", "task-footer");
    const person = state.members.find((m) => m.id === task.assignee);
    const date = node(
      "span",
      task.due < today && task.status !== "done" ? "late" : "",
      formatDate(task.due),
    );
    date.title = "Срок выполнения";
    foot.append(
      avatar(person),
      date,
      node(
        "span",
        "check-count",
        `${task.checklist.filter((c) => c.done).length}/${task.checklist.length} ✓`,
      ),
    );
    card.append(
      top,
      heading,
      node("p", "task-excerpt", task.description.slice(0, 95)),
      foot,
    );
    const move = node("select", "task-status-select");
    move.setAttribute("aria-label", `Переместить задачу: ${task.title}`);
    for (const [id, name] of Object.entries(M.statuses)) option(move, id, name);
    move.value = task.status;
    move.addEventListener("change", () => {
      try {
        save(
          (latest) => M.move(latest, task.id, move.value),
          "Статус задачи обновлён",
        );
        const replacement = [...screen.querySelectorAll("[data-task-id]")].find(
          (el) => el.dataset.taskId === task.id,
        );
        (
          replacement?.querySelector(".task-status-select") || $("#new-task")
        ).focus();
      } catch (error) {
        move.value = task.status;
        notify(error.message);
      }
    });
    move.addEventListener("dragstart", (event) => event.preventDefault());
    card.append(move);
    return card;
  }
  function formatDate(value) {
    return new Date(value + "T12:00:00").toLocaleDateString("ru-RU", {
      day: "numeric",
      month: "short",
    });
  }
  function metrics(tasks) {
    const data = M.metrics(tasks, today);
    const wrap = node("div", "metrics");
    for (const [name, value, detail] of [
      ["Всего задач", data.total, "В выбранном представлении"],
      ["В работе", data.progress, "Сейчас в процессе"],
      ["Завершено", data.done, `${data.percent}% от всех задач`],
      ["Требуют внимания", data.overdue, "Незавершённые с прошедшим сроком"],
    ]) {
      const card = node("article", "metric");
      card.append(
        node("p", "muted", name),
        node("strong", "metric-value", value),
        node("small", "muted", detail),
      );
      wrap.append(card);
    }
    return wrap;
  }
  function section(title, caption) {
    const el = node("section", "panel");
    const head = node("div", "panel-head");
    head.append(node("h2", "", title));
    if (caption) head.append(node("span", "muted", caption));
    el.append(head);
    return el;
  }
  function projectProgress(tasks) {
    const panel = section("Проекты в фокусе", "По текущим фильтрам");
    for (const project of state.projects) {
      const data = M.metrics(
        tasks.filter((t) => t.project === project.id),
        today,
      );
      const row = node("div", "project-progress");
      const head = node("div", "spread");
      head.append(
        node("strong", "", project.name),
        node("span", "muted", `${data.done}/${data.total} задач`),
      );
      const progress = node("progress");
      progress.max = 100;
      progress.value = data.percent;
      progress.setAttribute(
        "aria-label",
        `${project.name}: завершено ${data.percent}%`,
      );
      progress.style.accentColor = project.color;
      row.append(head, progress);
      panel.append(row);
    }
    return panel;
  }
  function activity() {
    const panel = section("Пульс команды", "История действий");
    const list = node("ol", "activity");
    for (const event of state.activity.slice(0, 6)) {
      const li = node("li");
      li.append(
        node("span", "activity-dot"),
        node("span", "", event.text),
        node(
          "time",
          "muted",
          new Date(event.at).toLocaleDateString("ru-RU", {
            day: "numeric",
            month: "short",
          }),
        ),
      );
      list.append(li);
    }
    panel.append(list);
    return panel;
  }
  function overview(tasks) {
    screen.append(metrics(tasks));
    const grid = node("div", "dashboard-grid");
    grid.append(projectProgress(tasks), activity());
    const upcoming = section(
      "Ближайшие задачи",
      "Откройте любую для редактирования",
    );
    const list = node("div", "upcoming-list");
    const rows = tasks
      .filter((t) => t.status !== "done")
      .sort((a, b) => a.due.localeCompare(b.due))
      .slice(0, 5);
    rows.forEach((task) => {
      const row = button("", () => openTask(task.id), "upcoming-row");
      row.append(
        node("span", "task-marker", task.status === "progress" ? "◉" : "○"),
        node("strong", "", task.title),
        badge(M.statuses[task.status]),
        node("time", task.due < today ? "late" : "muted", formatDate(task.due)),
      );
      list.append(row);
    });
    if (!rows.length)
      empty(list, "Нет незавершённых задач по выбранным фильтрам.");
    upcoming.append(list);
    screen.append(grid, upcoming);
  }
  function board(tasks) {
    const board = node("div", "board");
    for (const [status, name] of Object.entries(M.statuses)) {
      const lane = node("section", "lane");
      lane.dataset.status = status;
      const rows = tasks.filter((t) => t.status === status);
      const head = node("div", "lane-heading");
      head.append(
        node("h2", "", name),
        badge(rows.length),
        button("+", () => openTask(null, status), "add-in-lane"),
      );
      head.lastChild.setAttribute("aria-label", `Создать задачу: ${name}`);
      lane.append(head);
      lane.addEventListener("dragover", (event) => {
        event.preventDefault();
        event.dataTransfer.dropEffect = "move";
        lane.classList.add("drop-target");
      });
      lane.addEventListener("dragleave", (event) => {
        if (!lane.contains(event.relatedTarget))
          lane.classList.remove("drop-target");
      });
      lane.addEventListener("drop", (event) => {
        event.preventDefault();
        lane.classList.remove("drop-target");
        try {
          save(
            (current) =>
              M.move(current, event.dataTransfer.getData("text/plain"), status),
            `Задача перемещена: ${name}`,
          );
        } catch (error) {
          notify(error.message);
        }
      });
      rows.forEach((t) => lane.append(taskCard(t)));
      if (!rows.length)
        empty(
          lane,
          "Пока пусто. Добавьте задачу или перенесите её из другой колонки.",
        );
      board.append(lane);
    }
    screen.append(
      board,
      node(
        "p",
        "board-hint",
        "Перетаскивайте карточки между колонками. На телефоне или с клавиатуры используйте список статусов в карточке или поле «Статус» в форме.",
      ),
    );
  }
  function analytics(tasks) {
    screen.append(metrics(tasks));
    const grid = node("div", "analytics-grid");
    const statusPanel = section(
      "Распределение задач",
      "Актуальные данные доски",
    );
    for (const [id, name] of Object.entries(M.statuses)) {
      const n = tasks.filter((t) => t.status === id).length;
      const row = node("div", "chart-row");
      row.append(node("span", "", name), node("strong", "", n));
      const bar = node("div", "bar-track");
      const fill = node("div", `bar-fill ${id}`);
      fill.style.width = `${tasks.length ? (n / tasks.length) * 100 : 0}%`;
      bar.append(fill);
      row.append(bar);
      statusPanel.append(row);
    }
    const complete = section("Движение к результату");
    const percent = M.metrics(tasks, today).percent;
    const ring = node("div", "completion-ring");
    ring.style.setProperty("--progress", percent + "%");
    ring.setAttribute("role", "img");
    ring.setAttribute("aria-label", `Завершено ${percent}% задач`);
    ring.append(node("strong", "", percent + "%"));
    complete.append(
      ring,
      node(
        "p",
        "center muted",
        "Доля завершённых задач в выбранном представлении.",
      ),
    );
    grid.append(statusPanel, complete);
    screen.append(grid);
    const load = section(
      "Загрузка команды",
      "Оценка времени — введённые часы, не трекинг",
    );
    for (const person of state.members) {
      const rows = tasks.filter(
        (t) => t.assignee === person.id && t.status !== "done",
      );
      const line = node("div", "load-row");
      line.append(
        avatar(person),
        node("strong", "", person.name),
        node(
          "span",
          "muted",
          `${rows.length} задач · ${rows.reduce((s, t) => s + t.estimate, 0)} ч`,
        ),
      );
      load.append(line);
    }
    screen.append(load);
  }
  function team(tasks) {
    const grid = node("div", "team-grid");
    for (const person of state.members) {
      const card = node("article", "panel person");
      const rows = tasks.filter((t) => t.assignee === person.id);
      card.append(
        avatar(person),
        node("h2", "", person.name),
        node("p", "muted", person.role),
      );
      const stats = M.metrics(rows, today);
      card.append(
        node(
          "p",
          "",
          `${stats.total - stats.done} активных · ${stats.done} завершено`,
        ),
      );
      const link = node("a", "button secondary", "Открыть задачи →");
      link.href = `board.html?assignee=${encodeURIComponent(person.id)}`;
      card.append(link);
      grid.append(card);
    }
    screen.append(
      node(
        "p",
        "muted",
        "Вымышленная команда для демонстрации. Показатели рассчитаны по выбранным задачам.",
      ),
      grid,
    );
  }
  function settings() {
    const grid = node("div", "dashboard-grid");
    const data = section(
      "Данные под вашим контролем",
      "Хранение в этом браузере",
    );
    data.append(
      node(
        "p",
        "muted",
        "Экспорт сохраняет проекты, задачи, команду и историю в JSON. Импорт заменяет текущее пространство после проверки формата.",
      ),
      button("Экспортировать JSON", exportData),
      button("Импортировать JSON", () => $("#import-file").click()),
      button(
        "Восстановить демоданные",
        async () => {
          if (
            await confirmAction(
              "Заменить текущие данные учебным набором? Сначала экспортируйте нужные изменения.",
            )
          )
            save(() => M.seed(), "Демонстрационные данные восстановлены", {
              replace: true,
            });
        },
        "button danger",
      ),
    );
    if (store.warning() && store.original() !== null)
      data.append(
        button("Скачать исходное сохранение", () =>
          downloadText(store.original(), "orbit-original.json"),
        ),
      );
    const guide = section("Что можно попробовать");
    for (const text of [
      "Создать задачу и назначить исполнителя",
      "Перенести карточку на доске или изменить статус в форме",
      "Отметить пункты чек-листа и проверить аналитику",
      "Экспортировать данные и импортировать их обратно",
    ])
      guide.append(node("p", "guide-line", text));
    guide.append(
      node(
        "p",
        "muted",
        "Это клиентское демо: реальные аккаунты, общая серверная база и отправка уведомлений не подключены.",
      ),
    );
    grid.append(data, guide);
    screen.append(grid);
    const create = section("Расширить пространство");
    const forms = node("div", "dashboard-grid");
    for (const type of ["project", "member"]) {
      const f = node("form", "settings-form");
      const heading = node(
        "h3",
        "",
        type === "project" ? "Новый проект" : "Новый участник",
      );
      const label = node(
        "label",
        "",
        type === "project" ? "Название проекта" : "Имя участника",
      );
      const input = node("input");
      input.required = true;
      input.maxLength = 80;
      label.append(input);
      const roleLabel = node(
        "label",
        "",
        type === "project" ? "Цвет проекта" : "Роль",
      );
      const second = node("input");
      second.type = type === "project" ? "color" : "text";
      second.value = type === "project" ? "#7461ea" : "";
      second.required = true;
      second.maxLength = 80;
      roleLabel.append(second);
      const submit = node(
        "button",
        "button",
        type === "project" ? "Добавить проект" : "Добавить участника",
      );
      submit.type = "submit";
      f.append(heading, label, roleLabel, submit);
      f.addEventListener("submit", (event) => {
        event.preventDefault();
        if (!input.value.trim() || !second.value.trim()) return;
        try {
          const change = (current) => {
            const next = JSON.parse(JSON.stringify(current));
            if (type === "project")
              next.projects.push({
                id: crypto.randomUUID(),
                name: input.value.trim(),
                color: second.value,
              });
            else
              next.members.push({
                id: crypto.randomUUID(),
                name: input.value.trim(),
                role: second.value.trim(),
                color: "#dce6ff",
              });
            return next;
          };
          save(change, "Пространство обновлено");
        } catch (error) {
          notify(error.message);
        }
      });
      forms.append(f);
    }
    create.append(forms);
    screen.append(create);
  }
  function render() {
    populate();
    const tasks = filtered();
    $("#task-count").textContent =
      `${tasks.length} из ${state.tasks.length} задач`;
    $("#reset-filters").hidden =
      !$("#task-search").value &&
      [
        "project-filter",
        "assignee-filter",
        "status-filter",
        "priority-filter",
        "due-filter",
      ].every((id) => $("#" + id).value === "all");
    screen.replaceChildren();
    (({ overview, board, analytics, team, settings })[page] || overview)(tasks);
  }
  function openTask(id, status = "ready") {
    form.reset();
    $("#form-error").textContent = "";
    editingId = id;
    const task = state.tasks.find((t) => t.id === id);
    editingSignature = task ? JSON.stringify(task) : "";
    $("#dialog-title").textContent = task ? "Детали задачи" : "Новая задача";
    const initial = task || {
      title: "",
      description: "",
      project:
        $("#project-filter").value === "all"
          ? state.projects[0].id
          : $("#project-filter").value,
      assignee: state.members[0].id,
      status,
      priority: "medium",
      due: M.isoDay(new Date(Date.now() + 3 * 86400000)),
      estimate: 2,
      checklist: [],
    };
    for (const field of [
      "title",
      "description",
      "project",
      "assignee",
      "status",
      "priority",
      "due",
      "estimate",
    ])
      form.elements[field].value = initial[field];
    form.elements.checklist.value = initial.checklist
      .map((c) => c.text)
      .join("\n");
    $("#delete-task").hidden = !task;
    const checks = $("#task-checks");
    checks.replaceChildren();
    initial.checklist.forEach((c) => {
      const label = node("label", "check-item");
      const input = node("input");
      input.type = "checkbox";
      input.checked = c.done;
      input.addEventListener("change", () => {
        try {
          save(
            (latest) => {
              const current = latest.tasks.find((t) => t.id === id);
              return M.upsert(latest, {
                ...current,
                checklist: current.checklist.map((item) =>
                  item.id === c.id ? { ...item, done: input.checked } : item,
                ),
              });
            },
            "Чек-лист обновлён",
            { expectedTask: { id, signature: editingSignature } },
          );
          editingSignature = JSON.stringify(
            state.tasks.find((t) => t.id === id),
          );
        } catch (error) {
          input.checked = !input.checked;
          $("#form-error").textContent = error.message;
        }
      });
      label.append(input, node("span", "", c.text));
      checks.append(label);
    });
    dialog.showModal();
    form.elements.title.focus();
  }
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    try {
      const current = state.tasks.find((t) => t.id === editingId);
      if (editingId && JSON.stringify(current) !== editingSignature)
        throw new Error(
          "Задача изменилась. Закройте форму и откройте её заново, чтобы увидеть свежие данные.",
        );
      if (!form.elements.title.value.trim())
        throw new Error("Введите название задачи.");
      const lines = form.elements.checklist.value
        .split("\n")
        .map((s) => s.trim())
        .filter(Boolean);
      if (new Set(lines).size !== lines.length)
        throw new Error("Названия пунктов чек-листа должны различаться.");
      const task = {
        id: editingId || crypto.randomUUID(),
        checklist: lines.map(
          (text) =>
            current?.checklist.find((c) => c.text === text) || {
              id: crypto.randomUUID(),
              text,
              done: false,
            },
        ),
      };
      for (const field of [
        "title",
        "description",
        "project",
        "assignee",
        "status",
        "priority",
        "due",
      ])
        task[field] = form.elements[field].value;
      task.estimate = Number(form.elements.estimate.value);
      save(
        (latest) => M.upsert(latest, task),
        editingId ? "Задача сохранена" : "Задача создана",
        editingId
          ? { expectedTask: { id: editingId, signature: editingSignature } }
          : {},
      );
      dialog.close();
      $("#new-task").focus();
    } catch (error) {
      $("#form-error").textContent = error.message;
    }
  });
  $("#delete-task").addEventListener("click", async () => {
    try {
      if (editingId && (await confirmAction("Удалить эту задачу?"))) {
        save((latest) => M.remove(latest, editingId), "Задача удалена", {
          expectedTask: { id: editingId, signature: editingSignature },
        });
        dialog.close();
        $("#new-task").focus();
      }
    } catch (error) {
      $("#form-error").textContent = error.message;
    }
  });
  $("#close-dialog").addEventListener("click", () => dialog.close());
  $("#new-task").addEventListener("click", () => openTask(null));
  $("#reset-filters").addEventListener("click", () => {
    $("#task-search").value = "";
    for (const id of [
      "project-filter",
      "assignee-filter",
      "status-filter",
      "priority-filter",
      "due-filter",
    ])
      $("#" + id).value = "all";
    render();
    $("#task-search").focus();
  });
  for (const id of [
    "task-search",
    "project-filter",
    "assignee-filter",
    "status-filter",
    "priority-filter",
    "due-filter",
  ])
    $("#" + id).addEventListener(
      id === "task-search" ? "input" : "change",
      render,
    );
  function downloadText(text, name) {
    const blob = new Blob([text], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = node("a");
    link.href = url;
    link.download = name;
    document.body.append(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 60000);
    notify("Экспорт передан браузеру");
  }
  function exportData() {
    downloadText(JSON.stringify(state, null, 2), "orbit-workspace.json");
  }
  $("#import-file").addEventListener("change", async (event) => {
    const file = event.target.files[0];
    event.target.value = "";
    if (!file) return;
    try {
      if (file.size > 1024 * 1024)
        throw new Error("Максимальный размер JSON — 1 МБ.");
      const imported = M.validate(JSON.parse(await file.text()));
      if (
        await confirmAction(
          `Импортировать ${imported.tasks.length} задач? Текущие данные будут заменены.`,
        )
      )
        save(() => imported, "Данные импортированы", { replace: true });
    } catch (error) {
      notify(`Импорт не выполнен: ${error.message}`);
    }
  });
  window.addEventListener("storage", (event) => {
    if (event.key === key || event.key === null) {
      try {
        state = store.refresh();
        storageNotice();
        render();
        notify("Данные обновлены из другой вкладки");
      } catch (error) {
        storageNotice(error.message);
        notify(error.message);
      }
    }
  });
  document.addEventListener("keydown", (event) => {
    if (
      event.ctrlKey ||
      event.metaKey ||
      event.altKey ||
      dialog.open ||
      ["INPUT", "TEXTAREA", "SELECT"].includes(document.activeElement.tagName)
    )
      return;
    if (event.key.toLowerCase() === "n") {
      event.preventDefault();
      openTask(null);
    }
    if (event.key === "/") {
      event.preventDefault();
      $("#task-search").focus();
    }
  });
  if (page === "settings") $("#workspace-filters").hidden = true;
  render();
})();
