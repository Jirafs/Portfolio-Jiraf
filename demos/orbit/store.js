/* Read the current persisted snapshot immediately before every local mutation. */
globalThis.OrbitStore = {
  create(storage, key, model) {
    let state = model.seed();
    let rawSeen = null;
    let dirty = false;
    let invalid = false;
    let warning = "";
    const copy = (value) => model.validate(value);
    function read() {
      let raw;
      try {
        raw = storage.getItem(key);
      } catch {
        warning =
          "Браузер запретил доступ к хранилищу. Используйте экспорт JSON перед закрытием вкладки.";
        return state;
      }
      if (dirty) {
        if (raw !== rawSeen)
          throw new Error(
            "Другая вкладка изменила сохранение, а здесь остались несохранённые данные. Экспортируйте их перед импортом или сбросом.",
          );
        return state;
      }
      if (raw !== rawSeen || invalid) {
        try {
          state = raw === null ? model.seed() : model.validate(JSON.parse(raw));
          invalid = false;
          warning = "";
        } catch {
          invalid = true;
          rawSeen = raw;
          warning =
            "Сохранение повреждено и оставлено без изменений. В «Пространстве» можно скачать исходное сохранение, затем восстановить демоданные или импортировать JSON.";
          throw new Error(warning);
        }
        rawSeen = raw;
      }
      return state;
    }
    try {
      read();
    } catch (error) {
      warning = error.message;
    }
    return {
      snapshot: () => copy(state),
      warning: () => warning,
      original: () => rawSeen,
      refresh() {
        return copy(read());
      },
      commit(change, { replace = false, expectedTask } = {}) {
        const current = replace ? state : read();
        if (expectedTask) {
          const actual = current.tasks.find(
            (task) => task.id === expectedTask.id,
          );
          if (JSON.stringify(actual) !== expectedTask.signature)
            throw new Error(
              "Задача изменилась в другой вкладке. Закройте форму и откройте её заново: ваши правки пока не сохранены.",
            );
        }
        const next = copy(change(copy(current)));
        let durable = true;
        try {
          const raw = JSON.stringify(next);
          storage.setItem(key, raw);
          rawSeen = raw;
          dirty = false;
          invalid = false;
          warning = "";
        } catch {
          durable = false;
          dirty = true;
          warning =
            "Браузер запретил сохранение. Изменения доступны в этой вкладке; экспортируйте JSON перед закрытием.";
        }
        state = next;
        return { state: copy(state), durable, warning };
      },
    };
  },
};
