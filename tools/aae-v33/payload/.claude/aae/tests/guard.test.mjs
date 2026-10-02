// Bewaking (pariteit met de v3.2-guardtests; elke test heeft een G-code die de pariteitsmatrix gebruikt).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {fixture, cleanup, contract, plan, executing, go, st, prompt, hook, pre, write, bash, denies, agentCall, runAgent, REPORT, WHY, writeTranscript, put, installRuntime, spawnHook} from './helpers.mjs';
import {validateContract, sourceDigest, classifyCommand, clock} from '../runtime/core.mjs';
import {loadWork, saveWork, withLock, contractFile, newState} from '../runtime/state.mjs';
import {liveRows, reconcile} from '../runtime/reports.mjs';
import {presentProposal} from '../runtime/commands.mjs';

const met = fn => async () => { const root = fixture(); const cfg = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'aae33cfg-'))); process.env.CLAUDE_CONFIG_DIR = cfg; try { await fn(root, cfg); } finally { cleanup(root); cleanup(cfg); delete process.env.CLAUDE_CONFIG_DIR; clock.ms = () => Date.now(); } };
const msg = (fn) => { const e = denies(fn); assert.ok(e, 'verwacht een weigering'); return e.message; };
const contractWrite = (root, c) => { const v = validateContract(structuredClone(c)); put(root, contractFile(v.id), v); hook(root, {hook_event_name: 'PostToolUse', tool_name: 'Write', tool_input: {file_path: path.join(root, contractFile(v.id)), content: JSON.stringify(v)}, tool_response: {}}); return v; };

