(() => {
  "use strict";
  const M = window.OSQuizModel;
  const key = "jiraf.os-learning.v1";
  let state = M.blank();
  let notice =
    "Прогресс автоматически сохраняется в текущем браузере на этом устройстве.";
  try {
    const raw = localStorage.getItem(key);
    if (raw !== null) state = M.restore(raw);
  } catch {
    notice =
      "Сохранённый прогресс недоступен или устарел. Можно работать с новой попыткой; прежние результаты не восстановлены.";
  }
  const status = document.getElementById("storage-status");
  function update() {
    if (status) status.textContent = notice;
    document.querySelectorAll("[data-topic-toggle]").forEach((button) => {
      const done = state.completedTopics.includes(button.dataset.topicToggle);
      button.setAttribute("aria-pressed", String(done));
      button.textContent = done
        ? "✓ Тема пройдена — снять отметку"
        : "Отметить тему пройденной";
    });
    const count = document.getElementById("topic-progress");
    if (count)
      count.textContent = `Пройдено тем: ${state.completedTopics.length} из ${M.topics.length}. Отметки вы ставите самостоятельно.`;
    const history = document.getElementById("quiz-history");
    if (history) {
      const last = state.last
        ? `Последняя попытка${state.last.mode === "retry" ? " (повторение ошибок)" : ""}: ${M.score(state.last).correct} из ${state.last.ids.length}.`
        : "Завершённых попыток пока нет.";
      history.textContent = `${last} ${state.best ? `Лучший обычный тест: ${M.score(state.best).correct} из 10.` : "Лучший результат появится после обычного теста из 10 вопросов."}`;
    }
  }
  function save() {
    try {
      localStorage.setItem(key, JSON.stringify(state));
      notice = "Прогресс сохранён в текущем браузере на этом устройстве.";
    } catch {
      notice =
        "Браузер не сохранил прогресс. Текущая работа доступна до закрытия или перезагрузки страницы.";
    }
    update();
  }
  document.querySelectorAll("[data-topic-toggle]").forEach((button) =>
    button.addEventListener("click", () => {
      const id = button.dataset.topicToggle;
      state.completedTopics = state.completedTopics.includes(id)
        ? state.completedTopics.filter((x) => x !== id)
        : [...state.completedTopics, id];
      save();
    }),
  );
  const reset = document.getElementById("reset-progress");
  document
    .querySelectorAll("[data-topic-toggle], #reset-progress")
    .forEach((button) => {
      button.hidden = false;
    });
  const dialog = document.getElementById("reset-dialog");
  if (reset && dialog) {
    reset.addEventListener("click", () => {
      dialog.returnValue = "";
      dialog.showModal();
    });
    dialog.addEventListener("close", () => {
      if (dialog.returnValue !== "reset") return;
      state = M.blank();
      try {
        localStorage.removeItem(key);
        notice = "Прогресс по операционным системам сброшен.";
      } catch {
        notice =
          "Прогресс сброшен в памяти. Браузер не позволил удалить сохранение; оно может появиться после перезагрузки.";
      }
      update();
      window.dispatchEvent(new Event("os-progress-reset"));
      reset.focus();
    });
  }
  update();
  window.OSProgress = {
    get state() {
      return state;
    },
    save,
    update,
  };
})();
