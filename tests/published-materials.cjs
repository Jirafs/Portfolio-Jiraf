const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..');
const files = JSON.parse(fs.readFileSync(path.join(root, 'uploads.json'), 'utf8'));
assert.equal(new Set(files.map(file => file.path)).size, files.length);
for (const file of files) {
  const target = path.resolve(root, file.path);
  assert.ok(target.startsWith(path.join(root, 'uploads') + path.sep));
  const bytes = fs.readFileSync(target);
  assert.equal(bytes.length, file.size, file.name + ': manifest size');
  const sha = crypto.createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex');
  assert.equal(sha, file.sha, file.name + ': Git blob identity');
}
const csv = fs.readFileSync(path.join(root,'uploads/documents/attestation-yearly-summary-2026.csv'),'utf8');
assert.ok(!csv.includes('\r\r'), 'CSV must not contain doubled carriage returns');
assert.match(csv,/2024\/2025;99;97;97;97\.98;97\.98/);
assert.match(csv,/2025\/2026;107;103;107;96\.26;100(?:\.0)?/);
assert.equal(csv.trim().split(/\r?\n/).length, 3);
console.log('PASS: published materials exist with correct size/SHA; yearly export contains only two aggregate rows');
