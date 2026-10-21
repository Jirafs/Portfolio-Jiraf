/* Shared, DOM-only editor for public material descriptions. */
window.materialEditor = {
  categories: { lesson: 'Уроки', methodical: 'Методические разработки', practical: 'Практические задания', test: 'Тесты и контрольные', other: 'Другое' },
  metadata(values) {
    const limits = { title: 160, description: 1200, subject: 160, group: 80 };
    const result = {};
    for (const [key, limit] of Object.entries(limits)) {
      result[key] = String(values[key] || '').trim();
      if (result[key].length > limit) throw new Error(`Поле «${key}» слишком длинное.`);
    }
    if (!result.title) throw new Error('Укажите название материала.');
    result.category = Object.hasOwn(this.categories, values.category) ? values.category : 'other';
    return result;
  },
  search(file) {
    return this.normalize([file.name, file.title, file.description, file.subject, file.group].filter(Boolean).join(' '));
  },
  normalize(value) {
    return String(value || '').toLocaleLowerCase('ru-RU').replace(/ё/g, 'е');
  },
  publicationTime(file) {
    const explicit = Date.parse(file.publishedAt || '');
    if (Number.isFinite(explicit)) return explicit;
    // Earlier uploads stored the upload timestamp in their generated path.
    const match = String(file.path || '').match(/\/(\d{13})-/);
    const timestamp = match ? Number(match[1]) : 0;
    return Number.isFinite(new Date(timestamp).getTime()) ? timestamp : 0;
  },
  compare(a, b, order) {
    const names = () => (a.title || a.name || '').localeCompare(b.title || b.name || '', 'ru', {numeric:true, sensitivity:'base'});
    if (order === 'name') return names();
    const first = this.publicationTime(a);
    const second = this.publicationTime(b);
    if (!first || !second) return first ? -1 : second ? 1 : names();
    return (order === 'oldest' ? first - second : second - first) || names();
  },
  create(values, heading) {
    const form = document.createElement('form');
    form.className = 'material-editor owner-only';
    const title = document.createElement('h3');
    title.textContent = heading;
    const note = document.createElement('p');
    note.textContent = 'Эти сведения и сам файл будут доступны всем посетителям сайта.';
    form.append(title, note);
    const fields = {};
    for (const [key, label, limit] of [
      ['title', 'Название материала', 160], ['subject', 'Дисциплина', 160],
      ['group', 'Группа или несколько групп', 80], ['description', 'Описание', 1200], ['category', 'Категория']
    ]) {
      const wrapper = document.createElement('label');
      wrapper.textContent = label;
      const field = document.createElement(key === 'description' ? 'textarea' : key === 'category' ? 'select' : 'input');
      field.name = key;
      if (key === 'category') {
        for (const [value, name] of Object.entries(this.categories)) {
          const option = document.createElement('option');
          option.value = value;
          option.textContent = name;
          field.append(option);
        }
      } else {
        field.maxLength = limit;
        if (key === 'title') field.required = true;
        if (key === 'description') field.rows = 3;
        else field.type = 'text';
      }
      field.value = values[key] || (key === 'category' ? 'other' : '');
      fields[key] = field;
      wrapper.append(field);
      form.append(wrapper);
    }
    const status = document.createElement('p');
    status.setAttribute('role', 'status');
    const progress = document.createElement('progress');
    progress.hidden = true;
    progress.setAttribute('aria-label', 'Публикация материала');
    const actions = document.createElement('div');
    actions.className = 'material-editor-actions';
    const save = document.createElement('button');
    save.type = 'submit';
    save.textContent = 'Сохранить';
    const cancel = document.createElement('button');
    cancel.type = 'button';
    cancel.textContent = 'Отмена';
    actions.append(save, cancel);
    form.append(progress, status, actions);
    return { form, save, cancel, status,
      read: () => this.metadata(Object.fromEntries(Object.entries(fields).map(([key, field]) => [key, field.value]))),
      busy(value) {
        for (const field of [...Object.values(fields), save, cancel]) field.disabled = value;
        progress.hidden = !value;
        form.setAttribute('aria-busy', String(value));
      },
      focus() { fields.title.focus(); }
    };
  }
};
