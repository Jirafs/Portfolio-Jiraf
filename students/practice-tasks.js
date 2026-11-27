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

function htmlDocument(code) {
  return new DOMParser().parseFromString(code, 'text/html');
}

const taskChecks = {
  'html-1'(code) {
    const page = htmlDocument(code);
    return [['Заголовок в шапке', !!page.querySelector('header h1')?.textContent.trim()], ['Ссылка на #content', !!page.querySelector('header a[href="#content"]')?.textContent.trim()]];
  },
  'html-2'(code) {
    const form = htmlDocument(code).querySelector('form');
    const input = form?.querySelector('input[type="email"][required]');
    return [['Обязательное поле email', !!input], ['Связанная подпись', !!input?.id && [...form.querySelectorAll('label')].some(label => label.htmlFor === input.id && label.textContent.trim())], ['Кнопка отправки', !!form?.querySelector('button[type="submit"]')?.textContent.trim()]];
  },
  'html-3'(code) {
    const table = htmlDocument(code).querySelector('table');
    const rows = [...(table?.tBodies[0]?.rows || [])];
    return [['У таблицы есть название', !!table?.caption?.textContent.trim()], ['Два заголовка колонок', table?.tHead?.querySelectorAll('th[scope="col"]').length === 2], ['Две строки с заголовком и данными', rows.length === 2 && rows.every(row => row.cells.length === 2 && row.cells[0].matches('th[scope="row"]') && row.cells[1].matches('td'))]];
  },
  'react-1'(code) {
    return [['Пропс title передан как выражение JSX', /return\s*\(?\s*<h2>\s*\{\s*title\s*\}\s*<\/h2>/.test(code)]];
  },
  'react-2'(code) {
    return [['Состояние count начинается с нуля', /\[\s*count\s*,\s*setCount\s*\]\s*=\s*useState\s*\(\s*0\s*\)/.test(code)], ['Обновление использует предыдущее значение', /setCount\s*\(\s*\(?(\w+)\)?\s*=>\s*\1\s*\+\s*1\s*\)/.test(code)]];
  },
  'react-3'(code) {
    return [['Отбираются активные курсы', /courses\s*\.\s*filter\s*\(\s*course\s*=>\s*course\.active\s*\)/.test(code)], ['Список создаётся через map', /\.\s*map\s*\(\s*course\s*=>\s*<li\b/.test(code)], ['У списка правильные ключ и подпись', /<li\s+key=\{\s*course\.id\s*\}>\s*\{\s*course\.title\s*\}\s*<\/li>/.test(code)]];
  },
  'php-1'(code) {
    return [['Выводится поле title', /^\s*echo\s+\$course\s*\[\s*(['"])title\1\s*\]\s*;\s*$/.test(code)]];
  },
  'php-2'(code) {
    const match = code.match(/^\s*return\s+\$score\s*([<>=]+)\s*75\s*\?\s*(['"])(.*?)\2\s*:\s*(['"])(.*?)\4\s*;\s*$/);
    return [['Ровно 75 баллов засчитывается', match?.[1] === '>='], ['Верные результаты обеих веток', match?.[3] === 'зачёт' && match?.[5] === 'пока нет']];
  },
  'php-3'(code) {
    return [['Объявлена функция с параметром и типом результата array', /function\s+passedScores\s*\(\s*array\s+\$scores\s*\)\s*:\s*array/.test(code)], ['Отбираются баллы от 75', /array_filter\s*\(\s*\$scores\s*,\s*fn\s*\(\s*\$score\s*\)\s*=>\s*\$score\s*>=\s*75/.test(code)], ['Результат переиндексируется', /return\s+array_values\s*\(\s*array_filter\s*\(/.test(code)]];
  },
  'layout-4'(code) {
    const rule = cssRule(code, '.dashboard');
    return [['Контейнер Grid', rule?.display === 'grid'], ['Меню 200 px и гибкая колонка', rule?.gridTemplateColumns === '200px 1fr'], ['Промежуток 24 px', rule?.gap === '24px']];
  },
  'javascript-4'(code) {
    const result = code.match(/^\s*projects\s*\.\s*(\w+)\s*\(\s*project\s*=>\s*project\.subject\s*===\s*(['"])XML\2\s*\)\s*;?\s*$/);
    return [['Возвращается первый проект XML', result?.[1] === 'find']];
  },
  'xml-4'(code) {
    const root = xmlRoot(code);
    const products = [...(root?.children || [])];
    return [['Две записи product', root?.tagName === 'prices' && products.length === 2 && products.every(product => product.tagName === 'product')], ['Валюта RUB', products.length === 2 && products.every(product => product.getAttribute('currency') === 'RUB')], ['Положительные значения цены', products.length === 2 && products.every(product => /^\d+(?:\.\d+)?$/.test(product.textContent.trim()) && Number(product.textContent) > 0)]];
  },

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
    if (checks.length && checks.every(([, passed]) => passed)) studentProgress.complete(task.dataset.task);
  });
}
