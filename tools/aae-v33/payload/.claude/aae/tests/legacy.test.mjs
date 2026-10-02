// Overgang van een lopende v3.2-route naar v3.3 (AC9: de lopende route blijft werken).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fixture, cleanup, put, st, prompt, go, pre, write, bash, hook, denies} from './helpers.mjs';
import {importLegacy, adaptLegacyContract, mapRole} from '../runtime/legacy.mjs';
import {validateContract} from '../runtime/core.mjs';
import {loadWork} from '../runtime/state.mjs';
import {runCommand} from '../runtime/runner.mjs';

const cmd = (id, argv, purpose, o = {}) => ({id, argv, purpose, why: 'Opdracht ' + id + ' van de lopende route.', watch: [], timeout_ms: 60000, max_runs: 3, ...o});
function v32Task(over = {}) {
  return {
    schema_version: 3, id: 'AAE-OUD-1', title: 'Lopende v3.2-route', goal: 'Een oude route die na de overgang gewoon moet doorlopen.', phase: 'implementation', mode: 'high-assurance', risk: 'high', uncertainty: 'normal',
    risk_flags: ['external_effects', 'background_jobs'],
    scope: {read: ['src', 'docs/aae'], write: ['src', 'docs/PROGRESS.md']},
    acceptance: [{id: 'AC1', text: 'De oude route blijft werken na de overgang.'}],
    test_plan: [
      {kind: 'scope', method: 'inspection', description: 'Controleer de wijzigingen.'}, {kind: 'functional', method: 'command', description: 'Draai de tests.'}, {kind: 'regression', method: 'command', description: 'Draai de regressietests.'},
      {kind: 'failure-handling', method: 'command', description: 'Faalpaden.'}, {kind: 'idempotency', method: 'command', description: 'Dubbele events.'}, {kind: 'retry', method: 'command', description: 'Herstarten.'}
    ],
    agents: [
      {name: 'aae-security-reviewer', question: 'Beoordeel de bewaking.', files: ['src'], deliverable: 'Lijst met bevindingen en verdict.', stop_when: 'Klaar met het onderdeel.', model: 'sonnet', max_calls: 4},
      {name: 'aae-code-reviewer', question: 'Controleer pariteit.', files: ['src'], deliverable: 'Lijst met bevindingen en verdict.', stop_when: 'Klaar met het onderdeel.', model: 'sonnet', max_calls: 4}
    ],
    commands: [
      cmd('t_local', ['node', '--test', 'src/ok.test.mjs'], 'test'),
      cmd('stage', ['git', 'add', '-A', '--', 'src', 'docs/PROGRESS.md'], 'build'),
      cmd('commit', ['git', 'commit', '-m', 'Tussenstand', '-m', 'Toelichting'], 'build'),
      cmd('push_1', ['git', 'push', '-u', 'origin', 'claude/oud-1'], 'publish', {max_runs: 1}),
      cmd('gate', ['git', 'push', 'origin', 'claude/oud-1:main'], 'publish', {max_runs: 1, gate: 'ready'}),
      cmd('setup', ['git', 'checkout', '-b', 'claude/oud-1', 'abc1234'], 'destructive', {max_runs: 1})
    ],
    budget: {agent_calls: 8, max_parallel: 1, command_runs: 80, external_calls: 0}, approval_required: true, design_freeze: false, integrations: {}, decision_points: [],
    ...over
  };
}
function v32State(t, over = {}) {
  return {version: 3, integrations: {}, task: {id: t.id, digest: 'd1d1d1', contract: structuredClone(t), approval: {digest: 'd1d1d1', at: '2026-09-30T10:00:00.000Z'}, status: 'active', result: null, usage: {agents: 1, commands: 2, external: 0}, command_counts: {t_local: 2},
    command_receipts: [{command_id: 't_local', exit_code: 0, route_digest: 'd1d1d1', evidence_path: 'docs/aae/evidence/AAE-OUD-1/run-1.json'}], approved_commands: {}, external_calls: {}, external_receipts: [],
    calls: {'tu-oud': {role: 'aae-security-reviewer', status: 'stopped', agent_id: 'oud12345', at: '2026-09-30T10:05:00.000Z', finished: '2026-09-30T10:06:00.000Z', source_digest: 's1', task_digest: 'd1d1d1', reported_status: 'READY', report_summary: 'Geen blokkerende bevindingen.'}}, ...over}};
}
const zet = (root, t, s) => { put(root, 'docs/aae/TASK.json', t); put(root, '.claude/aae/state/local.json', s); };
const met = fn => async () => { const root = fixture(); try { await fn(root); } finally { cleanup(root); } };

