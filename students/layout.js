const width=document.querySelector('#width'),minimum=document.querySelector('#minimum'),cards=document.querySelector('#cards'),sizes=document.querySelector('#sizes');function render(){cards.style.width=width.value+'px';cards.style.gridTemplateColumns='repeat(auto-fit,minmax(min(100%, '+minimum.value+'px),1fr))';sizes.textContent='Область '+width.value+' px, карточка от '+minimum.value+' px';}width.oninput=minimum.oninput=render;render();

function checkAssignment(code) {
  const sheet = new CSSStyleSheet();
  sheet.replaceSync(code);
  const normal = [...sheet.cssRules].find(rule => rule.selectorText === '.catalog');
  const mobile = [...sheet.cssRules].find(rule => rule.conditionText?.replace(/\s/g, '') === '(max-width:480px)');
  const small = [...(mobile?.cssRules || [])].find(rule => rule.selectorText === '.catalog');
  const columns = normal?.style.gridTemplateColumns.replace(/\s/g, '');
  return [
    ['Контейнер использует Grid', normal?.style.display === 'grid'],
    ['Две колонки равной ширины', ['1fr1fr', 'repeat(2,1fr)'].includes(columns)],
    ['Промежуток 16 px', normal?.style.gap === '16px'],
    ['До 480 px остаётся одна колонка', small?.style.gridTemplateColumns === '1fr'],
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
