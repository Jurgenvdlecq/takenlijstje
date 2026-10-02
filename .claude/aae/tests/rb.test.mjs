// AAE-V33-001C: regressietests voor de blokkerende bevindingen van de onafhankelijke review van commit 5e64919 (RB01-RB10).
// RB01-RB04 (SQL) staan sinds 001E tabelgedreven in sql.test.mjs; RB08 (legacy-overname) staat in legacy.test.mjs en RB09 (installer) in tools/aae-v33/tests/installer.test.mjs.
// Elke test reproduceert het scenario uit het reviewrapport (docs/aae/notes/review-5e64919.md) en toont wat vóór het herstel misging.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {fixture, cleanup, contract, plan, executing, go, st, prompt, hook, pre, write, bash, denies, agentCall, runAgent, put, installRuntime} from './helpers.mjs';
import {validateContract, envelopeHash, extraRefusal, safeLocalArgv, clock} from '../runtime/core.mjs';
import {registerContract, loadWork, saveWork, withLock, proposalFile} from '../runtime/state.mjs';
import {presentProposal} from '../runtime/commands.mjs';
import {runCommand, reportTemplate} from '../runtime/runner.mjs';
import {assertGate, assertReady} from '../runtime/gates.mjs';
import {listSnapshots, snapshotDir, verifyChain, writeSnapshot, writeSnapshotRetry} from '../runtime/snapshot.mjs';
import {recoverWork} from '../runtime/recover.mjs';
import {trackedFingerprint} from '../runtime/gitops.mjs';

const met = fn => async () => { const root = fixture(); const cfg = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'aae33cfg-'))); process.env.CLAUDE_CONFIG_DIR = cfg; try { await fn(root, cfg); } finally { cleanup(root); cleanup(cfg); delete process.env.CLAUDE_CONFIG_DIR; clock.ms = () => Date.now(); } };
const msg = fn => { const e = denies(fn); assert.ok(e, 'verwacht een weigering'); return e.message; };
const amsg = async p => { try { await p; } catch (e) { return e.message; } assert.fail('verwacht een weigering'); };
const sh =(root, ...a) => spawnSync('git', ['-c', 'user.email=t@t.nl', '-c', 'user.name=T', '-c', 'commit.gpgsign=false', ...a], {cwd: root, encoding: 'utf8'});
function gitFixture(root) { sh(root, 'init', '-q'); sh(root, 'add', '-A'); sh(root, 'commit', '-q', '-m', 'eerste'); sh(root, 'checkout', '-q', '-b', 'claude/w'); }
const snapCommit = root => { sh(root, 'add', '-A', '--', 'docs/aae/work'); sh(root, 'commit', '-q', '-m', 'snapshot van de goedgekeurde envelop'); };
const cliRun = (root, ...args) => spawnSync(process.execPath, [path.join(root, '.claude/aae/runtime/cli.mjs'), ...args], {cwd: root, encoding: 'utf8'});
const BUDGET = n => ({agent_calls: {soft: 1, hard: 2}, command_runs: 20, external_calls: n, max_parallel: 1});
const HEAD = root => sh(root, 'rev-parse', 'HEAD').stdout.trim();
const makeResult = (root, receipt, mutate) => {
  const t = reportTemplate(root);
  t.status = 'READY'; t.summary = 'Alles bewezen en gecontroleerd binnen het gebied.';
  for (const a of t.criteria) { a.status = 'passed'; a.evidence = ['src/ok.test.mjs']; a.note = 'Bewezen met de test.'; }
  for (const x of t.checks) { x.status = 'passed'; x.note = 'Uitgevoerd en geslaagd.'; x.evidence = x.method === 'command' ? [receipt] : ['src/ok.test.mjs']; }
  if (mutate) mutate(t);
  put(root, 'docs/aae/work/W-T/result.json', t); return t;
};

