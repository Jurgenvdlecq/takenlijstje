// Verzamelbestand: laadt alle eigen tests van het werkpakket (baseline, P3, pariteit, ...).
// Reden: Node 22 breidt `node --test <map>` niet meer uit; zo volstaat één bestand als operand.
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';

const dir = path.dirname(fileURLToPath(import.meta.url));
const overslaan = new Set(['eigen.test.mjs', 'ref-v32.test.mjs', 'v33-suite.test.mjs']);
for (const f of fs.readdirSync(dir).sort()) {
  if (f.endsWith('.test.mjs') && !overslaan.has(f)) await import(pathToFileURL(path.join(dir, f)).href);
}
