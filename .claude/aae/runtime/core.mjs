/** AAE 3.1 - local workflow guard, not an OS security boundary. No dependencies. */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {SUPABASE_TOOLS,GITHUB_TOOLS} from './integrations.mjs';

export const VERSION = '3.2.0-local';
export const TASK = 'docs/aae/TASK.json';
export const RESULT = 'docs/aae/RESULT.json';
export const STATE = '.claude/aae/state';
export const ROLES = ['supervisor','product-analyst','product-designer','visual-designer','solution-architect','plan-critic','test-writer','code-reviewer','security-reviewer','ux-reviewer','visual-qa','performance-reviewer','accessibility-reviewer'].map(x=>'aae-'+x);
export const RISK_CHECKS = {
  ui: ['visual','accessibility'],
  authorization: ['authorization-positive','authorization-negative','tenant-isolation'],
  migration: ['migration','rollback','data-preservation'],
  financial: ['calculations','rounding'],
  sensitive_data: ['data-handling'],
  background_jobs: ['idempotency','retry'],
  external_effects: ['failure-handling']
};
export const HIGH_FLAGS = ['authorization','financial','sensitive_data'];
/** v3.2-local (R5/R12): lokale commando's mogen vaker draaien en mogen binnen de envelop worden toegevoegd. */
export const LOCAL_PURPOSES = ['read','test','build','preview'];
const CHECKS = new Set(['scope','functional','regression','analysis', ...Object.values(RISK_CHECKS).flat()]);
const DOCS = new Set([TASK, RESULT, 'docs/aae/PROJECT_PROFILE.md','docs/aae/PROGRESS.md','docs/aae/DECISIONS.md']);
const SKIP = new Set(['node_modules','.git','.claude','.next','dist','build','coverage','.venv','venv','__pycache__']);
export class GuardError extends Error { constructor(message) { super(message); this.name='GuardError'; } }
export const requireThat = (condition, message) => { if (!condition) throw new GuardError(message); };
export const sha = x => crypto.createHash('sha256').update(x).digest('hex');
export function stable(value) {
  if (Array.isArray(value)) return '['+value.map(stable).join(',')+']';
  if (value && typeof value === 'object') return '{'+Object.keys(value).sort().map(k=>JSON.stringify(k)+':'+stable(value[k])).join(',')+'}';
  return JSON.stringify(value);
}
export const digest = value => sha(stable(value));
export const now = () => new Date().toISOString();
function keys(obj, allowed, required, label) {
  requireThat(obj && typeof obj==='object' && !Array.isArray(obj), label+' moet een object zijn.');
  for (const key of Object.keys(obj)) requireThat(allowed.includes(key), label+': onbekend veld '+key);
  for (const key of required) requireThat(Object.hasOwn(obj,key), label+': ontbrekend veld '+key);
}
const text = (x, name, max=2000) => {
  requireThat(typeof x==='string' && x.trim().length>=3 && x.length<=max && !/[\x00-\x08]/.test(x), name+': geef concrete tekst.');
  requireThat(!/^(TODO|TBD|VUL IN|PLACEHOLDER|\.\.\.|<.*>)$/i.test(x.trim()), name+': sjabloon is niet ingevuld.');
};
const number = (x,min,max,name) => requireThat(Number.isInteger(x)&&x>=min&&x<=max,name+': verwacht geheel getal '+min+'..'+max);
const choice = (x, values, name) => requireThat(values.includes(x),name+': ongeldige waarde '+String(x));
const array = (x,min,max,name) => requireThat(Array.isArray(x)&&x.length>=min&&x.length<=max,name+': verwacht lijst met '+min+'..'+max+' items');
const identifier = (x,name) => requireThat(typeof x==='string' && /^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/.test(x),name+': gebruik een korte unieke code');
export function relName(value) {
  requireThat(typeof value==='string' && value.length>0 && value.length<1024,'Ongeldig bestandspad.');
  requireThat(!/[\\\x00-\x1f*?\[\]{}:]/.test(value) && !value.startsWith('/') && !value.startsWith('~'), 'Pad moet relatief, exact en zonder glob zijn: '+value);
  const p=value.replace(/\/$/,'');
  requireThat(p && p.split('/').every(s=>s!=='.'&&s!=='..'&&s!==''),'Onveilig pad: '+value);
  return p;
}
export function protectedPath(p) {
  return p==='CLAUDE.md'||p.startsWith('.claude/')||p==='.claude'||p==='.git'||p.startsWith('.git/')||p==='.gitignore'||p.startsWith('.aae-backups/')||p.split('/').some(s=>/^\.env(?:\.|$)/i.test(s)&&s!=='.env.example')||p.startsWith('docs/aae/');
}
export function controlDocument(p) { return DOCS.has(p) || /^docs\/aae\/notes\/[A-Za-z0-9_-]+\.md$/.test(p); }
/** Reject symlinks in every existing path component, including symlinked parents. */
export function safePath(root, relative, {allowMissing=true}={}) {
  const p=relName(relative), base=fs.realpathSync(root);
  let cursor=base;
  for (const part of p.split('/')) {
    cursor=path.join(cursor,part);
    try { const st=fs.lstatSync(cursor); requireThat(!st.isSymbolicLink(),'Symbolische link niet toegestaan in bewaakt pad: '+p); }
    catch(e) { if(e.code==='ENOENT' && allowMissing) continue; throw e; }
  }
  requireThat(cursor.startsWith(base+path.sep),'Pad buiten project.');
  return cursor;
}
export function relativeInput(root, absolute, cwd=root) {
  requireThat(typeof absolute==='string'&&absolute.length>0,'Bestandspad ontbreekt.');
  const target=path.resolve(cwd,absolute), base=fs.realpathSync(root);
  const rel=path.relative(base,target).split(path.sep).join('/');
  return relName(rel);
}
export function readJson(root, p) { return JSON.parse(fs.readFileSync(safePath(root,p,{allowMissing:false}),'utf8')); }
export function atomicJson(root,p,value) {
  const file=safePath(root,p);
  fs.mkdirSync(path.dirname(file),{recursive:true,mode:0o700});
  const tmp=file+'.tmp-'+crypto.randomUUID();
  fs.writeFileSync(tmp,JSON.stringify(value,null,2)+'\n',{mode:0o600,flag:'wx'});
  fs.renameSync(tmp,file);
}
export function requiredChecks(task) {
  return [...new Set([...(task.phase==='analysis'?['analysis']:['scope','functional','regression']), ...task.risk_flags.flatMap(f=>task.phase==='implementation'?RISK_CHECKS[f]:[])])];
}

