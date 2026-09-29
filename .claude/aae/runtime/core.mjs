/** AAE 3 - local workflow guard, not an OS security boundary. No dependencies. */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

export const VERSION = '3.0.0';
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
export const HIGH_FLAGS = ['authorization','migration','financial','sensitive_data'];
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
export function validateTask(t) {
  const req=['schema_version','id','title','goal','phase','mode','risk','uncertainty','risk_flags','scope','acceptance','test_plan','agents','commands','budget','approval_required','design_freeze'];
  keys(t,[...req,'parallel_reason'],req,'Taakcontract');
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
  if(t.phase==='analysis') requireThat(t.scope.write.length===0,'Analyse mag geen applicatieschrijfscope hebben.');
  else requireThat(t.scope.write.length>0,'Implementatie vereist expliciete schrijfscope.');
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
  keys(t.budget,['agent_calls','max_parallel','command_runs'],['agent_calls','max_parallel','command_runs'],'Budget');
  number(t.budget.agent_calls,0,12,'Agentbudget');number(t.budget.command_runs,0,40,'Commandobudget');number(t.budget.max_parallel,1,2,'Parallelisme');
  requireThat(t.agents.reduce((n,a)=>n+a.max_calls,0)<=t.budget.agent_calls,'Agentbudget kleiner dan geselecteerde max_calls.');
  if(t.budget.max_parallel>1) {text(t.parallel_reason,'Reden voor onafhankelijk parallel werk');requireThat(t.mode!=='lean','Geen parallelisme in Lean.');}
  array(t.commands,0,15,'Commandos');
  for(const c of t.commands) {
    keys(c,['id','argv','purpose','why','watch','timeout_ms','max_runs'],['id','argv','purpose','why','watch','timeout_ms','max_runs'],'Commando');
    identifier(c.id,'Commando-ID');array(c.argv,1,40,'Argumenten');
    for(const arg of c.argv) requireThat(typeof arg==='string'&&arg.length<8000&&!arg.includes('\0'),'Ongeldig commandoargument');
    requireThat(c.argv[0].length>0&&!/[\r\n]/.test(c.argv[0]),'Executable ontbreekt');
    choice(c.purpose,['read','test','build','preview','install','publish','destructive'],'Commandodoel');text(c.why,'Commandoreden');
    array(c.watch,0,30,'Commandobronnen');for(const p of c.watch) relName(p);
    number(c.timeout_ms,1000,300000,'Timeout');number(c.max_runs,1,6,'Aantal uitvoeringen');
    if(['install','publish','destructive'].includes(c.purpose))requireThat(c.max_runs===1,'Installeren/publiceren/destructief: een uitvoering per expliciete routegoedkeuring.');
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
export function commandFingerprint(root,c) {
  const automatic=['package.json','package-lock.json','pnpm-lock.yaml','yarn.lock','bun.lock','bun.lockb','pyproject.toml','requirements.txt','Cargo.toml','Cargo.lock','Makefile','justfile'];
  const refs=[...new Set([...automatic,...c.watch])].sort().map(p=>{
    const f=safePath(root,p);if(!fs.existsSync(f))return [p,'absent'];
    const st=fs.statSync(f);requireThat(st.isFile()&&st.size<20*1024*1024,'Commando-watch moet een normaal, klein bestand zijn: '+p);
    return [p,sha(fs.readFileSync(f))];
  });
  return digest({argv:c.argv,purpose:c.purpose,timeout_ms:c.timeout_ms,refs});
}
export function defaultState(){return {version:3,halted:false,request:null,task:null,history:[],trusted_commands:{},sessions:{},events:[]};}
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
  return old&&old.digest!==digest(t)&&(Boolean(old.approval)||old.contract.approval_required||old.contract.design_freeze||old.contract.mode==='high-assurance'||t.scope.write.some(p=>!scopeContains(old.contract.scope.write,p)))||t.approval_required||t.design_freeze||t.phase==='implementation'&&t.mode==='high-assurance'||t.budget.max_parallel>1||t.budget.agent_calls>defaults[t.mode]||t.agents.some(a=>a.model==='opus')||t.commands.some(c=>commandNeedsApproval(root,s,c))||old&&old.contract.phase==='analysis'&&t.phase==='implementation'||old&&(t.budget.agent_calls>old.contract.budget.agent_calls||t.budget.command_runs>old.contract.budget.command_runs);
}
function assertCommandsApproved(root,s,t) {
  for(const c of t.contract.commands) requireThat(t.approved_commands[c.id]===commandFingerprint(root,c)||s.trusted_commands[commandFingerprint(root,c)],'Commando '+c.id+' of diens bronnen zijn gewijzigd. Vraag een nieuwe gerichte GO.');
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
    const usage=same?{...old.usage,agents:old.usage.agents+(old.request_key!==s.request.key?(s.request.bootstrap_count||0):0)}:{agents:s.request.bootstrap_count||0,commands:0};
    requireThat(c.budget.agent_calls>=usage.agents&&c.budget.command_runs>=usage.commands,'Nieuw budget mag verbruik niet uitwissen.');
    const approved=same&&old.digest===d&&old.approval?.digest===d&&old.approval.request_key===s.request.key;
    const required=needsApproval(root,s,c,same?old:null);
    const approved_commands=approved?old.approved_commands:{};
    if(!required)for(const cmd of c.commands)approved_commands[cmd.id]=commandFingerprint(root,cmd);
    s.task={id:c.id,digest:d,contract:c,status:required&&!approved?'pending':'active',owner:s.request.session,request_key:s.request.key,approval:approved?old.approval:null,approved_commands,
      usage,calls:same?old.calls:{},command_counts:same?old.command_counts:{},command_receipts:same?old.command_receipts:[],command_running:null,denials:0};
    s.request.task_id=c.id;
    log(s,'route',{task:c.id,digest:d,status:s.task.status});
    return {task_id:c.id,route_digest:d,status:s.task.status,required_checks:requiredChecks(c),agents:c.agents.map(a=>({name:a.name,question:a.question,model:a.model})),usage,budget:c.budget,
      next:s.task.status==='pending'?'Vat scope, commands en gevolgen samen. Wacht op de gebruiker: AAE GO.':'Voer uitsluitend deze route uit.'};
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
    const command=prompt.match(/^AAE (GO|PAUZE|VERDER|NIEUW|HERSTEL|STATUS|VERTROUW)(?:\s+([A-Za-z0-9_-]+))?$/i);
    if(command) {
      const action=command[1].toUpperCase();
      if(action==='STATUS')return context('UserPromptSubmit',JSON.stringify(summary(s)));
      if(action==='PAUZE') {s.halted=true;if(s.task){s.task.status='paused';s.task.approval=null;}log(s,'user_pause');return context('UserPromptSubmit','AAE: gepauzeerd. Stop werkzaamheden en laat lopende agents stoppen; deze melding annuleert geen OS-processen.');}
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
        for(const cmd of c.commands)if(['read','test','build','preview'].includes(cmd.purpose)){const fp=commandFingerprint(root,cmd);requireThat(t.approved_commands[cmd.id]===fp,'Commandobronnen gewijzigd. Nieuwe GO nodig.');s.trusted_commands[fp]={at:now(),id:cmd.id};}
        log(s,'user_trust_commands',{task:t.id});
        return context('UserPromptSubmit','AAE: deze expliciet goedgekeurde lokale commandoversies mogen opnieuw worden gebruikt. Gewijzigde scripts/config en externe/destructieve acties blijven goedkeuring vereisen.');
      }
      if(action==='GO') {
        requireThat(t.status!=='closed','Afgeronde taak wordt niet opnieuw vrijgegeven. Maak een nieuwe opdracht.');
        s.halted=false;t.owner=session;t.request_key=s.request.key;t.status='active';
        t.approval={digest:t.digest,task_id:t.id,request_key:s.request.key,at:now(),source:'UserPromptSubmit'};
        for(const cmd of c.commands)t.approved_commands[cmd.id]=commandFingerprint(root,cmd);
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
    if(s.task){s.task.approval=null;/* old snapshot is not bound to this request */}
    log(s,'user_request',{session});
    return context('UserPromptSubmit','AAE v3: nieuwe vraag. Eerst lichte routing; hergebruik context. Geen oude bouwtoestemming. Gesprek mag zonder route. Een kleine duidelijke taak heeft geen aparte supervisor nodig.');
  });
}
export function summary(s) {
  if(!s.task)return {status:'no-task',bootstrap_calls:s.request?.bootstrap_count||0};
  const t=s.task;return {task_id:t.id,route_digest:t.digest,status:t.status,phase:t.contract.phase,owner:t.owner,usage:t.usage,budget:t.contract.budget,active_agents:liveCalls(s).map(c=>({role:c.role,status:c.status})),command_running:t.command_running||null,note:'Aanroepregistratie; geen meting van Claude Max-tegoed of werkelijke modeltokens.'};
}
export function inspect(root){return withState(root,s=>summary(s));}
