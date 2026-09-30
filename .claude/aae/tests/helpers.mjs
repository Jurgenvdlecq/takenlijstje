import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import crypto from 'node:crypto';
import {handleEvent} from '../runtime/events.mjs';
import {route,TASK,STATE,readJson} from '../runtime/core.mjs';
export const payload=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../../..');
export function put(root,p,body) {const f=path.join(root,p);fs.mkdirSync(path.dirname(f),{recursive:true});fs.writeFileSync(f,typeof body==='string'?body:JSON.stringify(body,null,2));}
export function fixture(t) {
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'aae-test-'));
  // Copy only shipped test dependencies, never the user's app, state, cookies or node_modules.
  for(const rel of ['.claude/aae/runtime','.claude/aae/templates','.claude/aae/docs','.claude/aae/ENTRY.md','.claude/aae/CATALOG.md']) {const dest=path.join(root,rel);fs.mkdirSync(path.dirname(dest),{recursive:true});fs.cpSync(path.join(payload,rel),dest,{recursive:true});}
  put(root,'src/a.js','export const a=1;\n');put(root,'src/b.js','export const b=2;\n');put(root,'package.json',{name:'fixture',scripts:{test:'node -e "console.log(42)"'}});
  t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
  return root;
}
export function ev(root,hook_event_name,extra={}) {return {session_id:'session-1',cwd:root,permission_mode:'default',hook_event_name,...extra};}
export function begin(root,text='Voer de afgebakende testopdracht uit.',extra={}) {
  handleEvent(root,ev(root,'SessionStart'));
  return handleEvent(root,ev(root,'UserPromptSubmit',{prompt:text,...extra}));
}
export function prompt(root,text,extra={}){return handleEvent(root,ev(root,'UserPromptSubmit',{prompt:text,...extra}));}
export function pre(root,tool_name,tool_input,extra={}) {return handleEvent(root,ev(root,'PreToolUse',{tool_name,tool_input,tool_use_id:crypto.randomUUID(),...extra}));}
export function task(overrides={}) {
  const c={schema_version:3,id:'T-001',title:'Gerichte testwijziging',goal:'Een afgebakende wijziging betrouwbaar uitvoeren.',phase:'implementation',mode:'lean',risk:'low',uncertainty:'low',risk_flags:[],scope:{read:['src'],write:['src/a.js']},
    acceptance:[{id:'AC1',text:'De bestaande hoofdregel blijft correct werken.'}],test_plan:['scope','functional','regression'].map(kind=>({kind,method:'inspection',description:'Controleer gericht de bedoelde regel.'})),agents:[],commands:[],integrations:{},budget:{agent_calls:0,max_parallel:1,command_runs:0,external_calls:0},approval_required:false,design_freeze:false,...overrides};
  if(c.phase==='analysis'){c.scope={read:['src'],write:[]};c.test_plan=[{kind:'analysis',method:'inspection',description:'Onderbouw het antwoord met de relevante bron.'}];}
  return c;
}
export function specialist(name='aae-code-reviewer',max_calls=1) {return {name,question:'Bevat deze kleine wijziging een aantoonbare regressie?',files:['src'],deliverable:'Onderbouwd oordeel over de hoofdregel.',stop_when:'De concrete regressievraag is beantwoord.',model:'sonnet',max_calls};}
export function installTask(root,c) {put(root,TASK,c);return route(root);}
export function agent(root,name='aae-code-reviewer',extra={}) {
  const toolId=crypto.randomUUID();const res=pre(root,'Agent',{subagent_type:name,prompt:'Relevante context: beoordeel uitsluitend de afgesproken wijziging.',run_in_background:false,...extra},{tool_use_id:toolId});
  return {toolId,res};
}
export function finish(root,call,name='aae-code-reviewer',report='Controle gereed. STATUS: READY') {
  const id='agent-'+call.toolId;
  handleEvent(root,ev(root,'SubagentStart',{agent_id:id,agent_type:name}));
  handleEvent(root,ev(root,'SubagentStop',{agent_id:id,agent_type:name,last_assistant_message:report}));
  handleEvent(root,ev(root,'PostToolUse',{tool_name:'Agent',tool_use_id:call.toolId,tool_response:{status:'completed',agentId:id,resolvedModel:'fixture-model',content:[{type:'text',text:report}]}}));
  return id;
}
export function state(root){return readJson(root,STATE+'/local.json');}
