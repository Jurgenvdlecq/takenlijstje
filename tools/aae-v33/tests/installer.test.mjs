// Installer, overgang en terugdraaien (AC9) op wegwerpkopieën van de echte v3.2-baseline (f9bf120). Er wordt nooit in het echte project geïnstalleerd.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {fileURLToPath, pathToFileURL} from 'node:url';
import {planInstall, apply, planRollback, rollback, payloadFiles, atomicWrite, VERSION} from '../installer/install.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const repo = path.resolve(here, '../../..');
const BASE = 'f9bf1200a9aedfc5e551be3780978f83cda99a64';
const sha = b => crypto.createHash('sha256').update(b).digest('hex');
const git = args => { const r = spawnSync('git', args, {cwd: repo, maxBuffer: 128 * 1024 * 1024}); if (r.status !== 0) throw new Error('git ' + args.join(' ') + ': ' + r.stderr); return r.stdout; };

/** Een kopie van de v3.2-installatie zoals die in f9bf120 staat (bestanden rechtstreeks uit git). */
function v32Project() {
  const dir = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'aae33inst-')));
  const lijst = git(['ls-tree', '-r', '-z', '--name-only', BASE, '.claude', 'CLAUDE.md', '.gitignore']).toString().split('\0').filter(Boolean);
  for (const p of lijst) { const f = path.join(dir, p); fs.mkdirSync(path.dirname(f), {recursive: true}); fs.writeFileSync(f, git(['show', BASE + ':' + p])); }
  fs.mkdirSync(path.join(dir, '.claude/aae/state'), {recursive: true});
  fs.writeFileSync(path.join(dir, '.claude/aae/state/marker.txt'), 'blijft staan');
  fs.mkdirSync(path.join(dir, 'src'), {recursive: true}); fs.writeFileSync(path.join(dir, 'package.json'), '{"name":"kopie","private":true}\n');
  return dir;
}
const alles = (dir, rel = '') => { const d = rel ? path.join(dir, rel) : dir, uit = []; if (!fs.existsSync(d)) return uit; for (const e of fs.readdirSync(d, {withFileTypes: true})) { const r = rel ? rel + '/' + e.name : e.name; if (r === '.aae-backups') continue; if (e.isDirectory()) uit.push(...alles(dir, r)); else uit.push(r); } return uit; };
const boom = dir => Object.fromEntries(alles(dir).sort().map(p => [p, sha(fs.readFileSync(path.join(dir, p)))]));
const metProject = fn => async () => { const dir = v32Project(); try { await fn(dir); } finally { fs.rmSync(dir, {recursive: true, force: true}); } };
const hook = (dir, e) => spawnSync(process.execPath, [path.join(dir, '.claude/aae/runtime/hook.mjs')], {cwd: dir, input: JSON.stringify({session_id: 's1', cwd: dir, ...e}), encoding: 'utf8'});

// Een kleine v3.2-route zoals een lopende taak er in .claude/aae/state/local.json uitziet.
const cmd = (id, argv, purpose, o = {}) => ({id, argv, purpose, why: 'Opdracht ' + id + ' van de lopende route.', watch: [], timeout_ms: 60000, max_runs: 3, ...o});
function zetRoute(dir) {
  const t = {schema_version: 3, id: 'AAE-OUD-1', title: 'Lopende v3.2-route', goal: 'Een oude route die na de overgang gewoon moet doorlopen.', phase: 'implementation', mode: 'standard', risk: 'medium', uncertainty: 'normal', risk_flags: [],
    scope: {read: ['src'], write: ['src']}, acceptance: [{id: 'AC1', text: 'De oude route blijft werken na de overgang.'}],
    test_plan: [{kind: 'scope', method: 'inspection', description: 'Controleer de wijzigingen.'}, {kind: 'functional', method: 'command', description: 'Draai de tests.'}, {kind: 'regression', method: 'command', description: 'Draai de regressietests.'}],
    agents: [], commands: [cmd('t_local', ['node', '--test', 'src/ok.test.mjs'], 'test')], budget: {agent_calls: 2, max_parallel: 1, command_runs: 20, external_calls: 0}, approval_required: true, design_freeze: false, integrations: {}, decision_points: []};
  const s = {version: 3, integrations: {}, task: {id: t.id, digest: 'd1d1d1', contract: structuredClone(t), approval: {digest: 'd1d1d1', at: '2026-09-30T10:00:00.000Z'}, status: 'active', usage: {agents: 0, commands: 2, external: 0}, command_counts: {t_local: 2}, command_receipts: [], approved_commands: {}, external_calls: {}, external_receipts: [], calls: {}}};
  fs.mkdirSync(path.join(dir, 'docs/aae'), {recursive: true});
  fs.writeFileSync(path.join(dir, 'docs/aae/TASK.json'), JSON.stringify(t, null, 2)); fs.writeFileSync(path.join(dir, '.claude/aae/state/local.json'), JSON.stringify(s, null, 2));
  fs.writeFileSync(path.join(dir, 'src/ok.test.mjs'), "import test from 'node:test';\ntest('ok', () => {});\n");
}

