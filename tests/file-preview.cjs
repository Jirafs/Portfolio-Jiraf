const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const source = fs.readFileSync(path.join(__dirname, '..', 'github-uploader.js'), 'utf8');
const start = source.indexOf('  function createPreview(');
const end = source.indexOf('  function renderFile(', start);
function element(tag) {
  const result = {tag, style:{}, children:[],listeners:{}, setAttribute(){}, addEventListener(event,callback){this.listeners[event]=callback}, append(...items){this.children.push(...items)}};
  if (tag === 'iframe') Object.defineProperty(result,'src',{get(){return this.savedSrc},set(value){this.savedSrc=value;this.srcWrites=(this.srcWrites||0)+1}});
  return result;
}
async function run() {
  let requests = 0;
  let fail = false;
  const create = vm.runInNewContext(`(${source.slice(start, end)})`, {
    document: {createElement:element},
    fetch:async () => {
      requests++;
      return {ok:!fail, status:fail?404:200, text:async()=>'<script>untrusted text</script>'};
    }
  });
  const preview = create({name:'test.txt'}, 'https://example.invalid/test.txt', 'txt');
  assert.equal(preview.element.children[0].tag, 'pre');
  await preview.open();
  assert.equal(preview.element.children[0].textContent, '<script>untrusted text</script>');
  await preview.open();
  assert.equal(requests, 1);
  fail = true;
  const retry = create({name:'test.md'}, 'https://example.invalid/test.md', 'md');
  await retry.open();
  assert.match(retry.element.children[0].textContent, /HTTP 404/);
  fail = false;
  await retry.open();
  assert.equal(retry.element.children[0].textContent, '<script>untrusted text</script>');
  const image = create({name:'test.png'}, 'https://example.invalid/test.png', 'png');
  image.open();
  assert.equal(image.element.children[0].hidden, false);
  const office = create({name:'lesson.docx'}, 'https://example.invalid/lesson.docx?a=1&b=2', 'docx');
  const frame = office.element.children.find(child=>child.tag==='iframe');
  assert.equal(frame.src,undefined,'No Office URL before an explicit preview request');
  office.open();
  assert.ok(frame.src.includes(encodeURIComponent('https://example.invalid/lesson.docx?a=1&b=2')));
  assert.equal(frame.srcWrites,1);
  office.open();
  assert.equal(frame.srcWrites,1,'Closing and reopening must not reload the viewer');
  office.element.children.find(child=>child.className==='office-preview-actions').children[0].listeners.click();
  assert.equal(frame.srcWrites,2,'Explicit retry reloads the viewer');
  console.log('PASS: safe text, preview retry, image visibility, lazy Office load and explicit reload');
}
run().catch(error => {console.error(error);process.exitCode=1});
