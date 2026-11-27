const source=document.querySelector('#source'),result=document.querySelector('#result');function render(){const doc=new DOMParser().parseFromString(source.value,'application/xml');if(doc.querySelector('parsererror')){result.textContent='Ошибка XML. Проверьте парность тегов и вложенность.';return;}if(doc.documentElement.tagName!=='catalog'){result.textContent='Ожидается корневой элемент catalog.';return;}const books=[...doc.documentElement.children];const titles=books.map(book=>book.querySelector(':scope > title')?.textContent.trim());result.textContent=books.length&&books.every((book,index)=>book.tagName==='book'&&titles[index])?titles.join('\n'):'Добавьте хотя бы один элемент book с непустым title.';}document.querySelector('#run').onclick=render;render();

function checkAssignment(code) {
  const parsed = new DOMParser().parseFromString(code, 'application/xml');
  if (parsed.querySelector('parsererror')) return [['XML синтаксически корректен', false]];
  const root = parsed.documentElement;
  const books = [...root.children];
  const ids = books.map(book => book.getAttribute('id')?.trim());
  const hasValue = (book, name) => [...book.children].some(child => child.localName === name && child.textContent.trim());
  return [
    ['Корневой элемент catalog', root.localName === 'catalog'],
    ['Две записи book', books.length === 2 && books.every(book => book.localName === 'book')],
    ['Идентификаторы заполнены и различаются', ids.length === 2 && ids.every(Boolean) && new Set(ids).size === 2],
    ['У каждой книги заполнены title и author', books.length === 2 && books.every(book => hasValue(book, 'title') && hasValue(book, 'author'))],
  ];
}

document.querySelector('#check-solution').addEventListener('click', () => {
  const input = document.querySelector('#solution');
  const checks = checkAssignment(input.value);
  const list = document.querySelector('#checks');
  list.replaceChildren(...checks.map(([label, passed]) => {
    const item = document.createElement('li');
    item.textContent = (passed ? 'Зачтено: ' : 'Проверьте: ') + label;
    return item;
  }));
});