function branchName(x,name){requireThat(typeof x==='string'&&x.trim().length>=1&&x.length<=240&&!/[\x00-\x1f]/.test(x),name+': ongeldige branchnaam');}
function projectRef(x){requireThat(typeof x==='string'&&/^[a-z0-9][a-z0-9-]{4,63}$/i.test(x),'Supabase project_ref is ongeldig.');}
export function validateIntegrations(t){
  const all=t.integrations??{};
  keys(all,['supabase','github'],[],'Integraties');
  let maxCalls=0,mutating=false,sensitive=false;
  if(all.supabase){
    const x=all.supabase;keys(x,['project_ref','tools','max_calls','sensitive_migrations','dangerous_sql'],['project_ref','tools','max_calls'],'Supabase-integratie');
    projectRef(x.project_ref);array(x.tools,1,SUPABASE_TOOLS.length,'Supabase-tools');requireThat(new Set(x.tools).size===x.tools.length,'Dubbele Supabase-tool.');
    for(const tool of x.tools)choice(tool,SUPABASE_TOOLS,'Supabase-tool');number(x.max_calls,1,30,'Supabase-aanroepen');maxCalls+=x.max_calls;
    const sm=x.sensitive_migrations??[];array(sm,0,8,'Gevoelige migraties');for(const n of sm)text(n,'Migratienaam',200);
    const ds=x.dangerous_sql??[];array(ds,0,2,'Gevoelige SQL');for(const q of ds)text(q,'Gevoelige SQL',16000);
    if(x.tools.includes('apply_migration')){requireThat(t.risk_flags.includes('migration'),'apply_migration vereist risicovlag migration.');mutating=true;}
    if(ds.length||sm.length){requireThat(t.risk==='high'&&t.mode==='high-assurance','Gevoelige databaseacties vereisen expliciet High Assurance.');sensitive=true;mutating=true;}
  }
  if(all.github){
    const x=all.github;keys(x,['tools','max_calls','base','head'],['tools','max_calls','base','head'],'GitHub-integratie');
    array(x.tools,1,GITHUB_TOOLS.length,'GitHub-tools');requireThat(new Set(x.tools).size===x.tools.length,'Dubbele GitHub-tool.');for(const tool of x.tools)choice(tool,GITHUB_TOOLS,'GitHub-tool');
    number(x.max_calls,1,4,'GitHub-aanroepen');branchName(x.base,'Base');branchName(x.head,'Head');requireThat(t.risk_flags.includes('external_effects'),'create_pull_request vereist risicovlag external_effects.');maxCalls+=x.max_calls;mutating=true;
  }
  return {all,maxCalls,mutating,sensitive};
}
export function integrationNeedsApproval(task){return validateIntegrations(task).mutating;}
export function validateTask(t) {
  const req=['schema_version','id','title','goal','phase','mode','risk','uncertainty','risk_flags','scope','acceptance','test_plan','agents','commands','budget','approval_required','design_freeze'];
  keys(t,[...req,'parallel_reason','integrations','decision_points'],req,'Taakcontract');
  if(Object.hasOwn(t,'decision_points')){array(t.decision_points,0,8,'Beslisgrenzen');for(const d of t.decision_points)text(d,'Beslisgrens',300);requireThat(new Set(t.decision_points).size===t.decision_points.length,'Dubbele beslisgrens');}
  requireThat(t.schema_version===3,'Taakcontract vereist schema_version 3.');
  identifier(t.id,'Taak-ID'); text(t.title,'Titel',200); text(t.goal,'Doel');
  choice(t.phase,['analysis','implementation'],'Fase');
  choice(t.mode,['lean','standard','high-assurance'],'Modus');
  choice(t.risk,['low','normal','high'],'Risico'); choice(t.uncertainty,['low','normal','high'],'Onzekerheid');
  array(t.risk_flags,0,7,'Risicovlaggen'); requireThat(new Set(t.risk_flags).size===t.risk_flags.length,'Dubbele risicovlag');
  for(const f of t.risk_flags) choice(f,Object.keys(RISK_CHECKS),'Risicovlag');
  requireThat(typeof t.approval_required==='boolean'&&typeof t.design_freeze==='boolean','Goedkeuringsvelden moeten booleans zijn.');
  if(t.risk==='high'||t.risk_flags.some(f=>HIGH_FLAGS.includes(f))) requireThat(t.mode==='high-assurance','Hoog risico vereist high-assurance.');
  if(t.mode==='lean') requireThat(t.risk==='low'&&t.uncertainty==='low','Lean vereist laag risico en lage onzekerheid.');
  keys(t.scope,['read','write'],['read','write'],'Scope');
  array(t.scope.read,0,30,'Leesscope'); array(t.scope.write,0,30,'Schrijfscope');
  for(const p of [...t.scope.read,...t.scope.write]) relName(p);
  for(const p of t.scope.write) requireThat(!protectedPath(relName(p)),'Systeembestanden/administratie horen niet in applicatiescope: '+p);
  const integrationInfo=validateIntegrations(t);
  if(t.phase==='analysis') {requireThat(t.scope.write.length===0,'Analyse mag geen applicatieschrijfscope hebben.');requireThat(!integrationInfo.mutating,'Analyse mag geen externe mutaties bevatten.');}
  else requireThat(t.scope.write.length>0||integrationInfo.mutating,'Implementatie vereist applicatieschrijfscope of een expliciete externe wijziging.');
  array(t.acceptance,1,12,'Acceptatiecriteria');
  for(const a of t.acceptance) {keys(a,['id','text'],['id','text'],'Acceptatiecriterium');identifier(a.id,'Criterium-ID');text(a.text,'Criterium');}
  requireThat(new Set(t.acceptance.map(a=>a.id)).size===t.acceptance.length,'Dubbele criterium-ID');
  array(t.test_plan,1,20,'Bewijsplan');
  for(const c of t.test_plan) {keys(c,['kind','method','description'],['kind','method','description'],'Bewijsplan');choice(c.kind,[...CHECKS],'Controle');choice(c.method,['command','inspection','manual'],'Bewijsmethode');text(c.description,'Bewijsomschrijving');}
  requireThat(new Set(t.test_plan.map(c=>c.kind)).size===t.test_plan.length,'Dubbele controle in bewijsplan.');
  for(const k of requiredChecks(t)) requireThat(t.test_plan.some(c=>c.kind===k),'Ontbrekende kwaliteitsondergrens: '+k);
  array(t.agents,0,12,'Agents');
  for(const a of t.agents) {
    keys(a,['name','question','files','deliverable','stop_when','model','max_calls'],['name','question','files','deliverable','stop_when','model','max_calls'],'Agent');
    choice(a.name,ROLES.filter(r=>r!=='aae-supervisor'),'Agentnaam');text(a.question,'Agentvraag');text(a.deliverable,'Agentresultaat');text(a.stop_when,'Stopcriterium');
    array(a.files,0,20,'Agentbestanden');for(const p of a.files) relName(p);
    choice(a.model,['haiku','sonnet','opus','fable'],'Modelalias');number(a.max_calls,1,4,'Agentaanroepen');
  }
  requireThat(new Set(t.agents.map(a=>a.name)).size===t.agents.length,'Dubbele agentselectie');
  if(t.mode==='lean') requireThat(t.agents.length<=1,'Lean heeft maximaal een specialist.');
  if(t.phase==='implementation'&&t.mode==='high-assurance') requireThat(t.agents.some(a=>['aae-security-reviewer','aae-code-reviewer','aae-test-writer'].includes(a.name)),'High Assurance implementatie vereist een gerichte onafhankelijke controle, niet een vaste agentketen.');
  keys(t.budget,['agent_calls','max_parallel','command_runs','external_calls'],['agent_calls','max_parallel','command_runs'],'Budget');
  number(t.budget.agent_calls,0,12,'Agentbudget');number(t.budget.command_runs,0,80,'Commandobudget');number(t.budget.max_parallel,1,2,'Parallelisme');
  if(integrationInfo.maxCalls){requireThat(Object.hasOwn(t.budget,'external_calls'),'Externe integraties vereisen budget.external_calls.');number(t.budget.external_calls,1,40,'Extern toolbudget');requireThat(integrationInfo.maxCalls<=t.budget.external_calls,'Extern toolbudget kleiner dan providerlimieten.');}
  else if(Object.hasOwn(t.budget,'external_calls'))number(t.budget.external_calls,0,40,'Extern toolbudget');
  requireThat(t.agents.reduce((n,a)=>n+a.max_calls,0)<=t.budget.agent_calls,'Agentbudget kleiner dan geselecteerde max_calls.');
  if(t.budget.max_parallel>1) {text(t.parallel_reason,'Reden voor onafhankelijk parallel werk');requireThat(t.mode!=='lean','Geen parallelisme in Lean.');}
  array(t.commands,0,20,'Commandos');
  for(const c of t.commands) {
    keys(c,['id','argv','purpose','why','watch','timeout_ms','max_runs','gate'],['id','argv','purpose','why','watch','timeout_ms','max_runs'],'Commando');
    if(Object.hasOwn(c,'gate'))choice(c.gate,['none','ready'],'Commando-gate');
    identifier(c.id,'Commando-ID');array(c.argv,1,40,'Argumenten');
    for(const arg of c.argv) requireThat(typeof arg==='string'&&arg.length<8000&&!arg.includes('\0'),'Ongeldig commandoargument');
    requireThat(c.argv[0].length>0&&!/[\r\n]/.test(c.argv[0]),'Executable ontbreekt');
    choice(c.purpose,['read','test','build','preview','install','publish','destructive'],'Commandodoel');text(c.why,'Commandoreden');
    array(c.watch,0,30,'Commandobronnen');for(const p of c.watch) relName(p);
    number(c.timeout_ms,1000,300000,'Timeout');number(c.max_runs,1,LOCAL_PURPOSES.includes(c.purpose)?20:c.purpose==='publish'?10:1,'Aantal uitvoeringen');
    if(['install','destructive'].includes(c.purpose))requireThat(c.max_runs===1,'Installeren/destructief: een uitvoering per expliciete routegoedkeuring.');
    if(t.phase==='analysis') requireThat(['read','test'].includes(c.purpose),'Analyse staat geen build/install/preview/publish/destructief commando toe.');
  }
  requireThat(new Set(t.commands.map(c=>c.id)).size===t.commands.length,'Dubbel commando-ID');
  requireThat(t.commands.reduce((n,c)=>n+c.max_runs,0)<=t.budget.command_runs,'Commandobudget te klein');
  requireThat(Buffer.byteLength(JSON.stringify(t))<48000,'Taakcontract is te groot; splits scope.');
  return t;
}
export function scopeContains(scope,p) { return scope.some(s=>{s=relName(s);return s===p||p.startsWith(s+'/');}); }
export function sourceDigest(root,task) {
  const found=new Map(); let bytes=0;
  function visit(p) {
    if(p==='docs/aae'||p.startsWith('docs/aae/')||p.split('/').some(s=>SKIP.has(s))) return;
    const f=safePath(root,p); let st;
    try{st=fs.lstatSync(f);}catch(e){if(e.code==='ENOENT'){found.set(p,'absent');return;}throw e;}
    if(st.isDirectory()) {for(const n of fs.readdirSync(f).sort()) visit(p+'/'+n);}
    else if(st.isFile()) {
      bytes+=st.size; requireThat(bytes<64*1024*1024&&found.size<3000,'Scope-fingerprint te groot. Kies gerichtere bronpaden.');
      found.set(p,sha(fs.readFileSync(f)));
    }
  }
  for(const p of [...task.scope.read,...task.scope.write]) visit(relName(p));
  return digest([...found.entries()].sort(([a],[b])=>a.localeCompare(b)));
}
export function commandRefs(root,c) {
  const automatic=['package.json','package-lock.json','pnpm-lock.yaml','yarn.lock','bun.lock','bun.lockb','pyproject.toml','requirements.txt','Cargo.toml','Cargo.lock','Makefile','justfile'];
  return [...new Set([...automatic,...c.watch])].sort().map(p=>{
    const f=safePath(root,p);if(!fs.existsSync(f))return [p,'absent'];
    const st=fs.statSync(f);requireThat(st.isFile()&&st.size<20*1024*1024,'Commando-watch moet een normaal, klein bestand zijn: '+p);
    return [p,sha(fs.readFileSync(f))];
  });
}
export function commandFingerprint(root,c) {
  return digest({argv:c.argv,purpose:c.purpose,timeout_ms:c.timeout_ms,refs:commandRefs(root,c)});
}
/** v3.2-local: wat de gebruiker goedkeurt = argv, doel, timeout, gate en de bewaakte paden (niet hun inhoud). */
export function commandShape(c){return digest({argv:c.argv,purpose:c.purpose,timeout_ms:c.timeout_ms,gate:c.gate||'none',watch:[...c.watch].sort()});}
export function approveCommand(root,c){return {fingerprint:commandFingerprint(root,c),shape:commandShape(c),refs:Object.fromEntries(commandRefs(root,c))};}
/**
 * v3.2-local (R12): een goedgekeurd commando blijft goedgekeurd zolang de vorm gelijk is. Alleen voor lokale commando's
 * (read/test/build/preview) zonder gate mag een sinds GO gewijzigd bewaakt bestand binnen de goedgekeurde schrijfscope
 * liggen (eigen werk binnen het pakket). Publish/install/destructive en gate-commando's vragen een nieuwe GO zodra een
 * bewaakt bestand verandert (review B4); een bewaakt bestand buiten de scope vraagt altijd een nieuwe GO.
 */
