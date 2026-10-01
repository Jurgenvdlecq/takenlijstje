import fs from 'node:fs';
import path from 'node:path';
import {spawn,spawnSync} from 'node:child_process';
import {
  STATE,RESULT,TASK,withState,assertBound,safePath,readJson,atomicJson,requireThat,
  sourceDigest,commandFingerprint,commandApproved,now,log,digest,requiredChecks,allLive,VERSION,summary
} from './core.mjs';

/** Execute a declared argv without a shell. Repository programs remain trusted code. */
export async function runCommand(root,id) {
  const launch=withState(root,s=>{
    const t=assertBound(root,s),c=t.contract.commands.find(x=>x.id===id);
    requireThat(c,'Commando niet in de route: '+id);
    requireThat(allLive(s).length===0&&!t.command_running,'Geen commandoloop naast agentcontrole of andere commandos.');
    const fingerprint=commandFingerprint(root,c);
    requireThat(commandApproved(root,t,c)||['read','test','build','preview'].includes(c.purpose)&&s.trusted_commands[fingerprint], 'Commando/bronnen niet goedgekeurd. Presenteer het commando en vraag AAE GO.');
    // v3.2-local (R6): een vooraf goedgekeurde merge/deploy draait pas als het resultaat aantoonbaar READY is.
    if(c.gate==='ready')assertReady(root,s,t,'Gate '+id+': ');
    requireThat(t.usage.commands<t.contract.budget.command_runs,'Totaal commandobudget bereikt. Niet automatisch herstarten.');
    requireThat((t.command_counts[id]||0)<c.max_runs,'Maximum aantal runs voor '+id+' bereikt.');
    const src=sourceDigest(root,t.contract);
    const related=t.command_receipts.filter(r=>r.command_fingerprint===fingerprint&&r.source_after===src).slice(-2);
    requireThat(!(related.length===2&&related.every(r=>r.exit_code!==0)),'Twee gelijke mislukte pogingen zonder bronwijziging. Stop en verander de hypothese, niet dezelfde test blijven draaien.');
    t.usage.commands++;t.command_counts[id]=(t.command_counts[id]||0)+1;
    const runId='run-'+t.usage.commands;
    t.command_running={id:runId,command:id,started:now(),pid:process.pid};
    log(s,'command_started',{task:t.id,command:id,run_id:runId});
    return {command:c,fingerprint,source_before:src,task_id:t.id,task_digest:t.digest,contract:t.contract,run_id:runId};
  });
  const logRel=STATE+'/logs/'+launch.task_id+'-'+launch.run_id+'.txt';
  const logPath=safePath(root,logRel);fs.mkdirSync(path.dirname(logPath),{recursive:true,mode:0o700});
  const fd=fs.openSync(logPath,'w',0o600);
  let captured=0,tail='',truncated=false;
  function output(buf) {
    const b=Buffer.from(buf);tail=(tail+b.toString('utf8')).slice(-2500);
    if(captured<1024*1024){const keep=b.subarray(0,1024*1024-captured);fs.writeSync(fd,keep);captured+=keep.length;}
    else truncated=true;
  }
  const started=Date.now();let result;
  try {
    result=await new Promise(resolve=>{
      const c=launch.command;
      const child=spawn(c.argv[0],c.argv.slice(1),{cwd:fs.realpathSync(root),shell:false,detached:process.platform!=='win32',env:{...process.env,CI:'1'},stdio:['ignore','pipe','pipe']});
      let timedOut=false,spawnError=null;
      const kill=()=>{try{if(process.platform!=='win32')process.kill(-child.pid,'SIGKILL');else child.kill('SIGKILL');}catch{}};
      const timer=setTimeout(()=>{timedOut=true;kill();},c.timeout_ms);
      child.stdout?.on('data',output);child.stderr?.on('data',output);
      child.on('error',err=>{spawnError=err.message;output(Buffer.from(err.message));});
      child.on('close',(code,signal)=>{clearTimeout(timer);resolve({exit_code:typeof code==='number'?code:timedOut?124:1,signal:signal||null,timed_out:timedOut,error:spawnError});});
    });
  } finally {fs.closeSync(fd);}
  const sourceAfter=sourceDigest(root,launch.contract);
  const receipt={schema_version:3,task_id:launch.task_id,route_digest:launch.task_digest,run_id:launch.run_id,command_id:id,argv:launch.command.argv,command_fingerprint:launch.fingerprint,source_before:launch.source_before,source_after:sourceAfter,
    ...result,duration_ms:Date.now()-started,finished:now(),log_path:logRel,log_truncated:truncated};
  const receiptPath='docs/aae/evidence/'+launch.task_id+'/'+launch.run_id+'.json';
  withState(root,s=>{
    requireThat(s.task?.id===launch.task_id&&s.task.digest===launch.task_digest,'Route gewijzigd tijdens commando; resultaat niet als actueel bewijs registreren.');
    s.task.command_running=null;s.task.command_receipts.push({...receipt,evidence_path:receiptPath});
    atomicJson(root,receiptPath,receipt);
    log(s,'command_finished',{task:launch.task_id,command:id,exit_code:receipt.exit_code});
  });
  return {...receipt,evidence_path:receiptPath,tail,warning:'Commandoreceipt bewijst uitvoering, niet inhoudelijke correctheid of veiligheid van projectcode.'};
}
function checkedEvidence(root,s,items,method,src) {
  requireThat(Array.isArray(items)&&items.length>0,'Bewijsverwijzing ontbreekt.');
  for(const p of items) {const f=safePath(root,p,{allowMissing:false});requireThat(fs.statSync(f).isFile(),'Bewijs moet een bestand zijn.');}
  if(method==='command') requireThat(items.some(p=>s.task.command_receipts.some(r=>r.evidence_path===p&&r.exit_code===0&&r.source_before===r.source_after&&r.source_after===src&&r.route_digest===s.task.digest)),'Geen succesvolle actuele commandoreceipt voor deze controle.');
}
/**
 * v3.2-local (R6): dezelfde READY-bewijsregels als close, zonder de taak te sluiten. Een commando met
 * gate "ready" draait alleen als RESULT.json bij de actuele route en bron hoort en alles aantoonbaar geslaagd is.
 */