test('RB08 legacy: een actieve v3.2-route met kloppende digest en identiek TASK.json wordt nooit stil approved of EXECUTING; verbruik en agentregistraties blijven behouden en een expliciete GO is nodig (eenmalige migratiegrens)', met(root => {
  const t = v32Task(); zet(root, t, v32State(t));
  const uit = importLegacy(root);
  assert.deepEqual(uit, {id: 'AAE-OUD-1', status: 'WAITING_FOR_APPROVAL'});
  const s = st(root, 'AAE-OUD-1');
  assert.equal(s.legacy, true); assert.equal(s.status, 'WAITING_FOR_APPROVAL'); assert.equal(s.approved, null, 'een v3.2-GO telt niet');
  assert.ok(denies(() => write(root, 'src/nieuw.js')), 'zonder nieuwe GO geen schrijfrechten');
  assert.deepEqual(s.usage, {agents: 1, commands: 2, external: 0}); assert.equal(s.command_counts.t_local, 2);
  const agent = s.agents['tu-oud']; assert.equal(agent.role, 'aae-reviewer'); assert.equal(agent.focus, 'security'); assert.equal(agent.reported_status, 'READY');
  assert.equal(s.receipts.length, 1);
  assert.equal(importLegacy(root), null, 'idempotent');
  assert.match(JSON.stringify(prompt(root, 'AAE GO AAE-OUD-1 abcdef12')), /GO geweigerd/, 'een GO zonder getoond voorstel telt niet');
  go(root, 'AAE-OUD-1'); assert.equal(st(root, 'AAE-OUD-1').status, 'EXECUTING', 'na present en de exacte GO start het pakket');
}));
test('RB08 legacy: een v3.2-route met apply_migration of sensitive_migrations wordt geen algemene B-vrijheid en een gevoelige migratie wordt niet overgenomen', () => {
  const t = v32Task({integrations: {supabase: {project_ref: 'abcdefghij', tools: ['get_project_url', 'apply_migration'], max_calls: 4, sensitive_migrations: ['verwijder_oude_tabel']}}});
  t.budget = {...t.budget, external_calls: 4};
  const {contract, notes} = adaptLegacyContract(t);
  assert.equal(contract.envelope.db_max, 'A', 'nooit automatisch B');
  assert.ok(notes.some(x => /verwijder_oude_tabel/.test(x)), 'de gevoelige migratie is zichtbaar als niet overgenomen');
});
test('legacy: de rollen worden afgebeeld op de drie nieuwe agents', () => {
  assert.deepEqual(mapRole('aae-security-reviewer'), ['aae-reviewer', 'security']);
  assert.deepEqual(mapRole('aae-code-reviewer'), ['aae-reviewer', 'code']);
  assert.deepEqual(mapRole('aae-solution-architect'), ['aae-architect', null]);
  assert.deepEqual(mapRole('aae-product-analyst'), ['aae-product-partner', null]);
});
test('legacy: commando\'s krijgen de juiste v3.3-capabilities (commit, push, merge ⇒ deploy "verify", destructief als extra)', () => {
  const {contract} = adaptLegacyContract(v32Task());
  const v = validateContract(structuredClone(contract));
  const p = Object.fromEntries(v.plan.commands.map(m => [m.id, m.purpose]));
  assert.deepEqual(p, {t_local: 'test', stage: 'commit', commit: 'commit', push_1: 'push', gate: 'merge', setup: 'destructive'});
  assert.equal(v.envelope.git.commit, true); assert.deepEqual(v.envelope.git.push, ['claude/oud-1']); assert.deepEqual(v.envelope.git.merge, {to: 'main'}); assert.equal(v.envelope.git.deploy, 'verify');
  assert.ok(v.envelope.extra_commands.some(x => x.purpose === 'destructive'));
  assert.equal(v.risk_class, 'HIGH');
});
test('legacy: na de overgang werkt de route: schrijven in het oude gebied, een lokaal commando, een gewoon bericht verandert niets', met(async root => {
  const t = v32Task(); zet(root, t, v32State(t));
  importLegacy(root); go(root, 'AAE-OUD-1');
  assert.equal(write(root, 'src/nieuw.js'), null);
  assert.ok(denies(() => write(root, 'app/x.ts')));
  assert.equal((await runCommand(root, 't_local')).exit_code, 0);
  prompt(root, 'Vervolgvraag');
  assert.equal(st(root, 'AAE-OUD-1').status, 'EXECUTING');
  assert.equal(bash(root, 'git status --porcelain'), null);
}));
test('legacy: terugdraaien blijft toegestaan: het rollbackcommando van de oude route blijft een toegestaan commando', met(root => {
  const t = v32Task(); t.commands.push(cmd('rollback', ['git', 'checkout', 'abc1234', '--', 'src'], 'destructive', {max_runs: 1}));
  const {contract} = adaptLegacyContract(t);
  const v = validateContract(structuredClone(contract));
  assert.ok(v.plan.commands.some(m => m.id === 'rollback' && v.envelope.extra_commands.some(x => x.argv.join(' ') === m.argv.join(' '))));
}));
test('legacy: een nog niet goedgekeurde v3.2-route wacht op de GO; ook een gepauzeerde wacht op een expliciete GO; een gesloten route is afgerond', met(root => {
  let t = v32Task(), s = v32State(t, {status: 'pending', approval: null}); zet(root, t, s);
  importLegacy(root);
  assert.equal(st(root, 'AAE-OUD-1').status, 'WAITING_FOR_APPROVAL');
  const root2 = fixture();
  try {
    zet(root2, t, v32State(t, {status: 'paused'})); importLegacy(root2);
    assert.equal(st(root2, 'AAE-OUD-1').status, 'WAITING_FOR_APPROVAL', 'ook een gepauzeerde v3.2-route start pas na een expliciete GO');
    zet(root2, v32Task({id: 'AAE-OUD-2'}), v32State(v32Task({id: 'AAE-OUD-2'}), {status: 'closed', result: 'READY'})); importLegacy(root2);
    assert.equal(st(root2, 'AAE-OUD-2').status, 'READY');
  } finally { cleanup(root2); }
}));
test('review: een actieve v3.2-route zonder (geldige) goedkeuring wordt NIET stilzwijgend goedgekeurd', met(root => {
  const t = v32Task(); zet(root, t, v32State(t, {approval: null}));
  importLegacy(root);
  assert.equal(st(root, 'AAE-OUD-1').status, 'WAITING_FOR_APPROVAL'); assert.equal(st(root, 'AAE-OUD-1').approved, null);
  const root2 = fixture();
  try {
    zet(root2, t, v32State(t, {approval: {digest: 'verouderd', at: '2026-09-30T10:00:00.000Z'}}));
    importLegacy(root2);
    assert.equal(st(root2, 'AAE-OUD-1').status, 'WAITING_FOR_APPROVAL', 'een goedkeuring van een oud contract geldt niet');
    assert.ok(denies(() => write(root2, 'src/x.js')), 'zonder GO geen schrijfrechten');
  } finally { cleanup(root2); }
}));
test('review ronde 3: een TASK.json die niet gelijk is aan het goedgekeurde contract, of een ontbrekende digest, wordt niet als goedgekeurd overgenomen', met(root => {
  const t = v32Task(), s = v32State(t); t.goal = 'Buiten de hook om aangepast doel dat nooit is goedgekeurd door de gebruiker.';
  zet(root, t, s); importLegacy(root);
  assert.equal(st(root, 'AAE-OUD-1').status, 'WAITING_FOR_APPROVAL');
  const root2 = fixture();
  try { const t2 = v32Task(), s2 = v32State(t2); delete s2.task.digest; delete s2.task.approval; zet(root2, t2, s2); importLegacy(root2); assert.equal(st(root2, 'AAE-OUD-1').status, 'WAITING_FOR_APPROVAL', 'undefined === undefined is geen goedkeuring'); }
  finally { cleanup(root2); }
}));
test('legacy: een v3.2-route zonder GO-eis (ook LIGHT) die iets wil wijzigen wacht op precies één GO', met(root => {
  const t = v32Task({approval_required: false, risk: 'low', mode: 'lean', risk_flags: []}); t.test_plan = t.test_plan.filter(x => ['scope', 'functional', 'regression'].includes(x.kind));
  t.commands = [cmd('t_local', ['node', '--test', 'src/ok.test.mjs'], 'test')];
  zet(root, t, v32State(t, {approval: null})); importLegacy(root);
  assert.equal(st(root, 'AAE-OUD-1').status, 'WAITING_FOR_APPROVAL');
  assert.equal(st(root, 'AAE-OUD-1').approved, null);
}));
test('review: een v3.2-gate op een commando dat geen merge is, laat de overname zichtbaar blokkeren (de gate vervalt niet stil)', met(root => {
  const t = v32Task(); t.commands.push(cmd('gate_lokaal', ['node', '--test', 'src/ok.test.mjs'], 'test', {gate: 'ready'}));
  zet(root, t, v32State(t)); const uit = importLegacy(root);
  assert.equal(uit.status, 'BLOCKED'); assert.match(st(root, 'AAE-OUD-1').blockers[0], /gate "ready"/);
}));
test('review: een gesloten v3.2-taak met PARTIAL of BLOCKED blijft open (BLOCKED), alleen READY is READY', met(root => {
  const t = v32Task(); zet(root, t, v32State(t, {status: 'closed', result: 'PARTIAL'})); importLegacy(root);
  assert.equal(st(root, 'AAE-OUD-1').status, 'BLOCKED'); assert.equal(st(root, 'AAE-OUD-1').result, 'PARTIAL');
}));
test('review: eenmalige commando\'s (merge, deploy, install, destructief) worden bij de overname op één run begrensd in plaats van de route te blokkeren', () => {
  const t = v32Task(); t.commands.find(m => m.id === 'gate').max_runs = 5; t.commands.find(m => m.id === 'setup').max_runs = 4;
  const v = validateContract(structuredClone(adaptLegacyContract(t).contract));
  assert.equal(v.plan.commands.find(m => m.id === 'gate').max_runs, 1); assert.equal(v.plan.commands.find(m => m.id === 'setup').max_runs, 1);
});
test('legacy: een v3.2-contract dat niet in v3.3 past blokkeert zichtbaar in plaats van stil te verdwijnen', met(root => {
  const t = v32Task({scope: {read: ['src'], write: []}, phase: 'implementation'}); t.commands = []; zet(root, t, v32State(t));
  const uit = importLegacy(root);
  assert.equal(uit.status, 'BLOCKED');
  assert.match(st(root, 'AAE-OUD-1').blockers[0], /past niet in v3\.3/);
}));
