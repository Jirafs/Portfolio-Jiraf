(() => {
  "use strict";
  const M = window.LearningCatalog;
  const form = document.getElementById("catalog-filters");
  const query = document.getElementById("catalog-query");
  const course = document.getElementById("catalog-course");
  const kind = document.getElementById("catalog-kind");
  const count = document.getElementById("catalog-count");
  const empty = document.getElementById("catalog-empty");
  const status = document.getElementById("catalog-share-status");
  const fallback = document.getElementById("catalog-share-fallback");
  const share = document.getElementById("catalog-share");
  const cards = [...document.querySelectorAll("[data-catalog-item]")].map(
    (node) => ({
      node,
      title: node.querySelector("h3").textContent,
      description: node.querySelector(".catalog-description").textContent,
      search: node.dataset.search,
      course: node.dataset.course,
      kind: node.dataset.kind,
    }),
  );
  let revision = 0;
  function values() {
    return M.state({ q: query.value, course: course.value, kind: kind.value });
  }
  function render(sync = true) {
    revision++;
    const filters = values();
    let total = 0;
    for (const item of cards) {
      const visible = M.matches(item, filters);
      item.node.hidden = !visible;
      if (visible) total++;
    }
    count.textContent = `Найдено: ${total} из ${cards.length}.`;
    empty.hidden = total > 0;
    status.textContent = "";
    fallback.hidden = true;
    if (sync) {
      try {
        const url = new URL(location.href);
        for (const key of ["q", "course", "kind"]) url.searchParams.delete(key);
        const params = new URLSearchParams(M.toSearch(filters));
        for (const [key, value] of params) url.searchParams.set(key, value);
        history.replaceState(null, "", url);
      } catch {
        /* Filters still work if the browser disallows URL updates. */
      }
    }
  }
  function restore() {
    const filters = M.fromSearch(location.search);
    query.value = filters.q;
    course.value = filters.course;
    kind.value = filters.kind;
    render(false);
  }
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    render();
  });
  query.addEventListener("input", () => render());
  course.addEventListener("change", () => render());
  kind.addEventListener("change", () => render());
  document.querySelectorAll("[data-catalog-reset]").forEach((button) =>
    button.addEventListener("click", () => {
      query.value = "";
      course.value = "";
      kind.value = "";
      render();
      query.focus();
    }),
  );
  share.addEventListener("click", async () => {
    const currentRevision = revision;
    status.textContent = "";
    fallback.hidden = true;
    const url = new URL(location.href);
    url.search = M.toSearch(values());
    url.hash = "";
    share.disabled = true;
    try {
      await navigator.clipboard.writeText(url.href);
      if (revision === currentRevision)
        status.textContent = "Ссылка на текущую подборку скопирована.";
    } catch {
      if (revision === currentRevision) {
        fallback.hidden = false;
        const field = document.getElementById("catalog-link");
        field.value = url.href;
        field.focus();
        field.select();
        status.textContent =
          "Автоматическое копирование недоступно. Скопируйте выделенную ссылку.";
      }
    } finally {
      share.disabled = false;
    }
  });
  window.addEventListener("popstate", restore);
  restore();
  form.hidden = false;
})();
