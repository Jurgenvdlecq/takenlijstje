// Pariteit, stap 1: de namen van alle v3.2-tests uit de baseline halen (basis voor de pariteitsmatrix).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const dir = path.join(root, '.claude/aae/tests');
const uitvoer = path.join(root, 'tools/aae-v33/pariteit/v32-tests.json');

export function testnamen(bron) {
  const namen = [];
  const re = /(?:^|\n)\s*test\((['"`])((?:\\.|(?!\1)[^\\])*)\1/g;
  let m;
  while ((m = re.exec(bron))) namen.push(m[2].replace(/\\(['"`\\])/g, '$1'));
  return namen;
}

test('pariteit: de v3.2-baseline bevat 131 tests, verdeeld over vijf bestanden', () => {
  const per = {};
  for (const f of fs.readdirSync(dir).filter(x => x.endsWith('.test.mjs')).sort()) {
    per[f] = testnamen(fs.readFileSync(path.join(dir, f), 'utf8'));
  }
  const totaal = Object.values(per).flat().length;
  const resultaat = {schema: 1, bron: 'f9bf120 .claude/aae/tests', totaal, per_bestand: per};
  const nieuw = JSON.stringify(resultaat, null, 2) + '\n';
  fs.mkdirSync(path.dirname(uitvoer), {recursive: true});
  const huidig = fs.existsSync(uitvoer) ? fs.readFileSync(uitvoer, 'utf8') : null;
  if (huidig !== nieuw) fs.writeFileSync(uitvoer, nieuw);
  assert.equal(Object.keys(per).length, 5);
  assert.equal(totaal, 131, 'verwacht 131 v3.2-tests, gevonden ' + totaal);
});
