// Runner, bewijs en gates (pariteit met de v3.2-runnertests R01-R34).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {fixture, cleanup, contract, plan, executing, go, st, prompt, hook, pre, denies, agentCall, runAgent, REPORT, put} from './helpers.mjs';
import {runCommand, reportTemplate, closeTask} from '../runtime/runner.mjs';
import {validateContract, clock} from '../runtime/core.mjs';
import {assertGate} from '../runtime/gates.mjs';
import {plainSummary} from '../runtime/commands.mjs';
import {candidateFiles, stagedFiles} from '../runtime/gitops.mjs';
import {contractFile} from '../runtime/state.mjs';

const met = fn => async () => { const root = fixture(); const cfg = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'aae33cfg-'))); process.env.CLAUDE_CONFIG_DIR = cfg; try { await fn(root, cfg); } finally { cleanup(root); cleanup(cfg); delete process.env.CLAUDE_CONFIG_DIR; clock.ms = () => Date.now(); } };
const msg = async p => { try { await p; } catch (e) { return e.message; } assert.fail('verwacht een weigering'); };
const C = (id, argv, purpose = 'test', o = {}) => ({id, argv, purpose, why: 'Test van ' + id + '.', watch: [], timeout_ms: 60000, max_runs: 5, ...o});
const metCmds = (cmds, extra = [], env = {}) => ({envelope: {extra_commands: extra, ...env}, plan: {...contract().plan, commands: [...contract().plan.commands, ...cmds]}});
const ex = (argv, purpose = 'test') => ({argv, purpose});
// Een klein projectscript als extra commando (een codevlag zoals node -e is sinds 001D nooit meer toegestaan als extra commando; zie RD02).
const script = (root, naam, code, ...args) => { fs.mkdirSync(path.join(root, 'scripts'), {recursive: true}); fs.writeFileSync(path.join(root, 'scripts', naam), code); return ['node', 'scripts/' + naam, ...args]; };
const makeResult = (root, receipt, mutate) => {
  const t = reportTemplate(root);
  t.status = 'READY'; t.summary = 'Alles bewezen en gecontroleerd binnen het gebied.';
  for (const a of t.criteria) { a.status = 'passed'; a.evidence = ['src/ok.test.mjs']; a.note = 'Bewezen met de test.'; }
  for (const x of t.checks) { x.status = 'passed'; x.note = 'Uitgevoerd en geslaagd.'; x.evidence = x.method === 'command' ? [receipt] : ['src/ok.test.mjs']; }
  if (mutate) mutate(t);
  put(root, 'docs/aae/work/W-T/result.json', t); return t;
};

