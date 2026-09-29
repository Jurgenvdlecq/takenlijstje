#!/usr/bin/env node
import {fileURLToPath} from 'node:url';
import {route,inspect,withState,assertBound,requireThat,sourceDigest} from './core.mjs';
import {runCommand,closeTask,reportTemplate,doctor} from './runner.mjs';
const root=fileURLToPath(new URL('../../../',import.meta.url));
try {
  const [verb,arg,...extra]=process.argv.slice(2);requireThat(extra.length===0,'Te veel argumenten.');
  let result;
  switch(verb) {
    case 'status': requireThat(!arg,'Geen argument verwacht.');result=inspect(root);break;
    case 'route': requireThat(!arg,'Geen argument verwacht.');result=route(root);break;
    case 'doctor': requireThat(!arg,'Geen argument verwacht.');result=doctor(root);break;
    case 'report-template': requireThat(!arg,'Geen argument verwacht.');result=reportTemplate(root);break;
    case 'close': requireThat(!arg,'Geen argument verwacht.');result=closeTask(root);break;
    case 'run': requireThat(arg,'Commando-ID ontbreekt.');result=await runCommand(root,arg);if(result.exit_code!==0)process.exitCode=1;break;
    case 'packet': result=withState(root,s=>{const t=assertBound(root,s),a=t.contract.agents.find(a=>a.name===arg);requireThat(a,'Agent niet geselecteerd.');return {task_id:t.id,route_digest:t.digest,source_digest:sourceDigest(root,t.contract),...a,acceptance:t.contract.acceptance};});break;
    default: throw new Error('Gebruik status | route | doctor | report-template | close | run <id> | packet <agent>.');
  }
  console.log(JSON.stringify(result,null,2));
} catch(e) {console.error('AAE: '+e.message);process.exitCode=2;}
