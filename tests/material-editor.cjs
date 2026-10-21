const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const root = path.join(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'github-uploader.js'), 'utf8');
function element(tag) {
  return { tag, children: [], dataset: {}, attrs: {}, listeners: {}, value: '', hidden: false,
    append(...items) { this.children.push(...items); },
    after(child) { this.children.push(child); },
    setAttribute(key, value) { this.attrs[key] = value; },
    addEventListener(event, callback) { this.listeners[event] = callback; },
    querySelector(selector) { return this.children.find(child => child.className?.split(' ').includes(selector.slice(1))); },
    focus() { this.focused = true; }, remove() { this.removed = true; }
  };
}
const document = { createElement: element, createTextNode: text=>({textContent:text}), querySelector: () => null };
const window = {};
vm.runInNewContext(fs.readFileSync(path.join(root, 'material-editor.js'), 'utf8'), { window, document });
const editor = window.materialEditor;
assert.equal(editor.metadata({title:'  Тест  ', category:'test'}).title, 'Тест');
assert.equal(editor.metadata({title:'Тест', category:'__proto__'}).category, 'other');
assert.throws(() => editor.metadata({title:' '}), /название/);
assert.throws(() => editor.metadata({title:'т'.repeat(161)}), /длинное/);
const searchText = editor.search({name:'file.txt', title:'Массивы', subject:'JavaScript', group:'4ИСИП-1023', description:'Практика'});
for (const term of ['массивы', 'javascript', '4исип-1023', 'практика', 'file.txt']) assert.ok(searchText.includes(term));
assert.equal(editor.normalize('РасчЁт'), 'расчет');
const legacyDate = {name:'Урок 10',path:'uploads/documents/1791456154706-id-file.txt'};
const recent = {name:'Урок 2',publishedAt:'2026-10-21T08:00:00Z'};
const undated = {name:'Без даты',publishedAt:'invalid'};
assert.equal(editor.publicationTime(legacyDate),1791456154706);
assert.equal(editor.publicationTime(undated),0);
assert.equal([legacyDate,recent,undated].sort((a,b)=>editor.compare(a,b,'newest'))[0],recent);
assert.equal([undated,legacyDate,recent].sort((a,b)=>editor.compare(a,b,'oldest'))[0],legacyDate);
assert.equal([legacyDate,recent].sort((a,b)=>editor.compare(a,b,'name'))[0],recent);
const unsafe = '<img src=x onerror=alert(1)>';
const form = editor.create({title:unsafe}, unsafe);
assert.equal(form.form.children[0].textContent, unsafe);
assert.equal(form.read().title, unsafe);
form.busy(true);
assert.equal(form.save.disabled, true);
assert.equal(form.form.children.find(child => child.tag === 'progress').hidden, false);
form.busy(false);
assert.equal(form.save.disabled, false);