function assertReady(root,s,t,prefix) {
  requireThat(fs.existsSync(safePath(root,RESULT)),prefix+'RESULT.json ontbreekt; eerst alle criteria en controles aantoonbaar READY maken.');
  const r=readJson(root,RESULT),src=sourceDigest(root,t.contract);
  requireThat(r.schema_version===3&&r.task_id===t.id&&r.route_digest===t.digest,prefix+'Resultaat hoort niet bij de actieve route.');
  requireThat(r.source_digest===src,prefix+'Broncode veranderd sinds bewijsrapport. Maak relevante controles opnieuw.');
  requireThat(r.status==='READY',prefix+'Resultaat is niet READY.');
  requireThat(Array.isArray(r.criteria)&&Array.isArray(r.checks),prefix+'Resultaat mist criteria of controles.');
  for(const a of t.contract.acceptance){const x=r.criteria.find(y=>y.id===a.id);requireThat(x?.status==='passed',prefix+'Criterium niet bewezen: '+a.id);checkedEvidence(root,s,x.evidence,'inspection',src);}
  for(const kind of [...new Set([...requiredChecks(t.contract),...t.contract.test_plan.map(c=>c.kind)])]){
    const x=r.checks.find(y=>y.kind===kind),planned=t.contract.test_plan.find(y=>y.kind===kind);
    requireThat(x?.status==='passed',prefix+'Verplichte controle niet geslaagd: '+kind);
    requireThat(x.method===planned.method,prefix+'Bewijsmethode wijkt af van plan: '+kind);
    checkedEvidence(root,s,x.evidence,x.method,src);
  }
  if(t.contract.phase==='implementation'&&t.contract.mode==='high-assurance')requireThat(Object.values(t.calls).some(c=>['aae-security-reviewer','aae-code-reviewer','aae-test-writer'].includes(c.role)&&c.status==='stopped'&&c.reported_status==='READY'&&c.source_digest===src&&c.task_digest===t.digest),prefix+'High Assurance mist actueel onafhankelijk READY-oordeel.');
}
export function reportTemplate(root) {
  return withState(root,s=>{const t=assertBound(root,s);return {
    schema_version:3,task_id:t.id,route_digest:t.digest,source_digest:sourceDigest(root,t.contract),status:'PARTIAL',summary:'Vul in wat aantoonbaar is uitgevoerd; geen verondersteld bewijs.',
    criteria:t.contract.acceptance.map(a=>({id:a.id,status:'not_run',evidence:[],note:''})),
    checks:t.contract.test_plan.map(c=>({kind:c.kind,method:c.method,status:'not_run',evidence:[],note:''}))
  };});
}
export function closeTask(root) {
  return withState(root,s=>{
    const t=assertBound(root,s);requireThat(allLive(s).length===0&&!t.command_running,'Er loopt nog werk.');
    const r=readJson(root,RESULT),src=sourceDigest(root,t.contract);
    requireThat(r.schema_version===3&&r.task_id===t.id&&r.route_digest===t.digest,'Resultaat hoort niet bij de actieve route.');
    requireThat(r.source_digest===src,'Broncode veranderd sinds bewijsrapport. Maak relevante controles opnieuw, niet blind een nieuwe hash.');
    requireThat(['READY','PARTIAL','BLOCKED'].includes(r.status),'Ongeldige eindstatus.');
    requireThat(typeof r.summary==='string'&&r.summary.trim().length>=5,'Samenvatting ontbreekt.');
    requireThat(Array.isArray(r.criteria)&&Array.isArray(r.checks),'Resultaat mist criteria of controles.');
    if(r.status==='READY') {
      requireThat(new Set(r.criteria.map(a=>a.id)).size===r.criteria.length,'Dubbele criteria in rapport.');
      for(const a of t.contract.acceptance) {const actual=r.criteria.find(x=>x.id===a.id);requireThat(actual?.status==='passed','Criterium niet bewezen: '+a.id);checkedEvidence(root,s,actual.evidence,'inspection',src);requireThat(typeof actual.note==='string'&&actual.note.length>=5,'Criterium mist toelichting.');}
      for(const kind of [...new Set([...requiredChecks(t.contract),...t.contract.test_plan.map(c=>c.kind)])]) {
        const actual=r.checks.find(x=>x.kind===kind),planned=t.contract.test_plan.find(x=>x.kind===kind);
        requireThat(actual?.status==='passed','Verplichte controle niet geslaagd: '+kind);
        requireThat(actual.method===planned.method,'Bewijsmethode wijkt af van plan: '+kind);
        checkedEvidence(root,s,actual.evidence,actual.method,src);
        requireThat(typeof actual.note==='string'&&actual.note.length>=5,'Controle mist toelichting.');
      }
      if(t.contract.phase==='implementation'&&t.contract.mode==='high-assurance') requireThat(Object.values(t.calls).some(c=>['aae-security-reviewer','aae-code-reviewer','aae-test-writer'].includes(c.role)&&c.status==='stopped'&&c.reported_status==='READY'&&c.source_digest===src&&c.task_digest===t.digest),'High Assurance mist actueel onafhankelijk READY-oordeel.');
    }
    t.status='closed';t.result=r.status;t.approval=null;
    atomicJson(root,STATE+'/results/'+t.id+'.json',r);log(s,'task_closed',{task:t.id,status:r.status});
    return {task_id:t.id,status:r.status,not_deployed:true,note:'Administratief afgerond. Bewijskwaliteit blijft mensenwerk; READY is geen publicatietoestemming.'};
  });
}
export function doctor(root) {
  const checks=[];const add=(name,ok,detail)=>checks.push({name,status:ok?'PASS':'ATTENTION',detail});
  add('node',Number(process.versions.node.split('.')[0])>=20,process.version);
  const version=spawnSync('claude',['--version'],{cwd:root,encoding:'utf8',timeout:5000,shell:false});
  const v=(version.stdout||'').match(/(\d+)\.(\d+)\.(\d+)/);
  const compatible=v&&(Number(v[1])>2||Number(v[1])===2&&(Number(v[2])>1||Number(v[2])===1&&Number(v[3])>=246));
  add('claude_cli',Boolean(compatible),v?v[0]:'Niet aangetroffen; geen echte hosttest uitgevoerd.');
  for(const p of ['.claude/settings.json','.claude/settings.local.json']) {
    if(!fs.existsSync(safePath(root,p)))continue;
    const cfg=readJson(root,p);
    add(p+' hooks_enabled',cfg.disableAllHooks!==true,'Lokale controles zijn niet hetzelfde als effectief geladen managed/user-beleid.');
    add(p+' normal_permissions',cfg.permissions?.defaultMode!=='bypassPermissions','Geen bypassPermissions gebruiken.');
  }
  const settings=readJson(root,'.claude/settings.json');
  const hooks=settings.hooks||{};
  for(const event of ['SessionStart','UserPromptSubmit','PreToolUse','PostToolUse','PostToolUseFailure','SubagentStart','SubagentStop']) {
    add('hook '+event,(hooks[event]||[]).some(g=>(g.hooks||[]).some(h=>h.command==='node'&&h.args?.some(a=>a.endsWith('/.claude/aae/runtime/hook.mjs')))), 'Controle van projectconfig; bevestig in Claude Code met /hooks.');
  }
  const managedFile='.claude/aae/managed.json';
  if(fs.existsSync(safePath(root,managedFile))) {
    const m=readJson(root,managedFile);let changed=[];
    for(const [p,hash]of Object.entries(m.files)){try{const b=fs.readFileSync(safePath(root,p,{allowMissing:false}));if(digestBytes(b)!==hash)changed.push(p);}catch{changed.push(p);}}
    add('managed_integrity',changed.length===0,changed.length?changed.join(', '):'Beheerde bestanden komen overeen met installatie.');
  } else add('managed_integrity',false,'Installatiemanifest ontbreekt.');
  const state=withState(root,s=>summary(s));
  return {version:VERSION,checks,state,live_validation:'NOT_RUN_BY_DOCTOR',supported_execution:'Linux/macOS/WSL met Node 20+; native Windows uitvoering niet praktijkgetest.',limitations:['Geen OS-sandbox. Goedgekeurde projectcommands kunnen doen wat de gebruiker op deze machine mag.','Geen exact Max-tegoed of totaal tokenverbruik berekend.','Externe/global/managed hooks kunnen aanvullend gedrag veroorzaken.','Werkelijke hostwerking moet eenmalig in een testproject worden bevestigd.']};
}
function digestBytes(b){return cryptoHash(b);}
import {createHash} from 'node:crypto';
function cryptoHash(b){return createHash('sha256').update(b).digest('hex');}