export function commandApproved(root,t,c){
  const rec=t.approved_commands?.[c.id];
  if(!rec)return false;
  if(typeof rec==='string')return rec===commandFingerprint(root,c);
  if(rec.shape!==commandShape(c))return false;
  const tolerant=LOCAL_PURPOSES.includes(c.purpose)&&(c.gate||'none')==='none';
  const current=Object.fromEntries(commandRefs(root,c));
  for(const [p,h] of Object.entries(current))if(rec.refs[p]!==h&&!(tolerant&&scopeContains(t.contract.scope.write,p)))return false;
  return true;
}
export function defaultState(){return {version:3,halted:false,request:null,task:null,history:[],trusted_commands:{},integrations:{supabase:{verified_ref:null,verified_at:null,verified_request_key:null}},sessions:{},events:[]};}
export function log(s,type,detail={}){s.events.push({at:now(),type,...detail});if(s.events.length>500)s.events=s.events.slice(-500);}
export function withState(root,fn) {
  const dir=safePath(root,STATE);fs.mkdirSync(dir,{recursive:true,mode:0o700});
  const lock=path.join(dir,'lock'), until=Date.now()+2000;
  for(;;){try{fs.mkdirSync(lock);fs.writeFileSync(path.join(lock,'owner.json'),JSON.stringify({pid:process.pid,at:now()}));break;}catch(e){if(e.code!=='EEXIST')throw e;requireThat(Date.now()<until,'AAE-status is vergrendeld. Stop; geen automatische herhaallus. Controleer doctor/herstelhandleiding.');Atomics.wait(new Int32Array(new SharedArrayBuffer(4)),0,0,15);}}
  try {
    const file=safePath(root,STATE+'/local.json');
    const s=fs.existsSync(file)?JSON.parse(fs.readFileSync(file,'utf8')):defaultState();
    requireThat(s.version===3,'Onbekende lokale stateversie. Niet automatisch resetten.');
    const result=fn(s);atomicJson(root,STATE+'/local.json',s);return result;
  } finally {fs.rmSync(lock,{recursive:true,force:true});}
}
export function getTask(root){return validateTask(readJson(root,TASK));}
export function liveCalls(s){return s.task?Object.values(s.task.calls).filter(c=>['reserved','running','unknown'].includes(c.status)):[];}
export function liveBootstrap(s){return Object.values(s.request?.bootstrap_calls||{}).filter(c=>['reserved','running','unknown'].includes(c.status));}
export function allLive(s){return [...liveCalls(s),...liveBootstrap(s)];}
export function assertBound(root,s) {
  const t=s.task;requireThat(!s.halted,'Expliciet gepauzeerd.');
  requireThat(t&&s.request,'Geen actieve route; schrijf TASK.json en voer route uit.');
  requireThat(t.status==='active','Taak niet actief ('+t.status+'). Vraag alleen de noodzakelijke goedkeuring/herstelactie.');
  requireThat(t.request_key===s.request.key&&t.owner===s.request.session,'Nieuwe gebruikersvraag: route eerst opnieuw beoordelen.');
  requireThat(digest(getTask(root))===t.digest,'Taakcontract gewijzigd: eerst herrouteren; oude toestemming is ongeldig.');
  return t;
}
function commandNeedsApproval(root,s,c){return !s.trusted_commands[commandFingerprint(root,c)]||!['read','test','build','preview'].includes(c.purpose);}
export function needsApproval(root,s,t,old) {
  const defaults={lean:1,standard:3,'high-assurance':6};
  return old&&old.digest!==digest(t)&&(Boolean(old.approval)||old.contract.approval_required||old.contract.design_freeze||old.contract.mode==='high-assurance'||t.scope.write.some(p=>!scopeContains(old.contract.scope.write,p)))||t.approval_required||t.design_freeze||t.phase==='implementation'&&t.mode==='high-assurance'||integrationNeedsApproval(t)||t.budget.max_parallel>1||t.budget.agent_calls>defaults[t.mode]||t.agents.some(a=>a.model==='opus')||t.commands.some(c=>commandNeedsApproval(root,s,c))||old&&old.contract.phase==='analysis'&&t.phase==='implementation'||old&&(t.budget.agent_calls>old.contract.budget.agent_calls||t.budget.command_runs>old.contract.budget.command_runs||(t.budget.external_calls||0)>(old.contract.budget.external_calls||0));
}
const LEVELS={low:0,normal:1,high:2}, level=x=>LEVELS[x]??9;
/**
 * v3.2-local (R4, review B1/B3): een nieuw of gewijzigd lokaal commando valt alleen binnen de envelop als zijn argv
 * volledig op een toegestane lijst staat: een bekend testprogramma als begin, daarna uitsluitend expliciet toegestane
 * opties of eenvoudige relatieve paden/refs (geen opties als --fix, --output, --import, geen absolute paden, geen '..',
 * geen ':' of '='). Het opgegeven doel ("test") alleen is geen bewijs.
 */
