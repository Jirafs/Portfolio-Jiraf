const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const root = path.join(__dirname, '..');
function element(tag) {
  return {tag,children:[],attrs:{},listeners:{},
    append(...items){this.children.push(...items)},
    setAttribute(key,value){this.attrs[key]=value},
    addEventListener(event,callback){this.listeners[event]=callback},
    click(){this.clicked=true},remove(){this.removed=true},focus(){this.focused=true},select(){this.selected=true}
  };
}
async function run() {
  let copied;
  let failClipboard = false;
  let failDownload = false;
  let revoked;
  const timers = [];
  const window = {};
  const document = {createElement:element,body:element('body')};
  class ObjectURL extends URL {
    static createObjectURL(){return 'blob:test-download'}
    static revokeObjectURL(url){revoked=url}
  }
  vm.runInNewContext(fs.readFileSync(path.join(root,'material-actions.js'),'utf8'),{
    window,document,URL:ObjectURL,
    navigator:{clipboard:{writeText:async text=>{if(failClipboard)throw new Error('Denied');copied=text;}}},
    fetch:async()=>({ok:!failDownload,status:failDownload?404:200,blob:async()=>({})}),
    setTimeout:callback=>timers.push(callback)
  });
  const file = {name:'Урок & пример.txt',title:'<script>test</script>',path:'uploads/documents/123-Урок & пример.txt'};
  const link = window.materialActions.shareUrl(file,'https://jirafs.github.io/Portfolio-Jiraf/');
  const parsed = new URL(link);
  assert.equal(parsed.pathname,'/Portfolio-Jiraf/pedagog.html');
  assert.equal(parsed.searchParams.get('material'),file.path);
  assert.equal(parsed.hash,'#methods');
  const actions = window.materialActions.create(file,'https://example.invalid/file.txt',link);
  const [download,share,manual,source,status] = actions.children;
  await share.listeners.click();
  assert.equal(copied,link);
  assert.equal(manual.hidden,true);
  failClipboard = true;
  await share.listeners.click();
  assert.equal(manual.value,link);
  assert.equal(manual.hidden,false);
  assert.equal(manual.selected,true);
  await download.listeners.click();
  const anchor = document.body.children[0];
  assert.equal(anchor.download,file.name);
  assert.equal(anchor.href,'blob:test-download');
  assert.equal(anchor.clicked,true);
  assert.equal(anchor.removed,true);
  assert.equal(download.disabled,false);
  timers[0]();
  assert.equal(revoked,'blob:test-download');
  failDownload = true;
  await download.listeners.click();
  assert.equal(source.hidden,false);
  assert.match(status.textContent,/HTTP 404/);
  assert.equal(download.disabled,false);
  failDownload = false;
  await download.listeners.click();
  assert.equal(source.hidden,true,'Retry hides obsolete error fallback');

  const uploader = fs.readFileSync(path.join(root,'github-uploader.js'),'utf8');
  const start = uploader.indexOf('  let sharedMaterialOpened = false;');
  const end = uploader.indexOf('  async function login(',start);
  let notice;
  const row = {dataset:{path:file.path},classList:{add:name=>{row.highlight=name}},focus:()=>{row.focused=true},scrollIntoView:()=>{row.scrolled=true}};
  const context = {window:{location:{search:parsed.search}},URLSearchParams,document,
    documentList:{querySelectorAll:()=>[row],before:item=>{notice=item}}};
  vm.createContext(context);
  vm.runInContext(uploader.slice(start,end),context);
  context.revealSharedMaterial();
  assert.equal(row.highlight,'material-shared');
  assert.equal(row.focused,true);
  assert.equal(row.scrolled,true);
  assert.match(notice.textContent,/выделен/);
  vm.runInContext('sharedMaterialOpened=false',context);
  context.window.location.search='?material=missing';
  context.revealSharedMaterial();
  assert.match(notice.textContent,/не найден/);
  console.log('PASS: share URL encoding, clipboard fallback, file download and retry, blob cleanup, direct links and missing material');
}
run().catch(error=>{console.error(error);process.exitCode=1});
