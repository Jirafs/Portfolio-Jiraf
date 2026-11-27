const projects=[{name:'Карточки каталога',subject:'Вёрстка',score:86},{name:'Калькулятор',subject:'JavaScript',score:72},{name:'Поиск по списку',subject:'JavaScript',score:94},{name:'Каталог книг',subject:'XML',score:81}];const score=document.querySelector('#score'),subject=document.querySelector('#subject'),result=document.querySelector('#result');function render(){const minimum=score.valueAsNumber;if(!score.validity.valid||!Number.isFinite(minimum)){result.textContent='Введите балл от 0 до 100.';return;}result.textContent=JSON.stringify(projects.filter(project=>(!subject.value||project.subject===subject.value)&&project.score>=minimum),null,2);}document.querySelector('#run').onclick=render;render();

function checkAssignment(code) {
  const structure = code.trim().match(/^projects\s*\.\s*(\w+)\s*\(\s*project\s*=>\s*project\.score\s*([<>=!_]+)\s*(\d+)\s*\)\s*\.\s*(\w+)\s*\(\s*project\s*=>\s*project\.name\s*\)\s*\.\s*(\w+)\s*\(\s*\)\s*;?$/);
  if (!structure) return [['Сохранена структура трёх вызовов', false]];
  const [, filterMethod, operator, threshold, mapMethod, sortMethod] = structure;
  const checks = [
    ['Первый вызов отбирает элементы', filterMethod === 'filter'],
    ['Граница отбора включает 75 баллов', operator === '>=' && Number(threshold) === 75],
    ['Второй вызов извлекает названия', mapMethod === 'map'],
    ['Последний вызов сортирует строки', sortMethod === 'sort'],
  ];
  if (checks.every(([, passed]) => passed)) {
    checks.push(['На тестовых данных: ' + projects.filter(project => project.score >= 75)
      .map(project => project.name).sort().join(', '), true]);
  }
  return checks;
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
