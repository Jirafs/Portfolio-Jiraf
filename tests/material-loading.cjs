const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const source = fs.readFileSync(path.join(__dirname,'..','github-uploader.js'),'utf8');
const start = source.indexOf('  async function refreshManifest(');
const end = source.indexOf('  let sharedMaterialOpened = false;',start);
function element(){return {children:[],attrs:{},listeners:{},append(...items){this.children.push(...items)},setAttribute(k,v){this.attrs[k]=v},addEventListener(k,v){this.listeners[k]=v},before(){}}}
async function run(){
  let requests=0;
  let response={ok:false,status:503};
  let resolveFetch;
  let rendered;
  const ctx={
    manifestVersion:0,accessToken:'',uploadManifest:[],rawRoot:'https://example.invalid',config:{manifest:'uploads.json'},
    document:{createElement:element},documentList:element(),uploadStatus:element(),encodePath:p=>p,
    fetch:async()=>{requests++;return response},
    getManifest:async token=>{assert.equal(token,'owner');return {files:[{name:'owner.txt'}]}},
    renderManifest:(files,owner)=>{rendered={files,owner};ctx.manifestVersion++},
    revealSharedMaterial:()=>{},
  };
  vm.createContext(ctx);
  vm.runInContext(source.slice(start,end),ctx);
  const state=vm.runInContext('materialLoadState',ctx);
  const retry=vm.runInContext('materialRetry',ctx);
  const message=vm.runInContext('materialLoadMessage',ctx);
  await ctx.loadMaterials();
  assert.equal(retry.hidden,false);
  assert.match(message.textContent,/503/);
  assert.equal(ctx.documentList.attrs['aria-busy'],'false');
  response={ok:true,json:async()=>[{name:'lesson.txt'}]};
  await retry.listeners.click();
  assert.equal(state.hidden,true);
  assert.equal(rendered.files[0].name,'lesson.txt');
  assert.equal(rendered.owner,false);

  ctx.fetch=()=>{requests++;return new Promise(resolve=>{resolveFetch=resolve})};
  const first=ctx.loadMaterials();
  const second=ctx.loadMaterials();
  assert.equal(first,second,'Repeated clicks share one request');
  resolveFetch({ok:true,json:async()=>[]});
  await first;

  const pending=ctx.loadMaterials();
  ctx.uploadManifest=[{name:'new-publication.txt'}];
  ctx.manifestVersion++;
  ctx.accessToken='owner';
  resolveFetch({ok:true,json:async()=>[{name:'stale.txt'}]});
  await pending;
  assert.equal(ctx.uploadManifest[0].name,'new-publication.txt','Late public fetch must not overwrite new authenticated data');
  const requestCount=requests;
  await ctx.loadMaterials();
  assert.equal(rendered.owner,true);
  assert.equal(rendered.files[0].name,'owner.txt');
  assert.equal(requests,requestCount,'Authenticated retry uses the owner API');
  ctx.accessToken='';
  const staleFailure=ctx.loadMaterials();
  ctx.manifestVersion++;
  resolveFetch({ok:false,status:500});
  await staleFailure;
  assert.equal(state.hidden,true,'Outdated failures must not obscure newer data');

  ctx.fetch=async()=>({status:404});
  await ctx.loadMaterials();
  assert.equal(rendered.files.length,0);
  assert.equal(state.hidden,true);
  ctx.fetch=async()=>({ok:true,json:async()=>({invalid:true})});
  await ctx.loadMaterials();
  assert.equal(retry.hidden,false);
  assert.match(message.textContent,/неверный формат/);
  console.log('PASS: failed load and retry, duplicate request protection, stale response protection, owner API, empty manifest and invalid JSON');
}
run().catch(error=>{console.error(error);process.exitCode=1});
