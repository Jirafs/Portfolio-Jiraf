(() => {
  "use strict";
  const M = window.OSQuizModel;
  const P = window.OSProgress;
  const app = document.getElementById("quiz-app");
  const intro = document.getElementById("quiz-intro");
  const active = document.getElementById("quiz-active");
  const result = document.getElementById("quiz-result");
  const title = document.getElementById("question-title");
  const choices = document.getElementById("question-options");
  const map = document.getElementById("question-map");
  const endDialog = document.getElementById("finish-dialog");
  const newDialog = document.getElementById("new-dialog");
  const el = (tag, text, cls) => {
    const n = document.createElement(tag);
    if (text) n.textContent = text;
    if (cls) n.className = cls;
    return n;
  };
  function focusHeading(node) {
    node.focus();
  }
  function openQuestion(index, focus = true) {
    const a = P.state.attempt;
    a.index = index;
    P.save();
    render();
    if (focus) focusHeading(title);
  }
  function start(ids) {
    P.state.attempt = M.createAttempt(ids);
    P.save();
    render();
    focusHeading(title);
  }
  function renderResult() {
    const a = P.state.attempt;
    const s = M.score(a);
    document.getElementById("result-title").textContent =
      `${s.correct} из ${s.total} — ${s.percent}%`;
    document.getElementById("result-description").textContent =
      `${a.mode === "retry" ? "Повторение ошибок" : "Обычный тест"}. Пропущено: ${s.skipped}. Это самопроверка, а не официальная оценка.`;
    document.getElementById("retry-errors").hidden = !s.wrong.length;
    const review = document.getElementById("answer-review");
    review.replaceChildren();
    a.ids.forEach((id, i) => {
      const q = M.byId[id];
      const selected = a.answers[id];
      const correct = selected === q.correct;
      const article = el(
        "article",
        "",
        `review-card ${correct ? "correct" : "incorrect"}`,
      );
      article.append(
        el(
          "p",
          `${correct ? "✓ Верно" : selected === undefined ? "○ Пропущено" : "× Ошибка"} · ${M.topics.find((t) => t.id === q.topic).title}`,
          "eyebrow",
        ),
        el("h3", `${i + 1}. ${q.text}`),
        el(
          "p",
          `Ваш ответ: ${selected === undefined ? "не выбран" : q.options[selected]}`,
        ),
      );
      if (!correct)
        article.append(
          el(
            "p",
            `Правильный ответ: ${q.options[q.correct]}`,
            "correct-answer",
          ),
        );
      article.append(el("p", q.explanation));
      const link = el("a", "Повторить тему →");
      link.href = `operating-systems.html#topic-${q.topic}`;
      article.append(
        link,
        el(
          "p",
          `По материалам банка заданий: № ${q.source}. Формулировка адаптирована для самопроверки.`,
          "note",
        ),
      );
      review.append(article);
    });
  }
  function render() {
    const a = P.state.attempt;
    intro.hidden = !!a;
    active.hidden = !a || a.finished;
    result.hidden = !a || !a.finished;
    P.update();
    if (!a) return;
    if (a.finished) {
      renderResult();
      return;
    }
    const q = M.byId[a.ids[a.index]];
    const answered = Object.keys(a.answers).length;
    document.getElementById("attempt-mode").textContent =
      a.mode === "retry"
        ? "Повторение ошибок · отдельная тренировка"
        : "Обычный тест · 10 вопросов из 5 тем";
    document.getElementById("question-position").textContent =
      `Вопрос ${a.index + 1} из ${a.ids.length} · ${M.topics.find((t) => t.id === q.topic).title}`;
    document.getElementById("answered-count").textContent =
      `Ответов выбрано: ${answered} из ${a.ids.length}`;
    const bar = document.getElementById("quiz-progress");
    bar.max = a.ids.length;
    bar.value = answered;
    title.textContent = q.text;
    choices.replaceChildren();
    q.options.forEach((text, i) => {
      const label = el("label", "", "quiz-option");
      const input = document.createElement("input");
      input.type = "radio";
      input.name = "answer";
      input.value = String(i);
      input.checked = a.answers[q.id] === i;
      input.addEventListener("change", () => {
        a.answers[q.id] = i;
        P.save();
        updateNavigation();
      });
      label.append(input, el("span", text));
      choices.append(label);
    });
    document.getElementById("previous-question").disabled = a.index === 0;
    document.getElementById("next-question").disabled =
      a.index === a.ids.length - 1;
    document.getElementById("clear-answer").disabled =
      a.answers[q.id] === undefined;
    updateNavigation();
  }
  function updateNavigation() {
    const a = P.state.attempt;
    const answered = Object.keys(a.answers).length;
    document.getElementById("answered-count").textContent =
      `Ответов выбрано: ${answered} из ${a.ids.length}`;
    document.getElementById("quiz-progress").value = answered;
    document.getElementById("clear-answer").disabled =
      a.answers[a.ids[a.index]] === undefined;
    map.replaceChildren();
    a.ids.forEach((id, index) => {
      const done = a.answers[id] !== undefined;
      const button = el(
        "button",
        `${index + 1}${done ? " ✓" : ""}`,
        "secondary",
      );
      button.type = "button";
      button.setAttribute(
        "aria-label",
        `Вопрос ${index + 1}: ${done ? "ответ выбран" : "без ответа"}`,
      );
      if (index === a.index) button.setAttribute("aria-current", "step");
      button.addEventListener("click", () => openQuestion(index));
      map.append(button);
    });
  }
  function finish() {
    M.complete(P.state);
    P.save();
    render();
    focusHeading(document.getElementById("result-title"));
  }
  document
    .getElementById("start-quiz")
    .addEventListener("click", () => start());
  document
    .getElementById("previous-question")
    .addEventListener("click", () => openQuestion(P.state.attempt.index - 1));
  document
    .getElementById("next-question")
    .addEventListener("click", () => openQuestion(P.state.attempt.index + 1));
  document.getElementById("clear-answer").addEventListener("click", () => {
    delete P.state.attempt.answers[P.state.attempt.ids[P.state.attempt.index]];
    P.save();
    render();
    focusHeading(title);
  });
  document.getElementById("finish-quiz").addEventListener("click", () => {
    const skipped = M.score(P.state.attempt).skipped;
    if (skipped) {
      document.getElementById("finish-message").textContent =
        `Осталось вопросов без ответа: ${skipped}. При завершении они будут засчитаны как пропущенные и попадут в повторение ошибок.`;
      endDialog.returnValue = "";
      endDialog.showModal();
    } else finish();
  });
  endDialog.addEventListener("close", () => {
    if (endDialog.returnValue === "finish") finish();
    else document.getElementById("finish-quiz").focus();
  });
  document
    .getElementById("retry-errors")
    .addEventListener("click", () => start(M.score(P.state.attempt).wrong));
  document.querySelectorAll("[data-new-attempt]").forEach((button) =>
    button.addEventListener("click", () => {
      if (P.state.attempt && !P.state.attempt.finished) {
        newDialog.returnValue = "";
        newDialog.showModal();
      } else start();
    }),
  );
  newDialog.addEventListener("close", () => {
    if (newDialog.returnValue === "new") start();
    else document.getElementById("restart-quiz").focus();
  });
  window.addEventListener("os-progress-reset", () => {
    render();
  });
  app.hidden = false;
  render();
})();