test('installer: het plan op een v3.2-installatie heeft geen conflicten, benoemt de wijzigingen en schrijft niets', metProject(dir => {
  const voor = boom(dir), plan = planInstall(dir);
  assert.deepEqual(plan.conflicts, []);
  assert.equal(plan.from, '3.2.0-local'); assert.equal(plan.to, VERSION);
  assert.ok(plan.actions.vervangen.includes('.claude/aae/ENTRY.md'));
  assert.equal(plan.actions.verwijderen.filter(p => p.startsWith('.claude/agents/')).length, 13, 'de dertien oude agents verdwijnen');
  assert.deepEqual(plan.actions.toevoegen.filter(p => p.startsWith('.claude/agents/')).sort(), ['.claude/agents/aae-architect.md', '.claude/agents/aae-product-partner.md', '.claude/agents/aae-reviewer.md']);
  assert.equal(plan.actions.archief, 'docs/archief/aae-3.2.0-local');
  assert.deepEqual(boom(dir), voor, 'een plan wijzigt niets');
}));

test('installer: apply installeert v3.3; instellingen, CLAUDE.md en status blijven ongemoeid; v3.2 staat in het archief', metProject(dir => {
  const voor = boom(dir), r = apply(dir);
  const payload = payloadFiles();
  for (const [rel, f] of payload) assert.equal(sha(fs.readFileSync(path.join(dir, rel))), f.sha, rel);
  const managed = JSON.parse(fs.readFileSync(path.join(dir, '.claude/aae/managed.json'), 'utf8'));
  assert.equal(managed.version, VERSION); assert.equal(VERSION, '3.3.1', 'v3.3.1: de installer meldt dezelfde versie als de runtime in de payload'); assert.deepEqual(Object.keys(managed.files).sort(), [...payload.keys()].sort());
  assert.deepEqual(fs.readdirSync(path.join(dir, '.claude/agents')).sort(), ['aae-architect.md', 'aae-product-partner.md', 'aae-reviewer.md']);
  for (const p of ['.claude/settings.json', 'CLAUDE.md', '.claude/aae/state/marker.txt']) assert.equal(sha(fs.readFileSync(path.join(dir, p))), voor[p], p + ' is ongewijzigd');
  assert.equal(sha(fs.readFileSync(path.join(dir, 'docs/archief/aae-3.2.0-local/aae/ENTRY.md'))), voor['.claude/aae/ENTRY.md'], 'archief bevat de v3.2-versie');
  assert.ok(fs.existsSync(path.join(dir, 'docs/archief/aae-3.2.0-local/agents/aae-supervisor.md')));
  const gi = fs.readFileSync(path.join(dir, '.gitignore'), 'utf8');
  assert.ok(gi.includes('/docs/aae/work/*/state.json') && gi.includes('# >>> AAE 3.3'));
  const giOud = git(['show', BASE + ':.gitignore']).toString();
  assert.ok(gi.startsWith(giOud), 'bestaande .gitignore-regels blijven vooraan en onaangeroerd');
  const restore = JSON.parse(fs.readFileSync(path.join(dir, r.backup, 'RESTORE.json'), 'utf8'));
  assert.equal(restore.status, 'applied'); assert.ok(restore.files.length > 20);
  const doc = spawnSync(process.execPath, [path.join(dir, '.claude/aae/runtime/cli.mjs'), 'doctor'], {cwd: dir, encoding: 'utf8'});
  assert.equal(doc.status, 0);
  assert.ok(JSON.parse(doc.stdout).checks.every(c => c.status === 'PASS'), doc.stdout);
}));

test('installer: een tweede installatie is een no-op', metProject(dir => {
  apply(dir);
  const plan = planInstall(dir);
  assert.equal(plan.noop, true); assert.deepEqual(plan.conflicts, []);
  assert.equal(apply(dir).noop, true);
}));

