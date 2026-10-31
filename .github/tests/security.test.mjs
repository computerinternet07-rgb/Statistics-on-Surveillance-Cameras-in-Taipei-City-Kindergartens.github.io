import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {resolve, dirname} from 'node:path';
import vm from 'node:vm';
import {publicSnapshot} from '../scripts/publish-data.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const [clientSource, coreSource, html, seed] = await Promise.all([
  readFile(resolve(root,'data-client.js'),'utf8'), readFile(resolve(root,'core.js'),'utf8'),
  readFile(resolve(root,'index.html'),'utf8'), readFile(resolve(root,'public-data.json'),'utf8')
]);
const site = 'https://test.github.io/project/';
const gas = 'https://script.google.com/macros/s/test_deployment/exec';
const fixture = (age = 0) => ({...JSON.parse(seed), generatedAt:new Date(Date.now()-age).toISOString()});
const json = (data, type = 'application/json; charset=utf-8') => new Response(JSON.stringify(data), {headers:{'content-type':type}});
const isLive = url => new URL(url).origin === 'https://script.google.com';
const blocked = () => Promise.reject(new TypeError('Connection unavailable'));
function harness(t, fetcher, options = {}) {
  const accepted = [], statuses = [], requests = [], storage = new Map(options.cache || []);
  const document = new EventTarget(); document.hidden = false;
  document.createElement = () => { throw new Error('Data transport must not create elements'); };
  const window = new EventTarget(); window.window = window;
  const context = vm.createContext({window, document, location:new URL(site), URL, Date, JSON, Set, Map,
    AbortController, TextDecoder, TextEncoder, Uint8Array,
    setTimeout:(fn, ms) => setTimeout(fn, options.fastTimeout ? 5 : ms), clearTimeout,
    setInterval:() => 1, clearInterval:() => {},
    localStorage:{getItem:k => {if(options.blockStorage)throw Error('Blocked');return storage.get(k)||null;}, setItem:(k,v) => {if(options.blockStorage)throw Error('Blocked');storage.set(k,v);}},
    fetch:(url, init) => {requests.push({url,init});return fetcher(url,init);}
  });
  vm.runInContext(coreSource,context); vm.runInContext(clientSource,context);
  const client = window.PublicDataClient({GAS_URL:gas, PUBLIC_DATA_URL:'./public-data.json', ...options.config}, (data,meta) => accepted.push({data,meta}), state => statuses.push(state));
  t.after(() => client.destroy());
  return {client,accepted,statuses,requests,storage,context};
}

