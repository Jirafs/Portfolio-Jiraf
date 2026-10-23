/* The demo domain model is shared by all five screens. */
globalThis.OrbitModel = (() => {
  const statuses = {
    backlog: "Идеи",
    ready: "К работе",
    progress: "В процессе",
    done: "Готово",
  };
  const priorities = { low: "Низкий", medium: "Средний", high: "Высокий" };
  const clone = (value) => JSON.parse(JSON.stringify(value));
  const isoDay = (value) => {
    const date = new Date(value);
    if (typeof value === "string") return date.toISOString().slice(0, 10);
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
  };
  function seed(now = new Date()) {
    const date = (offset) =>
      isoDay(new Date(now.getTime() + offset * 86400000));
    const projects = [
      { id: "web", name: "Сайт студии", color: "#7461ea" },
      { id: "app", name: "Мобильный продукт", color: "#1a9a86" },
      { id: "brand", name: "Бренд-платформа", color: "#de9654" },
    ];
    const members = [
      {
        id: "anna",
        name: "Анна Миронова",
        role: "Product designer",
        color: "#dce6ff",
      },
      {
        id: "max",
        name: "Максим Волков",
        role: "Frontend developer",
        color: "#e8defa",
      },
      {
        id: "lena",
        name: "Елена Белова",
        role: "Project manager",
        color: "#d9eee7",
      },
      {
        id: "ilya",
        name: "Илья Соколов",
        role: "Brand designer",
        color: "#ffead5",
      },
    ];
    const rows = [
      [
        "Собрать референсы для главной",
        "web",
        "backlog",
        "medium",
        "anna",
        5,
        3,
      ],
      ["Продумать пустые состояния", "app", "backlog", "low", "anna", 8, 4],
      ["Подготовить UI-kit", "web", "ready", "high", "anna", 2, 8],
      ["Сверстать карточку проекта", "web", "progress", "high", "max", 1, 6],
      [
        "Проверить мобильную навигацию",
        "app",
        "progress",
        "high",
        "max",
        -1,
        4,
      ],
      ["Согласовать палитру", "brand", "ready", "medium", "ilya", 3, 2],
      ["Написать тексты онбординга", "app", "ready", "medium", "lena", 4, 3],
      ["Собрать структуру сайта", "web", "done", "high", "lena", -3, 4],
      ["Подготовить логотип", "brand", "done", "medium", "ilya", -2, 8],
      [
        "Описать пользовательские сценарии",
        "app",
        "done",
        "high",
        "lena",
        -4,
        5,
      ],
      ["Протестировать форму заявки", "web", "progress", "medium", "max", 2, 3],
      [
        "Собрать презентацию концепции",
        "brand",
        "backlog",
        "low",
        "ilya",
        7,
        6,
      ],
    ];
    return {
      version: 1,
      projects,
      members,
      tasks: rows.map((r, i) => ({
        id: `orb-${i + 101}`,
        title: r[0],
        project: r[1],
        status: r[2],
        priority: r[3],
        assignee: r[4],
        due: date(r[5]),
        estimate: r[6],
        description:
          "Учебная задача демонстрационной команды. Откройте её, измените сведения или перенесите в другую колонку.",
        checklist: [
          {
            id: `c${i}a`,
            text: "Подготовить первый вариант",
            done: i % 3 === 0 || r[2] === "done",
          },
          { id: `c${i}b`, text: "Проверить результат", done: r[2] === "done" },
        ],
        createdAt: date(-10),
        updatedAt: date(-i % 5),
      })),
      activity: [
        {
          id: "welcome",
          text: "Демонстрационное пространство готово к работе",
          at: now.toISOString(),
        },
        ...rows
          .filter((r) => r[2] === "done")
          .map((r, i) => ({
            id: `seed-${i}`,
            text: `Завершена задача «${r[0]}»`,
            at: new Date(now.getTime() - (i + 1) * 86400000).toISOString(),
          })),
      ],
    };
  }
  function validate(raw) {
    const fail = () => {
      throw new Error(
        "Формат данных Orbit не поддерживается. Нужен JSON, экспортированный из этого демо.",
      );
    };
    const text = (value, max = 120) =>
      typeof value === "string" &&
      value.trim().length > 0 &&
      value.length <= max;
    const date = (value) =>
      typeof value === "string" &&
      /^\d{4}-\d{2}-\d{2}$/.test(value) &&
      Number.isFinite(Date.parse(value)) &&
      isoDay(value) === value;
    const unique = (list) =>
      new Set(list.map((row) => row.id)).size === list.length;
    if (
      !raw ||
      raw.version !== 1 ||
      !Array.isArray(raw.projects) ||
      !raw.projects.length ||
      raw.projects.length > 12 ||
      !Array.isArray(raw.members) ||
      !raw.members.length ||
      raw.members.length > 20 ||
      !Array.isArray(raw.tasks) ||
      raw.tasks.length > 500 ||
      !Array.isArray(raw.activity) ||
      raw.activity.length > 100
    )
      fail();
    if (
      [raw.projects, raw.members, raw.tasks, raw.activity].some((list) =>
        list.some(
          (row) => !row || typeof row !== "object" || Array.isArray(row),
        ),
      )
    )
      fail();
    if (![raw.projects, raw.members, raw.tasks].every(unique)) fail();
    if (
      raw.projects.some(
        (p) =>
          !text(p.id, 80) ||
          !text(p.name, 80) ||
          !/^#[a-f0-9]{6}$/i.test(p.color),
      )
    )
      fail();
    if (
      raw.members.some(
        (m) =>
          !text(m.id, 80) ||
          !text(m.name, 80) ||
          !text(m.role, 80) ||
          !/^#[a-f0-9]{6}$/i.test(m.color),
      )
    )
      fail();
    for (const t of raw.tasks) {
      if (
        !text(t.id, 80) ||
        !text(t.title) ||
        typeof t.description !== "string" ||
        t.description.length > 2000 ||
        !Object.hasOwn(statuses, t.status) ||
        !Object.hasOwn(priorities, t.priority) ||
        !raw.projects.some((p) => p.id === t.project) ||
        !raw.members.some((m) => m.id === t.assignee) ||
        !date(t.due) ||
        !date(t.createdAt) ||
        !date(t.updatedAt) ||
        !Number.isFinite(t.estimate) ||
        t.estimate < 0 ||
        t.estimate > 160 ||
        !Array.isArray(t.checklist) ||
        t.checklist.length > 30 ||
        !unique(t.checklist) ||
        t.checklist.some(
          (c) =>
            !text(c.id, 80) ||
            !text(c.text, 150) ||
            typeof c.done !== "boolean",
        )
      )
        fail();
    }
    if (
      raw.activity.some(
        (a) =>
          !text(a.id, 80) ||
          !text(a.text, 260) ||
          typeof a.at !== "string" ||
          !Number.isFinite(Date.parse(a.at)),
      )
    )
      fail();
    return clone({
      version: 1,
      projects: raw.projects,
      members: raw.members,
      tasks: raw.tasks,
      activity: raw.activity,
    });
  }
  function record(state, text, now) {
    state.activity.unshift({
      id: `event-${now.getTime()}-${state.activity.length}`,
      text,
      at: now.toISOString(),
    });
    state.activity = state.activity.slice(0, 100);
    return validate(state);
  }
  function upsert(state, task, now = new Date()) {
    const next = clone(state);
    const old = next.tasks.find((t) => t.id === task.id);
    const value = {
      ...task,
      title: task.title.trim(),
      description: task.description.trim(),
      createdAt: old?.createdAt || isoDay(now),
      updatedAt: isoDay(now),
    };
    if (old) next.tasks = next.tasks.map((t) => (t.id === task.id ? value : t));
    else next.tasks.push(value);
    return record(
      next,
      `${old ? "Обновлена" : "Создана"} задача «${value.title}»`,
      now,
    );
  }
  function move(state, id, status, now = new Date()) {
    const task = state.tasks.find((t) => t.id === id);
    if (!task || !Object.hasOwn(statuses, status))
      throw new Error("Задача или колонка не найдена.");
    if (task.status === status) return state;
    return upsert(state, { ...task, status }, now);
  }
  function remove(state, id, now = new Date()) {
    const task = state.tasks.find((t) => t.id === id);
    if (!task) throw new Error("Задача не найдена.");
    const next = clone(state);
    next.tasks = next.tasks.filter((t) => t.id !== id);
    return record(next, `Удалена задача «${task.title}»`, now);
  }
  function metrics(tasks, today = isoDay(new Date())) {
    const done = tasks.filter((t) => t.status === "done").length;
    return {
      total: tasks.length,
      done,
      progress: tasks.filter((t) => t.status === "progress").length,
      overdue: tasks.filter((t) => t.status !== "done" && t.due < today).length,
      hours: tasks.reduce((sum, t) => sum + t.estimate, 0),
      percent: tasks.length ? Math.round((done / tasks.length) * 100) : 0,
    };
  }
  return {
    statuses,
    priorities,
    seed,
    validate,
    upsert,
    move,
    remove,
    metrics,
    isoDay,
  };
})();