test('overgang: een lopende v3.2-route wacht na installatie op een expliciete GO (eenmalige migratiegrens), werkt daarna door binnen het oude gebied en de v3.2-bestanden blijven staan', metProject(dir => {
  zetRoute(dir);
  const taak = sha(fs.readFileSync(path.join(dir, 'docs/aae/TASK.json'))), staat = sha(fs.readFileSync(path.join(dir, '.claude/aae/state/local.json')));
  apply(dir);
  const status = hook(dir, {hook_event_name: 'UserPromptSubmit', prompt: 'AAE STATUS'});
  assert.equal(status.status, 0, status.stderr);
  assert.match(JSON.parse(status.stdout).hookSpecificOutput.additionalContext, /AAE-OUD-1 wacht op jouw GO/);
  const schrijf = () => hook(dir, {hook_event_name: 'PreToolUse', tool_name: 'Write', tool_use_id: 't1', tool_input: {file_path: path.join(dir, 'src/nieuw.js'), content: 'x'}});
  assert.equal(schrijf().status, 2, 'de v3.2-GO telt niet: zonder nieuwe GO geen schrijfrechten');
  assert.equal(hook(dir, {hook_event_name: 'UserPromptSubmit', prompt: 'AAE GO AAE-OUD-1 123456789abc'}).status, 0);
  assert.equal(schrijf().status, 2, 'een GO zonder getoond voorstel keurt niets goed');
  const toon = spawnSync(process.execPath, [path.join(dir, '.claude/aae/runtime/cli.mjs'), 'present', 'AAE-OUD-1'], {cwd: dir, encoding: 'utf8'});
  assert.equal(toon.status, 0, toon.stderr);
  const go = hook(dir, {hook_event_name: 'UserPromptSubmit', prompt: JSON.parse(toon.stdout).exacte_go});
  assert.equal(go.status, 0, go.stderr); assert.match(JSON.parse(go.stdout).hookSpecificOutput.additionalContext, /GO geldt voor AAE-OUD-1/);
  assert.equal(schrijf().status, 0, 'na de expliciete GO mag schrijven in het oude gebied');
  const buiten = hook(dir, {hook_event_name: 'PreToolUse', tool_name: 'Write', tool_use_id: 't2', tool_input: {file_path: path.join(dir, 'app/x.ts'), content: 'x'}});
  assert.equal(buiten.status, 2); assert.match(buiten.stderr, /buiten de goedgekeurde gebieden/);
  assert.equal(hook(dir, {hook_event_name: 'PreToolUse', tool_name: 'Bash', tool_use_id: 't3', tool_input: {command: 'node .claude/aae/runtime/cli.mjs run t_local'}}).status, 0);
  const run = spawnSync(process.execPath, [path.join(dir, '.claude/aae/runtime/cli.mjs'), 'run', 't_local'], {cwd: dir, encoding: 'utf8'});
  assert.equal(run.status, 0, run.stdout + run.stderr);
  assert.equal(sha(fs.readFileSync(path.join(dir, 'docs/aae/TASK.json'))), taak, 'TASK.json is onaangeroerd'); assert.equal(sha(fs.readFileSync(path.join(dir, '.claude/aae/state/local.json'))), staat, 'local.json is onaangeroerd');
}));

test('installer: een gewijzigd beheerd bestand geeft een conflict en er verandert niets', metProject(dir => {
  fs.appendFileSync(path.join(dir, '.claude/aae/docs/WORKFLOW.md'), '\neigen aanvulling\n');
  const voor = boom(dir), plan = planInstall(dir);
  assert.ok(plan.conflicts.some(c => c.includes('.claude/aae/docs/WORKFLOW.md')));
  assert.throws(() => apply(dir), /Conflicten/);
  assert.deepEqual(boom(dir), voor);
  assert.equal(fs.existsSync(path.join(dir, '.aae-backups')), false);
}));
test('installer: onbekende installaties, ontbrekende hooks, een Stop-hook en een lock geven conflicten', metProject(dir => {
  fs.writeFileSync(path.join(dir, '.claude/aae/eigen.txt'), 'x');
  assert.ok(planInstall(dir).conflicts.some(c => c.includes('onbekend bestand')));
  fs.rmSync(path.join(dir, '.claude/aae/eigen.txt'));
  const s = JSON.parse(fs.readFileSync(path.join(dir, '.claude/settings.json'), 'utf8')); const hooks = s.hooks; delete hooks.SubagentStop; hooks.Stop = [{hooks: [{type: 'command', command: 'node', args: ['${CLAUDE_PROJECT_DIR}/.claude/aae/runtime/hook.mjs']}]}];
  fs.writeFileSync(path.join(dir, '.claude/settings.json'), JSON.stringify(s));
  const c = planInstall(dir).conflicts.join(' | ');
  assert.match(c, /hook ontbreekt in settings\.json: SubagentStop/); assert.match(c, /Stop-hook/);
  fs.mkdirSync(path.join(dir, '.claude/aae/state/lock'));
  assert.match(planInstall(dir).conflicts.join(' | '), /vergrendeling/);
}));

test('installer: een fout halverwege draait alles terug (geen half geïnstalleerde toestand)', metProject(dir => {
  const voor = boom(dir);
  for (const na of [1, 5, 20, 60]) {
    assert.throws(() => apply(dir, {failAfter: na}), /Gesimuleerde fout/);
    assert.deepEqual(boom(dir), voor, 'na een fout bij stap ' + na);
    assert.equal(fs.existsSync(path.join(dir, '.aae-backups')) && fs.readdirSync(path.join(dir, '.aae-backups')).length > 0, false, 'geen achtergebleven back-up');
    assert.equal(fs.existsSync(path.join(dir, 'docs/archief')), false, 'geen achtergebleven archief');
  }
}));