// ---------------------------------------------------------------- RB05
test('RB05 extra_commands zijn volledig zichtbaar in het voorstel vóór de GO en kunnen publicatie of een gate niet omzeilen', met(async root => {
  const plan0 = contract().plan;
  const cmd = (id, argv, purpose) => ({id, argv, purpose, why: 'Een extra commando dat de gebruiker moet kunnen zien.', watch: [], timeout_ms: 5000, max_runs: 1});
  const mak = (argv, purpose) => contract({envelope: {extra_commands: [{argv, purpose}]}, plan: {...plan0, commands: [...plan0.commands, cmd('x1', argv, purpose)]}});
  // het reviewscenario: lokale doelen (test, build, read, preview) zonder gate mochten elke argv hebben, en met doel deploy omzeilde git push de merge-gate
  for (const [purpose, argv] of [['test', ['npm', 'publish']], ['build', ['git', 'push', '--force', 'origin', 'main']], ['read', ['git', 'push', 'origin', 'main']], ['preview', ['npm', 'run', 'deploy']], ['build', ['curl', 'https://x.example']], ['test', ['vercel', '--prod']], ['build', ['gh', 'pr', 'merge', '1']], ['deploy', ['git', 'push', 'origin', 'w:main']], ['merge', ['git', 'commit', '-m', 'x']], ['install', ['git', 'tag', 'v1']]]) {
    assert.ok(extraRefusal(argv, purpose), argv.join(' ') + ' (' + purpose + ') hoort geweigerd te worden');
    assert.throws(() => validateContract(structuredClone(mak(argv, purpose))), /staat niet op de lijst|accepteert geen/i, argv.join(' '));
  }
  // legitieme extra's blijven kunnen, mits zichtbaar
  assert.equal(extraRefusal(['node', 'scripts/bouw.mjs'], 'build'), null); assert.equal(extraRefusal(['git', 'checkout', '-b', 'x'], 'destructive'), null);
  // present toont alles: extra commando's (gemarkeerd), criteria, ondersteunende categorieën en providers
  installRuntime(root);
  const c = mak(['node', 'scripts/bouw.mjs'], 'build');
  plan(root, {envelope: c.envelope, plan: c.plan});
  const toon = cliRun(root, 'present', 'W-T'); assert.equal(toon.status, 0, toon.stderr);
  const uit = JSON.parse(toon.stdout), tekst = uit.samenvatting.join('\n');
  assert.match(tekst, /Extra commando's buiten de standaardlijst \(1\):/); assert.match(tekst, /\[build\] node scripts\/bouw\.mjs/); assert.match(tekst, /BUITEN de standaardlijst/); assert.match(tekst, /reden: Een extra commando dat de gebruiker moet kunnen zien/);
  assert.match(tekst, /AC1: De wijziging werkt zoals afgesproken\./); assert.match(tekst, /ondersteunend: tests/);
  // het echte GO-pad: de opdracht zoals die is getoond, niet via een helper die present zelf aanroept
  assert.equal(uit.exacte_go, 'AAE GO W-T ' + uit.short_hash); assert.equal(st(root).approved, null);
  prompt(root, uit.exacte_go); assert.equal(st(root).status, 'EXECUTING');
}));

test('RB05 de geheimencontrole draait ook bij push (eerder, buiten AAE gecommitte geheimen), een commit neemt geen gestagede bestanden buiten de gebieden mee, en git diff/show tonen geen bestandsinhoud', met(async root => {
  for (const argv of [['git', 'diff', '.env'], ['git', 'show', 'HEAD'], ['git', 'diff'], ['git', 'show', 'HEAD:.env'], ['git', 'diff', '--cached']]) assert.equal(safeLocalArgv(argv), false, argv.join(' '));
  for (const argv of [['git', 'diff', '--stat'], ['git', 'show', '--stat', 'HEAD'], ['git', 'diff', '--name-only']]) assert.equal(safeLocalArgv(argv), true, argv.join(' '));
  gitFixture(root);
  const C = (id, argv, purpose) => ({id, argv, purpose, why: 'Test van ' + id + '.', watch: [], timeout_ms: 60000, max_runs: 5});
  executing(root, {envelope: {git: {commit: true, push: ['claude/w'], merge: null, deploy: 'none'}}, plan: {...contract().plan, commands: [...contract().plan.commands, C('stage', ['git', 'add', '-A', '--', 'src'], 'commit'), C('commit', ['git', 'commit', '-m', 'Tussenstand'], 'commit'), C('push', ['git', 'push', '-u', 'origin', 'claude/w'], 'push')]}});
  // een geheim dat al eerder (buiten AAE) is gecommit, gaat niet mee met een push
  fs.writeFileSync(path.join(root, '.env'), 'SUPABASE_URL=x\n'); sh(root, 'add', '-f', '.env'); sh(root, 'commit', '-q', '-m', 'per ongeluk gecommit');
  assert.match(await amsg(runCommand(root, 'push')), /Mogelijk geheim in de te pushen commits.*\.env/);
  // een reeds gestagede bestand buiten de goedgekeurde gebieden gaat niet mee met een commit
  fs.mkdirSync(path.join(root, 'app'), {recursive: true}); fs.writeFileSync(path.join(root, 'app/x.js'), 'export {};\n'); sh(root, 'add', 'app/x.js');
  assert.match(await amsg(runCommand(root, 'commit')), /buiten de goedgekeurde gebieden.*app\/x\.js/);
}));

// ---------------------------------------------------------------- RB06
const GH = {tools: ['create_pull_request', 'merge_pull_request'], max_calls: 6, owner: 'o', repo: 'r', head: 'claude/w', base: 'main'};
const MERGE_ENV = {git: {commit: true, push: ['claude/w'], merge: {to: 'main'}, deploy: 'verify'}, providers: {github: GH}, budgets: BUDGET(6)};
const PRE = (root, input, id) => pre(root, 'mcp__github__merge_pull_request', {owner: 'o', repo: 'r', pullNumber: 12, ...input}, {tool_use_id: id});
test('RB06 een PR-merge is gebonden aan de remote PR-head én aan de gereviewde READY-commit (reviewscenario: een verouderd gepushte werkbranch)', met(async (root, cfg) => {
  gitFixture(root);
  executing(root, {envelope: MERGE_ENV});
  snapCommit(root);
  const r = await runCommand(root, 't_ok'); runAgent(root, {configDir: cfg}); makeResult(root, r.evidence_path); // v3.3.1: merge is HIGH, dus ook een onafhankelijk READY-oordeel
  const ready = HEAD(root), oud = sh(root, 'rev-parse', 'HEAD~1').stdout.trim();
  const maak = {owner: 'o', repo: 'r', base: 'main', head: 'claude/w', title: 'x'};
  const maakPr = (nr, sha, id) => { pre(root, 'mcp__github__create_pull_request', maak, {tool_use_id: id}); hook(root, {hook_event_name: 'PostToolUse', tool_name: 'mcp__github__create_pull_request', tool_use_id: id, tool_input: maak, tool_response: {number: nr, ...(sha ? {head: {sha}} : {})}}); };
  const lees = (nr, sha) => hook(root, {hook_event_name: 'PostToolUse', tool_name: 'mcp__github__pull_request_read', tool_use_id: 'l' + Math.random(), tool_input: {method: 'get', owner: 'o', repo: 'r', pullNumber: nr}, tool_response: {number: nr, head: {sha}}});
  // De PR is gemaakt en gelezen terwijl de remote werkbranch nog op een oudere commit stond dan het READY-resultaat.
  maakPr(12, oud, 'p1');
  assert.match(msg(() => PRE(root, {}, 'm0')), /expectedHeadSha/, 'zonder expectedHeadSha geen merge');
  assert.match(msg(() => PRE(root, {expectedHeadSha: ready}, 'm1')), /expectedHeadSha .* niet de remote PR-head/, 'de PR-head is niet de gereviewde commit');
  assert.match(msg(() => PRE(root, {expectedHeadSha: oud}, 'm2')), /niet de commit van het READY-resultaat/, 'de merge slaagde met READY-bewijs van een andere commit');
  // zonder waarneming van de remote head (geen sha in de respons) kan er niets worden samengevoegd
  maakPr(13, null, 'p2'); assert.match(msg(() => PRE(root, {pullNumber: 13, expectedHeadSha: ready}, 'm3')), /nog niet gelezen/);
  // de PR-head is bijgewerkt na de review: lezen legt de nieuwe remote head vast
  lees(12, ready);
  assert.match(msg(() => PRE(root, {expectedHeadSha: ready}, 'm4')), /origin\/claude\/w staat niet op de commit/, 'de gepushte werkbranch staat nog op de verouderde commit');
  sh(root, 'update-ref', 'refs/remotes/origin/claude/w', ready);
  lees(12, 'f'.repeat(40)); assert.match(msg(() => PRE(root, {expectedHeadSha: ready}, 'm5')), /niet de remote PR-head/, 'de PR-head veranderde na de review');
  lees(12, ready);
  assert.match(msg(() => PRE(root, {owner: 'x', expectedHeadSha: ready}, 'm6')), /zelf heeft gemaakt/, 'een PR van een andere repository');
  // de pull request moet ná de laatste push zijn gelezen
  withLock(root, () => { const s = loadWork(root, 'W-T'); s.last_push = {at: new Date(Date.now() + 60000).toISOString(), branch: 'claude/w'}; saveWork(root, s); });
  assert.match(msg(() => PRE(root, {expectedHeadSha: ready}, 'm8')), /gelezen vóór de laatste push/);
  withLock(root, () => { const s = loadWork(root, 'W-T'); delete s.last_push; saveWork(root, s); });
  assert.equal(PRE(root, {expectedHeadSha: ready}, 'm7'), null, 'alles gelijk: remote PR-head, expectedHeadSha, READY-commit, lokale HEAD en gepushte branch');
}));
test('RB06 owner, repo en head zijn verplicht vastgepind in de envelop; de deploy-gate is aan de READY-commit gebonden', met(async (root, cfg) => {
  const bron = contract({envelope: MERGE_ENV}); assert.doesNotThrow(() => validateContract(structuredClone(bron)));
  for (const weg of ['owner', 'repo', 'head']) { const c = contract({envelope: {...MERGE_ENV, providers: {github: {...GH, [weg]: undefined}}}}); delete c.envelope.providers.github[weg]; assert.throws(() => validateContract(structuredClone(c)), /GitHub/, weg); }
  assert.throws(() => validateContract(structuredClone(contract({envelope: {...MERGE_ENV, providers: {github: {...GH, head: 'claude/andere'}}}}))), /werkbranch uit envelop\.git\.push/);
  gitFixture(root);
  executing(root, {envelope: {git: {commit: true, push: ['claude/w'], merge: null, deploy: 'trigger'}}, plan: {...contract().plan}});
  snapCommit(root);
  const r = await runCommand(root, 't_ok'); runAgent(root, {configDir: cfg}); makeResult(root, r.evidence_path);
  const s = st(root); assert.doesNotThrow(() => assertGate(root, s, s.contract, 'deploy'));
  sh(root, 'commit', '-q', '--allow-empty', '-m', 'na het rapport');
  assert.throws(() => assertGate(root, s, s.contract, 'deploy'), /hoort bij commit/);
}));

// ---------------------------------------------------------------- RB07
test('RB07 zonder GO verandert geen gevolgd bestand: prune, een gevolgd voorstel of contract.json, en door hooks geschreven samenvattingen van een analyse', met(async (root, cfg) => {
  installRuntime(root); gitFixture(root);
  // scenario 1: prune verwijdert docs/aae/work/<id>/raw, een niet genegeerde (dus gevolgde) map, voor READY-pakketten ouder dan 7 dagen
  const werk = 'docs/aae/work/W-OUD';
  put(root, werk + '/raw/r1.md', 'bewaard ruw rapport'); put(root, werk + '/state.json', {version: 4, id: 'W-OUD', status: 'READY', updated: '2020-01-01T00:00:00.000Z', usage: {agents: 0, commands: 0, external: 0}, history: [], blockers: [], agents: {}, receipts: []});
  put(root, '.claude/aae/state/raw/W-OUD/x.src.txt', 'ongevolgd ruw bronrapport');
  sh(root, 'add', '-f', werk + '/raw/r1.md'); sh(root, 'commit', '-q', '-m', 'ruw rapport gevolgd');
  const p = cliRun(root, 'prune'); assert.equal(p.status, 0, p.stderr);
  const uit = JSON.parse(p.stdout);
  assert.ok(fs.existsSync(path.join(root, werk, 'raw/r1.md')), 'het gevolgde bestand is niet verwijderd');
  assert.ok(uit.overgeslagen.some(x => x.startsWith(werk + '/raw')), JSON.stringify(uit)); assert.ok(uit.verwijderd.includes('.claude/aae/state/raw/W-OUD'), 'ongevolgde ruwe lagen verdwijnen wel');
  assert.equal(sh(root, 'status', '--porcelain', '--untracked-files=no').stdout.trim(), '', 'geen gevolgd bestand is gewijzigd');
  // scenario 2: een na een commit gevolgd voorstel of contract.json kon zonder GO worden overschreven
  const c = validateContract(structuredClone(contract())); put(root, proposalFile('W-T'), c);
  sh(root, 'add', '-f', proposalFile('W-T')); sh(root, 'commit', '-q', '-m', 'voorstel gevolgd');
  assert.match(msg(() => pre(root, 'Write', {file_path: path.join(root, proposalFile('W-T')), content: JSON.stringify(c)})), /Zonder AAE GO verander ik geen gevolgde/, 'een gevolgd voorstel is geen vrije administratie');
  for (const p2 of ['docs/aae/work/W-T/contract.json', 'docs/aae/work/W-T/approved/001-abcdef012345.json']) assert.match(msg(() => write(root, p2)), /beschermd/, p2 + ': snapshots en contract.json schrijft alleen de runtime');
  assert.equal(write(root, 'docs/aae/notes/vrij.md', 'ongevolgde notitie'), null, 'ongevolgde administratie blijft vrij');
}));
test('RB07 een analyse-werkpakket schrijft geen gevolgd bestand: samenvattingen gaan naar een ongevolgde plek, alleen leescommando\'s en een controle op gevolgde wijzigingen', met(async (root, cfg) => {
  gitFixture(root);
  const analyse = {envelope: {phase: 'analysis', areas: []}, plan: {...contract().plan, commands: [], test_plan: [{kind: 'analysis', method: 'inspection', description: 'Beschrijf de bevindingen en wat niet is gecontroleerd.'}]}};
  assert.equal(plan(root, analyse).status, 'EXECUTING', 'een pure analyse start zonder GO');
  runAgent(root, {configDir: cfg});
  const rep = st(root).agents['tu-agent-1'].report;
  assert.ok(rep.digest_path.startsWith('docs/aae/notes/runs-W-T/'), rep.digest_path); assert.ok(fs.existsSync(path.join(root, rep.digest_path)));
  assert.ok(!fs.existsSync(path.join(root, 'docs/aae/work/W-T/runs')), 'geen map runs/ onder het gevolgde pad');
  assert.equal(sh(root, 'status', '--porcelain', '--untracked-files=no').stdout.trim(), '');
  // een analyse voert alleen leescommando's uit (geen projectcode die gevolgde bestanden kan schrijven)
  const metTest = {envelope: {phase: 'analysis', areas: []}, plan: {...analyse.plan, commands: [{id: 't_ok', argv: ['node', '--test', 'src/ok.test.mjs'], purpose: 'test', why: 'Een test in een analyse.', watch: [], timeout_ms: 5000, max_runs: 1}]}};
  assert.throws(() => validateContract(structuredClone(contract({id: 'W-X', ...metTest}))), /alleen leescommando/);
  // de controle op gevolgde wijzigingen ziet een wijziging aan een gevolgd bestand
  const voor = trackedFingerprint(root); fs.writeFileSync(path.join(root, 'package.json'), '{"name":"gewijzigd"}\n');
  assert.notEqual(trackedFingerprint(root), voor);
}));
test('RB07 vrij schrijven is ook in een echte git-map getoetst (GB14 deed dat alleen zonder git): een gevolgd resultaatbestand valt onder de GO-regel', met(root => {
  gitFixture(root);
  assert.equal(pre(root, 'Write', {file_path: path.join(root, 'docs/aae/work/W-T/result.json'), content: '{"a":1}'}), null, 'ongevolgd resultaat is vrij');
  put(root, 'docs/aae/work/W-T/result.json', '{"a":1}');
  sh(root, 'add', '-f', 'docs/aae/work/W-T/result.json'); sh(root, 'commit', '-q', '-m', 'resultaat gevolgd');
  assert.match(msg(() => pre(root, 'Write', {file_path: path.join(root, 'docs/aae/work/W-T/result.json'), content: '{"a":2}'})), /Zonder AAE GO verander ik geen gevolgde/);
  assert.match(msg(() => write(root, 'docs/aae/PROGRESS.md')), /Zonder AAE GO/);
}));

// ---------------------------------------------------------------- RB10
const sd = (root, id = 'W-T') => path.join(root, snapshotDir(id));
const leesSnap = (root, naam, id = 'W-T') => JSON.parse(fs.readFileSync(path.join(sd(root, id), naam), 'utf8'));
test('RB10 bij AAE GO legt de runtime als eerste schrijfactie een tracked, append-only snapshot van de exacte goedgekeurde envelop met volledige hash vast', met(root => {
  plan(root); const p = presentProposal(root, 'W-T');
  assert.ok(!fs.existsSync(sd(root)), 'vóór de GO is er geen gevolgde schrijfactie');
  assert.equal(loadWork(root, 'W-T').approved, null);
  prompt(root, p.exacte_go);
  const [naam, ...rest] = listSnapshots(root, 'W-T'); assert.equal(rest.length, 0); assert.match(naam, /^001-[0-9a-f]{12}\.json$/);
  const s = leesSnap(root, naam), c = st(root).contract, h = envelopeHash(c);
  assert.equal(s.hash, h); assert.equal(s.hash.length, 64); assert.equal(s.sequence, 1); assert.equal(s.previous_hash, null); assert.equal(s.work_id, 'W-T');
  assert.equal(s.contract.goal, c.goal); assert.deepEqual(s.contract.envelope.acceptance, c.envelope.acceptance); assert.deepEqual(s.contract.envelope.areas, c.envelope.areas);
  for (const sleutel of ['risk_class', 'risk_flags']) assert.deepEqual(s.contract[sleutel], c[sleutel], sleutel);
  for (const sleutel of ['phase', 'db_max', 'providers', 'git', 'budgets', 'decision_points', 'decision_defaults', 'extra_commands']) assert.deepEqual(s.contract.envelope[sleutel], c.envelope[sleutel], sleutel);
  assert.deepEqual(s.envelope.write, ['src']); assert.deepEqual(s.evidence_floor, c.plan.test_plan.map(t => ({kind: t.kind, method: t.method, description: t.description})));
  assert.equal(st(root).snapshot.path, snapshotDir('W-T') + '/' + naam);
  // de snapshot is van de runtime: het model kan hem niet schrijven of overschrijven
  assert.match(msg(() => write(root, snapshotDir('W-T') + '/' + naam)), /beschermd/); assert.match(msg(() => write(root, snapshotDir('W-T') + '/002-aaaaaaaaaaaa.json')), /beschermd/);
  const voor = fs.readFileSync(path.join(sd(root), naam), 'utf8'); writeSnapshot(root, loadWork(root, 'W-T')); assert.equal(fs.readFileSync(path.join(sd(root), naam), 'utf8'), voor, 'idempotent: nooit overschreven');
}));
test('RB10 (v3.3.1) kan de snapshot blijvend niet worden geschreven, dan wordt het pakket BLOCKED (geen NEEDS_HUMAN: het is technisch) en gaat geen enkele schrijfactie voor; na herstel van het probleem hervat AAE VERDER', met(root => {
  plan(root); const p = presentProposal(root, 'W-T');
  put(root, 'docs/aae/work/W-T/approved', 'dit is een bestand, geen map'); // blokkeert het aanmaken van de snapshot
  prompt(root, p.exacte_go);
  assert.equal(st(root).status, 'BLOCKED'); assert.equal(st(root).needs_human, null, 'een snapshotfout is geen beslissing van Jurgen');
  assert.match(st(root).blockers[0], /Snapshot .* niet worden vastgelegd/); assert.ok(st(root).history.some(h => h.type === 'snapshot_geblokkeerd'));
  assert.match(msg(() => write(root, 'src/a.js')), /Geen werkpakket in uitvoering/, 'er is geen enkele schrijfactie vóór de snapshot');
  prompt(root, 'AAE VERDER'); assert.equal(st(root).status, 'BLOCKED', 'zolang het probleem er is, hervat het pakket niet');
  fs.rmSync(path.join(root, 'docs/aae/work/W-T/approved'));
  prompt(root, 'AAE VERDER'); assert.equal(st(root).status, 'EXECUTING'); assert.equal(listSnapshots(root, 'W-T').length, 1);
  assert.equal(write(root, 'src/a.js'), null);
}));
test('RB10 (v3.3.1) een verdwenen snapshot wordt door de runtime teruggezet zonder blokkade; een blijvende fout geeft na herpogingen een fout', met(root => {
  executing(root);
  const [naam] = listSnapshots(root, 'W-T'), f = path.join(sd(root), naam), orig = fs.readFileSync(f, 'utf8');
  fs.rmSync(f); // de snapshot is verdwenen: de runtime schrijft hem terug, het model nooit
  assert.equal(write(root, 'src/a.js'), null); assert.equal(st(root).status, 'EXECUTING');
  assert.equal(fs.readFileSync(f, 'utf8'), orig, 'dezelfde snapshot, byte voor byte');
  fs.rmSync(f); fs.mkdirSync(f); // een map op de plek van het bestand: elke poging faalt
  const t0 = Date.now();
  assert.throws(() => writeSnapshotRetry(root, loadWork(root, 'W-T'), 'AAE GO', {pogingen: 3, wacht: 20}), /onleesbaar|beschadigd/);
  assert.ok(Date.now() - t0 >= 50, 'er is gewacht tussen de pogingen (20 + 40 ms)');
}));
test('RB10 een latere materiële wijziging geeft na een nieuwe GO een nieuwe snapshot met vorige-hash-keten; de bestaande snapshot blijft onaangeroerd; een beschadigde snapshot stopt elke handeling', met(root => {
  executing(root);
  const [een] = listSnapshots(root, 'W-T'), eerste = fs.readFileSync(path.join(sd(root), een), 'utf8');
  const u = registerContract(root, validateContract(structuredClone(contract({envelope: {areas: [{name: 'Broncode', write: ['src'], support: ['tests']}, {name: 'Applicatie', write: ['app']}]}}))));
  assert.equal(u.status, 'NEEDS_HUMAN'); assert.equal(listSnapshots(root, 'W-T').length, 1, 'zonder nieuwe GO geen nieuwe snapshot');
  go(root);
  const lijst = listSnapshots(root, 'W-T'); assert.equal(lijst.length, 2); assert.equal(fs.readFileSync(path.join(sd(root), lijst[0]), 'utf8'), eerste, 'de eerste snapshot is niet overschreven');
  const twee = leesSnap(root, lijst[1]); assert.equal(twee.sequence, 2); assert.equal(twee.previous_hash, leesSnap(root, lijst[0]).hash); assert.deepEqual(twee.envelope.write, ['app', 'src']);
  assert.equal(verifyChain(root, 'W-T').chain.length, 2);
  // een handmatig gewijzigde snapshot: elke bewakingshandeling weigert en het pakket wacht op een beslissing
  const f = path.join(sd(root), lijst[1]); const s = JSON.parse(fs.readFileSync(f, 'utf8')); s.contract.goal = 'Een heel ander doel dat nooit is goedgekeurd door de gebruiker.'; fs.writeFileSync(f, JSON.stringify(s, null, 2));
  assert.match(msg(() => write(root, 'src/a.js')), /beschadigd of handmatig gewijzigd/); assert.equal(st(root).status, 'BLOCKED', 'v3.3.1: een technische snapshotfout is BLOCKED, geen NEEDS_HUMAN'); assert.equal(st(root).needs_human, null);
}));
test('RB10 herstel na verlies van sessie of container: cli recover bouwt uit de snapshot-keten plus de repository-staat op wat was goedgekeurd; PAUSED; AAE VERDER hervat uitsluitend dezelfde envelop en is geen nieuwe GO', met(root => {
  gitFixture(root); executing(root, {envelope: {git: {commit: true, push: ['claude/w'], merge: null, deploy: 'none'}}});
  const goedgekeurd = st(root).approved.envelope_hash, doel = st(root).contract.goal;
  assert.match(msg(() => recoverWork(root, 'W-T')), /nog een geldige lokale status/, 'met een werkende state is herstel niet nodig');
  // het snapshot is nog niet vastgelegd: dan overleeft het een verlies van de container niet
  fs.rmSync(path.join(root, 'docs/aae/work/W-T/state.json'));
  assert.match(msg(() => recoverWork(root, 'W-T')), /niet \(ongewijzigd\) in de laatste commit vastgelegd/);
  // hij is vastgelegd: de sessie vermeldt dat er te herstellen valt
  snapCommit(root);
  assert.match(JSON.stringify(hook(root, {hook_event_name: 'SessionStart'})), /W-T ontbreekt of is beschadigd[\s\S]*cli\.mjs recover/);
  const r = recoverWork(root, 'W-T');
  assert.equal(r.status, 'PAUSED'); assert.equal(r.volledige_hash, goedgekeurd); assert.equal(r.doel, doel);
  const s = st(root); assert.equal(s.approved.envelope_hash, goedgekeurd); assert.equal(s.approved.snapshot_required, true);
  assert.ok(denies(() => write(root, 'src/a.js')), 'op PAUSED geen schrijfrechten');
  // een kale GO of een GO met de hash van de goedgekeurde envelop hervat niet stilzwijgend: alleen AAE VERDER hervat dezelfde envelop
  assert.match(JSON.stringify(prompt(root, 'AAE GO')), /GO geweigerd/);
  // het voorstel opnieuw registreren binnen de envelop houdt de goedkeuring; erbuiten wacht het op een nieuwe GO
  const binnen = registerContract(root, validateContract(structuredClone(contract({envelope: {git: {commit: true, push: ['claude/w'], merge: null, deploy: 'none'}}}))));
  assert.deepEqual(binnen.reasons, []); assert.equal(st(root).status, 'PAUSED');
  prompt(root, 'AAE VERDER'); assert.equal(st(root).status, 'EXECUTING'); assert.equal(st(root).approved.envelope_hash, goedgekeurd, 'dezelfde envelop, geen nieuwe GO');
  assert.equal(write(root, 'src/a.js'), null);
  // een gewijzigd voorstel is nooit te hervatten met VERDER: het vraagt een nieuwe GO met ID en hash
  const buiten = registerContract(root, validateContract(structuredClone(contract({goal: 'Een ander doel dan het goedgekeurde, nog niet getoond aan de gebruiker.', envelope: {git: {commit: true, push: ['claude/w'], merge: null, deploy: 'none'}}}))));
  assert.equal(buiten.status, 'NEEDS_HUMAN'); prompt(root, 'AAE VERDER'); assert.equal(st(root).status, 'NEEDS_HUMAN');
}));
test('RB10 een beschadigde, handmatig gewijzigde of onvolledige keten wordt bij herstel geweigerd; een beschadigde state wordt opzij gezet', met(root => {
  gitFixture(root); executing(root);
  snapCommit(root);
  const [naam] = listSnapshots(root, 'W-T'), f = path.join(sd(root), naam), orig = fs.readFileSync(f, 'utf8');
  fs.rmSync(path.join(root, 'docs/aae/work/W-T/state.json'));
  const s = JSON.parse(orig); s.contract.goal = 'Handmatig aangepast doel dat nooit is goedgekeurd door de gebruiker.'; fs.writeFileSync(f, JSON.stringify(s, null, 2));
  assert.match(msg(() => recoverWork(root, 'W-T')), /beschadigd of handmatig gewijzigd/);
  fs.writeFileSync(f, orig);
  const t = JSON.parse(orig); t.sequence = 3; fs.writeFileSync(f, JSON.stringify(t, null, 2)); assert.match(msg(() => recoverWork(root, 'W-T')), /beschadigd|volgnummer|bestandsnaam/);
  fs.writeFileSync(f, orig);
  // een beschadigde state.json (geen JSON) telt als verloren: herstel zet hem opzij
  fs.writeFileSync(path.join(root, 'docs/aae/work/W-T/state.json'), '{kapot');
  assert.equal(recoverWork(root, 'W-T').status, 'PAUSED');
  assert.ok(fs.readdirSync(path.join(root, 'docs/aae/work/W-T')).some(n => n.startsWith('state.json.beschadigd-')));
}));
test('RB10 (v3.3.1) geen verplichte commitvolgorde: bronwijzigingen mogen vóór de snapshotcommit; READY eist een lokaal geldige snapshot, de merge-gate eist hem in HEAD', met(async (root, cfg) => {
  gitFixture(root); executing(root, {envelope: {git: {commit: true, push: ['claude/w'], merge: null, deploy: 'none'}}});
  assert.equal(write(root, 'src/a.js'), null, 'geen "commit eerst de snapshot" meer vóór de eerste bronwijziging');
  const r = await runCommand(root, 't_ok'); makeResult(root, r.evidence_path);
  assert.doesNotThrow(() => assertReady(root, st(root), st(root).contract, ''), 'READY: een lokaal geldige snapshot is genoeg, ook zonder commit');
  const [naam] = listSnapshots(root, 'W-T'), f = path.join(sd(root), naam), orig = fs.readFileSync(f, 'utf8');
  fs.rmSync(f); assert.throws(() => assertReady(root, st(root), st(root).contract, ''), /lokale snapshot/, 'READY: zonder snapshot geen READY');
  fs.writeFileSync(f, orig.replace('"goal"', '"goal "')); assert.throws(() => assertReady(root, st(root), st(root).contract, ''), /beschadigd of handmatig gewijzigd/, 'READY: een gewijzigde snapshot telt niet');
  fs.writeFileSync(f, orig);
  assert.doesNotThrow(() => { const t = reportTemplate(root); assert.ok(t.git_head); });
}));
test('RB10 (v3.3.1) de merge-gate houdt de eis dat de snapshot in HEAD staat (alleen daar, niet meer bij READY of schrijven)', met(async (root, cfg) => {
  gitFixture(root); executing(root, {envelope: {git: {commit: true, push: ['claude/w'], merge: {to: 'main'}, deploy: 'verify'}}});
  const r = await runCommand(root, 't_ok'); runAgent(root, {configDir: cfg}); makeResult(root, r.evidence_path);
  const s = st(root);
  assert.throws(() => assertGate(root, s, s.contract, 'merge'), /Gate merge: de snapshot van de goedgekeurde envelop .* niet in de laatste commit/);
}));
