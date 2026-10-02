// Pariteit (AC2): elke v3.2-test en elke bevinding B1-B6 heeft in v3.3 een benoemde, bestaande test (behouden/aangepast) of een benoemde vervanger (vervallen).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const lees = p => JSON.parse(fs.readFileSync(path.resolve(here, p), 'utf8'));
const v32 = lees('../pariteit/v32-tests.json'), matrix = lees('../pariteit/matrix.json');
const testDir = path.resolve(here, '../payload/.claude/aae/tests');

function titels() {
  const uit = [];
  for (const f of fs.readdirSync(testDir).filter(x => x.endsWith('.test.mjs'))) {
    const bron = fs.readFileSync(path.join(testDir, f), 'utf8');
    for (const m of bron.matchAll(/(?:^|\n)test\(\s*(['"`])((?:\\.|(?!\1)[^\\])*)\1/g)) uit.push(m[2].replace(/\\(['"`\\])/g, '$1'));
  }
  return uit;
}
const alle = titels();
const bestaat = prefix => alle.some(t => t.startsWith(prefix));

test('pariteit: de matrix bevat precies de 131 v3.2-tests, elk één keer', () => {
  const namen = Object.values(v32.per_bestand).flat();
  assert.equal(namen.length, v32.totaal);
  assert.equal(namen.length, 131);
  const inMatrix = matrix.regels.map(r => r.v32);
  assert.equal(new Set(inMatrix).size, inMatrix.length, 'dubbele regel in de matrix');
  assert.deepEqual(namen.filter(n => !inMatrix.includes(n)), [], 'ontbrekend in de matrix');
  assert.deepEqual(inMatrix.filter(n => !namen.includes(n)), [], 'onbekende v3.2-naam in de matrix');
});
test('pariteit: elke regel heeft een geldige status en bestaande v3.3-tests; aangepast en vervallen hebben een toelichting', () => {
  for (const r of matrix.regels) {
    assert.ok(['behouden', 'aangepast', 'vervallen'].includes(r.status), r.v32);
    assert.ok(Array.isArray(r.v33) && r.v33.length > 0, 'geen v3.3-test voor: ' + r.v32);
    for (const p of r.v33) assert.ok(bestaat(p), 'v3.3-test bestaat niet: "' + p + '" (bij: ' + r.v32 + ')');
    if (r.status !== 'behouden') assert.ok(typeof r.toelichting === 'string' && r.toelichting.length >= 15, 'toelichting ontbreekt: ' + r.v32);
  }
});
test('pariteit: de bevindingen B1 t/m B6 hebben elk minstens één bestaande test', () => {
  for (const b of ['B1', 'B2', 'B3', 'B4', 'B5', 'B6']) {
    const x = matrix.bevindingen[b];
    assert.ok(x && x.v33.length > 0, b);
    for (const p of x.v33) assert.ok(bestaat(p), b + ': test bestaat niet: ' + p);
  }
});
test('pariteit: elke 001B-regel (GO-binding en administratieregel) heeft bestaande tests', () => {
  const regels = Object.entries(matrix.wijzigingen_001b.regels);
  assert.ok(regels.length >= 10);
  for (const [naam, codes] of regels) { assert.ok(codes.length > 0, naam); for (const c of codes) assert.ok(alle.some(t => t.startsWith(c + ' ')), '001B-test bestaat niet: ' + c + ' (bij: ' + naam + ')'); }
  for (let i = 1; i <= 17; i++) assert.ok(alle.some(t => t.startsWith('GB' + String(i).padStart(2, '0') + ' ')), 'GB' + i + ' ontbreekt');
});
test('pariteit: elke 001C-regel (reviewbevindingen en durability) heeft bestaande RB-tests', () => {
  // RB09 staat in tools/aae-v33/tests/installer.test.mjs, de rest in de payload.
  const eigen = fs.readdirSync(here).filter(f => f.endsWith('.test.mjs')).flatMap(f => [...fs.readFileSync(path.join(here, f), 'utf8').matchAll(/(?:^|\n)test\(\s*(['"`])((?:\\.|(?!\1)[^\\])*)\1/g)].map(m => m[2]));
  const rb = [...alle, ...eigen];
  const regels = Object.entries(matrix.wijzigingen_001c.regels); assert.equal(regels.length, 10);
  for (const [naam, codes] of regels) { assert.ok(codes.length > 0, naam); for (const c of codes) assert.ok(rb.some(t => t.startsWith(c + ' ')), '001C-test bestaat niet: ' + c + ' (bij: ' + naam + ')'); }
  for (let i = 1; i <= 10; i++) assert.ok(rb.some(t => t.startsWith('RB' + String(i).padStart(2, '0') + ' ')), 'RB' + i + ' ontbreekt');
});
test('pariteit: elke 001D-regel (rereview van 5ba1e59 en hardening) heeft bestaande RD-tests', () => {
  // RD06 staat in tools/aae-v33/tests/installer.test.mjs, de rest in de payload.
  const eigen = fs.readdirSync(here).filter(f => f.endsWith('.test.mjs')).flatMap(f => [...fs.readFileSync(path.join(here, f), 'utf8').matchAll(/(?:^|\n)test\(\s*(['"`])((?:\\.|(?!\1)[^\\])*)\1/g)].map(m => m[2]));
  const rd = [...alle, ...eigen];
  const regels = Object.entries(matrix.wijzigingen_001d.regels); assert.equal(regels.length, 6);
  for (const [naam, codes] of regels) { assert.ok(codes.length > 0, naam); for (const c of codes) assert.ok(rd.some(t => t.startsWith(c + ' ')), '001D-test bestaat niet: ' + c + ' (bij: ' + naam + ')'); }
  for (let i = 1; i <= 6; i++) assert.ok(rd.some(t => t.startsWith('RD' + String(i).padStart(2, '0') + ' ')), 'RD' + i + ' ontbreekt');
});
test('pariteit: scenario\'s T1 t/m T22 bestaan alle als test', () => {
  for (let i = 1; i <= 22; i++) assert.ok(alle.some(t => new RegExp('^T' + i + '[ b]').test(t)), 'T' + i + ' ontbreekt');
});
test('pariteit: het aantal behouden/aangepast/vervallen wordt vastgelegd en vervallen is de uitzondering', () => {
  const n = s => matrix.regels.filter(r => r.status === s).length;
  assert.equal(n('behouden') + n('aangepast') + n('vervallen'), 131);
  assert.ok(n('vervallen') <= 8, 'meer dan 8 vervallen tests: onderbouwing nodig');
  fs.writeFileSync(path.resolve(here, '../pariteit/samenvatting.json'), JSON.stringify({behouden: n('behouden'), aangepast: n('aangepast'), vervallen: n('vervallen'), totaal: 131, v33_tests_in_payload: alle.length}, null, 2) + '\n');
});
