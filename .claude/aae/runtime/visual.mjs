/** Optional authenticated visual fixture helper; never installs a browser. */
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createRequire} from 'node:module';
import {safePath,readJson,withState,assertBound,sourceDigest,atomicJson,requireThat,now} from './core.mjs';
export function validateVisual(c) {
  requireThat(c&&c.schema_version===1,'Visual config vereist schema_version 1.');
  const base=new URL(c.base_url);
  requireThat(['http:','https:'].includes(base.protocol)&&!base.username&&!base.password,'Gebruik een http(s) preview zonder credentials in URL.');
  const local=['localhost','127.0.0.1','[::1]'].includes(base.hostname);
  requireThat(local||c.allow_remote===true,'Remote preview vereist expliciet allow_remote en testdata; geen productiegegevens.');
  requireThat(Array.isArray(c.scenes)&&c.scenes.length>0&&c.scenes.length<=4,'Kies 1 tot 4 relevante scenes, niet alle schermen.');
  if(c.storage_state)requireThat(/^\.claude\/aae\/private\/[A-Za-z0-9_-]+\.json$/.test(c.storage_state),'Sla testauth uitsluitend op in .claude/aae/private/<naam>.json; niet committen.');
  const ids=new Set();
  for(const s of c.scenes) {
    requireThat(/^[a-zA-Z0-9_-]{1,48}$/.test(s.id)&&!ids.has(s.id),'Ongeldige/dubbele scene-ID.');ids.add(s.id);
    requireThat(typeof s.path==='string'&&s.path.startsWith('/')&&!s.path.startsWith('//'),'Scene pad relatief aan de preview.');
    requireThat(typeof s.expected_path==='string'&&s.expected_path.startsWith('/'),'Verwachte URL-path is verplicht om loginredirects te herkennen.');
    requireThat(typeof s.expected_visible==='string'&&s.expected_visible.length>0,'Verwachte zichtbare marker is verplicht.');
    const v=s.viewport||{width:390,height:844};
    requireThat(Number.isInteger(v.width)&&v.width>=320&&v.width<=2400&&Number.isInteger(v.height)&&v.height>=320&&v.height<=1600,'Ongeldige viewport.');
    requireThat(!s.steps||Array.isArray(s.steps)&&s.steps.length<=8,'Maximaal acht gerichte stappen.');
    for(const step of s.steps||[])requireThat(['click','fill','press','expect-visible'].includes(step.action)&&typeof step.selector==='string'&&step.selector.length>0,'Onbekende stap; geen willekeurige page.evaluate.');
  }
  return c;
}
export async function captureVisual(root,configPath) {
  const c=validateVisual(readJson(root,configPath));
  const bound=withState(root,s=>{const t=assertBound(root,s);return {task_id:t.id,route_digest:t.digest,source_digest:sourceDigest(root,t.contract)};});
  const req=createRequire(path.join(root,'package.json'));let playwright;
  try{playwright=req('playwright');}catch{try{playwright=req('@playwright/test');}catch{throw new Error('Playwright ontbreekt in dit project. Geen installatie uitgevoerd. Meld VISUAL NOT_RUN en vraag alleen installatie wanneer nodig.');}}
  if(c.storage_state)safePath(root,c.storage_state,{allowMissing:false});
  const browser=await playwright.chromium.launch({headless:true});const records=[];
  try {
    for(const s of c.scenes) {
      const context=await browser.newContext({viewport:s.viewport||{width:390,height:844},...(c.storage_state?{storageState:safePath(root,c.storage_state,{allowMissing:false})}:{})});
      try {
        const page=await context.newPage();page.setDefaultTimeout(10000);
        const target=new URL(s.path,c.base_url);requireThat(target.origin===new URL(c.base_url).origin,'Scene mag niet naar ander domein verwijzen.');
        await page.goto(target.toString(),{waitUntil:'domcontentloaded',timeout:20000});
        for(const x of s.steps||[]) {const loc=page.locator(x.selector);if(x.action==='click')await loc.click();else if(x.action==='fill')await loc.fill(String(x.value||''));else if(x.action==='press')await loc.press(String(x.value||'Enter'));else await loc.waitFor({state:'visible'});}
        const actual=new URL(page.url());requireThat(actual.origin===target.origin&&actual.pathname===s.expected_path,'Onverwachte pagina/loginredirect; screenshot is geen geldig bewijs voor '+s.id);
        await page.locator(s.expected_visible).waitFor({state:'visible'});
        const rel='docs/aae/evidence/'+bound.task_id+'/visual-'+s.id+'.png';const out=safePath(root,rel);fs.mkdirSync(path.dirname(out),{recursive:true,mode:0o700});
        await page.screenshot({path:out,fullPage:false,animations:'disabled'});
        records.push({scene:s.id,path:rel,url:actual.origin+actual.pathname,viewport:s.viewport||{width:390,height:844},authenticated_fixture:Boolean(c.storage_state),steps:(s.steps||[]).length,status:'CAPTURED_NOT_REVIEWED'});
      } finally {await context.close();}
    }
  } finally {await browser.close();}
  const report={schema_version:1,...bound,captured_at:now(),status:'CAPTURED_NOT_REVIEWED',scenes:records,note:'Open de afbeeldingen daadwerkelijk. Capture/locatorstappen bewijzen geen volledige UX/toegankelijkheid.'};
  atomicJson(root,'docs/aae/evidence/'+bound.task_id+'/visual-manifest.json',report);return report;
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
  const root=fileURLToPath(new URL('../../../',import.meta.url));
  try{requireThat(process.argv.length===3,'Gebruik visual.mjs <relatief-configbestand> via een goedgekeurde runnercommand.');console.log(JSON.stringify(await captureVisual(root,process.argv[2]),null,2));}catch(e){console.error('AAE VISUAL: '+e.message);process.exitCode=2;}
}