test('R01 een commando draait pas na de GO van het werkpakket', met(async root => {
  plan(root);
  assert.match(await msg(runCommand(root, 't_ok')), /Geen actief werkpakket/);
  go(root);
  assert.equal((await runCommand(root, 't_ok')).exit_code, 0);
}));
test('R02 de receipt bevat echte exitcode, bronvingerafdrukken, begrensde uitvoer en looptijd', met(async root => {
  executing(root);
  const r = await runCommand(root, 't_ok');
  assert.equal(r.exit_code, 0); assert.match(r.source_before, /^[0-9a-f]{64}$/); assert.equal(r.source_before, r.source_after);
  assert.equal(typeof r.duration_ms, 'number'); assert.ok(r.tail.length <= 2500); assert.ok(fs.existsSync(path.join(root, r.log_path)));
  assert.ok(fs.existsSync(path.join(root, r.evidence_path))); assert.match(r.envelope_hash, /^[0-9a-f]{64}$/);
  assert.equal(st(root).command_running, null);
}));
test('R03 het maximum aantal uitvoeringen per commando blijft bewaard', met(async root => {
  executing(root, metCmds([C('twee', ['node', '--test', 'src/ok.test.mjs'], 'test', {max_runs: 2})]));
  await runCommand(root, 'twee'); await runCommand(root, 'twee');
  assert.match(await msg(runCommand(root, 'twee')), /Maximum aantal runs/);
  assert.equal(st(root).command_counts.twee, 2);
}));
test('R04 een wijziging in een script of configuratie maakt de goedkeuring van een niet-lokaal commando ongeldig', met(async root => {
  fs.mkdirSync(path.join(root, 'scripts')); fs.writeFileSync(path.join(root, 'scripts/inst.js'), 'console.log(1)');
  executing(root, metCmds([C('inst', ['node', 'scripts/inst.js'], 'install', {max_runs: 1, watch: ['scripts/inst.js']})], [ex(['node', 'scripts/inst.js'], 'install')]));
  fs.writeFileSync(path.join(root, 'scripts/inst.js'), 'console.log(2)');
  assert.match(await msg(runCommand(root, 'inst')), /niet \(meer\) gelijk/);
}));
test('R05 het pakketmanifest zit in de vingerafdruk, ook als het niet in watch staat', met(async root => {
  const argv = script(root, 'niets.mjs', 'export {};\n');
  executing(root, metCmds([C('inst', argv, 'install', {max_runs: 1})], [ex(argv, 'install')]));
  fs.writeFileSync(path.join(root, 'package.json'), '{"name":"fixture","private":true,"scripts":{"x":"y"}}\n');
  assert.match(await msg(runCommand(root, 'inst')), /niet \(meer\) gelijk/);
}));
test('R06 shell-metatekens zijn letterlijke argv-tekst en worden nooit uitgevoerd', met(async root => {
  const argv = script(root, 'lit.mjs', 'import fs from "node:fs"; fs.writeFileSync("gelezen.txt", process.argv[2]);\n', 'a;touch pwned');
  executing(root, metCmds([C('lit', argv)], [ex(argv)]));
  assert.equal((await runCommand(root, 'lit')).exit_code, 0);
  assert.equal(fs.readFileSync(path.join(root, 'gelezen.txt'), 'utf8'), 'a;touch pwned');
  assert.equal(fs.existsSync(path.join(root, 'pwned')), false);
}));
test('R07 een time-out geeft een vastgelegde mislukte receipt', met(async root => {
  const argv = script(root, 'traag.mjs', 'setTimeout(() => {}, 60000);\n');
  executing(root, metCmds([C('traag', argv, 'test', {timeout_ms: 1000})], [ex(argv)]));
  const r = await runCommand(root, 'traag');
  assert.equal(r.timed_out, true); assert.notEqual(r.exit_code, 0); assert.equal(st(root).command_running, null);
}));
test('R08 een ontbrekend programma geeft een begrensde fout zonder vastgelopen registratie', met(async root => {
  const argv = ['aae-bestaat-niet-xyz'];
  executing(root, metCmds([C('weg', argv)], [ex(argv)]));
  const r = await runCommand(root, 'weg');
  assert.notEqual(r.exit_code, 0); assert.ok(String(r.error || r.tail).length < 3000);
  assert.equal(st(root).command_running, null);
}));
test('R09 grote uitvoer wordt lokaal en in het antwoord begrensd', met(async root => {
  const argv = script(root, 'groot.mjs', 'process.stdout.write("x".repeat(3 * 1024 * 1024));\n');
  executing(root, metCmds([C('groot', argv)], [ex(argv)]));
  const r = await runCommand(root, 'groot');
  assert.equal(r.log_truncated, true); assert.ok(fs.statSync(path.join(root, r.log_path)).size <= 1024 * 1024); assert.ok(r.tail.length <= 2500);
}));
test('R10 twee gelijke mislukte pogingen zonder bronwijziging vragen een andere hypothese', met(async root => {
  executing(root, metCmds([C('rood', ['node', '--test', 'src/rood.test.mjs'])]));
  assert.notEqual((await runCommand(root, 'rood')).exit_code, 0); assert.notEqual((await runCommand(root, 'rood')).exit_code, 0);
  assert.match(await msg(runCommand(root, 'rood')), /Twee gelijke mislukte pogingen/);
  fs.writeFileSync(path.join(root, 'src/nieuw.js'), 'wijziging');
  assert.notEqual((await runCommand(root, 'rood')).exit_code, 0, 'na een bronwijziging mag het weer');
}));
test('R11 een gelijktijdige runneraanroep wordt geblokkeerd', met(async root => {
  const argv = script(root, 'lang.mjs', 'setTimeout(() => {}, 700);\n');
  executing(root, metCmds([C('lang', argv)], [ex(argv)]));
  const eerste = runCommand(root, 'lang');
  assert.match(await msg(runCommand(root, 't_ok')), /Geen commandoloop/);
  assert.equal((await eerste).exit_code, 0);
}));
test('R12 een op schijf gewijzigd maar niet geregistreerd contract wordt niet uitgevoerd', met(async root => {
  executing(root);
  const c = structuredClone(st(root).contract); c.plan.commands.push(C('sluip', ['node', '--test', 'src/rood.test.mjs']));
  put(root, contractFile('W-T'), c);
  assert.match(await msg(runCommand(root, 'sluip')), /Commando niet in het plan/);
}));
test('R13 alleen lokale commando\'s van de allowlist draaien zonder extra goedkeuring; andere moeten exact in de envelop staan', met(async root => {
  assert.throws(() => validateContract(structuredClone(contract(metCmds([C('vrij', ['node', '-e', '1'])])))), /valt buiten de envelop/);
  executing(root);
  assert.equal((await runCommand(root, 't_ok')).exit_code, 0);
}));
test('R14 deploy is een expliciete capability met bewijs (geen extra commando): zonder capability of zonder READY-resultaat geen uitvoering', met(async root => {
  // Sinds 001D bestaat er geen los deploy-commando meer: een deploy-doel accepteert geen extra commando's; uitrollen loopt uitsluitend via de capability en haar gate.
  const argv = script(root, 'uitrol.mjs', 'export {};\n');
  assert.throws(() => validateContract(structuredClone(contract(metCmds([C('uitrol', argv, 'deploy', {max_runs: 1})], [ex(argv, 'deploy')], {git: {commit: false, push: [], merge: null, deploy: 'trigger'}})))), /accepteert geen extra commando/);
  assert.throws(() => validateContract(structuredClone(contract(metCmds([C('uitrol', argv, 'deploy', {max_runs: 1})], [], {git: {commit: false, push: [], merge: null, deploy: 'trigger'}})))), /Een los deploy-commando bestaat niet/);
  // de gate zelf blijft: zonder capability niet, met capability alleen met een READY-resultaat
  executing(root, metCmds([], [], {git: {commit: false, push: [], merge: null, deploy: 'verify'}}));
  const s = st(root);
  assert.throws(() => assertGate(root, s, s.contract, 'deploy'), /Deploy starten is geen capability/);
  const root2 = fixture();
  try {
    executing(root2, metCmds([], [], {git: {commit: false, push: [], merge: null, deploy: 'trigger'}}));
    const s2 = st(root2);
    assert.throws(() => assertGate(root2, s2, s2.contract, 'deploy'), /result\.json ontbreekt/);
  } finally { cleanup(root2); }
}));
test('R15 een gepauzeerd werkpakket voert een eerder goedgekeurd commando niet uit', met(async root => {
  executing(root); prompt(root, 'AAE PAUZE');
  assert.match(await msg(runCommand(root, 't_ok')), /Geen actief werkpakket/);
}));
test('R16 een commando draait niet terwijl een reviewer actief is', met(async root => {
  executing(root); agentCall(root, {id: 'tu-1'});
  assert.match(await msg(runCommand(root, 't_ok')), /agentcontrole/);
}));
test('R17 het standaardrapport is PARTIAL en beweert geen niet-uitgevoerde tests', met(async root => {
  executing(root);
  const t = reportTemplate(root);
  assert.equal(t.status, 'PARTIAL'); assert.ok(t.criteria.every(a => a.status === 'not_run')); assert.ok(t.checks.every(x => x.status === 'not_run'));
}));
test('R18 READY kan geen verplicht criterium of verplichte controle weglaten', met(async root => {
  executing(root);
  const r = await runCommand(root, 't_ok');
  makeResult(root, r.evidence_path, t => { t.criteria[0].status = 'not_run'; });
  assert.throws(() => closeTask(root), /Criterium niet bewezen/);
  makeResult(root, r.evidence_path, t => { t.checks = t.checks.filter(x => x.kind !== 'regression'); });
  assert.throws(() => closeTask(root), /Verplichte controle niet geslaagd: regression/);
}));
test('R19 READY weigert niet-bestaand bewijs', met(async root => {
  executing(root);
  const r = await runCommand(root, 't_ok');
  makeResult(root, r.evidence_path, t => { t.criteria[0].evidence = ['docs/aae/evidence/bestaat-niet.json']; });
  assert.throws(() => closeTask(root));
}));
test('R20 READY weigert bewijs van een oudere bronversie', met(async root => {
  executing(root);
  const r = await runCommand(root, 't_ok');
  fs.writeFileSync(path.join(root, 'src/na-de-test.js'), 'nieuwe wijziging');
  makeResult(root, r.evidence_path);
  assert.throws(() => closeTask(root), /actuele commandoreceipt/);
}));
test('R21 commandobewijs moet een echte, geslaagde en actuele receipt zijn', met(async root => {
  executing(root, metCmds([C('rood', ['node', '--test', 'src/rood.test.mjs'])]));
  const rood = await runCommand(root, 'rood'); await runCommand(root, 't_ok');
  makeResult(root, rood.evidence_path);
  assert.throws(() => closeTask(root), /actuele commandoreceipt/);
  makeResult(root, 'src/ok.test.mjs');
  assert.throws(() => closeTask(root), /actuele commandoreceipt/);
}));
test('R22 een script dat de bron wijzigt kan niet dienen als bewijs voor een ongewijzigde bron', met(async root => {
  const argv = script(root, 'gen.mjs', 'import fs from "node:fs"; fs.writeFileSync("src/gen.js", String(Date.now()));\n');
  executing(root, metCmds([C('gen', argv)], [ex(argv)]));
  const r = await runCommand(root, 'gen');
  assert.notEqual(r.source_before, r.source_after);
  makeResult(root, r.evidence_path);
  assert.throws(() => closeTask(root), /actuele commandoreceipt/);
}));
test('R23 een extra gepland of risicogebonden bewijs moet ook zijn afgerond', met(async root => {
  const p = contract({risk_flags: ['background_jobs']}).plan;
  p.test_plan.push(...['idempotency', 'retry'].map(kind => ({kind, method: 'inspection', description: 'Beschrijf de controle van ' + kind + '.'})));
  executing(root, {risk_flags: ['background_jobs'], plan: p});
  const r = await runCommand(root, 't_ok');
  makeResult(root, r.evidence_path, t => { t.checks = t.checks.filter(x => x.kind !== 'idempotency'); });
  assert.throws(() => closeTask(root), /Verplichte controle niet geslaagd: idempotency/);
}));
test('R24 eerlijk PARTIAL afsluiten doet niet alsof het klaar of uitgerold is en laat VERDER toe', met(async root => {
  executing(root);
  const t = reportTemplate(root); t.summary = 'Alleen de eerste helft is gebouwd; de tweede helft ontbreekt nog.';
  put(root, 'docs/aae/work/W-T/result.json', t);
  const r = closeTask(root);
  assert.equal(r.status, 'PARTIAL'); assert.equal(r.work_status, 'BLOCKED'); assert.equal(r.not_deployed, true);
  assert.match(plainSummary(root).plain[0], /gedeeltelijk klaar/);
  prompt(root, 'AAE VERDER');
  assert.equal(st(root).status, 'EXECUTING'); assert.equal(st(root).blockers.length, 0);
}));
test('R24b een bewezen READY sluit het werkpakket af zonder deployment of publicatie', met(async root => {
  executing(root);
  const r = await runCommand(root, 't_ok');
  makeResult(root, r.evidence_path);
  const klaar = closeTask(root);
  assert.equal(klaar.work_status, 'READY'); assert.equal(klaar.not_deployed, true);
  assert.equal(st(root).status, 'READY');
  assert.match(await msg(runCommand(root, 't_ok')), /Geen actief werkpakket/);
}));
test('R25 HIGH vraagt een actueel onafhankelijk READY-oordeel van een voltooide reviewerrun', met(async (root, cfg) => {
  executing(root, {risk_class: 'HIGH'});
  const r = await runCommand(root, 't_ok');
  makeResult(root, r.evidence_path);
  assert.throws(() => closeTask(root), /onafhankelijk READY-oordeel/);
  runAgent(root, {configDir: cfg});
  makeResult(root, r.evidence_path);
  assert.equal(closeTask(root).work_status, 'READY');
}));
test('R26 een PARTIAL reviewerrapport is geen onafhankelijk READY-bewijs', met(async (root, cfg) => {
  executing(root, {risk_class: 'HIGH'});
  const r = await runCommand(root, 't_ok');
  runAgent(root, {configDir: cfg, text: REPORT('PARTIAL')});
  makeResult(root, r.evidence_path);
  assert.throws(() => closeTask(root), /onafhankelijk READY-oordeel/);
}));
const mergeEnv = {git: {commit: true, push: ['claude/w'], merge: {to: 'main'}, deploy: 'verify'}};
const mergeCmd = C('samenvoegen', ['git', 'push', 'origin', 'claude/w:main'], 'merge', {max_runs: 1});
test('R27 de merge-gate wacht op een READY-resultaat op de actuele bron (B5)', met(async root => {
  executing(root, metCmds([mergeCmd], [], mergeEnv));
  assert.match(await msg(runCommand(root, 'samenvoegen')), /result\.json ontbreekt/);
}));
test('R28 de merge-gate weigert een READY-resultaat van een oudere bron', met(async root => {
  executing(root, metCmds([mergeCmd], [], mergeEnv));
  const r = await runCommand(root, 't_ok');
  makeResult(root, r.evidence_path);
  fs.writeFileSync(path.join(root, 'src/laat.js'), 'na het rapport');
  assert.match(await msg(runCommand(root, 'samenvoegen')), /Broncode veranderd/);
}));
const sh = (root, ...a) => spawnSync('git', ['-c', 'user.email=t@t.nl', '-c', 'user.name=T', '-c', 'commit.gpgsign=false', ...a], {cwd: root, encoding: 'utf8'});
function gitFixture(root) { sh(root, 'init', '-q'); sh(root, 'add', '-A'); sh(root, 'commit', '-q', '-m', 'eerste'); sh(root, 'commit', '-q', '--allow-empty', '-m', 'tweede'); sh(root, 'checkout', '-q', '-b', 'claude/w'); }
test('review: de merge-gate bindt het bewijs aan de commit: HEAD moet gelijk zijn aan de vastgelegde commit en de branch aan HEAD', met(async root => {
  gitFixture(root);
  executing(root, metCmds([mergeCmd], [], mergeEnv));
  sh(root, 'add', '-A', '--', 'docs/aae/work'); sh(root, 'commit', '-q', '-m', 'snapshot van de goedgekeurde envelop'); // READY en de merge-gate eisen dat de snapshot in HEAD staat
  const r = await runCommand(root, 't_ok');
  const t = makeResult(root, r.evidence_path);
  assert.match(t.git_head, /^[0-9a-f]{40,64}$/, 'het rapportsjabloon legt HEAD vast');
  const s = st(root);
  assert.doesNotThrow(() => assertGate(root, s, s.contract, 'merge', mergeCmd.argv), 'alles actueel: de gate laat het door');
  sh(root, 'branch', 'claude/oud', 'HEAD~1');
  assert.throws(() => assertGate(root, s, s.contract, 'merge', ['git', 'push', 'origin', 'claude/oud:main']), /staat niet op dezelfde commit/);
  sh(root, 'commit', '-q', '--allow-empty', '-m', 'derde');
  assert.throws(() => assertGate(root, s, s.contract, 'merge', mergeCmd.argv), /hoort bij commit/);
}));
test('review: een commit neemt geen geheimen mee (bestandsnaam of inhoud); .env.example mag wel', met(async root => {
  gitFixture(root);
  const cmds = [C('stage', ['git', 'add', '-A', '--', 'src'], 'commit', {max_runs: 10}), C('commit', ['git', 'commit', '-m', 'Tussenstand'], 'commit', {max_runs: 10})];
  executing(root, metCmds(cmds, [], {git: {commit: true, push: ['claude/w'], merge: null, deploy: 'none'}}));
  fs.writeFileSync(path.join(root, 'src/.env.local'), 'SUPABASE_URL=x\n');
  assert.match(await msg(runCommand(root, 'stage')), /Mogelijk geheim.*\.env\.local/);
  fs.rmSync(path.join(root, 'src/.env.local'));
  fs.writeFileSync(path.join(root, 'src/notitie.txt'), ['-----BEGIN ', 'RSA PRIVATE ', 'KEY-----'].join('') + '\nabc\n');
  const fout = await msg(runCommand(root, 'stage'));
  assert.match(fout, /privésleutel/); assert.ok(!fout.includes('abc'), 'de inhoud wordt nooit getoond');
  fs.rmSync(path.join(root, 'src/notitie.txt'));
  fs.writeFileSync(path.join(root, 'src/.env.example'), 'SUPABASE_URL=\n'); fs.writeFileSync(path.join(root, 'src/gewoon.js'), 'export {};\n');
  assert.equal((await runCommand(root, 'stage')).exit_code, 0);
  fs.writeFileSync(path.join(root, 'src/geheim.pem'), 'x'); sh(root, 'add', '-f', 'src/geheim.pem');
  assert.match(await msg(runCommand(root, 'commit')), /Mogelijk geheim.*geheim\.pem/, 'ook wat al klaarstaat wordt bij de commit gecontroleerd');
}));
test('review ronde 3: een mislukte git-aanroep in de geheimencontrole is nooit "geen bestanden" (faalt gesloten)', met(async root => {
  assert.throws(() => candidateFiles(root, ['src']), /Geheimencontrole niet mogelijk/);
  assert.throws(() => stagedFiles(root), /Geheimencontrole niet mogelijk/);
  executing(root, metCmds([C('stage', ['git', 'add', '-A', '--', 'src'], 'commit')], [], {git: {commit: true, push: ['claude/w'], merge: null, deploy: 'none'}}));
  assert.match(await msg(runCommand(root, 'stage')), /Geheimencontrole niet mogelijk/);
}));
test('R29 een wijziging in een bewaakt script binnen het gebied laat een lokaal commando goedgekeurd', met(async root => {
  fs.writeFileSync(path.join(root, 'src/check.js'), 'console.log(1)');
  const argv = ['node', 'src/check.js'];
  executing(root, metCmds([C('check', argv, 'test', {watch: ['src/check.js']})], [ex(argv)]));
  assert.equal((await runCommand(root, 'check')).exit_code, 0);
  fs.writeFileSync(path.join(root, 'src/check.js'), 'console.log(2)');
  assert.equal((await runCommand(root, 'check')).exit_code, 0);
}));
test('R30 B4: een wijziging aan een bewaakt bestand binnen het gebied vraagt voor een install-commando een nieuwe GO', met(async root => {
  fs.writeFileSync(path.join(root, 'src/inst.js'), 'console.log(1)');
  const argv = ['node', 'src/inst.js'];
  executing(root, metCmds([C('inst', argv, 'install', {max_runs: 1, watch: ['src/inst.js']})], [ex(argv, 'install')]));
  fs.writeFileSync(path.join(root, 'src/inst.js'), 'console.log(2)');
  assert.match(await msg(runCommand(root, 'inst')), /niet \(meer\) gelijk/);
}));
test('R31 B4: ook een destructief commando is aan zijn vingerafdruk gebonden; een merge accepteert geen extra commando meer', met(async root => {
  fs.writeFileSync(path.join(root, 'src/wis.js'), 'console.log(1)');
  const argv = ['node', 'src/wis.js'];
  executing(root, metCmds([C('wissen', argv, 'destructive', {max_runs: 1, watch: ['src/wis.js']})], [ex(argv, 'destructive')]));
  fs.writeFileSync(path.join(root, 'src/wis.js'), 'console.log(2)');
  assert.match(await msg(runCommand(root, 'wissen')), /niet \(meer\) gelijk/);
  assert.throws(() => validateContract(structuredClone(contract(metCmds([C('samenvoegen', argv, 'merge', {max_runs: 1})], [ex(argv, 'merge')], mergeEnv)))), /accepteert geen extra commando/);
}));
test('R32 een binnen de envelop aangepast plan houdt goedgekeurde commando\'s uitvoerbaar zonder nieuwe GO', met(async root => {
  executing(root);
  const c = contract(); c.plan = {...c.plan, commands: [...c.plan.commands, C('t_rood', ['node', '--test', 'src/rood.test.mjs'], 'test', {max_runs: 2})]};
  const v = validateContract(structuredClone(c)); put(root, contractFile('W-T'), v);
  hook(root, {hook_event_name: 'PostToolUse', tool_name: 'Write', tool_input: {file_path: path.join(root, contractFile('W-T')), content: JSON.stringify(v)}, tool_response: {}});
  assert.equal(st(root).status, 'EXECUTING');
  assert.equal((await runCommand(root, 't_ok')).exit_code, 0);
  assert.notEqual((await runCommand(root, 't_rood')).exit_code, 0);
}));
test('R33 een vervolgbericht laat de commandogoedkeuring intact', met(async root => {
  executing(root);
  prompt(root, 'Gewoon een vraag tussendoor'); prompt(root, 'Nog een bericht');
  assert.equal((await runCommand(root, 't_ok')).exit_code, 0);
}));
test('R34 herhalen binnen het goedgekeurde aantal runs mag voor lokale en git-commando\'s; gevoelige commando\'s zijn eenmalig en nooit vertrouwd', () => {
  const git = {commit: true, push: ['claude/w'], merge: null, deploy: 'none'};
  assert.doesNotThrow(() => validateContract(structuredClone(contract(metCmds([C('p', ['git', 'push', '-u', 'origin', 'claude/w'], 'push', {max_runs: 3})], [], {git})))));
  assert.throws(() => validateContract(structuredClone(contract(metCmds([C('d', ['node', 'scripts/x.mjs'], 'install', {max_runs: 2})], [ex(['node', 'scripts/x.mjs'], 'install')], {git})))), /Aantal uitvoeringen/);
});