test('rollback: de v3.2-bestanden komen byte-exact terug, het archief verdwijnt, de status blijft', metProject(dir => {
  zetRoute(dir);
  const voor = boom(dir), r = apply(dir);
  assert.notDeepEqual(boom(dir), voor);
  const plan = planRollback(dir, r.backup);
  assert.deepEqual(plan.conflicts, []);
  const uit = rollback(dir, r.backup);
  assert.ok(uit.hersteld > 20);
  assert.deepEqual(boom(dir), voor, 'volledige boom gelijk aan de v3.2-situatie');
  assert.equal(JSON.parse(fs.readFileSync(path.join(dir, r.backup, 'RESTORE.json'), 'utf8')).status, 'rolled_back');
  assert.throws(() => planRollback(dir, r.backup), /niet "applied"/, 'een back-up draait maar één keer terug');
  // en opnieuw installeren kan daarna gewoon
  assert.equal(planInstall(dir).conflicts.length, 0);
}));
test('rollback: weigert bestanden te overschrijven die na de installatie zijn gewijzigd', metProject(dir => {
  const r = apply(dir);
  fs.appendFileSync(path.join(dir, '.claude/aae/ENTRY.md'), '\nnieuwe eigen regel\n');
  const na = boom(dir), plan = planRollback(dir, r.backup);
  assert.ok(plan.conflicts.some(c => c.includes('.claude/aae/ENTRY.md')));
  assert.throws(() => rollback(dir, r.backup), /Conflicten/);
  assert.deepEqual(boom(dir), na);
}));
test('rollback: een beschadigde back-upblob of een onveilig pad in RESTORE.json wordt herkend', metProject(dir => {
  const r = apply(dir), rf = path.join(dir, r.backup, 'RESTORE.json'), x = JSON.parse(fs.readFileSync(rf, 'utf8'));
  const blob = x.files.find(e => e.before).before; fs.writeFileSync(path.join(dir, r.backup, 'blobs', blob), 'beschadigd');
  assert.ok(planRollback(dir, r.backup).conflicts.some(c => c.includes('beschadigd')));
  x.files.push({path: '../buiten.txt', before: null, after: null, mode: null}); fs.writeFileSync(rf, JSON.stringify(x));
  assert.ok(planRollback(dir, r.backup).conflicts.some(c => c.includes('Onveilig pad')));
  assert.throws(() => planRollback(dir, '../ergens'), /Ongeldig back-uppad/);
  assert.throws(() => planRollback(dir, '.aae-backups/..'), /Ongeldig back-uppad/);
  assert.throws(() => planRollback(dir, '.aae-backups/.'), /Ongeldig back-uppad/);
}));
test('rollback (review): eigen regels in .gitignore na de installatie blokkeren het terugdraaien niet; alleen het beheerde blok verdwijnt', metProject(dir => {
  const voor = boom(dir), r = apply(dir);
  fs.appendFileSync(path.join(dir, '.gitignore'), '\n/eigen-map/\n');
  const plan = planRollback(dir, r.backup);
  assert.deepEqual(plan.conflicts, []);
  rollback(dir, r.backup);
  const na = boom(dir), gi = fs.readFileSync(path.join(dir, '.gitignore'), 'utf8');
  assert.ok(gi.includes('/eigen-map/') && !gi.includes('AAE 3.3'), 'eigen regel blijft, blok weg');
  for (const p of Object.keys(voor)) if (p !== '.gitignore') assert.equal(na[p], voor[p], p);
  assert.ok(gi.startsWith(git(['show', BASE + ':.gitignore']).toString()), 'de oorspronkelijke regels staan er nog ongewijzigd');
}));
test('rollback: is zelf atomair; een fout halverwege laat de v3.3-installatie intact', metProject(dir => {
  const r = apply(dir), na = boom(dir);
  assert.throws(() => rollback(dir, r.backup, {failAfter: 7}), /Gesimuleerde fout/);
  assert.deepEqual(boom(dir), na);
  assert.equal(rollback(dir, r.backup).backup, r.backup);
}));

