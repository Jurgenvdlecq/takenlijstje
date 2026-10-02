// Visuele fixturehulp (pariteit V01-V05). V05 is omgevingsonafhankelijk gemaakt: de v3.2-test faalde als Playwright toevallig geïnstalleerd was.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fixture, cleanup, executing} from './helpers.mjs';
import {validateVisual, captureVisual} from '../runtime/visual.mjs';

const c = (extra = {}) => ({schema_version: 1, base_url: 'http://127.0.0.1:3000', scenes: [{id: 'today', path: '/today', expected_path: '/today', expected_visible: '[data-testid="today"]'}], ...extra});
const nepPlaywright = {chromium: {launch: async () => ({close: async () => {}, newContext: async () => ({close: async () => {}, newPage: async () => {
  let u = '';
  return {setDefaultTimeout() {}, goto: async url => { u = url; }, url: () => u, locator: () => ({waitFor: async () => {}, click: async () => {}, fill: async () => {}, press: async () => {}}), screenshot: async ({path: p}) => { fs.writeFileSync(p, 'PNG'); }};
}})})}};

test('V01 een expliciet verwacht scherm en marker zijn verplicht', () => {
  assert.equal(validateVisual(c()).scenes.length, 1);
  assert.throws(() => validateVisual(c({scenes: [{id: 'x', path: '/'}]})), /Verwachte/);
});
test('V02 een remote preview en credentials in de URL zijn niet impliciet toegestaan', () => {
  assert.throws(() => validateVisual(c({base_url: 'https://example.com'})), /Remote/);
  assert.throws(() => validateVisual(c({base_url: 'http://u:p@localhost/'})), /credentials/);
});
test('V03 testauthenticatie buiten de privémap wordt geweigerd', () => {
  assert.throws(() => validateVisual(c({storage_state: 'cookies.json'})), /testauth/);
  assert.doesNotThrow(() => validateVisual(c({storage_state: '.claude/aae/private/demo.json'})));
});
test('V04 geen willekeurige evaluatie en geen dubbele scènes', () => {
  const x = c(); x.scenes[0].steps = [{action: 'evaluate', selector: 'x'}];
  assert.throws(() => validateVisual(x), /Onbekende stap/);
  assert.throws(() => validateVisual(c({scenes: [c().scenes[0], c().scenes[0]]})), /dubbele/);
});
test('V05 geen automatische browser- of afhankelijkheidsinstallatie (omgevingsonafhankelijk)', async () => {
  const bron = fs.readFileSync(new URL('../runtime/visual.mjs', import.meta.url), 'utf8');
  assert.ok(!/child_process|spawn|exec\(|execSync|npm install|npx playwright install/.test(bron), 'visual.mjs start nooit een installatie');
  const root = fixture();
  try {
    executing(root);
    fs.writeFileSync(path.join(root, 'visual.json'), JSON.stringify(c()));
    await assert.rejects(captureVisual(root, 'visual.json', {loadPlaywright: () => { throw new Error('Playwright ontbreekt in dit project. Geen installatie uitgevoerd.'); }}), /Playwright ontbreekt/);
  } finally { cleanup(root); }
});
test('V06 een schermafdruk is alleen bewijs binnen een goedgekeurd werkpakket en wordt als "niet beoordeeld" vastgelegd', async () => {
  const root = fixture();
  try {
    fs.writeFileSync(path.join(root, 'visual.json'), JSON.stringify(c()));
    await assert.rejects(captureVisual(root, 'visual.json', {loadPlaywright: () => nepPlaywright}), /Geen werkpakket in uitvoering/);
    executing(root);
    const r = await captureVisual(root, 'visual.json', {loadPlaywright: () => nepPlaywright});
    assert.equal(r.status, 'CAPTURED_NOT_REVIEWED'); assert.match(r.envelope_hash, /^[0-9a-f]{64}$/);
    assert.ok(fs.existsSync(path.join(root, r.scenes[0].path)));
    assert.ok(fs.existsSync(path.join(root, 'docs/aae/evidence/W-T/visual-manifest.json')));
  } finally { cleanup(root); }
});
