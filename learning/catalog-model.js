(function (root) {
  "use strict";
  const courseIds = ["react", "xml", "operating-systems"];
  const kinds = ["course", "lesson", "practice", "test", "document"];
  function normalize(value) {
    return String(value || "")
      .normalize("NFKC")
      .toLocaleLowerCase("ru")
      .replace(/ё/g, "е")
      .replace(/[^\p{L}\p{N}]+/gu, " ")
      .trim();
  }
  function state(value = {}) {
    return {
      q: String(value.q || "").slice(0, 120),
      course: courseIds.includes(value.course) ? value.course : "",
      kind: kinds.includes(value.kind) ? value.kind : "",
    };
  }
  function matches(item, filters) {
    const f = state(filters);
    const words = normalize(f.q).split(/\s+/).filter(Boolean);
    const haystack = normalize(
      [item.title, item.description, item.search].join(" "),
    );
    const tokens = haystack.split(/\s+/);
    return (
      (!f.course || item.course === f.course) &&
      (!f.kind || item.kind === f.kind) &&
      words.every((word) =>
        word.length <= 2 ? tokens.includes(word) : haystack.includes(word),
      )
    );
  }
  function fromSearch(search) {
    const p = new URLSearchParams(search);
    return state({
      q: p.get("q"),
      course: p.get("course"),
      kind: p.get("kind"),
    });
  }
  function toSearch(value) {
    const p = new URLSearchParams();
    const f = state(value);
    for (const name of ["q", "course", "kind"])
      if (f[name]) p.set(name, f[name]);
    return p.toString();
  }
  const api = { normalize, state, matches, fromSearch, toSearch };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.LearningCatalog = api;
})(typeof globalThis !== "undefined" ? globalThis : this);