test('installer-CLI: zonder --apply wordt niets gewijzigd; met conflicten eindigt hij met een foutcode', metProject(dir => {
  const voor = boom(dir), script = path.join(here, '../installer/install.mjs');
  const plan = spawnSync(process.execPath, [script, '--project', dir], {encoding: 'utf8'});
  assert.equal(plan.status, 0, plan.stderr); assert.match(plan.stdout, /Voer opnieuw uit met --apply/);
  assert.deepEqual(boom(dir), voor);
  fs.appendFileSync(path.join(dir, '.claude/aae/docs/WORKFLOW.md'), 'x');
  const slecht = spawnSync(process.execPath, [script, '--project', dir, '--apply'], {encoding: 'utf8'});
  assert.notEqual(slecht.status, 0); assert.match(slecht.stderr + slecht.stdout, /onderling|Conflict|gewijzigd/i);
  assert.equal(spawnSync(process.execPath, [script, '--project', dir, '--bestaat-niet'], {encoding: 'utf8'}).status, 2);
}));
test('installer: de payload bevat alleen .claude-bestanden, geen symlinks, precies drie agents en geen Stop-logica', () => {
  const p = payloadFiles();
  for (const rel of p.keys()) assert.ok(rel.startsWith('.claude/'), rel);
  assert.deepEqual([...p.keys()].filter(r => r.startsWith('.claude/agents/')).sort(), ['.claude/agents/aae-architect.md', '.claude/agents/aae-product-partner.md', '.claude/agents/aae-reviewer.md']);
  assert.ok(!p.has('.claude/settings.json'), 'settings.json hoort niet bij de payload');
});

