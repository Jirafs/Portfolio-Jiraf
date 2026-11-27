'use strict';
const $ = id => document.getElementById(id);
const storageKey = 'portfolio-owasp-progress-v1';
let completed = readProgress(), current = 0, fixed = false;
let observedBefore = new Set();

function readProgress() {
  try {
    const saved = JSON.parse(localStorage.getItem(storageKey) || '[]');
    return Array.isArray(saved) ? labs.filter(lab => saved.includes(lab.id)).map(lab => lab.id) : [];
  } catch {
    return [];
  }
}

function saveProgress() {
  try { localStorage.setItem(storageKey, JSON.stringify(completed)); }
  catch { /* The simulator works without local storage. */ }
}
function progress() {
  $('progress').value = completed.length;
  $('progress').max = labs.length;
  $('progress-label').textContent = `${completed.length} / ${labs.length}`;
  $('lab-nav').replaceChildren(...labs.map((lab,index)=>{
    const button = document.createElement('button'); button.type = 'button';
    button.className = index === current ? 'active' : '';
    if (index === current) button.setAttribute('aria-current','step');
    const number = document.createElement('span');number.className = 'number';number.textContent = lab.id;
    const name = document.createElement('span');name.textContent = lab.name;
    button.append(number,name);
    if (completed.includes(lab.id)) {const check=document.createElement('span');check.className='check';check.textContent='✓';check.setAttribute('aria-label','Завершено');button.append(check);}
    button.addEventListener('click',()=>{current=index;fixed=false;render();});return button;
  }));
}
function clearResponse() {
  $('response').hidden=true;$('response').textContent='';$('empty-response').hidden=false;
  $('feedback').textContent='';$('response-status').textContent='READY';
}
function setMode(value) {
  fixed=value;
  $('vulnerable').classList.toggle('selected',!fixed);$('fixed').classList.toggle('selected',fixed);
  $('vulnerable').setAttribute('aria-pressed',String(!fixed));$('fixed').setAttribute('aria-pressed',String(fixed));
  $('mode-label').textContent=fixed ? '● После защиты' : '● До защиты';clearResponse();
}
function render() {
  const lab = labs[current];
  const values = {
    'lab-id': lab.id === 'LAB11' ? 'Бонус' : lab.id + ':2025',
    'lab-tag': lab.tag,
    'lab-title': lab.name,
    'lab-en': lab.en,
    description: 'Сравните, как разные правила обработки влияют на результат.',
    task: 'Введите учебное условие из подсказки и запустите оба режима. Объясните, почему результаты различаются.',
    hint: 'Для этой модели используйте условие «' + lab.sample + '».',
    'fix-description': lab.fix,
    'code-bad': lab.before,
    'code-good': lab.after,
    'lab-counter': String(current + 1).padStart(2, '0') + ' / ' + labs.length,
  };
  for (const [id, value] of Object.entries(values)) $(id).textContent = value;
  $('lab-model').hidden = false;
  $('payload').value = '';
  $('hint-box').hidden = true;
  $('hint-toggle').setAttribute('aria-expanded', 'false');
  $('pixel-visual').hidden = lab.id !== 'LAB11';
  setMode(false);
  progress();
}

$('vulnerable').addEventListener('click', () => setMode(false));
$('fixed').addEventListener('click', () => setMode(true));
$('hint-toggle').addEventListener('click', () => {
  const show = $('hint-box').hidden;
  $('hint-box').hidden = !show;
  $('hint-toggle').setAttribute('aria-expanded', String(show));
});
$('use-solution').addEventListener('click', () => {
  $('payload').value = labs[current].sample;
  $('payload').focus();
});
$('run-form').addEventListener('submit', event => {
  event.preventDefault();
  const lab = labs[current];
  if ($('payload').value.trim().toLowerCase() !== lab.sample) {
    clearResponse();
    $('feedback').textContent = 'Введите условие из подсказки или нажмите «Подставить пример».';
    return;
  }

  $('empty-response').hidden = true;
  $('response').hidden = false;
  $('response').textContent = fixed ? lab.after : lab.before;
  $('response-status').textContent = 'SIMULATED';
  if (!fixed) observedBefore.add(lab.id);
  if (fixed && observedBefore.has(lab.id) && !completed.includes(lab.id)) {
    completed.push(lab.id);
    saveProgress();
    progress();
  }
  $('feedback').textContent = completed.includes(lab.id)
    ? '✓ Оба режима пройдены. Сформулируйте, что изменилось.'
    : fixed ? 'Запустите также режим «До защиты».'
      : 'Теперь переключитесь в режим «После защиты» и повторите.';
});
$('reset').addEventListener('click', () => {
  if (!confirm('Сбросить прогресс лаборатории в этом браузере?')) return;
  completed = [];
  observedBefore.clear();
  current = 0;
  saveProgress();
  render();
});
$('pixel-toggle').addEventListener('click', () => {
  const shifted = $('pixel-marker').classList.toggle('shifted');
  $('pixel-toggle').setAttribute('aria-pressed', String(shifted));
  $('pixel-position').textContent = shifted ? 'Смещение: 1 пиксель' : 'Смещение: 0 пикселей';
});
render();
