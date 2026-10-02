import fs from 'node:fs';
import path from 'node:path';
import {
  ROLES,TASK,STATE,withState,requireThat,validateTask,relName,safePath,relativeInput,
  controlDocument,protectedPath,scopeContains,assertBound,sourceDigest,digest,now,log,context,userPrompt,summary,liveCalls,atomicJson,getTask
} from './core.mjs';
import {classifyExternalCall,projectRefFromInput,projectRefFromResponse,responseDigest,safeExternalSummary,sqlText,migrationName,migrationSql} from './integrations.mjs';

const READ_TOOLS=new Set(['Read','Grep','Glob']);
const HARMLESS_MAIN=new Set(['ToolSearch','AskUserQuestion','TodoWrite','TaskCreate','TaskGet','TaskList','TaskUpdate','TaskOutput','TaskStop','EnterPlanMode','ExitPlanMode','WebSearch','WebFetch']);
const WRITE_TOOLS=new Set(['Write','Edit','MultiEdit','NotebookEdit']);
const SYSTEM_READ=['.claude/aae/ENTRY.md','.claude/aae/CATALOG.md','.claude/aae/docs','docs/aae/PROJECT_PROFILE.md','docs/aae/PROGRESS.md','docs/aae/DECISIONS.md',TASK];
export const liveBootstrap=s=>Object.values(s.request?.bootstrap_calls||{}).filter(c=>['reserved','running','unknown'].includes(c.status));
export const activeAgents=s=>[...liveCalls(s),...liveBootstrap(s)];
function isSubagent(e){return Boolean(e.agent_id||e.agent_type);}
function agentRows(s){return [...Object.values(s.task?.calls||{}),...Object.values(s.request?.bootstrap_calls||{})];}
function activeRow(s,e){return agentRows(s).reverse().find(c=>c.agent_id===e.agent_id&&['reserved','running'].includes(c.status));}

