const sessions = [
  {
    id: "s1",
    type: "strength",
    day: "Понедельник",
    time: "18:30",
    title: "Сила и техника",
    coach: "Алексей · 55 минут",
  },
  {
    id: "s2",
    type: "yoga",
    day: "Вторник",
    time: "09:00",
    title: "Йога: мягкий старт",
    coach: "Анна · 60 минут",
  },
  {
    id: "s3",
    type: "functional",
    day: "Среда",
    time: "19:00",
    title: "Функциональный круг",
    coach: "Дмитрий · 45 минут",
  },
  {
    id: "s4",
    type: "yoga",
    day: "Четверг",
    time: "20:00",
    title: "Йога: восстановление",
    coach: "Анна · 60 минут",
  },
  {
    id: "s5",
    type: "strength",
    day: "Суббота",
    time: "11:00",
    title: "Силовая база",
    coach: "Алексей · 55 минут",
  },
];

const $ = (s) => document.querySelector(s);
let saved = [];
try {
  const v = JSON.parse(localStorage.getItem("fitclub-plan") || "[]");
  if (Array.isArray(v))
    saved = [...new Set(v.filter((id) => sessions.some((s) => s.id === id)))];
} catch {}
function save() {
  try {
    localStorage.setItem("fitclub-plan", JSON.stringify(saved));
    return true;
  } catch {
    return false;
  }
}
let type = new URLSearchParams(location.search).get("type") || "all";
if (!["all", "strength", "yoga", "functional"].includes(type)) type = "all";
function row(s, label, action) {
  const r = document.createElement("article");
  r.className = "session";
  const d = document.createElement("div"),
    h = document.createElement("h3"),
    p = document.createElement("p"),
    b = document.createElement("button");
  h.textContent = s.title;
  p.textContent = `${s.day}, ${s.time} · ${s.coach}`;
  b.textContent = label;
  b.setAttribute("aria-label", `${label}: ${s.title}`);
  b.onclick = action;
  d.append(h, p);
  r.append(d, b);
  return r;
}
function render() {
  if (!$("#sessions")) return;
  const visible = sessions.filter(
    (s) =>
      (type === "all" || s.type === type) &&
      ($("#day").value === "all" || s.day === $("#day").value),
  );
  $("#sessions").replaceChildren(
    ...visible.map((s) =>
      row(s, saved.includes(s.id) ? "В плане" : "Выбрать", () => {
        $("#session").value = s.id;
        $("#booking").scrollIntoView();
        $("#session").focus();
      }),
    ),
  );
  if (!visible.length)
    $("#sessions").textContent =
      "Занятий не найдено. Измени день или направление.";
  document
    .querySelectorAll("[data-filter]")
    .forEach((b) =>
      b.setAttribute("aria-pressed", String(b.dataset.filter === type)),
    );
}
if ($("#session")) {
  sessions.forEach((s) => {
    const o = document.createElement("option");
    o.value = s.id;
    o.textContent = `${s.day}, ${s.time} — ${s.title}`;
    $("#session").append(o);
  });
  document.querySelectorAll("[data-filter]").forEach(
    (b) =>
      (b.onclick = () => {
        type = b.dataset.filter;
        render();
      }),
  );
  $("#day").onchange = render;
  $("#booking-form").onsubmit = (e) => {
    e.preventDefault();
    const name = new FormData(e.currentTarget).get("name").trim();
    const nameInput = e.currentTarget.elements.name;
    nameInput.setCustomValidity(
      name.length < 2
        ? "Введите имя: минимум два символа без пробелов по краям."
        : "",
    );
    if (!nameInput.reportValidity()) return;
    const id = $("#session").value,
      existed = saved.includes(id);
    if (!existed) saved.push(id);
    const stored = save();
    $("#confirmation").hidden = false;
    $("#confirmation").textContent =
      `${name}, ${existed ? "занятие уже есть в плане" : "демо-занятие добавлено"}. ${stored ? "Список доступен на странице «Мои тренировки»." : "Сохранение запрещено браузером; план доступен до обновления страницы."} Реальная запись не создана.`;
    render();
  };
  render();
}
document
  .querySelector('#booking-form [name="name"]')
  ?.addEventListener("input", (event) =>
    event.currentTarget.setCustomValidity(""),
  );
function bookings() {
  if (!$("#bookings")) return;
  $("#bookings").replaceChildren(
    ...sessions
      .filter((s) => saved.includes(s.id))
      .map((s) =>
        row(s, "Убрать", () => {
          saved = saved.filter((id) => id !== s.id);
          if (!save())
            $("#storage-status").textContent = "Браузер не сохранил изменения.";
          bookings();
          (
            document.querySelector("#bookings button") ||
            document.querySelector('nav a[href="schedule.html"]')
          ).focus();
        }),
      ),
  );
  if (!saved.length)
    $("#bookings").textContent =
      "План пока пуст. Выбери тренировку в расписании.";
}
bookings();