async function run() {
  const dropzone = element('div');
  const messages = [];
  let fail = true;
  const written = [];
  const context = {window, document, dropzone, accessToken:'test', documentCategory:{value:'test'},
    config:{maxFileSize:1000}, allowedExtensions:{documents:new Set(['txt'])},
    showStatus: message => messages.push(message),
    writeFile: async (file, type, metadata, stage) => {
      stage('Передача файла…');
      if (fail) throw new Error('Нет сети');
      written.push({file, metadata});
    }
  };
  vm.createContext(context);
  vm.runInContext(source.slice(source.indexOf('  let documentDraft = null;'), source.indexOf('  async function handleFiles(')), context);
  context.prepareDocuments([{name:'one.txt',size:12}, {name:'two.txt',size:12}]);
  assert.equal(written.length, 0, 'Selection must never publish immediately');
  const draft = vm.runInContext('documentDraft',context);
  assert.equal(draft.read().title, 'one.txt');
  await draft.form.listeners.submit({preventDefault(){}});
  assert.match(draft.status.textContent,/Нет сети/);
  assert.equal(draft.read().title,'one.txt');
  assert.equal(draft.save.disabled,false);
  fail = false;
  await draft.form.listeners.submit({preventDefault(){}});
  assert.equal(written.length,1);
  const second = vm.runInContext('documentDraft',context);
  assert.equal(second.read().title,'two.txt');
  second.cancel.listeners.click();
  assert.equal(written.length,1,'Cancel must not publish remaining files');
  assert.equal(vm.runInContext('documentDraft',context),null);

  // Rendering and editing preserve file identity and any concurrently added entries.
  const file = {name:'legacy.txt',path:'uploads/legacy.txt',size:30,sha:'original',type:'documents'};
  const concurrent = {path:'uploads/new.txt',sha:'another'};
  let saved;
  Object.assign(context, { publicFileUrl:p=>p, fileViewUrl:(f,url)=>url, formatSize:n=>String(n), createPreview:()=>null,
    renderManifest:()=>{}, removeFromGitHub:()=>{},
    updateManifest:async updater => { saved=updater([file,concurrent]); return saved; }
  });
  vm.runInContext(source.slice(source.indexOf('  function renderFile('),source.indexOf('  function filterDocuments(')),context);
  const list = element('ul');
  context.renderFile(file,'documents',list,true);
  const content = list.children[0].children[0];
  assert.match(content.children[0].textContent,/legacy.txt/);
  const edit = content.children.find(child=>child.textContent==='Редактировать сведения');
  edit.listeners.click();
  const editForm = content.children.find(child=>child.className==='material-editor owner-only');
  const titleInput = editForm.children.find(child=>child.tag==='label').children[0];
  titleInput.value = 'Новое название';
  await editForm.listeners.submit({preventDefault(){}});
  assert.equal(saved[0].title,'Новое название');
  assert.equal(saved[0].sha,'original');
  assert.equal(saved[0].path,file.path);
  assert.equal(saved[1],concurrent);
  assert.ok(saved[0].updatedAt);

  // A failed manifest save must roll back the uploaded blob.
  const stages = [];
  let rolledBack;
  Object.assign(context, {crypto:{randomUUID:()=> 'test-id'},
    config:{maxFileSize:1000, uploadDirectory:'uploads'},
    putFile:async()=>({content:{sha:'new-blob'}}), deleteFile:async entry=>{rolledBack=entry;},
    updateManifest:async()=>{throw new Error('Manifest failed');}
  });
  vm.runInContext(source.slice(source.indexOf('  async function writeFile('),source.indexOf('  let documentDraft = null;')), context);
  await assert.rejects(context.writeFile({name:'new.txt',size:20},'documents',{title:'Название',subject:'JS'},message=>stages.push(message)),/Manifest failed/);
  assert.equal(rolledBack.sha,'new-blob');
  assert.equal(rolledBack.title,'Название');
  assert.equal(stages.length,2);
  await assert.rejects(context.writeFile({name:'large.txt',size:2000},'documents',{title:'Название'}),/10 МБ/);
  const rows = [
    {dataset:{title:'Урок 10',search:'расчет javascript 4исип',category:'lesson',extension:'txt',publishedAt:'1791456154706'}},
    {dataset:{title:'Урок 2',search:'javascript основы',category:'lesson',extension:'pdf',publishedAt:String(Date.parse('2026-10-21T08:00:00Z'))}},
    {dataset:{title:'Старое пособие',search:'пособие',category:'methodical',extension:'docx',publishedAt:'0'}}
  ];
  let order = [...rows];
  let moves = 0;
  Object.assign(context, {
    documentList:{querySelectorAll:()=>order,append:(...items)=>{order=items;moves++;}},
    materialSearch:{value:'4ИСИП РАСЧЁТ'}, materialCategoryFilter:{value:'all'}, materialTypeFilter:{value:'all'},
    materialSort:{value:'newest'},materialReset:{},materialResultsCount:{},materialEmpty:{}
  });
  vm.runInContext(source.slice(source.indexOf('  function filterDocuments('),source.indexOf('  function renderManifest(')),context);
  context.filterDocuments();
  assert.equal(rows[0].hidden,false,'Search words may be out of order and use ё');
  assert.equal(rows[1].hidden,true);
  assert.equal(context.materialReset.hidden,false);
  assert.equal(order[0],rows[1]);
  assert.equal(order[2],rows[2],'Undated materials must stay last');
  const previousMoves = moves;
  context.filterDocuments();
  assert.equal(moves,previousMoves,'Filtering must not reinsert existing previews');
  context.materialSearch.value='';
  context.materialCategoryFilter.value='lesson';
  context.materialTypeFilter.value='pdf';
  context.filterDocuments();
  assert.equal(rows[0].hidden,true);
  assert.equal(rows[1].hidden,false);
  context.materialCategoryFilter.value='all';
  context.materialTypeFilter.value='all';
  context.filterDocuments();
  assert.equal(context.materialReset.hidden,true);
  assert.ok(rows.every(row=>!row.hidden));
  console.log('PASS: metadata validation, safe DOM, search, staged publication, retry, cancel, editing with concurrent additions');
}
run().catch(error=>{console.error(error);process.exitCode=1});