// Review B6: node --test voert elk expliciet opgegeven bestand uit; daarom alleen testbestanden of bekende testmappen.
const nodeTestOperand=a=>{const last=a.split('/').pop();return /\.(test|spec)\.[cm]?[jt]sx?$/.test(last)||['tests','test','__tests__','spec','src'].includes(last);};
const SAFE_LOCAL_ARGV=[
  {prefix:['node','--test'],flags:[],operand:nodeTestOperand},
  {prefix:['npx','vitest','run'],flags:[]},
  {prefix:['npx','tsc','--noEmit'],flags:['--pretty']},
  {prefix:['npx','eslint'],flags:['--max-warnings=0']},
  {prefix:['npx','playwright','test'],flags:[]},
  {prefix:['git','status'],flags:['--porcelain','--short','--branch']},
  {prefix:['git','diff'],flags:['--stat','--name-only','--cached','--check']},
  {prefix:['git','log'],flags:['--oneline','--stat'],pattern:/^(-n\d{1,4}|--max-count=\d{1,4})$/},
  {prefix:['git','show'],flags:['--stat','--name-only']},
  {prefix:['git','rev-parse'],flags:['--abbrev-ref','--short']},
  {prefix:['git','merge-base'],flags:['--is-ancestor']}
];
const SAFE_OPERAND=/^(?![-\/])(?!.*(^|\/)\.\.(\/|$))[A-Za-z0-9_.\/@^~-]{1,200}$/;
export function safeLocalArgv(argv){
  if(!Array.isArray(argv)||!argv.every(a=>typeof a==='string'))return false;
  const rule=SAFE_LOCAL_ARGV.find(r=>argv.length>=r.prefix.length&&r.prefix.every((x,i)=>argv[i]===x));
  if(!rule)return false;
  return argv.slice(rule.prefix.length).every(a=>rule.flags.includes(a)||Boolean(rule.pattern?.test(a))||SAFE_OPERAND.test(a)&&(!rule.operand||rule.operand(a)));
}
/**
 * v3.2-local (R4): redenen waarom een gewijzigd contract buiten de goedgekeurde envelop valt.
 * Lege lijst = amendement: de route blijft actief en de bestaande GO blijft geldig.
 * Materieel (nieuwe GO): ander ID of fase; andere modus; hoger risico of hogere onzekerheid; andere risicovlaggen;
 * bredere schrijfscope; andere goedkeuringsvlaggen; verwijderde beslisgrens; verwijderd of gewijzigd acceptatiecriterium;
 * verwijderde of gewijzigde controle in het bewijsplan; nieuwe, verwijderde of gewijzigde agent (vraag, resultaat,
 * stopcriterium, model, minder bestanden, meer aanroepen); hoger agent-/extern budget of meer parallelisme; ander doel van
 * een commando; nieuw of gewijzigd niet-lokaal commando of meer runs daarvan; nieuw of gewijzigd lokaal commando buiten de
 * toegestane argv-lijst; bredere integratie (ander project, extra tools of calls, nieuwe gevoelige SQL/migraties, andere
 * PR-base/head). Het commandobudget mag omhoog (R12, herstelrondes) tot het schemamaximum.
 * Review B2: bewijs en READY-eisen mogen niet stil lichter worden, anders wordt ook een gate-merge lichter.
 */
