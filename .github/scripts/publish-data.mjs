import {readFile, writeFile, mkdir, cp, appendFile} from 'node:fs/promises';
import {resolve, dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createRequire} from 'node:module';

const require = createRequire(import.meta.url);
const D = require('../../core.js');
const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const MAX_AGE = 7 * 86400000;
const keys = ['type','district','name','outdoor','indoor','group'];

export function publicSnapshot(input, now = Date.now()) {
  const generated = Date.parse(input?.generatedAt);
  if (!D.validate(input) || !Number.isFinite(generated) || generated > now + 300000 || now - generated > MAX_AGE) throw new Error('Invalid or expired public snapshot');
  if (!keys.every(k => input.columns[k].every(v => v.length <= 300))) throw new Error('Public field is too long');
  // Whitelist the published fields. Spreadsheet ids, internal errors or extra fields
  // in any future backend response cannot accidentally be copied into GitHub Pages.
  return {
    version: String(input.version || '').slice(0,100),
    revision: String(input.revision || '').slice(0,100),
    generatedAt: new Date(generated).toISOString(),
    dataAsOf: String(input.dataAsOf || '').slice(0,100),
    academicYear: String(input.academicYear || '').slice(0,20),
    columns: Object.fromEntries(keys.map(k => [k, input.columns[k]])),
    groups: input.groups.map(g => ({id:g.id,label:g.label.slice(0,40),count:input.columns.group.filter(id=>id===g.id).length}))
  };
}
export function settings(text) {
  const read = key => text.match(new RegExp('\\b' + key + ':\\s*([\'"])(.*?)\\1'))?.[2];
  const gas = read('GAS_URL'), site = read('SITE_URL');
  if (!/^https:\/\/script\.google\.com\/macros\/s\/[A-Za-z0-9_-]+\/exec$/.test(gas || '')) throw new Error('GAS_URL must be the public /exec deployment');
  const target = new URL(site);
  if (target.protocol !== 'https:' || !/^[a-z0-9-]+\.github\.io$/.test(target.hostname)) throw new Error('SITE_URL must use this project’s GitHub Pages host');
  return {gas,site:target.href};
}
async function getJSON(url) {
  const controller = new AbortController(), timer = setTimeout(() => controller.abort(), 25000);
  try {
    const response = await fetch(url, {signal:controller.signal,headers:{Accept:'application/json'},redirect:'follow'});
    if (!response.ok) throw new Error('HTTP ' + response.status);
    const text = await response.text();
    if (text.length > 1000000 || !text.trimStart().startsWith('{')) throw new Error('Expected public JSON; redeploy the new GAS version');
    return publicSnapshot(JSON.parse(text));
  } finally { clearTimeout(timer); }
}
export function newest(candidates) {
  if (!candidates.length) throw new Error('No valid recent snapshot; preserve the existing published site');
  return candidates.reduce((a,b) => Date.parse(a.generatedAt) >= Date.parse(b.generatedAt) ? a : b);
}
export async function main() {
  const config = settings(await readFile(resolve(root,'config.js'),'utf8'));
  const candidates = [];
  try { candidates.push(publicSnapshot(JSON.parse(await readFile(resolve(root,'public-data.json'),'utf8')))); } catch (ignore) {}
  let synced = false;
  for (let attempt = 0; attempt < 2 && !synced; attempt++) {
    try {
      const url = new URL(config.gas); url.searchParams.set('api','public-data'); url.searchParams.set('v',String(Math.floor(Date.now()/60000)));
      candidates.push(await getJSON(url)); synced = true;
    } catch (error) { if (attempt === 0) await new Promise(resolve => setTimeout(resolve,1500)); }
  }
  if (!synced) {
    // Keep the last successfully published snapshot, not an old repository seed.
    try { candidates.push(await getJSON(new URL('public-data.json?refresh='+Date.now(),config.site))); } catch (ignore) {}
    console.warn('::warning::GAS refresh failed. A validated recent snapshot will be retained if available.');
  }
  const data = newest(candidates), output = resolve(root,'_site');
  await mkdir(output,{recursive:true});
  const files = ['index.html','config.js','core.js','query.js','data-client.js','app.js','enhance.js','site.css','metal-cards.css','metal-cards.js','map-data.js','scene.js','assets','THREE-LICENSE.txt','FONT-LICENSE.txt','.nojekyll'];
  for (const file of files) await cp(resolve(root,file),resolve(output,file),{recursive:true});
  await writeFile(resolve(output,'public-data.json'),JSON.stringify(data)+'\n');
  const summary = `Public records: ${data.columns.name.length}\nSnapshot synchronized at: ${data.generatedAt}\nLive refresh: ${synced?'success':'fallback'}\n`;
  console.log(summary);
  if (process.env.GITHUB_STEP_SUMMARY) await appendFile(process.env.GITHUB_STEP_SUMMARY,summary);
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main().catch(error => {console.error(error.message);process.exitCode=1;});
