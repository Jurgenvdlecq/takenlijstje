#!/usr/bin/env node
/**
 * AAE v3.2-local patch: één GO per werkpakket.
 *
 * Gebruik (vanuit de projectroot, via de AAE-runner):
 *   node scripts/aae-v3.2/apply.mjs --selftest         op een tijdelijke kopie: toepassen, verifiëren, AAE-testsuite, terugdraaien, herstel controleren
 *   node scripts/aae-v3.2/apply.mjs --plan             per bestand huidige en nieuwe hash tonen; wijzigt niets
 *   node scripts/aae-v3.2/apply.mjs --apply            back-up in .aae-backups/local-<tijd>/, dan toepassen (bij fout zelf terugdraaien)
 *   node scripts/aae-v3.2/apply.mjs --verify           geïnstalleerde bestanden en managed.json controleren tegen de laatste toepassing
 *   node scripts/aae-v3.2/apply.mjs --rollback-latest  laatste toepassing terugzetten (herhaalbaar; weigert bij tussentijdse wijzigingen)
 *
 * Geen shell, geen netwerk, geen afhankelijkheden. Schrijft uitsluitend de doelen uit edits.json
 * (allemaal onder .claude/aae/), .claude/aae/managed.json en de back-upmap.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

const HERE=path.dirname(fileURLToPath(import.meta.url));
const ROOT=path.resolve(HERE,'../..');
const MANAGED='.claude/aae/managed.json';
const VERSION='3.2.0-local';
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const fail=msg=>{throw new Error(msg);};

function snippet(rel){
  let t=fs.readFileSync(path.join(HERE,rel),'utf8');
  if(t.endsWith('\n'))t=t.slice(0,-1);
  if(!t.length)fail('Leeg fragment: '+rel);
  return t;
}
/** Toegestaan doel: alleen onder .claude/aae/, nooit state of private, geen '.'/'..'-segmenten. */
function validTarget(t,{allowManaged=false}={}){
  if(allowManaged&&t===MANAGED)return true;
  return typeof t==='string'&&/^\.claude\/aae\/[A-Za-z0-9_./-]+$/.test(t)&&!t.split('/').some(s=>s==='..'||s==='.'||s==='')&&!t.startsWith('.claude/aae/state/')&&!t.startsWith('.claude/aae/private/')&&t!==MANAGED;
}
function loadOps(){
  const ops=JSON.parse(fs.readFileSync(path.join(HERE,'edits.json'),'utf8'));
  if(!Array.isArray(ops)||!ops.length)fail('edits.json bevat geen operaties.');
  for(const o of ops){
    if(!validTarget(o.target))fail('Ongeldig doel: '+o.target);
    if(!['replace','append','write'].includes(o.op))fail('Ongeldige operatie: '+o.op);
  }
  return ops;
}
function count(hay,needle){let n=0,i=0;while((i=hay.indexOf(needle,i))!==-1){n++;i+=needle.length;}return n;}
/** Vingerafdruk van de volledige payload (edits.json plus alle fragmenten en bestanden, in volgorde). */
function payloadDigest(){
  const ops=loadOps(),h=crypto.createHash('sha256');
  h.update(fs.readFileSync(fileURLToPath(import.meta.url)));
  h.update(fs.readFileSync(path.join(HERE,'edits.json')));
  for(const o of ops)for(const k of ['old','new','text','source'])if(o[k]){h.update('\0'+o[k]+'\0');h.update(fs.readFileSync(path.join(HERE,o[k])));}
  return h.digest('hex');
}
/** Geen symbolische links in enig deel van het pad (ook niet in bovenliggende mappen). */
function symlinkProblem(base,rel){
  let cur=base;
  for(const part of rel.split('/')){
    cur=path.join(cur,part);
    try{if(fs.lstatSync(cur).isSymbolicLink())return rel+': symbolische link in pad ('+path.relative(base,cur)+')';}
    catch(e){if(e.code==='ENOENT')return null;throw e;}
  }
  return null;
}
const hashOf=(base,rel)=>{const p=path.join(base,rel);return fs.existsSync(p)?sha(fs.readFileSync(p)):null;};