export function envelopeChanges(o,c){
  const why=[],sub=(a,b)=>a.every(x=>b.includes(x)),same=(a,b)=>sub(a,b)&&sub(b,a);
  if(c.id!==o.id)why.push('taak-ID');
  if(c.phase!==o.phase)why.push('fase');
  if(c.mode!==o.mode)why.push('modus');
  if(level(c.risk)>level(o.risk))why.push('risico');
  if(level(c.uncertainty)>level(o.uncertainty))why.push('onzekerheid');
  if(!same(c.risk_flags,o.risk_flags))why.push('risicovlaggen');
  if(!c.scope.write.every(p=>scopeContains(o.scope.write,relName(p))))why.push('schrijfscope');
  if(c.approval_required!==o.approval_required||c.design_freeze!==o.design_freeze)why.push('goedkeuringsvlaggen');
  if(!sub(o.decision_points||[],c.decision_points||[]))why.push('beslisgrenzen');
  if(!o.acceptance.every(a=>c.acceptance.some(b=>b.id===a.id&&b.text===a.text)))why.push('acceptatiecriteria');
  if(!o.test_plan.every(a=>c.test_plan.some(b=>b.kind===a.kind&&b.method===a.method&&b.description===a.description)))why.push('bewijsplan');
  for(const a of c.agents){const b=o.agents.find(x=>x.name===a.name);if(!b||a.max_calls>b.max_calls||a.model!==b.model||a.question!==b.question||a.deliverable!==b.deliverable||a.stop_when!==b.stop_when||!sub(b.files,a.files))why.push('agent '+a.name);}
  for(const b of o.agents)if(!c.agents.some(a=>a.name===b.name))why.push('agent verwijderd '+b.name);
  if(c.budget.agent_calls>o.budget.agent_calls||c.budget.max_parallel>o.budget.max_parallel||(c.budget.external_calls||0)>(o.budget.external_calls||0))why.push('budget');
  for(const x of c.commands){
    const y=o.commands.find(k=>k.id===x.id);
    if(y&&y.purpose!==x.purpose){why.push('commando-doel '+x.id);continue;}
    // Review B5: een READY-gate mag niet stil verdwijnen (bewijs niet lichter).
    if(y&&(y.gate||'none')==='ready'&&(x.gate||'none')!=='ready'){why.push('commando-gate '+x.id);continue;}
    if(y&&commandShape(y)===commandShape(x)){if(!LOCAL_PURPOSES.includes(x.purpose)&&x.max_runs>y.max_runs)why.push('commando-runs '+x.id);continue;}
    if(!LOCAL_PURPOSES.includes(x.purpose)||!safeLocalArgv(x.argv))why.push('commando '+x.id);
  }
  const oi=o.integrations||{},ci=c.integrations||{};
  if(ci.supabase){const a=ci.supabase,b=oi.supabase;if(!b||a.project_ref!==b.project_ref||!sub(a.tools,b.tools)||a.max_calls>b.max_calls||!sub(a.sensitive_migrations||[],b.sensitive_migrations||[])||!sub(a.dangerous_sql||[],b.dangerous_sql||[]))why.push('supabase');}
  if(ci.github){const a=ci.github,b=oi.github;if(!b||a.base!==b.base||a.head!==b.head||!sub(a.tools,b.tools)||a.max_calls>b.max_calls)why.push('github');}
  return why;
}
function assertCommandsApproved(root,s,t) {
  for(const c of t.contract.commands) requireThat(commandApproved(root,t,c)||s.trusted_commands[commandFingerprint(root,c)],'Commando '+c.id+' of diens bronnen zijn gewijzigd. Vraag een nieuwe gerichte GO.');
}
export function route(root) {
  return withState(root,s=>{
    requireThat(!s.halted,'Workflow gepauzeerd. Gebruik expliciet AAE GO/VERDER of AAE NIEUW.');
    requireThat(s.request,'Geen gebruikersverzoek geregistreerd. Start een nieuwe Claude Code-sessie met werkende hooks.');
    requireThat(allLive(s).length===0,'Er loopt nog een agent. Niet herrouteren voordat die gestopt is.');
    requireThat(!s.task?.command_running,'Er loopt nog een commando.');
    const c=getTask(root), d=digest(c), old=s.task;
    requireThat(old?.status!=='paused','Taak is expliciet gepauzeerd. Alleen een gebruikers-GO of VERDER kan dat opheffen.');
    if(s.request.task_id)requireThat(s.request.task_id===c.id,'Geen nieuw taak-ID om het budget binnen dezelfde gebruikersvraag opnieuw te starten.');
    if(old&&old.id!==c.id){requireThat(!s.history.includes(c.id),'Oud taak-ID mag niet worden hergebruikt.');s.history.push(old.id);}
    const same=old?.id===c.id;
    requireThat(!(same&&old.status==='closed'),'Dit taak-ID is afgerond. Gebruik een nieuw ID bij een nieuwe gebruikersopdracht.');
    const usage=same?{...old.usage,agents:old.usage.agents+(old.request_key!==s.request.key?(s.request.bootstrap_count||0):0),external:old.usage.external||0}:{agents:s.request.bootstrap_count||0,commands:0,external:0};
    requireThat(c.budget.agent_calls>=usage.agents&&c.budget.command_runs>=usage.commands&&(c.budget.external_calls||0)>=usage.external,'Nieuw budget mag verbruik niet uitwissen.');
    // v3.2-local (R4): een gewijzigd contract van een goedgekeurde, actieve route blijft binnen de envelop actief.
    const wasApproved=same&&old.status==='active'&&old.approval?.digest===old.digest&&old.approval.request_key===s.request.key;
    const envelope=wasApproved&&old.digest!==d?envelopeChanges(old.contract,c):null;
    const amended=Boolean(envelope&&envelope.length===0);
    const approved=same&&old.digest===d&&old.approval?.digest===d&&old.approval.request_key===s.request.key||amended;
    const required=amended?false:needsApproval(root,s,c,same?old:null);
    const approved_commands=approved?old.approved_commands:{};
    if(amended){
      for(const id of Object.keys(approved_commands))if(!c.commands.some(x=>x.id===id))delete approved_commands[id];
      for(const cmd of c.commands){const rec=approved_commands[cmd.id];if(!(rec&&(typeof rec==='string'||rec.shape===commandShape(cmd))))approved_commands[cmd.id]=approveCommand(root,cmd);}
    } else if(!required)for(const cmd of c.commands)approved_commands[cmd.id]=approveCommand(root,cmd);
    const approval=amended?{...old.approval,digest:d,amended_from:old.digest,amended_at:now()}:approved?old.approval:null;
    s.task={id:c.id,digest:d,contract:c,status:required&&!approved?'pending':'active',owner:s.request.session,request_key:s.request.key,approval,approved_commands,
      usage,calls:same?old.calls:{},command_counts:same?old.command_counts:{},command_receipts:same?old.command_receipts:[],command_running:null,
      external_calls:same?(old.external_calls||{}):{},external_receipts:same?(old.external_receipts||[]):[],sensitive_approval:approved&&!amended?(old.sensitive_approval||null):null,denials:0};
    s.request.task_id=c.id;
    // v3.2-local (R10): een projectverificatie uit deze gebruikersvraag geldt voor de taak die nu wordt gerouteerd.
    const sv=s.integrations?.supabase;if(sv?.verified_ref&&sv.verified_request_key===s.request.key)sv.verified_task=c.id;
    log(s,amended?'route_amended':'route',{task:c.id,digest:d,status:s.task.status,...(envelope&&envelope.length?{envelope_changes:envelope}:{})});
    return {task_id:c.id,route_digest:d,status:s.task.status,required_checks:requiredChecks(c),agents:c.agents.map(a=>({name:a.name,question:a.question,model:a.model})),usage,budget:c.budget,
      amended,envelope_changes:envelope||[],
      next:s.task.status==='pending'?(envelope&&envelope.length?'Materiele wijziging buiten de goedgekeurde envelop ('+envelope.join(', ')+'). Vat samen en wacht op AAE GO.':'Vat scope, commands en gevolgen samen. Wacht op de gebruiker: AAE GO.'):amended?'Amendement binnen de goedgekeurde envelop; de GO blijft geldig. Werk zelfstandig verder.':'Voer uitsluitend deze route uit.'};
  });
}
export function context(event,msg){return {hookSpecificOutput:{hookEventName:event,additionalContext:msg}};}
export function userPrompt(root,e) {
  return withState(root,s=>{
    const prompt=String(e.prompt||'').trim(), session=String(e.session_id||'');
    requireThat(session,'Sessie-ID ontbreekt.');
    // Never deduplicate different prompts on session_id; prompt_id is optional.
    if(e.prompt_id&&s.sessions[session]?.seen?.includes(e.prompt_id)) return context('UserPromptSubmit','AAE: deze gebruikersprompt is al verwerkt.');
    const se=s.sessions[session]??={seen:[]};
    if(e.prompt_id){se.seen.push(e.prompt_id);se.seen=se.seen.slice(-100);}
    const sensitiveCommand=prompt.match(/^AAE GEVOELIG GO(?:\s+([A-Za-z0-9_-]+))?$/i);
    if(sensitiveCommand){
      requireThat(s.task&&s.request,'Geen actieve taak voor gevoelige toestemming.');
      requireThat(!sensitiveCommand[1]||sensitiveCommand[1]===s.task.id,'Gevoelige goedkeuring noemt een ander taak-ID.');
      requireThat(s.task.status==='active'&&s.task.approval?.digest===s.task.digest&&s.task.approval.request_key===s.request.key,'Eerst de gewone route met AAE GO goedkeuren.');
      const info=validateIntegrations(getTask(root));requireThat(info.sensitive,'De actuele route bevat geen exact geplande gevoelige databaseactie.');
      s.task.sensitive_approval={digest:s.task.digest,request_key:s.request.key,at:now(),source:'UserPromptSubmit'};
      log(s,'user_sensitive_go',{task:s.task.id});
      return context('UserPromptSubmit','AAE: gevoelige GO geldt uitsluitend voor de exact in '+s.task.id+' vastgelegde gevoelige migraties/SQL en vervalt bij routewijziging.');
    }
    const command=prompt.match(/^AAE (GO|PAUZE|VERDER|NIEUW|HERSTEL|STATUS|VERTROUW)(?:\s+([A-Za-z0-9_-]+))?$/i);
    if(command) {
      const action=command[1].toUpperCase();
      if(action==='STATUS')return context('UserPromptSubmit',JSON.stringify(summary(s)));
      if(action==='PAUZE') {s.halted=true;if(s.task){s.task.status='paused';s.task.approval=null;s.task.sensitive_approval=null;}log(s,'user_pause');return context('UserPromptSubmit','AAE: gepauzeerd. Stop werkzaamheden en laat lopende agents stoppen; deze melding annuleert geen OS-processen.');}
      if(action==='HERSTEL') {
        requireThat(s.task||liveBootstrap(s).length,'Geen taak of agent om te herstellen.');
        for(const call of allLive(s))call.status='abandoned';
        if(s.task){s.task.command_running=null;s.task.status='paused';s.task.approval=null;s.task.owner=session;}
        if(s.request)s.request.session=session;
        log(s,'user_recovery',{task:s.task?.id||'routing'});
        return context('UserPromptSubmit','AAE: registraties vrijgegeven op expliciete gebruikersbevestiging dat processen zijn gestopt. Budget NIET gereset. Taak blijft gepauzeerd; AAE GO voor hervatting.');
      }
      if(action==='NIEUW') {
        s.halted=false;
        requireThat(allLive(s).length===0&&!s.task?.command_running,'Eerst lopend werk stoppen.');
        if(s.task){s.history.push(s.task.id);s.task=null;}
        s.request={key:crypto.randomUUID(),session,hash:sha(prompt),bootstrap_count:0,bootstrap_calls:{},task_id:null};
        return context('UserPromptSubmit','AAE: nieuwe opdrachtgrens. Vraag om of lees de nieuwe opdracht; geen uitvoering zonder route.');
      }
      requireThat(s.task,'Geen route beschikbaar. Maak eerst een route en presenteer die.');
      requireThat(!command[2]||command[2]===s.task.id,'Goedkeuring noemt een ander taak-ID.');
      requireThat(allLive(s).length===0&&!s.task.command_running,'Eerst lopend werk laten afronden.');
      requireThat(s.request&&s.request.session===session||s.task.owner===session||action==='VERDER','Deze sessie is niet de eigenaar; eerst AAE VERDER om expliciet over te nemen.');
      const t=s.task,c=getTask(root);
      requireThat(digest(c)===t.digest,'Contract veranderd sinds routepresentatie. Eerst route opnieuw laten maken.');
      if(action==='VERTROUW') {
        requireThat(t.status==='active'&&t.approval?.digest===t.digest,'Keur eerst de route en commandos goed met AAE GO.');
        for(const cmd of c.commands)if(['read','test','build','preview'].includes(cmd.purpose)){const fp=commandFingerprint(root,cmd);requireThat(commandApproved(root,t,cmd),'Commandobronnen gewijzigd. Nieuwe GO nodig.');s.trusted_commands[fp]={at:now(),id:cmd.id};}
        log(s,'user_trust_commands',{task:t.id});
        return context('UserPromptSubmit','AAE: deze expliciet goedgekeurde lokale commandoversies mogen opnieuw worden gebruikt. Gewijzigde scripts/config en externe/destructieve acties blijven goedkeuring vereisen.');
      }
      if(action==='GO') {
        requireThat(t.status!=='closed','Afgeronde taak wordt niet opnieuw vrijgegeven. Maak een nieuwe opdracht.');
        s.halted=false;t.owner=session;t.request_key=s.request.key;t.status='active';
        t.approval={digest:t.digest,task_id:t.id,request_key:s.request.key,at:now(),source:'UserPromptSubmit'};t.sensitive_approval=null;
        for(const cmd of c.commands)t.approved_commands[cmd.id]=approveCommand(root,cmd);
        log(s,'user_go',{task:t.id,digest:t.digest});
        return context('UserPromptSubmit','AAE: GO geldt alleen voor '+t.id+' / '+t.digest.slice(0,12)+'. Fase: '+c.phase+'. Geen toestemming buiten deze scope.');
      }
      if(action==='VERDER') {
        requireThat(t.status!=='closed','Taak is afgerond.');
        const wasPaused=t.status==='paused'||s.halted;s.halted=false;
        s.request={...s.request,session,key:crypto.randomUUID(),bootstrap_calls:{},bootstrap_count:0,task_id:t.id};
        t.owner=session;t.request_key=s.request.key;
        if(t.approval)t.approval.request_key=s.request.key;
        if(wasPaused){t.status='pending';return context('UserPromptSubmit','AAE: eigenaar hervat, maar ingetrokken goedkeuring blijft ingetrokken. AAE GO nodig.');}
        assertCommandsApproved(root,s,t);
        log(s,'user_continue',{task:t.id});
        return context('UserPromptSubmit','AAE: dezelfde scope hervat; eerder verbruik blijft meetellen.');
      }
    }
    requireThat(allLive(s).length===0&&!s.task?.command_running,'Er loopt nog werk. Eerst afronden of AAE PAUZE en na stoppen AAE HERSTEL.');
    requireThat(!s.task||s.task.owner===session||['closed','paused'].includes(s.task.status),'Een andere sessie beheert deze werkmap. Geen tweede bouwer: stop die sessie of gebruik bewust AAE VERDER.');
    s.request={key:crypto.randomUUID(),session,hash:sha(prompt),bootstrap_count:0,bootstrap_calls:{},task_id:null};
    // v3.2-local (R3): een vervolgbericht laat een actieve route van deze sessie en haar GO staan.
    // Alleen de aparte gevoelige GO vervalt. Gepauzeerde, afgeronde of nog niet goedgekeurde routes worden niet meegenomen.
    if(s.task&&s.task.status==='active'&&s.task.owner===session){
      s.task.request_key=s.request.key;if(s.task.approval)s.task.approval.request_key=s.request.key;s.task.sensitive_approval=null;
      log(s,'user_request',{session,task_kept:s.task.id});
      return context('UserPromptSubmit','AAE v3.2-local: taak '+s.task.id+' blijft actief'+(s.task.approval?' en de GO blijft geldig':'')+' binnen de goedgekeurde envelop. Werk zelfstandig verder; alleen een materiele scope- of risicowijziging of een beslisgrens vraagt een nieuwe GO. Is dit een nieuwe opdracht, rond dan eerst af (close) of herrouteer met een nieuw taak-ID.');
    }
    if(s.task){s.task.approval=null;s.task.sensitive_approval=null;/* old snapshot is not bound to this request */}
    log(s,'user_request',{session});
    return context('UserPromptSubmit','AAE v3.2-local: nieuwe vraag. Eerst lichte routing; hergebruik context. Geen oude bouwtoestemming. Gesprek mag zonder route. Een kleine duidelijke taak heeft geen aparte supervisor nodig.');
  });
}
export function summary(s) {
  if(!s.task)return {status:'no-task',bootstrap_calls:s.request?.bootstrap_count||0};
  const t=s.task;return {task_id:t.id,route_digest:t.digest,status:t.status,phase:t.contract.phase,owner:t.owner,usage:t.usage,budget:t.contract.budget,external_verified:s.integrations?.supabase?.verified_ref||null,active_agents:liveCalls(s).map(c=>({role:c.role,status:c.status})),command_running:t.command_running||null,note:'Aanroepregistratie; geen meting van Claude Max-tegoed of werkelijke modeltokens.'};
}
export function inspect(root){return withState(root,s=>summary(s));}