function externalRows(s){return [...Object.values(s.task?.external_calls||{}),...Object.values(s.request?.external_calls||{})];}
function externalRow(s,e){return externalRows(s).find(c=>c.id===e.tool_use_id);}
function liveExternal(s){return externalRows(s).filter(c=>['reserved','running','unknown'].includes(c.status));}
function readBoundTask(root,s){
  requireThat(!s.halted,'Workflow gepauzeerd.');requireThat(s.task&&s.request,'Maak eerst een route voor deze Supabase/GitHub-actie.');
  requireThat(['pending','active'].includes(s.task.status),'Taak is niet beschikbaar voor externe read-checks.');
  requireThat(s.task.request_key===s.request.key&&s.task.owner===s.request.session,'Nieuwe gebruikersvraag of andere eigenaar: route eerst opnieuw beoordelen.');
  requireThat(digest(getTask(root))===s.task.digest,'Taakcontract gewijzigd: eerst herrouteren.');
  return s.task;
}
function exactSensitiveAllowed(cfg,call,input){
  if(call.provider!=='supabase')return false;
  if(call.action==='apply_migration')return (cfg.sensitive_migrations||[]).includes(migrationName(input));
  if(call.action==='execute_sql')return (cfg.dangerous_sql||[]).some(q=>q.trim()===sqlText(input).trim());
  return false;
}
function preExternal(root,s,e,call){
  checkOwner(s,e);requireThat(!s.halted,'Workflow gepauzeerd.');requireThat(e.tool_use_id,'Externe tool mist tool_use_id; geen betrouwbare receiptregistratie.');
  requireThat(liveExternal(s).length===0,'Er loopt al een externe toolactie. Wacht op afronding.');
  const input=e.tool_input||{}, inRef=projectRefFromInput(input);
  s.integrations??={supabase:{verified_ref:null,verified_at:null,verified_request_key:null}};s.integrations.supabase??={verified_ref:null,verified_at:null,verified_request_key:null};
  // One narrow read-only bootstrap is allowed before a route so the current Supabase project can be bound.
  const currentBound=Boolean(s.task&&s.request&&s.task.request_key===s.request.key);
  if(call.provider==='supabase'&&call.action==='get_project_url'&&!currentBound){
    s.integrations.supabase={verified_ref:null,verified_at:null,verified_request_key:null};
    s.request.external_calls??={};s.request.external_probe_count=(s.request.external_probe_count||0)+1;requireThat(s.request.external_probe_count<=2,'Maximaal twee projectbindingsprobes per gebruikersvraag.');
    s.request.external_calls[e.tool_use_id]={id:e.tool_use_id,provider:call.provider,action:call.action,level:'read',status:'reserved',input_digest:safeExternalSummary(call,input).input_digest,at:now(),probe:true};
    log(s,'external_reserved',{provider:call.provider,action:call.action,probe:true});return null;
  }
  const t=readBoundTask(root,s), cfg=t.contract.integrations?.[call.provider];
  requireThat(cfg,'Deze externe provider staat niet in het taakcontract.');requireThat(cfg.tools.includes(call.action),'Tool '+call.action+' staat niet in de goedgekeurde integratieroute.');
  requireThat((t.usage.external||0)<(t.contract.budget.external_calls||0),'Extern toolbudget bereikt. Herbeoordeel; geen automatische extra ronde.');
  const providerCount=Object.values(t.external_calls||{}).filter(x=>x.provider===call.provider).length;requireThat(providerCount<cfg.max_calls,'Providerlimiet bereikt voor '+call.provider+'.');
  if(call.provider==='supabase'){
    if(inRef)requireThat(inRef===cfg.project_ref,'Supabase-tool wijst naar een ander project dan de taakroute.');
    if(call.action==='get_project_url')s.integrations.supabase={verified_ref:null,verified_at:null,verified_request_key:null};
    // v3.2-local (R10): de projectverificatie geldt voor de hele taak, niet per gebruikersbericht.
    else {const sv=s.integrations.supabase;requireThat(sv.verified_ref===cfg.project_ref&&(sv.verified_task===t.id||sv.verified_request_key===s.request.key),'Supabase-project is niet voor deze taak live geverifieerd. Roep eerst get_project_url aan en bind de route aan die ref.');sv.verified_task=t.id;}
    if(call.action==='apply_migration'){requireThat(Boolean(migrationName(input)),'apply_migration vereist een expliciete migratienaam.');requireThat(Boolean(migrationSql(input).trim()),'apply_migration vereist expliciete migratie-SQL.');}
    if(call.action==='execute_sql'&&call.level==='change')throw new Error('Muterende execute_sql is niet toegestaan in AAE v3.1. Gebruik apply_migration met een benoemde migratie.');
  }
  if(call.provider==='github'){
    requireThat(typeof input.base==='string'&&input.base.length>0,'PR-aanmaak vereist expliciete base.');
    requireThat(typeof input.head==='string'&&input.head.length>0,'PR-aanmaak vereist expliciete head.');
    requireThat(input.base===cfg.base,'PR-base wijkt af van taakcontract.');
    requireThat(input.head===cfg.head,'PR-head wijkt af van taakcontract.');
  }
  if(call.level==='read'){
    // Pending routes may gather read-only evidence before GO so the user can approve with context.
  } else {
    requireThat(t.status==='active'&&t.approval?.digest===t.digest&&t.approval.request_key===s.request.key,'Externe wijziging vereist de actuele AAE GO.');
    if(call.level==='sensitive'){
      requireThat(exactSensitiveAllowed(cfg,call,input),'Gevoelige actie staat niet exact in sensitive_migrations/dangerous_sql van de route.');
      requireThat(t.sensitive_approval?.digest===t.digest&&t.sensitive_approval.request_key===s.request.key,'Gevoelige actie vereist apart: AAE GEVOELIG GO '+t.id);
    }
  }
  t.usage.external=(t.usage.external||0)+1;t.external_calls??={};
  const row={id:e.tool_use_id,provider:call.provider,action:call.action,level:call.level,status:'reserved',at:now(),task_digest:t.digest,summary:safeExternalSummary(call,input)};
  t.external_calls[e.tool_use_id]=row;
  log(s,'external_reserved',{provider:call.provider,action:call.action,level:call.level});
  return null;
}
function externalLifecycle(root,s,e){
  const row=externalRow(s,e);if(!row)return false;
  if(e.hook_event_name==='PostToolUseFailure'){
    row.status='failed';row.finished=now();log(s,'external_failed',{provider:row.provider,action:row.action});return true;
  }
  if(e.hook_event_name!=='PostToolUse')return false;
  row.status='stopped';row.finished=now();row.result_digest=responseDigest(e.tool_response);
  if(row.provider==='supabase'&&row.action==='get_project_url'){
    const ref=projectRefFromResponse(e.tool_response);row.observed_project_ref=ref||null;
    if(ref){
      const cfg=s.task?.contract.integrations?.supabase;
      if(cfg&&cfg.project_ref!==ref){row.status='mismatch';log(s,'supabase_project_mismatch',{expected:cfg.project_ref,observed:ref});}
      else {s.integrations??={};const bound=Boolean(s.task&&s.request&&s.task.request_key===s.request.key&&['pending','active'].includes(s.task.status));s.integrations.supabase={verified_ref:ref,verified_at:now(),verified_request_key:s.request?.key||null,verified_task:bound?s.task.id:null};log(s,'supabase_project_verified',{project_ref:ref});}
    }
  }
  if(s.task&&row.task_digest===s.task.digest){
    const index=s.task.external_receipts.length+1, receipt={schema_version:1,task_id:s.task.id,route_digest:s.task.digest,provider:row.provider,action:row.action,level:row.level,status:row.status,summary:row.summary,result_digest:row.result_digest,observed_project_ref:row.observed_project_ref||null,finished:row.finished};
    const receiptPath='docs/aae/evidence/'+s.task.id+'/external-'+index+'.json';atomicJson(root,receiptPath,receipt);s.task.external_receipts.push({...receipt,evidence_path:receiptPath});row.evidence_path=receiptPath;
  }
  log(s,'external_finished',{provider:row.provider,action:row.action,status:row.status});return true;
}
function checkOwner(s,e){requireThat(s.request&&s.request.session===e.session_id,'Geen actieve gebruikersvraag voor deze sessie. Herstart, of neem een bestaande taak expliciet over met AAE VERDER.');}
function toolPath(root,e){return relativeInput(root,e.tool_input.file_path||e.tool_input.notebook_path,e.cwd||root);}
function readPermission(root,s,e) {
  const input=e.tool_input||{};
  let p;
  if(e.tool_name==='Read')p=toolPath(root,e);
  else if(input.path&&path.resolve(input.path)!==fs.realpathSync(root))p=relativeInput(root,input.path,e.cwd||root);
  if(p){safePath(root,p);requireThat(!p.startsWith('.claude/aae/private/'),'Lees geen testauthcookies met modeltools. Gebruik alleen de fixturehelper.');requireThat(!p.split('/').some(n=>/^\.env(?:\.|$)/.test(n)&&n!=='.env.example'),'Lees geen secrets. Gebruik .env.example of namen zonder waarden.');}
  if(!isSubagent(e)) return null;
  const row=activeRow(s,e);requireThat(row&&row.role===e.agent_type,'Geen geldige geregistreerde agentaanroep voor deze toolactie.');
  if(row.role==='aae-supervisor') {
    requireThat(e.tool_name!=='Grep'||p,'Supervisor: geen repo-brede inhoudsscan.');
    if(p&&!scopeContains([...SYSTEM_READ,'.claude/aae/templates'],p)) {
      row.discovery_reads??=[];
      if(!row.discovery_reads.includes(p))row.discovery_reads.push(p);
      requireThat(row.discovery_reads.length<=3,'Supervisor heeft drie verkennende paden gebruikt. Rapporteer onzekerheid; start geen brede scan.');
    }
  } else {
    const agent=s.task?.contract.agents.find(a=>a.name===row.role);
    requireThat(agent,'Agent niet meer in actuele route.');
    requireThat(p&&scopeContains([...SYSTEM_READ,...agent.files, 'docs/aae/evidence', 'docs/aae/notes', '.claude/agents/'+row.role+'.md'],p),'Agent mag alleen het afgesproken werkpakket lezen; specificeer een toegestaan pad.');
  }
  return null;
}
function delegation(root,s,e) {
  requireThat(!isSubagent(e),'Specialisten mogen geen andere agents starten.');checkOwner(s,e);requireThat(!s.halted,'Workflow gepauzeerd.');
  requireThat(e.tool_use_id,'Agentaanroep mist tool_use_id. Geen betrouwbare budgetregistratie; stop voor compatibiliteitscontrole.');
  const input=e.tool_input||{};
  const oldResume=input.resume?agentRows(s).find(c=>c.agent_id===input.resume):null;
  const role=input.subagent_type||oldResume?.role;
  requireThat(ROLES.includes(role),'Agent niet toegestaan. Alleen geselecteerde aae-agents; geen Explore/Plan/algemene fallback of agentteams.');
  requireThat(!input.run_in_background,'Vraag foreground aan. De host kan toch backgrounden; de slotregistratie blijft dan actief.');
  requireThat(!input.isolation,'Subagent-worktrees vallen buiten deze gedeelde taakregistratie. Gebruik normale read-only agents.');
  const bootstrap=role==='aae-supervisor';
  const container=bootstrap?s.request.bootstrap_calls:s.task?.calls;
  requireThat(container,'Maak eerst een route. Alleen de lichte supervisor heeft een begrensde bootstrap-route.');
  const existing=container[e.tool_use_id];
  const signature=digest(input);
  if(existing){requireThat(existing.input_digest===signature,'Tool-ID hergebruikt met andere invoer.');return {hookSpecificOutput:{hookEventName:'PreToolUse',updatedInput:existing.updated_input}};}
  let model,packet,limit;
  if(bootstrap) {
    requireThat(!input.resume,'Supervisor wordt niet eindeloos hervat. Gebruik diens bestaande oordeel.');
    requireThat(s.task?.status!=='paused','Taak gepauzeerd. Geen nieuwe supervisor.');
    requireThat(s.request.bootstrap_count<1,'Deze gebruikersvraag heeft al een supervisor gebruikt. Hoofdsessie hergebruikt bevindingen.');
    if(s.task?.request_key===s.request.key)requireThat(s.task.usage.agents<s.task.contract.budget.agent_calls,'Geen resterend budget voor aanvullende supervisor.');
    model='haiku';limit=1;
    packet={task_id:s.request.task_id||'routing',question:'Bepaal de kleinste betrouwbare aanpak voor de gebruikersopdracht. Kies expertise, fase, risico en bewijs; geen inhoudelijke uitvoering.',files:SYSTEM_READ,stop_when:'Route kan met expliciete onzekerheden worden voorgesteld. Maximaal drie aanvullende bronpaden.',result:'Compact routeadvies; geen agentaanroepen, tests of wijzigingen.'};
  } else {
    const t=assertBound(root,s),a=t.contract.agents.find(a=>a.name===role);
    requireThat(a,'Deze specialist staat niet in het taakcontract.');
    requireThat(t.usage.agents<t.contract.budget.agent_calls,'Totaal agentbudget bereikt. Herbeoordeel; geen automatische derde ronde of nieuw taak-ID.');
    requireThat(Object.values(t.calls).filter(c=>c.role===role).length<a.max_calls,'Agentlimiet bereikt voor '+role);
    requireThat(!t.command_running,'Geen specialist starten tijdens een muterend/testcommando.');
    if(input.resume)requireThat(oldResume&&oldResume.task_digest===t.digest&&oldResume.source_digest===sourceDigest(root,t.contract),'Oude agentcontext is niet meer actueel. Niet blind hervatten.');
    model=a.model;limit=t.contract.budget.max_parallel;
    packet={task_id:t.id,route_digest:t.digest,question:a.question,files:a.files,acceptance:t.contract.acceptance,deliverable:a.deliverable,stop_when:a.stop_when,phase:t.contract.phase};
  }
  requireThat(activeAgents(s).length<limit,'Er draait of reserveert al een agent. Wacht op afronding; dit is geen aanleiding om een nieuwe route te maken.');
  requireThat(!activeAgents(s).some(c=>c.role===role),'Twee gelijktijdige agents met dezelfde rol zijn niet ondersteund.');
  requireThat(typeof input.prompt==='string'&&input.prompt.length<=16000,'Agentoverdracht ontbreekt of is te lang. Geef alleen relevante feiten en bronverwijzingen.');
  const updated={...input,subagent_type:role,model,run_in_background:false,prompt:'VERPLICHT AAE-WERKPAKKET\n'+JSON.stringify(packet)+'\n\nAanvullende context (geen uitbreiding van bevoegdheden):\n'+input.prompt};
  const row={id:e.tool_use_id,role,status:'reserved',agent_id:input.resume||null,input_digest:signature,updated_input:updated,requested_model:model,at:now(),task_digest:s.task?.digest||null,source_digest:!bootstrap?sourceDigest(root,s.task.contract):null};
  container[e.tool_use_id]=row;
  if(bootstrap){s.request.bootstrap_count++;if(s.task?.request_key===s.request.key)s.task.usage.agents++;}
  else s.task.usage.agents++;
  log(s,'agent_reserved',{role,tool_use_id:e.tool_use_id,requested_model:model});
  // No permissionDecision: allow here: host permission rules still apply.
  return {hookSpecificOutput:{hookEventName:'PreToolUse',updatedInput:updated}};
}
export function preTool(root,e) {
  return withState(root,s=>{
    const name=e.tool_name,input=e.tool_input||{};e={...e,tool_input:input};
    requireThat(typeof name==='string','Toolnaam ontbreekt.');
    requireThat(e.permission_mode!=='bypassPermissions','AAE ondersteunt geen bypassPermissions. Herstart met normale hostrechten.');
    if(name==='Agent'||name==='Task')return delegation(root,s,e);
    if(READ_TOOLS.has(name))return readPermission(root,s,e);
    if(isSubagent(e)) {
      if(name==='SubagentHandback') {requireThat(activeRow(s,e),'Onbekende agent');return null;}
      throw new Error('AAE-specialisten zijn read-only: geen shell, schrijven, skills, MCP of verdere delegatie. Lever advies/testcode aan de hoofdsessie.');
    }
    const external=classifyExternalCall(name,input);if(external)return preExternal(root,s,e,external);
    if(HARMLESS_MAIN.has(name))return null;
    if(WRITE_TOOLS.has(name)) {
      checkOwner(s,e);
      const paths=name==='MultiEdit'?(input.edits||[]).map(edit=>relativeInput(root,edit.file_path||input.file_path,e.cwd||root)):[toolPath(root,e)];
      requireThat(paths.length>0,'Geen herkenbaar schrijfdoel.');
      for(const p of paths) {
        safePath(root,p);
        if(controlDocument(p)) {
          if(p===TASK){requireThat(name==='Write','Taakcontract altijd als volledig JSON-bestand met Write vervangen.');requireThat(activeAgents(s).length===0&&!s.task?.command_running,'Wijzig de route niet tijdens lopend werk.');validateTask(JSON.parse(input.content));}
          continue;
        }
        requireThat(!protectedPath(p),'AAE/projectinstructies, state, credentials en instellingen zijn beschermd. Gebruik de offline installer voor systeemupdates.');
        const t=assertBound(root,s);
        requireThat(t.contract.phase==='implementation','Analyse-only: geen applicatiecode wijzigen.');
        requireThat(activeAgents(s).length===0&&liveExternal(s).length===0&&!t.command_running,'Geen bronwijzigingen tijdens agent-, externe tool- of testuitvoering.');
        requireThat(scopeContains(t.contract.scope.write,p),'Bestand valt buiten afgesproken schrijfscope: '+p);
      }
      return null;
    }
    if(name==='Bash'||name==='PowerShell') {
      checkOwner(s,e);
      requireThat(fs.realpathSync(e.cwd||root)===fs.realpathSync(root),'Voer de AAE-runner uit vanuit de projectroot; geen cd-ketens.');
      requireThat(!input.run_in_background,'Geen onbeheerde shell-achtergrondtaken.');
      const m=String(input.command||'').match(/^node \.claude\/aae\/runtime\/cli\.mjs (status|route|doctor|report-template|close|run|packet)(?: ([A-Za-z0-9_-]+))?$/);
      requireThat(m,'Geen vrije shell binnen de agentworkflow. Registreer argv + reden + bronnen in TASK.json en gebruik: node .claude/aae/runtime/cli.mjs run <id>. Geen shell-parser of impliciete npm-toestemming.');
      requireThat(['run','packet'].includes(m[1])?Boolean(m[2]):!m[2],'Onjuiste runnerargumenten.');
      if(m[1]==='run'||m[1]==='close')assertBound(root,s);
      return null;
    }
    throw new Error('Tool '+name+' is niet door AAE v3.1 geclassificeerd. Niet omzeilen via MCP/skills/agentteams. Vraag om een gerichte adapter of gebruik de ondersteunde route.');
  });
}
export function lifecycle(root,e) {
  return withState(root,s=>{
    const rows=agentRows(s);
    if(externalLifecycle(root,s,e))return null;
    if(e.hook_event_name==='SubagentStart') {
      const match=[...rows].reverse().find(c=>c.role===e.agent_type&&c.status==='reserved'&&(!c.agent_id||c.agent_id===e.agent_id))||[...rows].reverse().find(c=>c.agent_id===e.agent_id&&['running','unknown'].includes(c.status));
      if(!match){log(s,'unmatched_subagent_start',{role:e.agent_type});return context('SubagentStart','AAE: geen toegestane dispatch gevonden. Doe geen projectwerk; rapporteer aan de hoofdsessie.');}
      match.agent_id=e.agent_id;match.status='running';
      return context('SubagentStart','AAE: alleen lezen en de toegewezen vraag beantwoorden. Geen tools buiten Read/Grep/Glob, geen nieuwe agents. Rapporteer READY/PARTIAL/BLOCKED met bewijs, geen bouw-GO.');
    }
    if(e.hook_event_name==='SubagentStop') {
      const match=[...rows].reverse().find(c=>c.agent_id===e.agent_id&&['running','reserved','unknown'].includes(c.status));
      if(match){match.status='stopped';match.finished=now();const report=String(e.last_assistant_message||'').slice(-2500);if(report)match.report_summary=report;match.reported_status=[...(match.report_summary||'').matchAll(/STATUS:\s*(READY|PARTIAL|BLOCKED)/g)].at(-1)?.[1]||match.reported_status||'UNKNOWN';log(s,'agent_stopped',{role:match.role});}
      return null; // Never block stopping: no review-induced infinite loops.
    }
    if(e.tool_name==='SubagentHandback'&&e.hook_event_name==='PostToolUse'){
      const match=activeRow(s,e);
      if(match){const text=String(e.tool_input?.message||e.tool_input?.report||'').slice(-2500);if(text){match.report_summary=text;const status=[...text.matchAll(/STATUS:\s*(READY|PARTIAL|BLOCKED)/g)].at(-1)?.[1];if(status)match.reported_status=status;}}
      return null;
    }
    if(['Agent','Task'].includes(e.tool_name)) {
      const match=rows.find(c=>c.id===e.tool_use_id);if(!match)return null;
      if(e.hook_event_name==='PostToolUseFailure'){match.status='failed';match.finished=now();log(s,'agent_failed',{role:match.role});return null;}
      const r=e.tool_response||{};
      if(r.agentId)match.agent_id=r.agentId;
      if(r.resolvedModel)match.observed_model=r.resolvedModel;
      if(Array.isArray(r.modelsUsed))match.models_used=r.modelsUsed;
      if(Number.isFinite(r.totalDurationMs))match.observed_duration_ms=r.totalDurationMs;
      if(Number.isFinite(r.totalToolUseCount))match.observed_tool_calls=r.totalToolUseCount;
      if(r.usage)match.last_request_usage=r.usage; // explicitly NOT whole-run tokens
      if(r.status==='completed'){match.status='stopped';match.finished=now();const txt=Array.isArray(r.content)?r.content.map(c=>c.text||'').join('\n'):'';const status=[...txt.matchAll(/STATUS:\s*(READY|PARTIAL|BLOCKED)/g)].at(-1)?.[1];if(status)match.reported_status=status;}
      else if(r.status==='async_launched'&&!['stopped','failed','abandoned'].includes(match.status))match.status='running';
      else if(match.status==='reserved')match.status='unknown';
      return null;
    }
    return null;
  });
}
export function handleEvent(root,e) {
  requireThat(e&&typeof e==='object','Hookinvoer ontbreekt.');
  switch(e.hook_event_name) {
    case 'SessionStart': return withState(root,s=>{s.sessions[e.session_id]??={seen:[]};if(e.model)s.sessions[e.session_id].observed_main_model=e.model;log(s,'session_start',{session:e.session_id});return context('SessionStart','AAE v3.2-local geladen. Lees .claude/aae/ENTRY.md. Geen automatische projectaudit. Status: '+JSON.stringify(summary(s)));});
    case 'UserPromptSubmit': return userPrompt(root,e);
    case 'PreToolUse': return preTool(root,e);
    case 'SubagentStart': case 'SubagentStop': case 'PostToolUse': case 'PostToolUseFailure': return lifecycle(root,e);
    case 'Stop': return null; // user controls stop; close command checks evidence
    case 'SessionEnd': return withState(root,s=>{log(s,'session_end',{session:e.session_id});return null;});
    default: throw new Error('Niet-ondersteund AAE hook-event: '+e.hook_event_name);
  }
}