test('G01 zonder werkpakket in uitvoering worden geen applicatiebestanden gewijzigd', met(root => {
  assert.match(msg(() => write(root, 'src/a.js')), /Geen werkpakket in uitvoering/);
  plan(root);
  assert.match(msg(() => write(root, 'src/a.js')), /Geen werkpakket in uitvoering/, 'ook niet terwijl het plan op GO wacht');
}));
test('G02 runtime, projectinstructies, instellingen en administratie zijn beschermd, ook binnen een goedgekeurd werkpakket', met(root => {
  executing(root);
  for (const p of ['.claude/settings.json', 'CLAUDE.md', '.claude/aae/runtime/core.mjs', '.env', 'docs/aae/work/W-T/state.json', '.git/config']) assert.match(msg(() => write(root, p)), /beschermd/, p);
}));
test('G03 een niet ingevuld contractsjabloon kan niet worden geregistreerd', () => {
  const t = JSON.parse(fs.readFileSync(new URL('../templates/contract.template.json', import.meta.url), 'utf8'));
  assert.throws(() => validateContract(t));
});
test('G04 een vormloos of tweeregelig contract kan niet worden geregistreerd', () => {
  assert.throws(() => validateContract({id: 'W-X', goal: 'doe iets'}));
  assert.throws(() => validateContract({schema_version: 4, id: 'W-X', title: 'T', goal: 'Doel dat lang genoeg is.'}));
  assert.throws(() => validateContract('tekst'));
});
test('G05 analyse is geen bouwtoestemming; van analyse naar implementatie is een wezenlijke wijziging met een nieuwe GO', met(root => {
  const analyse = {envelope: {phase: 'analysis', areas: []}, plan: {...contract().plan, agents: [], commands: [], test_plan: [{kind: 'analysis', method: 'inspection', description: 'Beschrijf de bevindingen en wat niet is gecontroleerd.'}]}};
  executing(root, analyse);
  assert.match(msg(() => write(root, 'src/a.js')), /Analyse-only/);
  contractWrite(root, contract());
  assert.equal(st(root).status, 'NEEDS_HUMAN');
  assert.ok(st(root).needs_human.reasons.includes('fase'));
  assert.match(msg(() => write(root, 'src/a.js')), /Geen werkpakket in uitvoering/);
}));
test('G08 het contract wordt alleen als volledig, gevalideerd JSON-bestand met Write vervangen', met(root => {
  executing(root);
  const f = path.join(root, contractFile('W-T')), c = validateContract(structuredClone(contract()));
  assert.equal(pre(root, 'Write', {file_path: f, content: JSON.stringify(c)}), null);
  assert.match(msg(() => pre(root, 'Edit', {file_path: f, old_string: 'a', new_string: 'b'})), /volledig JSON-bestand met Write/);
  assert.ok(denies(() => pre(root, 'Write', {file_path: f, content: '{kapot'})));
  assert.ok(denies(() => pre(root, 'Write', {file_path: f, content: JSON.stringify({...c, id: 'W-ANDERS'})})));
  assert.ok(denies(() => pre(root, 'Write', {file_path: f, content: JSON.stringify({...c, schema_version: 3})})));
}));
test('G10 een symbolische link in een administratiepad kan niet naar code verwijzen', met(root => {
  executing(root);
  fs.mkdirSync(path.join(root, 'docs/aae/notes'), {recursive: true}); fs.rmSync(path.join(root, 'docs/aae/notes'), {recursive: true});
  fs.symlinkSync(path.join(root, 'src'), path.join(root, 'docs/aae/notes'));
  assert.match(msg(() => write(root, 'docs/aae/notes/x.md')), /Symbolische link/);
}));
test('G11 een symbolische link als bovenliggende map van het gebied wordt geweigerd', met(root => {
  executing(root);
  fs.rmSync(path.join(root, 'src'), {recursive: true}); fs.mkdirSync(path.join(root, 'elders'));
  fs.symlinkSync(path.join(root, 'elders'), path.join(root, 'src'));
  assert.match(msg(() => write(root, 'src/a.js')), /Symbolische link/);
}));
test('G12 secrets en testauthenticatie zijn geen directe lees- of schrijfdoelen (ook niet voor modeltools)', met(root => {
  executing(root);
  for (const p of ['.env', '.env.local', '.claude/aae/private/auth.json']) assert.ok(denies(() => pre(root, 'Read', {file_path: path.join(root, p)})), 'lezen ' + p);
  assert.ok(denies(() => write(root, '.env')));
  fs.writeFileSync(path.join(root, '.env.example'), 'NAAM=\n');
  assert.equal(pre(root, 'Read', {file_path: path.join(root, '.env.example')}), null);
}));
test('G13 niet-geplande agents en niet-AAE-agenttypen worden geweigerd', met(root => {
  executing(root);
  for (const t of ['Explore', 'general-purpose', 'Plan', 'aae-security-reviewer']) assert.match(msg(() => agentCall(root, {id: 'x-' + t, role: t})), /Agent niet toegestaan/, t);
  assert.match(msg(() => agentCall(root, {id: 'x-arch', role: 'aae-architect'})), /staat niet in het plan/);
  assert.match(msg(() => agentCall(root, {id: 'x-sec', prompt: 'WAAROM-AGENT: onafhankelijke beveiligingscontrole die ik niet zelf doe\nFOCUS: security\nBeoordeel src.'})), /staat niet in het plan/);
  assert.equal(st(root).usage.agents, 0);
}));
test('G14 het agentverbruik overleeft herregistratie van het contract', met((root, cfg) => {
  executing(root);
  runAgent(root, {configDir: cfg});
  const c = contract(); c.plan = {...c.plan, agents: [...c.plan.agents, {name: 'aae-architect', question: 'Ontwerp een kleinere variant van de oplossing.', files: ['src']}]};
  contractWrite(root, c);
  assert.equal(st(root).usage.agents, 1);
  assert.equal(st(root).status, 'EXECUTING');
}));
test('G15 een agentreservering is idempotent voor dezelfde tool-ID en weigert hergebruik met andere invoer', met(root => {
  executing(root);
  const a = agentCall(root, {id: 'tu-1'}), b = agentCall(root, {id: 'tu-1'});
  assert.deepEqual(a, b);
  assert.equal(st(root).usage.agents, 1);
  assert.match(msg(() => agentCall(root, {id: 'tu-1', vraag: 'Een volledig andere vraag.'})), /Tool-ID hergebruikt/);
}));
test('G16 het door het plan gekozen model wordt ingezet, niet een duurder gevraagd model', met(root => {
  executing(root);
  const r = pre(root, 'Agent', {subagent_type: 'aae-reviewer', description: 'x', prompt: WHY + 'Beoordeel src.', model: 'opus', run_in_background: false}, {tool_use_id: 'tu-m'});
  assert.equal(r.hookSpecificOutput.updatedInput.model, 'sonnet');
  assert.equal(r.hookSpecificOutput.updatedInput.run_in_background, false);
}));
test('G18 het contract wordt niet gewijzigd terwijl een agent loopt', met(root => {
  executing(root);
  agentCall(root, {id: 'tu-1'});
  const c = validateContract(structuredClone(contract()));
  assert.match(msg(() => pre(root, 'Write', {file_path: path.join(root, contractFile('W-T')), content: JSON.stringify(c)})), /tijdens lopend werk/);
}));
test('G19 met een agentbudget van nul start er geen agent', met(root => {
  executing(root, {envelope: {budgets: {agent_calls: {soft: 0, hard: 0}, command_runs: 20, external_calls: 0, max_parallel: 1}}});
  assert.match(msg(() => agentCall(root)), /Hard agentplafond \(0\)/);
}));
test('G20 een tweede werkpakket start niet zolang een ander actief is; één bouwer per werkmap', met(root => {
  executing(root);
  plan(root, {id: 'W-U'});
  assert.equal(st(root, 'W-U').status, 'WAITING_FOR_APPROVAL');
  const p = presentProposal(root, 'W-U');
  assert.match(msg(() => prompt(root, p.exacte_go)), /nog actief/);
  assert.equal(st(root, 'W-U').status, 'WAITING_FOR_APPROVAL');
  assert.equal(st(root).status, 'EXECUTING');
}));
test('G21 specialisten kunnen niet schrijven of een shell draaien; G22 en niet delegeren', met(root => {
  executing(root);
  agentCall(root, {id: 'tu-1'}); hook(root, {hook_event_name: 'SubagentStart', agent_type: 'aae-reviewer', agent_id: 'sub00001'});
  const sub = {agent_id: 'sub00001', agent_type: 'aae-reviewer'};
  assert.match(msg(() => pre(root, 'Write', {file_path: path.join(root, 'src/a.js'), content: 'x'}, sub)), /read-only/);
  assert.match(msg(() => pre(root, 'Bash', {command: 'git status'}, sub)), /read-only/);
  assert.match(msg(() => pre(root, 'Skill', {skill: 'x'}, sub)), /read-only/);
  assert.match(msg(() => pre(root, 'Agent', {subagent_type: 'aae-reviewer', prompt: WHY + 'x', run_in_background: false}, sub)), /geen andere agents/);
}));
test('G23 een niet-geregistreerde agent mag niets lezen; een geregistreerde alleen het afgesproken pakket', met(root => {
  executing(root);
  assert.match(msg(() => pre(root, 'Read', {file_path: path.join(root, 'src/a.js')}, {agent_id: 'wild0001', agent_type: 'aae-reviewer'})), /Geen geldige geregistreerde agentaanroep/);
  agentCall(root, {id: 'tu-1'}); hook(root, {hook_event_name: 'SubagentStart', agent_type: 'aae-reviewer', agent_id: 'sub00001'});
  const sub = {agent_id: 'sub00001', agent_type: 'aae-reviewer'};
  assert.equal(pre(root, 'Read', {file_path: path.join(root, 'src/a.js')}, sub), null);
  assert.match(msg(() => pre(root, 'Read', {file_path: path.join(root, 'app/x.ts')}, sub)), /alleen het afgesproken werkpakket/);
}));
test('G25 met max_parallel 2 draaien twee verschillende alleen-lezen agents tegelijk', met(root => {
  executing(root, {envelope: {budgets: {agent_calls: {soft: 2, hard: 4}, command_runs: 20, external_calls: 0, max_parallel: 2}}});
  agentCall(root, {id: 'tu-1', vraag: 'Beoordeel src/a.js.'});
  assert.ok(agentCall(root, {id: 'tu-2', vraag: 'Beoordeel src/b.js.'}));
  assert.equal(st(root).usage.agents, 2);
}));
test('G26 achtergrondtelemetrie geeft een slot niet vroegtijdig vrij', met(root => {
  executing(root);
  agentCall(root, {id: 'tu-1'});
  hook(root, {hook_event_name: 'PostToolUse', tool_name: 'Agent', tool_use_id: 'tu-1', tool_input: {}, tool_response: {status: 'async_launched', agentId: 'bg000001'}});
  assert.equal(st(root).agents['tu-1'].status, 'running');
  assert.equal(liveRows(st(root)).length, 1);
}));
test('G27 een mislukte start verbruikt budget maar houdt geen slot vast', met(root => {
  executing(root);
  agentCall(root, {id: 'tu-1'});
  hook(root, {hook_event_name: 'PostToolUseFailure', tool_name: 'Agent', tool_use_id: 'tu-1', tool_input: {}, error: 'mislukt'});
  assert.equal(st(root).agents['tu-1'].status, 'failed');
  assert.equal(st(root).usage.agents, 1);
  assert.equal(liveRows(st(root)).length, 0);
}));
test('G29 hervatten van een oude agentcontext wordt geweigerd', met(root => {
  executing(root);
  assert.match(msg(() => pre(root, 'Agent', {subagent_type: 'aae-reviewer', prompt: WHY + 'x', run_in_background: false, resume: 'abc'}, {tool_use_id: 'tu-r'})), /Hervatten wordt niet ondersteund/);
}));
test('G32 ook een LIGHT-pakket start niet zonder GO; een expliciete pauze wint daarna van de goedkeuring', met(root => {
  const s = plan(root, {risk_class: 'LIGHT'});
  assert.equal(s.status, 'WAITING_FOR_APPROVAL', 'LIGHT keurt zichzelf niet meer goed');
  assert.equal(s.approved, null);
  assert.match(msg(() => write(root, 'src/a.js')), /Geen werkpakket in uitvoering/);
  go(root);
  assert.equal(st(root).status, 'EXECUTING');
  prompt(root, 'AAE PAUZE');
  assert.equal(st(root).status, 'PAUSED');
  assert.match(msg(() => write(root, 'src/a.js')), /Geen werkpakket in uitvoering/);
  prompt(root, 'Ga gewoon door alsjeblieft');
  assert.equal(st(root).status, 'PAUSED');
}));
test('G34 een dubbele GO is idempotent: dezelfde goedkeuring, geen tweede start', met(root => {
  executing(root);
  const at = st(root).approved.at, h = st(root).approved.envelope_hash;
  assert.match(JSON.stringify(prompt(root, 'AAE GO W-T ' + h.slice(0, 8))), /al geldig/);
  assert.equal(st(root).approved.at, at); assert.equal(st(root).approved.envelope_hash, h);
}));
test('G36 een GO voor een ander werkpakket wordt geweigerd', met(root => {
  plan(root);
  assert.match(msg(() => prompt(root, 'AAE GO W-ANDERS abcdef12')), /niet in een toestand voor GO/);
  assert.equal(st(root).status, 'WAITING_FOR_APPROVAL');
}));
test('G40 na pauze en hervatten blijven de tellers behouden', met((root, cfg) => {
  executing(root);
  runAgent(root, {configDir: cfg});
  prompt(root, 'AAE PAUZE'); prompt(root, 'AAE VERDER');
  assert.equal(st(root).status, 'EXECUTING');
  assert.equal(st(root).usage.agents, 1);
}));
test('G41 afstemming (presumed_dead) ruimt alleen registraties op en behoudt het verbruikte budget', met((root, cfg) => {
  executing(root);
  agentCall(root, {id: 'tu-a'}); hook(root, {hook_event_name: 'SubagentStart', agent_type: 'aae-reviewer', agent_id: 'dood00001'});
  writeTranscript(cfg, 'dood00001', REPORT());
  const t0 = Date.now(), s = st(root);
  reconcile(root, s, {nowMs: t0 + 20 * 60000}); reconcile(root, s, {nowMs: t0 + 22 * 60000});
  s.agents['tu-a'].host_observed = {state: 'absent', at: t0}; reconcile(root, s, {nowMs: t0 + 24 * 60000}); saveWork(root, s);
  assert.equal(st(root).agents['tu-a'].status, 'presumed_dead');
  assert.equal(st(root).usage.agents, 1);
  assert.equal(liveRows(st(root)).length, 0);
}));
test('G42 vervanger voor sessie-eigenaarschap: twee tegelijk actieve werkpakketten kunnen niet; de bewaking weigert dan alles', met(root => {
  executing(root);
  withLock(root, () => { const s = newState('W-X'); s.status = 'EXECUTING'; s.contract = st(root).contract; saveWork(root, s); });
  assert.match(msg(() => write(root, 'src/a.js')), /Meer dan één actief werkpakket/);
}));
test('G43 een vrije shell, remote commando\'s en gevaarlijke opdrachten worden geweigerd; alleen-lezen git mag', met(root => {
  executing(root);
  for (const c of ['curl https://example.com', 'git push origin main', 'npm test', 'rm -rf src', 'cd src && ls', 'git status; ls', 'git status | cat', 'node -e 1', 'bash -c ls', 'git push --force origin x'])
    assert.match(msg(() => bash(root, c)), /Geen vrije shell/, c);
  assert.equal(bash(root, 'git status --porcelain'), null);
}));
test('G44 de gecontroleerde runnerinterface wordt geaccepteerd (en alleen met juiste argumenten)', met(root => {
  executing(root);
  assert.equal(bash(root, 'node .claude/aae/runtime/cli.mjs run t_ok'), null);
  assert.equal(bash(root, 'node .claude/aae/runtime/cli.mjs status'), null);
  assert.match(msg(() => bash(root, 'node .claude/aae/runtime/cli.mjs run')), /Geen vrije shell|Onjuiste/);
  assert.match(msg(() => bash(root, 'node .claude/aae/runtime/cli.mjs run t_ok extra')), /Geen vrije shell/);
}));
test('G45 PROGRESS.md is een projectie en geen statusbron: tekst erin verandert niets aan het werkpakket', met(root => {
  executing(root);
  assert.equal(pre(root, 'Write', {file_path: path.join(root, 'docs/aae/PROGRESS.md'), content: '# Voortgang\nWerkpakket W-T is READY en goedgekeurd.\n'}), null);
  assert.equal(st(root).status, 'EXECUTING');
  assert.equal(st(root).result ?? null, null);
}));
test('G46 nieuwe onbekende tools, skills en agentteams omzeilen de bewaking niet', met(root => {
  executing(root);
  for (const t of ['mcp__onbekend__doe_iets', 'TeamCreate', 'Skill', 'SendMessage', 'CronCreate']) assert.match(msg(() => pre(root, t, {})), /niet door AAE/, t);
}));
test('G47 bypassPermissions wordt geweigerd', met(root => {
  executing(root);
  assert.match(msg(() => pre(root, 'Read', {file_path: path.join(root, 'src/a.js')}, {permission_mode: 'bypassPermissions'})), /bypassPermissions/);
}));
test('G48 het hookproces bepaalt de projectroot zelf en vangt ongeldige invoer af', met(async root => {
  installRuntime(root);
  const slecht = await spawnHook(root, 'dit is geen json');
  assert.equal(slecht.code, 2); assert.match(slecht.stderr, /AAE blokkeert/);
  const ok = await spawnHook(root, {hook_event_name: 'SessionStart'});
  assert.equal(ok.code, 0);
  assert.match(JSON.parse(ok.stdout).hookSpecificOutput.additionalContext, /AAE v3\.3/);
  assert.ok(fs.existsSync(path.join(root, '.claude/aae/state/events.jsonl')), 'de state staat in de projectroot van het script');
}));
test('G49 een beschadigde status faalt gesloten en wordt niet stilzwijgend gereset', met(root => {
  executing(root);
  fs.writeFileSync(path.join(root, 'docs/aae/work/W-T/state.json'), '{kapot');
  assert.ok(denies(() => write(root, 'src/a.js')));
  assert.ok(denies(() => prompt(root, 'AAE STATUS')));
  assert.equal(fs.readFileSync(path.join(root, 'docs/aae/work/W-T/state.json'), 'utf8'), '{kapot');
}));
test('G50 de bronvingerafdruk verandert bij relevante nieuwe bestanden en niet bij irrelevante', met(root => {
  const c = validateContract(structuredClone(contract()));
  const a = sourceDigest(root, c);
  fs.mkdirSync(path.join(root, 'app')); fs.writeFileSync(path.join(root, 'app/x.ts'), 'x');
  assert.equal(sourceDigest(root, c), a, 'buiten gebied/leesscope: gelijk');
  fs.writeFileSync(path.join(root, 'src/nieuw.js'), 'x');
  assert.notEqual(sourceDigest(root, c), a, 'nieuw ongevolgd bestand in het gebied: anders');
}));
test('G53 een expliciete pauze wordt niet opgeheven door een vervolgbericht', met(root => {
  executing(root); prompt(root, 'AAE PAUZE'); prompt(root, 'Vervolg: ik heb nog een vraag over iets anders.');
  assert.equal(st(root).status, 'PAUSED');
}));
test('G55 een wijziging van het plan binnen de goedgekeurde envelop behoudt de GO', met(root => {
  executing(root);
  const voor = st(root).approved.envelope_hash;
  const c = contract(); c.plan = {...c.plan, agents: [...c.plan.agents, {name: 'aae-architect', question: 'Ontwerp een kleinere variant van de oplossing.', files: ['src']}],
    commands: [...c.plan.commands, {id: 't_rood', argv: ['node', '--test', 'src/rood.test.mjs'], purpose: 'test', why: 'Controleert dat een falende test echt faalt.', watch: [], timeout_ms: 60000, max_runs: 2}]};
  contractWrite(root, c);
  assert.equal(st(root).status, 'EXECUTING');
  assert.equal(st(root).approved.envelope_hash, voor);
  assert.ok(st(root).contract.plan.agents.some(a => a.name === 'aae-architect'));
  assert.ok(st(root).contract.plan.commands.some(m => m.id === 't_rood'));
}));
test('G57 een nieuw lokaal testcommando blijft binnen de envelop; een vervallen beslisgrens niet', met(root => {
  executing(root, {envelope: {decision_points: ['Bij een wijziging van de zichtbare tekst eerst vragen.']}});
  const c = contract({envelope: {decision_points: ['Bij een wijziging van de zichtbare tekst eerst vragen.']}});
  c.plan = {...c.plan, commands: [...c.plan.commands, {id: 't_nieuw', argv: ['node', '--test', 'src/rood.test.mjs'], purpose: 'test', why: 'Extra lokale controle.', watch: [], timeout_ms: 60000, max_runs: 2}]};
  contractWrite(root, c);
  assert.equal(st(root).status, 'EXECUTING');
  contractWrite(root, contract({envelope: {decision_points: []}}));
  assert.equal(st(root).status, 'NEEDS_HUMAN');
  assert.ok(st(root).needs_human.reasons.includes('beslisgrenzen'));
}));
test('G58 schemalimieten: runs per gevoelig commando, beslisgrenzen en budgetten', () => {
  const basis = () => contract({envelope: {extra_commands: [{argv: ['npm', 'ci'], purpose: 'install'}]}});
  const ok = basis(); ok.plan.commands.push({id: 'inst', argv: ['npm', 'ci'], purpose: 'install', why: 'Installeert afhankelijkheden.', watch: [], timeout_ms: 60000, max_runs: 1});
  assert.doesNotThrow(() => validateContract(structuredClone(ok)));
  const twee = structuredClone(ok); twee.plan.commands.at(-1).max_runs = 2;
  assert.throws(() => validateContract(twee), /Aantal uitvoeringen/);
  assert.throws(() => validateContract(structuredClone(contract({envelope: {decision_points: Array.from({length: 9}, (_, i) => 'Beslisgrens nummer ' + i)}}))), /Beslisgrenzen/);
  assert.throws(() => validateContract(structuredClone(contract({envelope: {budgets: {agent_calls: {soft: 1, hard: 2}, command_runs: 201, external_calls: 0, max_parallel: 1}}}))), /Commandobudget/);
  const veel = contract(); veel.plan.commands = Array.from({length: 31}, (_, i) => ({id: 'c' + i, argv: ['node', '--test', 'src/ok.test.mjs'], purpose: 'test', why: 'Test nummer ' + i, watch: [], timeout_ms: 5000, max_runs: 1}));
  assert.throws(() => validateContract(veel), /Commando's/);
});
test('G59 B1: een commando kan zijn doel niet veranderen of publicatie als lokale test binnensmokkelen', () => {
  const c = validateContract(structuredClone(contract({envelope: {git: {commit: true, push: ['claude/w'], merge: null, deploy: 'none'}}})));
  assert.equal(classifyCommand(c, {argv: ['git', 'push', '-u', 'origin', 'claude/w'], purpose: 'test'}).ok, false);
  assert.equal(classifyCommand(c, {argv: ['npm', 'publish'], purpose: 'build'}).ok, false);
  assert.equal(classifyCommand(c, {argv: ['node', '--test', 'src/ok.test.mjs'], purpose: 'push'}).ok, false);
  assert.equal(classifyCommand(c, {argv: ['node', '--test', 'src/ok.test.mjs'], purpose: 'deploy'}).ok, false);
  assert.equal(classifyCommand(c, {argv: ['git', 'push', '-u', 'origin', 'claude/w'], purpose: 'push'}).ok, true);
});
test('G63 alle meegeleverde voorbeeldcontracten zijn geldig', () => {
  const dir = new URL('../examples/', import.meta.url);
  const lijst = fs.readdirSync(dir).filter(f => f.endsWith('.json'));
  assert.ok(lijst.length >= 2, 'minstens twee voorbeelden');
  for (const f of lijst) assert.doesNotThrow(() => validateContract(JSON.parse(fs.readFileSync(new URL(f, dir), 'utf8'))), f);
});
