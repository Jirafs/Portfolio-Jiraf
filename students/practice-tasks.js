function cssRule(code, selector, condition) {
  const sheet = new CSSStyleSheet();
  sheet.replaceSync(code);
  const rules = [...sheet.cssRules];
  const scope = condition
    ? [...(rules.find(rule => rule instanceof CSSMediaRule && rule.conditionText.replace(/\s/g, '') === condition)?.cssRules || [])]
    : rules;
  return scope.find(rule => rule.selectorText === selector)?.style;
}

function xmlRoot(code) {
  const document = new DOMParser().parseFromString(code, 'application/xml');
  return document.querySelector('parsererror') ? null : document.documentElement;
}

function xmlChild(node, name) {
  return [...(node?.children || [])].find(child => child.tagName === name);
}

const taskChecks = {
  'layout-1'(code) {
    const rule = cssRule(code, '.product');
    return [['Отступ 16 px', rule?.padding === '16px'], ['Скругление 8 px', rule?.borderRadius === '8px']];
  },
  'layout-2'(code) {
    const rule = cssRule(code, '.toolbar');
    return [['Flexbox', rule?.display === 'flex'], ['Элементы по краям', rule?.justifyContent === 'space-between'], ['Выравнивание по центру', rule?.alignItems === 'center'], ['Разрешён перенос', rule?.flexWrap === 'wrap']];
  },
  'layout-3'(code) {
    const wide = cssRule(code, '.course');
    const narrow = cssRule(code, '.course', '(max-width:600px)');
    const areas = style => style?.gridTemplateAreas.replace(/\s+/g, ' ').replaceAll("'", '"');
    return [['Широкий экран использует Grid', wide?.display === 'grid'], ['Две колонки на широком экране', /^\S+\s+\S+$/.test(wide?.gridTemplateColumns || '')], ['Три строки и нужные области', areas(wide) === '"header header" "menu content" "footer footer"'], ['Одна колонка до 600 px', narrow?.gridTemplateColumns === '1fr'], ['Порядок областей на узком экране', areas(narrow) === '"header" "menu" "content" "footer"']];
  },
  'javascript-1'(code) {
    const actual = code.replace(/\s/g, '').replace(/;$/, '');
    return [['Вызов map извлекает названия', actual === 'projects.map(project=>project.name)']];
  },
  'javascript-2'(code) {
    const match = code.replace(/\s/g, '').match(/^projects\.(\w+)\(project=>project\.score([<>=_]+)90\);?$/);
    return [['Достаточно одного проекта', match?.[1] === 'some'], ['Учитывается ровно 90 баллов', match?.[2] === '>=']];
  },
  'javascript-3'(code) {
    const match = code.match(/^\s*projects\s*\.\s*(\w+)\s*\(\s*project\s*=>\s*project\.subject\s*===\s*(['"])([^'"]+)\2\s*\)\s*\.\s*(\w+)\s*\(\s*\(\s*sum\s*,\s*project\s*\)\s*=>\s*sum\s*([+\-*/_]+)\s*project\.score\s*,\s*(\w+)\s*\)\s*;?\s*$/);
    const checks = [['Отбор через filter', match?.[1] === 'filter'], ['Отбирается дисциплина XML', match?.[3] === 'XML'], ['Суммирование через reduce', match?.[4] === 'reduce' && match?.[5] === '+'], ['Начальное значение равно 0', match?.[6] === '0']];
    if (checks.every(([, passed]) => passed)) checks.push(['Результат на учебных данных: ' + projects.filter(project => project.subject === 'XML').reduce((sum, project) => sum + project.score, 0), true]);
    return checks;
  },
  'xml-1'(code) {
    const root = xmlRoot(code);
    return [['Корневой элемент course', root?.tagName === 'course'], ['Язык ru', root?.getAttribute('lang') === 'ru'], ['Название заполнено', !!xmlChild(root, 'title')?.textContent.trim()]];
  },
  'xml-2'(code) {
    const root = xmlRoot(code);
    const lessons = [...(root?.children || [])];
    const times = lessons.map(lesson => lesson.getAttribute('start'));
    return [['Два занятия внутри schedule', root?.tagName === 'schedule' && lessons.length === 2 && lessons.every(lesson => lesson.tagName === 'lesson')], ['Время в допустимом формате', times.length === 2 && times.every(time => /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(time || ''))], ['Время занятий различается', times.length === 2 && times.every(Boolean) && new Set(times).size === 2], ['Обе аудитории заполнены', lessons.length === 2 && lessons.every(lesson => xmlChild(lesson, 'room')?.textContent.trim())]];
  },
  'xml-3'(code) {
    const root = xmlRoot(code);
    const authors = [...(xmlChild(root, 'authors')?.children || [])];
    const books = [...(xmlChild(root, 'books')?.children || [])];
    const ids = new Set(authors.map(author => author.getAttribute('id')?.trim()).filter(Boolean));
    return [['Структура library, authors и books', root?.tagName === 'library' && !!xmlChild(root, 'authors') && !!xmlChild(root, 'books')], ['Два автора с разными id', authors.length === 2 && ids.size === 2 && authors.every(author => author.tagName === 'author')], ['Две книги с названиями', books.length === 2 && books.every(book => book.tagName === 'book' && xmlChild(book, 'title')?.textContent.trim())], ['Каждая книга ссылается на автора из каталога', books.length === 2 && books.every(book => ids.has(book.getAttribute('authorId')))]];
  },
};

for (const task of document.querySelectorAll('[data-task]')) {
  task.querySelector('[data-check-task]').addEventListener('click', () => {
    const solution = task.querySelector('textarea').value;
    const results = task.querySelector('ul');
    const checks = solution.trim() ? taskChecks[task.dataset.task](solution) : [['Введите решение', false]];
    results.replaceChildren(...checks.map(([label, passed]) => {
      const item = document.createElement('li');
      item.textContent = (passed ? 'Зачтено: ' : 'Проверьте: ') + label;
      return item;
    }));
    results.hidden = false;
  });
}
