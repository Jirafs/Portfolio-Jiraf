(() => {
  "use strict";
  const $ = (selector) => document.querySelector(selector);
  const labels = {
    backlog: "Идеи",
    ready: "К работе",
    progress: "В процессе",
    done: "Готово",
  };
  const roles = {
    owner: "Владелец",
    editor: "Редактор",
    viewer: "Наблюдатель",
  };
  let session,
    state,
    workspace,
    editing,
    generation = 0,
    pending = false;
  function message(text) {
    $("#message").textContent = text;
    $("#message").hidden = !text;
  }
  async function api(path, method = "GET", body) {
    const response = await fetch(`/api/${path}`, {
      method,
      credentials: "same-origin",
      headers:
        method === "GET"
          ? {}
          : { "Content-Type": "application/json", "X-Orbit-Request": "1" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    let data;
    try {
      data = await response.json();
    } catch {
      throw new Error(
        "Сервер недоступен. Проверьте локальный запуск и обновите страницу.",
      );
    }
    if (!response.ok) {
      const error = new Error(data.error || "Запрос не выполнен.");
      error.status = response.status;
      throw error;
    }
    return data;
  }
  function node(tag, text, className) {
    const element = document.createElement(tag);
    if (text !== undefined) element.textContent = text;
    if (className) element.className = className;
    return element;
  }
  function showAuth() {
    generation++;
    session = state = workspace = editing = null;
    $("#edit-dialog").close();
    ["#auth-form", "#task-form", "#member-form", "#edit-form"].forEach(
      (selector) => $(selector).reset(),
    );
    $("#board").replaceChildren();
    $("#members").replaceChildren();
    $("#workspace-select").replaceChildren();
    $("#account-name").textContent = "";
    $("#metrics").textContent = "";
    $("#workspace").hidden = true;
    $("#launch").hidden = true;
    $("#auth").hidden = false;
  }
  async function run(action, errorTarget) {
    if (pending) return;
    pending = true;
    document
      .querySelectorAll("button, input, select, textarea")
      .forEach((b) => (b.disabled = true));
    try {
      await action();
    } catch (error) {
      const text =
        error instanceof TypeError
          ? "Нет связи с сервером. Данные формы сохранены: повторите действие после восстановления связи."
          : error.message;
      if (error.status === 401) {
        $("#edit-dialog").close();
        showAuth();
        message(text);
      } else if (errorTarget) {
        $(errorTarget).textContent = text;
        $("#edit-reload").hidden = error.status !== 409;
      } else message(text);
    } finally {
      pending = false;
      document
        .querySelectorAll("button, input, select, textarea")
        .forEach((b) => (b.disabled = false));
    }
  }
  async function loadSession() {
    session = await api("session");
    const select = $("#workspace-select");
    select.replaceChildren();
    session.workspaces.forEach((w) => {
      const option = node("option", w.name);
      option.value = w.id;
      select.append(option);
    });
    if (!session.workspaces.some((w) => String(w.id) === String(workspace)))
      workspace = session.workspaces[0]?.id;
    select.value = workspace;
    $("#account-name").textContent =
      `${session.user.name} · ${session.user.email}`;
    $("#auth").hidden = $("#launch").hidden = true;
    $("#workspace").hidden = false;
    await loadWorkspace();
  }
  async function loadWorkspace() {
    const ticket = ++generation,
      selected = workspace;
    const data = await api(`workspaces/${selected}`);
    if (ticket !== generation || selected !== workspace) return;
    state = data;
    const writable = data.role !== "viewer";
    $("#role-label").textContent = `Ваша роль: ${roles[data.role]}`;
    $("#task-form").hidden = !writable;
    $("#member-form").hidden = data.role !== "owner";
    $("#metrics").textContent =
      `Всего задач: ${data.tasks.length} · В процессе: ${data.tasks.filter((t) => t.status === "progress").length} · Готово: ${data.tasks.filter((t) => t.status === "done").length}`;
    $("#board").replaceChildren();
    for (const [status, label] of Object.entries(labels)) {
      const tasks = data.tasks.filter((t) => t.status === status),
        column = node("section", undefined, "column");
      column.append(node("h2", `${label} · ${tasks.length}`));
      if (!tasks.length) column.append(node("p", "Задач пока нет", "empty"));
      tasks.forEach((task) => {
        const card = node("article", undefined, "task");
        card.append(node("h3", task.title));
        if (task.description) card.append(node("p", task.description));
        if (writable) {
          const button = node("button", "Изменить", "secondary");
          button.type = "button";
          button.setAttribute("aria-label", `Изменить задачу: ${task.title}`);
          button.addEventListener("click", () => openEdit(task));
          card.append(button);
        }
        column.append(card);
      });
      $("#board").append(column);
    }
    $("#members").replaceChildren(
      ...data.members.map((member) =>
        node("li", `${member.name} · ${member.email} · ${roles[member.role]}`),
      ),
    );
  }
  function openEdit(task) {
    editing = { ...task, workspace };
    $("#edit-name").value = task.title;
    $("#edit-description").value = task.description;
    $("#edit-status").value = task.status;
    $("#edit-error").textContent = "";
    $("#edit-reload").hidden = true;
    $("#edit-dialog").showModal();
    $("#edit-name").focus();
  }
  $("#auth-mode").addEventListener("change", () => {
    const registration = $("#auth-mode").value === "register";
    $("#name-label").hidden = !registration;
    $("#auth-name").required = registration;
    $("#auth-password").autocomplete = registration
      ? "new-password"
      : "current-password";
    $("#auth-title").textContent = registration
      ? "Создать аккаунт"
      : "Войти в Orbit";
    $("#auth-form button").textContent = registration
      ? "Создать аккаунт"
      : "Войти";
  });
  $("#auth-form").addEventListener("submit", (event) => {
    event.preventDefault();
    run(async () => {
      await api($("#auth-mode").value, "POST", {
        email: $("#auth-email").value,
        name: $("#auth-name").value,
        password: $("#auth-password").value,
      });
      $("#auth-password").value = "";
      await loadSession();
      message("Вы вошли в своё пространство.");
    });
  });
  $("#logout").addEventListener("click", () =>
    run(async () => {
      await api("logout", "POST", {});
      showAuth();
      message("Вы вышли из аккаунта.");
    }),
  );
  $("#workspace-select").addEventListener("change", () => {
    workspace = Number($("#workspace-select").value);
    run(async () => {
      await loadWorkspace();
      message("");
    });
  });
  $("#refresh").addEventListener("click", () =>
    run(async () => {
      await loadSession();
      message("Доска обновлена.");
    }),
  );
  $("#task-form").addEventListener("submit", (event) => {
    event.preventDefault();
    run(async () => {
      await api("tasks", "POST", {
        workspace: Number(workspace),
        title: $("#task-title").value,
        description: $("#task-description").value,
        status: $("#task-status").value,
      });
      $("#task-form").reset();
      await loadWorkspace();
      message("Задача создана.");
    });
  });
  $("#edit-cancel").addEventListener("click", () => $("#edit-dialog").close());
  $("#edit-reload").addEventListener("click", () => {
    if (
      !confirm(
        "Загрузить актуальную версию? Несохранённый текст в этой форме будет заменён.",
      )
    )
      return;
    run(async () => {
      const id = editing.id;
      await loadWorkspace();
      const current = state.tasks.find((task) => task.id === id);
      if (!current || state.role === "viewer") {
        $("#edit-dialog").close();
        message(
          current
            ? "У вас больше нет права редактировать задачи."
            : "Задача уже удалена другим участником.",
        );
        return;
      }
      openEdit(current);
      $("#edit-error").textContent =
        "Актуальная версия загружена. Проверьте её перед сохранением.";
    }, "#edit-error");
  });
  $("#edit-form").addEventListener("submit", (event) => {
    event.preventDefault();
    run(async () => {
      await api(`tasks/${editing.id}`, "PATCH", {
        version: editing.version,
        title: $("#edit-name").value,
        description: $("#edit-description").value,
        status: $("#edit-status").value,
      });
      $("#edit-dialog").close();
      await loadWorkspace();
      message("Изменения сохранены.");
    }, "#edit-error");
  });
  $("#task-delete").addEventListener("click", () => {
    if (
      !confirm(
        `Удалить задачу «${editing.title}»? Это действие нельзя отменить.`,
      )
    )
      return;
    run(async () => {
      await api(`tasks/${editing.id}`, "DELETE", { version: editing.version });
      $("#edit-dialog").close();
      await loadWorkspace();
      message("Задача удалена.");
    }, "#edit-error");
  });
  $("#member-form").addEventListener("submit", (event) => {
    event.preventDefault();
    run(async () => {
      await api("members", "POST", {
        workspace: Number(workspace),
        email: $("#member-email").value,
        role: $("#member-role").value,
      });
      $("#member-form").reset();
      await loadWorkspace();
      message("Права участника сохранены.");
    });
  });
  if (location.hostname === "127.0.0.1") {
    loadSession().catch((error) => {
      if (error.status === 401) showAuth();
      else message("Для входа запустите Python-сервер по инструкции ниже.");
    });
  }
})();
