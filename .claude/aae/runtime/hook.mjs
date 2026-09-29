#!/usr/bin/env node
import fs from 'node:fs';
import {fileURLToPath} from 'node:url';
import {handleEvent} from './events.mjs';
const root=fileURLToPath(new URL('../../../',import.meta.url));
try {
  const raw=fs.readFileSync(0,'utf8');
  if(raw.length>4*1024*1024)throw new Error('Hookinvoer te groot.');
  const result=handleEvent(root,JSON.parse(raw));
  if(result)process.stdout.write(JSON.stringify(result)+'\n');
} catch(e) {
  process.stderr.write('AAE blokkeert: '+String(e.message||e).slice(0,1500)+'\n');
  process.exitCode=2;
}