// ---- RB09: crash-safe installeren en terugdraaien ----
const manifestVan = (dir, rel) => JSON.parse(fs.readFileSync(path.join(dir, rel, 'RESTORE.json'), 'utf8'));
const backups = dir => fs.existsSync(path.join(dir, '.aae-backups')) ? fs.readdirSync(path.join(dir, '.aae-backups')).map(n => '.aae-backups/' + n) : [];
test('RB09 een kill halverwege apply (de reviewopdracht: RESTORE.json stond pas aan het eind) laat een bruikbaar terugdraaimanifest achter; --rollback herstelt byte-exact en daarna kan opnieuw worden geïnstalleerd', metProject(dir => {
  const voor = boom(dir), installer = pathToFileURL(path.join(here, '../installer/install.mjs')).href;
  const kill = spawnSync(process.execPath, ['--input-type=module', '-e', "import('" + installer + "').then(m => m.apply(" + JSON.stringify(dir) + ", {crashAfter: 7}))"], {encoding: 'utf8'});
  assert.ok(kill.signal === 'SIGKILL' || kill.status !== 0, 'het proces is hard gestopt halverwege');
  assert.notDeepEqual(boom(dir), voor, 'er staat een gedeeltelijke installatie');
  const [rel] = backups(dir); assert.ok(rel, 'er staat een back-up');
  assert.equal(manifestVan(dir, rel).status, 'in_progress', 'het manifest stond al vóór de eerste mutatie op schijf');
  assert.match(planInstall(dir).conflicts.join(' | '), /onafgemaakte installatie.*--rollback/, 'een nieuwe installatie weigert en wijst op terugdraaien');
  const plan = planRollback(dir, rel); assert.deepEqual(plan.conflicts, [], plan.conflicts.join('; ')); assert.ok(plan.notes.some(n => /onderbroken installatie/.test(n)));
  rollback(dir, rel);
  assert.deepEqual(boom(dir), voor, 'volledig terug in de v3.2-toestand');
  assert.equal(manifestVan(dir, rel).status, 'rolled_back');
  assert.equal(planInstall(dir).conflicts.length, 0); apply(dir);
}));
test('RB09 een falende undo-stap laat de back-up staan (status undo_failed) en het terugdraaien daarna lukt wel', metProject(dir => {
  const voor = boom(dir);
  assert.throws(() => apply(dir, {failAfter: 30, failUndoAfter: 3}), /niet volledig gelukt[\s\S]*undo_failed[\s\S]*--rollback/);
  const lijst = backups(dir); assert.equal(lijst.length, 1, 'de back-up is niet verwijderd');
  const m = manifestVan(dir, lijst[0]); assert.equal(m.status, 'undo_failed'); assert.ok(m.undo_failures.length > 0);
  assert.ok(fs.readdirSync(path.join(dir, lijst[0], 'blobs')).length > 0, 'de blobs zijn er nog');
  assert.match(planInstall(dir).conflicts.join(' | '), /onafgemaakte installatie/);
  rollback(dir, lijst[0]);
  assert.deepEqual(boom(dir), voor);
}));
test('RB09 een onderbroken rollback is herhaalbaar (het manifest blijft ongewijzigd tot het klaar is)', metProject(dir => {
  const voor = boom(dir), r = apply(dir);
  assert.throws(() => rollback(dir, r.backup, {failAfter: 5}), /Gesimuleerde fout/);
  assert.equal(manifestVan(dir, r.backup).status, 'applied');
  rollback(dir, r.backup); assert.deepEqual(boom(dir), voor);
}));
test('RB09 een geslinkte .claude (of .gitignore) wordt als wortel geweigerd; een downgrade wordt geweigerd; een handmatig bewerkt .gitignore blokkeert het terugdraaien niet', metProject(dir => {
  const andere = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'aae33link-')));
  try {
    fs.symlinkSync(path.join(dir, '.claude'), path.join(andere, '.claude'));
    assert.match(planInstall(andere).conflicts.join(' | '), /Symbolische link niet toegestaan als wortel: \.claude/);
    assert.throws(() => apply(andere), /Conflicten[\s\S]*Symbolische link/);
  } finally { fs.rmSync(andere, {recursive: true, force: true}); }
  const voor = boom(dir), r = apply(dir);
  // handmatig bewerkt .gitignore: het beheerde blok staat zonder afsluitende newline
  const gi = path.join(dir, '.gitignore'); fs.writeFileSync(gi, fs.readFileSync(gi, 'utf8').replace(/\n$/, ''));
  assert.deepEqual(planRollback(dir, r.backup).conflicts, []);
  rollback(dir, r.backup); assert.ok(!fs.readFileSync(gi, 'utf8').includes('AAE 3.3'));
  assert.deepEqual(boom(dir), voor);
  // downgrade
  const r2 = apply(dir), mf = path.join(dir, '.claude/aae/managed.json'), m = JSON.parse(fs.readFileSync(mf, 'utf8')); m.version = '3.9.0'; fs.writeFileSync(mf, JSON.stringify(m, null, 2) + '\n');
  assert.match(planInstall(dir).conflicts.join(' | '), /downgrade/); assert.ok(r2.backup);
}));
// ---- RD06 (001D): elke schrijfactie van de installer is atomair ----
const INSTALLER = pathToFileURL(path.join(here, '../installer/install.mjs')).href;
const kindApply = (dir, cfg) => spawnSync(process.execPath, ['--input-type=module', '-e', "import('" + INSTALLER + "').then(m => m.apply(" + JSON.stringify(dir) + ", " + JSON.stringify(cfg) + "))"], {encoding: 'utf8'});
const kindRollback = (dir, rel, cfg) => spawnSync(process.execPath, ['--input-type=module', '-e', "import('" + INSTALLER + "').then(m => m.rollback(" + JSON.stringify(dir) + ", " + JSON.stringify(rel) + ", " + JSON.stringify(cfg) + "))"], {encoding: 'utf8'});
const tmpRestjes = dir => alles(dir).filter(p => /(^|\/)\.aae-tmp-[0-9a-f]{8}-/.test(p));
const geenHalveBestanden = (dir, voor) => { for (const [rel, f] of payloadFiles()) { const p = path.join(dir, rel); if (!fs.existsSync(p)) continue; const h = sha(fs.readFileSync(p)); assert.ok(h === f.sha || h === voor[rel], 'een half of onbekend bestand op een doelpad: ' + rel); } };
test('RD06 een kill midden in een bestand (voor of na het hernoemen) is altijd terug te draaien naar de oorspronkelijke staat, zonder half bestand of tijdelijk restje', metProject(dir => {
  const voor = boom(dir); let midden = 0, gedood = 0;
  for (const punt of ['temp', 'rename']) for (const na of [0, 1, 2, 3, 5, 8, 13, 21, 40, 70, 110, 160, 230, 320]) {
    const kill = kindApply(dir, {crashInWrite: {na, punt}});
    if (kill.signal === 'SIGKILL') { gedood++; if (tmpRestjes(dir).length) midden++; } else assert.equal(kill.status, 0, kill.stderr);
    geenHalveBestanden(dir, voor);
    const rel = backups(dir).sort().at(-1);
    if (!rel ||!fs.existsSync(path.join(dir, rel, 'RESTORE.json'))) { assert.deepEqual(boom(dir), voor, 'nog niets gemuteerd (' + punt + ' ' + na + ')'); continue; }
    const plan = planRollback(dir, rel); assert.deepEqual(plan.conflicts, [], punt + ' ' + na + ': ' + plan.conflicts.join('; '));
    rollback(dir, rel);
    assert.deepEqual(boom(dir), voor, 'volledig terug in de v3.2-toestand na een kill (' + punt + ' ' + na + ')'); assert.deepEqual(tmpRestjes(dir), []);
  }
  assert.ok(gedood > 10, 'de meeste runs zijn echt gedood halverwege: ' + gedood); assert.ok(midden > 0, 'er is minstens één keer midden in een bestand gedood (er bleef een tijdelijk restje)');
  assert.equal(planInstall(dir).conflicts.length, 0, 'daarna kan gewoon opnieuw worden geïnstalleerd'); apply(dir);
}));
test('RD06 een kill tijdens het terugzetten laat nooit een half bestand achter en het terugdraaien is daarna gewoon te herhalen', metProject(dir => {
  const voor = boom(dir), r = apply(dir), na0 = boom(dir);
  let gedood = 0;
  for (const punt of ['temp', 'rename']) for (const na of [0, 1, 2, 4, 7, 12]) {
    const kill = kindRollback(dir, r.backup, {crashInWrite: {na, punt}});
    if (kill.signal !== 'SIGKILL') { // minder schrijfacties dan `na`: het terugdraaien is gewoon klaar
      assert.equal(kill.status, 0, kill.stderr); assert.deepEqual(boom(dir), voor); assert.equal(manifestVan(dir, r.backup).status, 'rolled_back');
      apply(dir); Object.assign(r, {backup: backups(dir).sort().at(-1)}); continue;
    }
    gedood++;
    const plan = planRollback(dir, r.backup); assert.deepEqual(plan.conflicts, [], punt + ' ' + na + ': ' + plan.conflicts.join('; '));
    geenHalveBestanden(dir, voor);
    // het manifest staat nog open en het terugdraaien kan gewoon opnieuw
    assert.notEqual(manifestVan(dir, r.backup).status, 'rolled_back');
    rollback(dir, r.backup);
    assert.deepEqual(boom(dir), voor, 'volledig terug na een kill tijdens het terugzetten (' + punt + ' ' + na + ')'); assert.deepEqual(tmpRestjes(dir), []);
    apply(dir); // opnieuw installeren voor de volgende ronde; de vorige back-up is al teruggedraaid
    Object.assign(r, {backup: backups(dir).sort().at(-1)});
  }
  assert.ok(gedood > 0, 'minstens één rollback is echt gedood halverwege'); assert.ok(Object.keys(na0).length > 0);
}));
test('RD06 de schrijfactie vervangt een symlink op de doelplek en volgt hem nooit; een symlink in het AAE-gebied is bovendien een conflict', metProject(dir => {
  const buiten = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'aae33victim-')));
  try {
    const slachtoffer = path.join(buiten, 'geheim.txt'); fs.writeFileSync(slachtoffer, 'ORIGINEEL');
    const doel = path.join(dir, 'link-doel.txt'); fs.symlinkSync(slachtoffer, doel);
    atomicWrite(doel, 'NIEUW', 0o644);
    assert.equal(fs.readFileSync(slachtoffer, 'utf8'), 'ORIGINEEL', 'het bestand achter de symlink is niet overschreven');
    assert.equal(fs.lstatSync(doel).isSymbolicLink(), false, 'de symlink is vervangen'); assert.equal(fs.readFileSync(doel, 'utf8'), 'NIEUW'); assert.equal(fs.statSync(doel).mode & 0o777, 0o644);
    assert.deepEqual(fs.readdirSync(dir).filter(n => n.startsWith('.aae-tmp-')), [], 'geen restje');
    // een symlink op een bestand binnen het AAE-gebied: de installatie weigert en schrijft niets
    const voor = boom(dir), eerste = alles(dir, '.claude/aae')[0] || alles(dir, '.claude')[0];
    const p = path.join(dir, eerste); fs.rmSync(p); fs.symlinkSync(slachtoffer, p);
    assert.throws(() => apply(dir), /Conflicten[\s\S]*Symbolische link/);
    assert.equal(fs.readFileSync(slachtoffer, 'utf8'), 'ORIGINEEL'); assert.ok(voor && fs.lstatSync(p).isSymbolicLink());
  } finally { fs.rmSync(buiten, {recursive: true, force: true}); }
}));
test('RD06 het terugdraaimanifest en de blobs gaan ook atomair: een kill vóór het eerste manifest laat niets gemuteerd achter en een nieuwe installatie werkt', metProject(dir => {
  const voor = boom(dir);
  const kill = kindApply(dir, {crashInWrite: {na: 0, punt: 'temp'}});
  assert.equal(kill.signal, 'SIGKILL', kill.stderr);
  assert.deepEqual(boom(dir), voor, 'niets gemuteerd');
  assert.equal(planInstall(dir).conflicts.length, 0, 'geen onafgemaakte installatie die eerst teruggedraaid moet worden: ' + planInstall(dir).conflicts.join('; '));
  apply(dir);
}));
test('overgang (echte state): een kopie van de echte lopende route wordt overgenomen en blijft werken', async t => {
  const taakBron = path.join(repo, 'docs/aae/TASK.json'), staatBron = path.join(repo, '.claude/aae/state/local.json');
  let taak, staat;
  try { taak = JSON.parse(fs.readFileSync(taakBron, 'utf8')); staat = JSON.parse(fs.readFileSync(staatBron, 'utf8')); } catch { return t.skip('geen echte v3.2-state in deze werkmap'); }
  if (taak.schema_version !== 3 || staat.version !== 3 || !staat.task || staat.task.id !== taak.id) return t.skip('de werkmap bevat geen lopende v3.2-route');
  const dir = v32Project();
  try {
    fs.mkdirSync(path.join(dir, 'docs/aae'), {recursive: true});
    fs.copyFileSync(taakBron, path.join(dir, 'docs/aae/TASK.json')); fs.copyFileSync(staatBron, path.join(dir, '.claude/aae/state/local.json'));
    const gebied = taak.scope.write[0];
    fs.mkdirSync(path.join(dir, gebied), {recursive: true});
    const voor = boom(dir), taakHash = sha(fs.readFileSync(path.join(dir, 'docs/aae/TASK.json'))), staatHash = sha(fs.readFileSync(path.join(dir, '.claude/aae/state/local.json')));
    const inst = apply(dir);
    const status = hook(dir, {hook_event_name: 'UserPromptSubmit', prompt: 'AAE STATUS'});
    assert.equal(status.status, 0, status.stderr);
    const tekst = JSON.parse(status.stdout).hookSpecificOutput.additionalContext;
    const actief = staat.task.status === 'active';
    // Eenmalige migratiegrens: een lopende v3.2-route wordt nooit stil goedgekeurd; ze wacht op een expliciete GO met ID en korte hash.
    if (actief) assert.match(tekst, new RegExp(taak.id + ' wacht op jouw GO'));
    const werk = JSON.parse(fs.readFileSync(path.join(dir, 'docs/aae/work', taak.id, 'state.json'), 'utf8'));
    assert.equal(werk.legacy, true); assert.notEqual(werk.status, 'BLOCKED', 'de overgenomen route past in v3.3: ' + JSON.stringify(werk.blockers));
    if (actief) { assert.equal(werk.status, 'WAITING_FOR_APPROVAL'); assert.equal(werk.approved, null); }
    const kopie = JSON.parse(fs.readFileSync(path.join(dir, '.claude/aae/state/local.json'), 'utf8'));
    assert.equal(werk.usage.agents, kopie.task.usage.agents); assert.equal(werk.usage.commands, kopie.task.usage.commands);
    const schrijf = (id, rel) => hook(dir, {hook_event_name: 'PreToolUse', tool_name: 'Write', tool_use_id: id, tool_input: {file_path: path.join(dir, rel), content: 'x'}}).status;
    const voorGo = actief ? schrijf('t0', gebied + '/proef.txt') : 2;
    assert.equal(voorGo, 2, 'zonder nieuwe GO geen schrijfrechten');
    let toegestaan = 0;
    if (actief) {
      const toon = spawnSync(process.execPath, [path.join(dir, '.claude/aae/runtime/cli.mjs'), 'present', taak.id], {cwd: dir, encoding: 'utf8'});
      assert.equal(toon.status, 0, toon.stderr);
      const go = hook(dir, {hook_event_name: 'UserPromptSubmit', prompt: JSON.parse(toon.stdout).exacte_go});
      assert.equal(go.status, 0, go.stderr); assert.match(JSON.parse(go.stdout).hookSpecificOutput.additionalContext, /GO geldt voor/);
      toegestaan = schrijf('t1', gebied + '/proef.txt');
    }
    const buiten = schrijf('t2', 'app/proef.txt');
    assert.equal(toegestaan, 0); assert.equal(buiten, 2);
    const onaangeroerd = sha(fs.readFileSync(path.join(dir, 'docs/aae/TASK.json'))) === taakHash && sha(fs.readFileSync(path.join(dir, '.claude/aae/state/local.json'))) === staatHash;
    assert.equal(onaangeroerd, true, 'de v3.2-routebestanden blijven onaangeroerd');
    // Terugdraaien blijft kunnen, ook met een overgenomen route: de v3.2-bestanden komen byte-exact terug (de v3.3-voortgang staat apart in docs/aae/work).
    const plan = planRollback(dir, inst.backup);
    assert.deepEqual(plan.conflicts, []); assert.ok(plan.notes.length >= 1, 'waarschuwt dat voortgang na de installatie alleen in docs/aae/work staat');
    rollback(dir, inst.backup);
    const na = boom(dir);
    for (const p of Object.keys(voor)) assert.equal(na[p], voor[p], 'na terugdraaien gelijk: ' + p);
    for (const p of Object.keys(na)) if (!Object.hasOwn(voor, p)) assert.ok(p.startsWith('docs/aae/work/') || p.startsWith('.claude/aae/state/'), 'alleen v3.3-voortgang en -status mogen overblijven: ' + p);
    const evidence = {schema: 2, bron: 'kopie van docs/aae/TASK.json en .claude/aae/state/local.json van de werkmap (alleen gelezen, in een wegwerpkopie)', route_overgenomen: taak.id, status_na_overgang: werk.status, go_stil_overgenomen: Boolean(werk.approved), expliciete_go_nodig_na_migratie: true, verbruik_overgenomen: true,
      schrijven_zonder_nieuwe_go_geweigerd: voorGo === 2, schrijven_in_gebied_na_go_toegestaan: toegestaan === 0, schrijven_buiten_gebied_geweigerd: buiten === 2, v32_bestanden_onaangeroerd: onaangeroerd, terugdraaien_getest: true};
    const doel = path.join(here, '../evidence/overgang-echte-state.json'), nieuw = JSON.stringify(evidence, null, 2) + '\n';
    if (!fs.existsSync(doel) || fs.readFileSync(doel, 'utf8') !== nieuw) fs.writeFileSync(doel, nieuw);
  } finally { fs.rmSync(dir, {recursive: true, force: true}); }
});
