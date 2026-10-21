const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const source = fs.readFileSync(path.join(__dirname, '..', 'github-uploader.js'), 'utf8');
const start = source.indexOf('  function createPreview(');
const end = source.indexOf('  function renderFile(', start);
function element(tag) {
  return {tag, style:{}, children:[], setAttribute(){}, append(...items){this.children.push(...items)}};
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
  console.log('PASS: safe text rendering, cached preview, error retry, image visibility');
}
run().catch(error => {console.error(error);process.exitCode=1});
