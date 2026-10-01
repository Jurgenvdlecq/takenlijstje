// M0: byte-exacte vaststelling van de v3.2-baseline (f9bf120) en vergelijking met v3.1 (572d263).
// Het resultaat gaat naar tools/aae-v33/baseline/verschillen-v31-v32.json (alleen herschreven als de inhoud verandert).
import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const V32 = 'f9bf1200a9aedfc5e551be3780978f83cda99a64';
const V31 = '572d2635002043bba6370713f246a217a341f7c4';
const uitvoer = path.join(root, 'tools/aae-v33/baseline/verschillen-v31-v32.json');

const git = (...args) => {
  const r = spawnSync('git', args, {cwd: root, encoding: 'buffer', shell: false, maxBuffer: 64 * 1024 * 1024});
  return {code: r.status, out: r.stdout, text: (r.stdout || Buffer.alloc(0)).toString('utf8').trim(), err: (r.stderr || Buffer.alloc(0)).toString('utf8').trim()};
};
const sha256 = buf => crypto.createHash('sha256').update(buf).digest('hex');
const tonen = (rev, p) => git('show', rev + ':' + p);

test('M0: de werkbranch is gebouwd op f9bf120 (v3.2) en .claude is byte-identiek aan die commit', () => {
  const basis = git('merge-base', '--is-ancestor', V32, 'HEAD');
  assert.equal(basis.code, 0, 'f9bf120 is geen voorouder van HEAD');
  for (const p of ['.claude', 'scripts/aae-v3.2', 'CLAUDE.md', '.gitignore']) {
    assert.equal(git('rev-parse', 'HEAD:' + p).text, git('rev-parse', V32 + ':' + p).text, p + ' wijkt af van f9bf120');
  }
});

test('M0: alle beheerde bestanden van v3.2 komen exact overeen met het manifest (managed.json, 3.2.0-local)', () => {
  const m = JSON.parse(fs.readFileSync(path.join(root, '.claude/aae/managed.json'), 'utf8'));
  assert.equal(m.version, '3.2.0-local');
  const afwijkend = [];
  for (const [p, hash] of Object.entries(m.files)) {
    if (sha256(fs.readFileSync(path.join(root, p))) !== hash) afwijkend.push(p);
  }
  assert.deepEqual(afwijkend, []);
  assert.ok(Object.keys(m.files).length >= 40);
});

test('M0: de v3.1-baseline (572d263) komt exact overeen met het v3.1-manifest', () => {
  const m = JSON.parse(tonen(V31, '.claude/aae/managed.json').text);
  assert.equal(m.version, '3.1.0');
  const afwijkend = [];
  for (const [p, hash] of Object.entries(m.files)) {
    const f = tonen(V31, p);
    if (f.code !== 0 || sha256(f.out) !== hash) afwijkend.push(p);
  }
  assert.deepEqual(afwijkend, []);
});

test('M0: verschillen v3.1 → v3.2 zijn vastgelegd en beperkt tot de gedocumenteerde bestanden', () => {
  const lijst = git('diff', '--name-status', V31, V32, '--', '.claude', 'CLAUDE.md', '.gitignore', 'scripts', 'docs/aae', 'docs/PROGRESS.md');
  assert.equal(lijst.code, 0, lijst.err);
  const rijen = lijst.text.split('\n').filter(Boolean).map(r => {
    const [status, ...rest] = r.split('\t');
    const p = rest.at(-1);
    const oud = status.startsWith('A') ? null : sha256(tonen(V31, p).out);
    const nieuw = status.startsWith('D') ? null : sha256(tonen(V32, p).out);
    return {pad: p, status: status[0], sha256_v31: oud, sha256_v32: nieuw};
  });
  const aae = rijen.filter(r => r.pad.startsWith('.claude/'));
  const toegestaan = new Set([
    '.claude/aae/ENTRY.md', '.claude/aae/managed.json',
    '.claude/aae/docs/COMMANDS_AND_LIMITS.md', '.claude/aae/docs/INTEGRATIONS.md', '.claude/aae/docs/WORKFLOW.md', '.claude/aae/docs/LOCAL_CHANGES.md',
    '.claude/aae/runtime/core.mjs', '.claude/aae/runtime/events.mjs', '.claude/aae/runtime/runner.mjs',
    '.claude/aae/tests/guard.test.mjs', '.claude/aae/tests/integrations.test.mjs', '.claude/aae/tests/runner.test.mjs',
    '.claude/aae/templates/TASK.template.json', '.claude/aae/examples/06-werkpakket-met-merge.json'
  ]);
  const onverwacht = aae.map(r => r.pad).filter(p => !toegestaan.has(p));
  assert.deepEqual(onverwacht, [], 'onverwachte .claude-wijzigingen tussen v3.1 en v3.2');
  for (const onveranderd of ['.claude/settings.json', '.claude/aae/runtime/hook.mjs', '.claude/aae/runtime/cli.mjs', '.claude/aae/runtime/integrations.mjs', '.claude/aae/runtime/visual.mjs', '.claude/aae/CATALOG.md']) {
    assert.equal(git('rev-parse', V31 + ':' + onveranderd).text, git('rev-parse', V32 + ':' + onveranderd).text, onveranderd + ' had gelijk moeten blijven');
  }
  for (const p of fs.readdirSync(path.join(root, '.claude/agents'))) {
    assert.equal(git('rev-parse', V31 + ':.claude/agents/' + p).text, git('rev-parse', V32 + ':.claude/agents/' + p).text, 'agentdefinitie ' + p + ' is gewijzigd');
  }
  const resultaat = {
    schema: 1,
    v31_commit: V31,
    v32_commit: V32,
    aantal_gewijzigd_in_claude: aae.length,
    verschillen_claude: aae,
    overige_verschillen: rijen.filter(r => !r.pad.startsWith('.claude/')).map(r => ({pad: r.pad, status: r.status})),
    onveranderd_gebleven: ['.claude/settings.json', 'hook.mjs', 'cli.mjs', 'integrations.mjs', 'visual.mjs', 'CATALOG.md', 'alle 13 agentdefinities']
  };
  const nieuw = JSON.stringify(resultaat, null, 2) + '\n';
  fs.mkdirSync(path.dirname(uitvoer), {recursive: true});
  const huidig = fs.existsSync(uitvoer) ? fs.readFileSync(uitvoer, 'utf8') : null;
  if (huidig !== nieuw) fs.writeFileSync(uitvoer, nieuw);
});