/** Bereken de nieuwe inhoud van alle doelen ten opzichte van de installatie in `base`. */
function compute(base){
  const ops=loadOps(),problems=[],files=new Map();
  const managedLink=symlinkProblem(base,MANAGED);if(managedLink)problems.push(managedLink);
  const managedBefore=fs.readFileSync(path.join(base,MANAGED),'utf8');
  const managed=JSON.parse(managedBefore);
  const entry=target=>{
    if(!files.has(target)){
      const f=path.join(base,target);
      let exists=false;
      const link=symlinkProblem(base,target);if(link)problems.push(link);
      try{fs.lstatSync(f);exists=true;}catch(e){if(e.code!=='ENOENT')throw e;}
      const text=exists?fs.readFileSync(f,'utf8'):null;
      files.set(target,{exists,before:text,after:text});
    }
    return files.get(target);
  };
  for(const o of ops){
    const e=entry(o.target);
    if(o.op==='write'){e.after=fs.readFileSync(path.join(HERE,o.source),'utf8');continue;}
    if(!e.exists){problems.push(o.target+': bestaat niet (nodig voor '+o.op+')');continue;}
    if(o.op==='replace'){
      const oldText=snippet(o.old),newText=snippet(o.new),n=count(e.after,oldText);
      if(n!==1){problems.push(o.target+': fragment '+o.old+' komt '+n+'x voor (verwacht precies 1)');continue;}
      e.after=e.after.replace(oldText,()=>newText);
    } else {
      e.after=e.after+(e.after.endsWith('\n')?'':'\n')+snippet(o.text)+'\n';
    }
  }
  for(const [target,e] of files){
    if(e.exists&&managed.files[target]&&sha(e.before)!==managed.files[target])problems.push(target+': wijkt af van managed.json (lokale wijziging); eerst bewust samenvoegen');
    if(e.exists&&!managed.files[target])problems.push(target+': bestaat al maar is niet beheerd door AAE');
    if(e.after===e.before)problems.push(target+': operatie verandert niets');
  }
  // Review N6: ook de overige beheerde bestanden moeten nu kloppen, anders faalt --verify na het toepassen.
  for(const [target,hash] of Object.entries(managed.files)){
    if(files.has(target))continue;
    const link=symlinkProblem(base,target);if(link){problems.push(link);continue;}
    if(hashOf(base,target)!==hash)problems.push(target+': beheerd bestand ontbreekt of wijkt af van managed.json');
  }
  const next={...managed,version:VERSION,files:{...managed.files}};
  for(const [target,e] of files)next.files[target]=sha(e.after);
  return {files,managedBefore,managedAfter:JSON.stringify(next,null,2)+'\n',problems,fromVersion:managed.version};
}
function atomicWrite(file,data){
  fs.mkdirSync(path.dirname(file),{recursive:true});
  let mode=0o644;try{mode=fs.statSync(file).mode&0o777;}catch{}
  const tmp=file+'.aae-tmp-'+crypto.randomUUID();
  fs.writeFileSync(tmp,data,{mode,flag:'wx'});
  fs.renameSync(tmp,file);
}
function allWrites(plan){
  return [...plan.files.entries()].map(([target,e])=>({target,existed:e.exists,before:e.before,after:e.after}))
    .concat([{target:MANAGED,existed:true,before:plan.managedBefore,after:plan.managedAfter}]);
}
function requireClean(plan){
  if(plan.problems.length){for(const p of plan.problems)console.error('  - '+p);fail('Payload past niet op deze installatie ('+plan.problems.length+' probleem/problemen). Niets gewijzigd.');}
}
function latestBackup(root){
  const d=path.join(root,'.aae-backups');
  const list=fs.existsSync(d)?fs.readdirSync(d).filter(n=>n.startsWith('local-')).sort():[];
  if(!list.length)fail('Geen back-up van een lokale toepassing gevonden.');
  const dir=path.join(d,list.at(-1)),recPath=path.join(dir,'RESTORE.json');
  if(!fs.existsSync(recPath))fail('RESTORE.json ontbreekt in '+path.relative(root,dir)+'; terugdraaien niet mogelijk.');
  let rec;try{rec=JSON.parse(fs.readFileSync(recPath,'utf8'));}catch(e){fail('RESTORE.json onleesbaar: '+e.message);}
  if(!Array.isArray(rec.files))fail('RESTORE.json zonder bestandslijst.');
  // Review N-a: een bewerkte RESTORE.json mag nooit buiten .claude/aae/ laten schrijven.
  for(const f of rec.files)if(!validTarget(f.target,{allowManaged:true}))fail('RESTORE.json bevat een ongeldig doel: '+String(f.target));
  return {dir,recPath,rec};
}