test('CSP precedes resources and allows only local executable code', () => {
  const tag = html.match(/<meta http-equiv="Content-Security-Policy" content="([^"]+)"/);
  assert(tag); assert(html.indexOf(tag[0]) < html.indexOf('<link'));
  const policy = Object.fromEntries(tag[1].split(';').map(s=>s.trim()).filter(Boolean).map(s=>{const [key,...values]=s.split(/\s+/);return[key,values];}));
  assert.deepEqual(policy['default-src'],["'none'"]);
  assert.deepEqual(policy['script-src'],["'self'"]);
  for (const key of ['script-src-attr','style-src-attr','object-src','base-uri','form-action','frame-src','worker-src']) assert.deepEqual(policy[key],["'none'"]);
  assert.deepEqual(policy['style-src'],["'self'"]);
  assert.deepEqual(policy['connect-src'],["'self'",'https://script.google.com','https://script.googleusercontent.com']);
  assert(!tag[1].includes('unsafe-')); assert(!tag[1].includes('frame-ancestors'));
  assert.match(html,/<meta name="referrer" content="no-referrer">/);
  for(const match of html.matchAll(/<script([^>]*)>([\s\S]*?)<\/script>/g)){assert.match(match[1],/src="\.\//);assert.equal(match[2].trim(),'');}
  assert(!/<[^>]+\son\w+\s*=/i.test(html));
});

test('Transport has no executable response or JSONP fallback', () => {
  assert(!/createElement|__tpeCamera_|searchParams\.set\(['"]callback|eval\s*\(|new Function/.test(clientSource));
});

test('Snapshot works when Google is blocked (LINE fallback)', async t => {
  const h=harness(t,url=>isLive(url)?blocked():Promise.resolve(json(fixture())));
  await h.client.refresh();assert.equal(h.accepted.length,1);assert.equal(h.accepted[0].meta.source,'snapshot');
  assert.equal(h.statuses.at(-1).kind,'ready');
  for(const {url,init} of h.requests){assert.equal(init.credentials,'omit');assert.equal(init.referrerPolicy,'no-referrer');assert.equal(init.headers.Accept,'application/json');assert(!new URL(url).searchParams.has('callback'));}
  assert.equal(h.requests.find(r=>!isLive(r.url)).init.redirect,'error');
});

test('Live JSON works without a local snapshot', async t => {
  const h=harness(t,url=>isLive(url)?Promise.resolve(json(fixture())):blocked());
  await h.client.refresh();assert.equal(h.accepted[0].meta.source,'live');assert.equal(h.statuses.at(-1).kind,'ready');
  assert.equal(h.requests.find(r=>isLive(r.url)).init.mode,'cors');
});

for(const type of ['text/html','application/javascript','text/plain']) test('Reject response MIME '+type,async t=>{
  const h=harness(t,()=>Promise.resolve(json(fixture(),type)));await h.client.refresh();assert.equal(h.accepted.length,0);assert.equal(h.statuses.at(-1).kind,'error');
});

test('JavaScript disguised as JSON is not executed',async t=>{
  const h=harness(t,()=>Promise.resolve(new Response('window.compromised=true; __callback({});',{headers:{'content-type':'application/json'}})));
  await h.client.refresh();assert.equal(h.accepted.length,0);assert.equal(vm.runInContext('window.compromised',h.context),undefined);
});

test('Reject an unexpected final redirect origin',async t=>{
  const h=harness(t,()=>{const response=json(fixture());Object.defineProperty(response,'url',{value:'https://unexpected.invalid/data'});return Promise.resolve(response);});
  await h.client.refresh();assert.equal(h.accepted.length,0);
});

test('Accept the documented Google content redirect',async t=>{
  const h=harness(t,url=>{if(!isLive(url))return blocked();const response=json(fixture());Object.defineProperty(response,'url',{value:'https://script.googleusercontent.com/macros/echo?public=1'});return Promise.resolve(response);});
  await h.client.refresh();assert.equal(h.accepted.length,1);
});

test('Reject oversized response before parsing',async t=>{
  const h=harness(t,()=>Promise.resolve(new Response(' '.repeat(1000001),{headers:{'content-type':'application/json'}})));
  await h.client.refresh();assert.equal(h.accepted.length,0);
});

test('Reject excessive announced response size',async t=>{
  const h=harness(t,()=>Promise.resolve(new Response('{}',{headers:{'content-type':'application/json','content-length':'1000001'}})));
  await h.client.refresh();assert.equal(h.accepted.length,0);
});

for(const [label,mutate] of [
  ['expired data',d=>d.generatedAt=new Date(Date.now()-8*86400000).toISOString()],
  ['future data',d=>d.generatedAt=new Date(Date.now()+600000).toISOString()],
  ['unknown status',d=>d.columns.outdoor[0]='invalid'],
  ['oversized public text',d=>d.columns.name[0]='x'.repeat(301)],
  ['oversized group label',d=>d.groups[0].label='x'.repeat(41)],
  ['mismatched columns',d=>d.columns.name.push('invalid')]
]) test('Reject '+label,async t=>{
  const d=fixture();mutate(d);const h=harness(t,()=>Promise.resolve(json(d)));await h.client.refresh();assert.equal(h.accepted.length,0);
});

test('Slow older snapshot cannot replace current live data',async t=>{
  let release, acceptedLive;
  const signal=new Promise(resolve=>acceptedLive=resolve);
  const old=fixture(60000),fresh=fixture();fresh.columns.name[0]='最新資料';
  const h=harness(t,url=>isLive(url)?Promise.resolve(json(fresh)):new Promise(resolve=>release=resolve));
  const pending=h.client.refresh();
  // Wait for live response consumption without a timing-based sleep.
  const poll=()=>h.accepted.length?acceptedLive():setImmediate(poll);poll();await signal;
  release(json(old));await pending;
  assert.equal(h.accepted.length,1);assert.equal(h.accepted[0].data.columns.name[0],'最新資料');
});

test('Blocked localStorage does not stop public data',async t=>{
  const h=harness(t,()=>Promise.resolve(json(fixture())),{blockStorage:true});h.client.start();await h.client.refresh();assert(h.accepted.length>0);
});

test('Validated cached data stays available if both networks fail',async t=>{
  const h=harness(t,blocked,{cache:[['taipei-camera:public:v3:'+gas,JSON.stringify(fixture())]]});h.client.start();await h.client.refresh();assert.equal(h.accepted[0].meta.source,'cache');assert.equal(h.statuses.at(-1).kind,'ready');
});

test('Expired cached data is rejected',async t=>{
  const h=harness(t,blocked,{cache:[['taipei-camera:public:v3:'+gas,JSON.stringify(fixture(8*86400000))]]});h.client.start();await h.client.refresh();assert.equal(h.accepted.length,0);assert.equal(h.statuses.at(-1).kind,'error');
});

test('External snapshot and invalid GAS URLs are never fetched',async t=>{
  const h=harness(t,()=>Promise.reject(Error('Must not fetch')),{config:{GAS_URL:'https://unexpected.invalid/exec',PUBLIC_DATA_URL:'https://unexpected.invalid/public-data.json'}});await h.client.refresh();assert.equal(h.requests.length,0);
});

test('Concurrent refreshes share the same pair of requests',async t=>{
  const h=harness(t,()=>Promise.resolve(json(fixture())));await Promise.all([h.client.refresh(),h.client.refresh(),h.client.refresh()]);assert.equal(h.requests.length,2);
});

test('Destroy aborts both requests and prevents late rendering',async t=>{
  const h=harness(t,(_url,{signal})=>new Promise((_resolve,reject)=>signal.addEventListener('abort',()=>reject(Error('Aborted')))));
  const pending=h.client.refresh();h.client.destroy();await pending;assert(h.requests.every(r=>r.init.signal.aborted));assert.equal(h.accepted.length,0);
});

test('Timeout aborts stalled transport',async t=>{
  const h=harness(t,(_url,{signal})=>new Promise((_resolve,reject)=>signal.addEventListener('abort',()=>reject(Error('Aborted')))),{fastTimeout:true});await h.client.refresh();assert(h.requests.every(r=>r.init.signal.aborted));assert.equal(h.statuses.at(-1).kind,'error');
});

test('Publisher keeps only the approved public fields',()=>{
  const d=fixture();d.secret='PRIVATE';d.columns.internal=['PRIVATE'];d.groups[0].secret='PRIVATE';
  const output=publicSnapshot(d);assert(!JSON.stringify(output).includes('PRIVATE'));assert.equal(Object.keys(output.columns).length,6);
});
