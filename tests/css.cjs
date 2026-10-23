const fs = require('node:fs');
const path = require('node:path');
const prettier = require('prettier');
const root = path.resolve(__dirname, '..');
async function walk(folder) {
  for (const entry of fs.readdirSync(folder, {withFileTypes:true})) {
    if (['.git','node_modules','uploads'].includes(entry.name)) continue;
    const file=path.join(folder,entry.name);
    if(entry.isDirectory()) await walk(file);
    else if(file.endsWith('.css')) await prettier.format(fs.readFileSync(file,'utf8'),{parser:'css'});
  }
}
walk(root).then(()=>console.log('PASS: all CSS sources parse')).catch(error=>{console.error(error);process.exitCode=1;});