function plan(root){
  const p=compute(root);
  console.log('AAE '+p.fromVersion+' -> '+VERSION+'  payload '+payloadDigest());
  for(const w of allWrites(p))console.log((w.existed?'wijzig ':'nieuw  ')+w.target+'  '+(w.existed?sha(w.before).slice(0,12):'-'.repeat(12))+' -> '+sha(w.after).slice(0,12));
  requireClean(p);
  console.log('PLAN OK: '+allWrites(p).length+' bestanden, geen conflicten. Niets gewijzigd.');
}
function apply(root){
  const p=compute(root);requireClean(p);
  const writes=allWrites(p);
  const dir=path.join(root,'.aae-backups','local-'+new Date().toISOString().replace(/[:.]/g,'-'));
  fs.mkdirSync(path.join(dir,'files'),{recursive:true,mode:0o700});
  const record={created:new Date().toISOString(),version_from:p.fromVersion,version_to:VERSION,payload_sha256:payloadDigest(),note:'Terugzetten: node scripts/aae-v3.2/apply.mjs --rollback-latest',files:[]};
  for(const w of writes){
    if(w.existed){const b=path.join(dir,'files',w.target);fs.mkdirSync(path.dirname(b),{recursive:true});fs.writeFileSync(b,w.before);}
    record.files.push({target:w.target,existed:w.existed,before_sha256:w.existed?sha(w.before):null,after_sha256:sha(w.after)});
  }
  fs.writeFileSync(path.join(dir,'RESTORE.json'),JSON.stringify(record,null,2)+'\n');
  const done=[];
  try{for(const w of writes){atomicWrite(path.join(root,w.target),w.after);done.push(w);}}
  catch(e){
    for(const w of done.reverse()){const f=path.join(root,w.target);if(w.existed)atomicWrite(f,w.before);else fs.rmSync(f,{force:true});}
    record.restored_at=new Date().toISOString();record.restored_reason='interne terugdraai na schrijffout: '+e.message;
    fs.writeFileSync(path.join(dir,'RESTORE.json'),JSON.stringify(record,null,2)+'\n');
    fail('Toepassen mislukt en teruggedraaid: '+e.message);
  }
  console.log('TOEGEPAST: '+writes.length+' bestanden, payload '+record.payload_sha256.slice(0,16)+'; back-up in '+path.relative(root,dir));
  verify(root);
}
function verify(root){
  const {rec}=latestBackup(root);
  if(rec.restored_at)fail('De laatste toepassing is al teruggedraaid ('+rec.restored_at+').');
  const bad=[];
  for(const f of rec.files)if(hashOf(root,f.target)!==f.after_sha256)bad.push(f.target);
  const m=JSON.parse(fs.readFileSync(path.join(root,MANAGED),'utf8'));
  for(const [t,h] of Object.entries(m.files))if(hashOf(root,t)!==h)bad.push('managed.json: '+t);
  if(m.version!==VERSION)bad.push('managed.json versie '+m.version);
  if(bad.length){for(const b of bad)console.error('  - '+b);fail('Verificatie mislukt.');}
  console.log('VERIFY OK: '+rec.files.length+' bestanden gelijk aan payload '+String(rec.payload_sha256).slice(0,16)+'; managed.json '+m.version+' klopt voor '+Object.keys(m.files).length+' beheerde bestanden.');
}
function rollback(root){
  const {dir,recPath,rec}=latestBackup(root);
  if(rec.restored_at)fail('Al teruggedraaid op '+rec.restored_at+'.');
  // Herhaalbaar: een bestand dat al gelijk is aan de oude toestand telt als hersteld; alleen een derde toestand is een conflict.
  const state=f=>{const cur=hashOf(root,f.target);return cur===f.after_sha256?'toegepast':cur===f.before_sha256?'hersteld':'gewijzigd';};
  for(const f of rec.files){const l=symlinkProblem(root,f.target);if(l)fail('Terugdraaien geweigerd: '+l);}
  const changed=rec.files.filter(f=>state(f)==='gewijzigd');
  if(changed.length)fail('Terugdraaien geweigerd; sinds toepassen gewijzigd: '+changed.map(f=>f.target).join(', '));
  // Review N7: eerst alle back-ups toetsen, dan pas schrijven.
  for(const f of rec.files)if(f.existed){const b=path.join(dir,'files',f.target);if(!fs.existsSync(b)||sha(fs.readFileSync(b))!==f.before_sha256)fail('Back-up ontbreekt of is beschadigd: '+f.target+'; niets teruggezet.');}
  for(const f of rec.files){if(state(f)!=='toegepast')continue;const p=path.join(root,f.target);if(f.existed)atomicWrite(p,fs.readFileSync(path.join(dir,'files',f.target)));else fs.rmSync(p,{force:true});}
  rec.restored_at=new Date().toISOString();fs.writeFileSync(recPath,JSON.stringify(rec,null,2)+'\n');
  console.log('TERUGGEDRAAID: '+rec.files.length+' bestanden hersteld naar AAE '+rec.version_from+'.');
}
function selftest(){
  const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'aae-v32-selftest-'));
  try{
    const src=path.join(ROOT,'.claude/aae'),skip=['state','private'].map(x=>path.join(src,x));
    fs.cpSync(src,path.join(tmp,'.claude/aae'),{recursive:true,filter:s=>!skip.some(x=>s===x||s.startsWith(x+path.sep))});
    const agents=path.join(ROOT,'.claude/agents');
    if(fs.existsSync(agents))for(const f of fs.readdirSync(agents).filter(n=>/^aae-[a-z-]+\.md$/.test(n)))fs.cpSync(path.join(agents,f),path.join(tmp,'.claude/agents',f));
    const original=allWrites(compute(tmp)).map(w=>({target:w.target,hash:hashOf(tmp,w.target)}));
    // Review N5: dezelfde apply/verify/rollback-code als in de echte repository, maar op de kopie.
    apply(tmp);
    const dir=path.join(tmp,'.claude/aae/tests');
    const tests=fs.readdirSync(dir).filter(f=>f.endsWith('.test.mjs')).sort().map(f=>path.join(dir,f));
    const r=spawnSync(process.execPath,['--test',...tests],{cwd:tmp,encoding:'utf8',shell:false,timeout:280000,maxBuffer:64*1024*1024});
    const out=(r.stdout||'')+(r.stderr||'');
    const lines=out.split('\n');
    const failing=lines.filter(l=>/^\s*not ok \d+/.test(l));
    if(failing.length){console.log('Mislukte tests:');for(const l of failing)console.log('  '+l.trim());}
    console.log(lines.filter(l=>/^# (tests|suites|pass|fail|cancelled|skipped|todo)\b/.test(l)).join('\n'));
    if(r.error)fail('Testsuite kon niet starten: '+r.error.message);
    if(r.status!==0){console.log('--- laatste uitvoer ---\n'+out.slice(-5000));fail('Zelftest mislukt (exit '+r.status+').');}
    rollback(tmp);
    const notRestored=original.filter(o=>hashOf(tmp,o.target)!==o.hash).map(o=>o.target);
    if(notRestored.length)fail('Terugdraaien op de kopie niet volledig: '+notRestored.join(', '));
    let second='';try{rollback(tmp);}catch(e){second=e.message;}
    if(!/Al teruggedraaid/.test(second))fail('Tweede terugdraai had geweigerd moeten worden.');
    console.log('ZELFTEST GESLAAGD: payload '+payloadDigest().slice(0,16)+' op een tijdelijke kopie toegepast en geverifieerd, volledige AAE-testsuite groen, daarna volledig teruggedraaid. Repository niet gewijzigd.');
  } finally {fs.rmSync(tmp,{recursive:true,force:true});}
}

try{
  const [flag,...extra]=process.argv.slice(2);
  if(extra.length)fail('Te veel argumenten.');
  switch(flag){
    case '--selftest':selftest();break;
    case '--plan':plan(ROOT);break;
    case '--apply':apply(ROOT);break;
    case '--verify':verify(ROOT);break;
    case '--rollback-latest':rollback(ROOT);break;
    default:fail('Gebruik --selftest | --plan | --apply | --verify | --rollback-latest');
  }
}catch(e){console.error('FOUT: '+e.message);process.exitCode=1;}
