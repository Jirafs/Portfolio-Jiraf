(() => {
  const cases = {
    movies: {
      name: "Фильмы",
      root: "movies",
      record: "movie",
      fields: [
        ["title", "Название"],
        ["year", "Год"],
      ],
      example:
        '<?xml version="1.0" encoding="UTF-8"?>\n<movies>\n  <movie>\n    <title>Интерстеллар</title>\n    <year>2014</year>\n  </movie>\n  <movie>\n    <title>ВАЛЛ-И</title>\n    <year>2008</year>\n  </movie>\n</movies>',
    },
    schedule: {
      name: "Расписание",
      root: "sessions",
      record: "session",
      fields: [
        ["subject", "Предмет"],
        ["day", "День"],
        ["time", "Время"],
      ],
      example:
        '<?xml version="1.0" encoding="UTF-8"?>\n<sessions>\n  <session>\n    <subject>Веб-разработка</subject>\n    <day>Понедельник</day>\n    <time>09:00</time>\n  </session>\n  <session>\n    <subject>Операционные системы</subject>\n    <day>Вторник</day>\n    <time>10:40</time>\n  </session>\n</sessions>',
    },
    products: {
      name: "Товары",
      root: "catalog",
      record: "product",
      fields: [
        ["name", "Название"],
        ["price", "Цена, ₽"],
      ],
      example:
        '<?xml version="1.0" encoding="UTF-8"?>\n<catalog>\n  <product>\n    <name>Блокнот</name>\n    <price>250</price>\n  </product>\n  <product>\n    <name>Карандаш</name>\n    <price>45</price>\n  </product>\n</catalog>',
    },
  };
  function config(id) {
    if (!Object.hasOwn(cases, id))
      throw new Error("Выберите один из трёх примеров.");
    return cases[id];
  }
  function guard(source) {
    if (typeof source !== "string" || !source.trim())
      throw new Error("Редактор пуст. Загрузите пример или вставьте XML.");
    if (source.length > 50000)
      throw new Error(
        "XML слишком большой: допустимо не более 50 000 символов.",
      );
    if (/<!\s*(DOCTYPE|ENTITY)\b/i.test(source))
      throw new Error(
        "В этом практикуме не используются DOCTYPE и объявления ENTITY. Уберите их и оставьте XML с данными.",
      );
  }
  function validateRows(id, rows) {
    const c = config(id);
    if (!Array.isArray(rows) || !rows.length)
      throw new Error(
        `Внутри <${c.root}> нужна хотя бы одна запись <${c.record}>.`,
      );
    if (rows.length > 100)
      throw new Error("Для практикума достаточно не более 100 записей.");
    return rows.map((row, index) => {
      if (!row || typeof row !== "object")
        throw new Error(`Запись ${index + 1}: неверный формат данных.`);
      const clean = {};
      for (const [key, label] of c.fields) {
        const text = typeof row[key] === "string" ? row[key].trim() : "";
        if (!text)
          throw new Error(
            `Запись ${index + 1}: заполните поле «${label}» (<${key}>).`,
          );
        if (text.length > 160)
          throw new Error(
            `Запись ${index + 1}: поле «${label}» длиннее 160 символов.`,
          );
        clean[key] = text;
      }
      if (
        id === "movies" &&
        (!/^\d{4}$/.test(clean.year) ||
          Number(clean.year) < 1888 ||
          Number(clean.year) > 2100)
      )
        throw new Error(
          `Запись ${index + 1}: год должен быть целым числом от 1888 до 2100.`,
        );
      if (id === "schedule" && !/^([01]\d|2[0-3]):[0-5]\d$/.test(clean.time))
        throw new Error(
          `Запись ${index + 1}: время укажите в формате ЧЧ:ММ, например 09:30.`,
        );
      if (
        id === "products" &&
        (!/^\d+(?:[.,]\d{1,2})?$/.test(clean.price) ||
          !Number.isFinite(Number(clean.price.replace(",", "."))) ||
          Number(clean.price.replace(",", ".")) > 100000000)
      )
        throw new Error(
          `Запись ${index + 1}: цена должна быть неотрицательным числом, не более 100 000 000, с максимум двумя знаками после запятой.`,
        );
      return clean;
    });
  }
  function parse(source, id, parser) {
    const c = config(id);
    guard(source);
    const doc = (parser || new DOMParser()).parseFromString(
      source,
      "application/xml",
    );
    if (doc.getElementsByTagName("parsererror").length)
      throw new Error(
        "XML не разобран. Проверьте закрывающие теги, вложенность, кавычки и единственный корневой элемент. Чтобы вывести знак & в тексте, используйте &amp;.",
      );
    const root = doc.documentElement;
    if (!root || root.tagName !== c.root || root.namespaceURI)
      throw new Error(
        `Для примера «${c.name}» нужен корень <${c.root}> без пространства имён.`,
      );
    const elements = [...root.children];
    if (elements.length > 100)
      throw new Error("Для практикума достаточно не более 100 записей.");
    if (elements.some((el) => el.tagName !== c.record || el.namespaceURI))
      throw new Error(
        `Внутри <${c.root}> должны находиться записи <${c.record}>.`,
      );
    if (
      [...root.childNodes].some(
        (n) => (n.nodeType === 3 || n.nodeType === 4) && n.textContent.trim(),
      )
    )
      throw new Error(`Текст внутри <${c.root}> разместите в полях записей.`);
    const rows = elements.map((record, index) => {
      const children = [...record.children];
      if (
        children.length !== c.fields.length ||
        children.some(
          (el) =>
            !c.fields.some(([key]) => key === el.tagName) || el.namespaceURI,
        )
      )
        throw new Error(
          `Запись ${index + 1}: используйте ровно по одному полю ${c.fields.map(([key]) => `<${key}>`).join(", ")}.`,
        );
      const row = {};
      for (const [key] of c.fields) {
        const matches = children.filter((el) => el.tagName === key);
        if (matches.length !== 1 || matches[0].children.length)
          throw new Error(
            `Запись ${index + 1}: поле <${key}> должно встречаться один раз и содержать текст.`,
          );
        row[key] = matches[0].textContent;
      }
      if (
        [...record.childNodes].some(
          (n) => (n.nodeType === 3 || n.nodeType === 4) && n.textContent.trim(),
        )
      )
        throw new Error(
          `Запись ${index + 1}: текст должен находиться внутри полей.`,
        );
      return row;
    });
    return validateRows(id, rows);
  }
  function criteria(id, rows) {
    const c = config(id);
    const key = c.fields[0][0];
    return [
      { text: "XML разбирается без ошибок", passed: true },
      {
        text: "Структура и значения полей соответствуют примеру",
        passed: true,
      },
      { text: "Добавлено не менее трёх записей", passed: rows.length >= 3 },
      {
        text: "Названия записей различаются",
        passed:
          new Set(rows.map((r) => r[key].toLocaleLowerCase("ru-RU"))).size ===
          rows.length,
      },
    ];
  }
  function validateDraft(value) {
    if (
      !value ||
      value.version !== 1 ||
      !Object.hasOwn(cases, value.active) ||
      !value.drafts ||
      typeof value.drafts !== "object" ||
      Array.isArray(value.drafts)
    )
      throw new Error("Неверный формат черновика.");
    const drafts = {};
    for (const id of Object.keys(cases))
      if (Object.hasOwn(value.drafts, id)) {
        if (
          typeof value.drafts[id] !== "string" ||
          value.drafts[id].length > 50000
        )
          throw new Error("Неверный размер черновика.");
        drafts[id] = value.drafts[id];
      }
    return { version: 1, active: value.active, drafts };
  }
  globalThis.XMLLabModel = {
    cases,
    config,
    guard,
    parse,
    validateRows,
    criteria,
    validateDraft,
  };
})();
