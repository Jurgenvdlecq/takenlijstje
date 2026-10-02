// AAE-V33-001B: één GO per werkpakket, gebonden aan werkpakket-ID + volledige envelop-hash, en één simpele regel voor wijzigingen aan gevolgde bestanden.
// Elke test heeft een GB-code die de pariteitsmatrix en de reviewopdracht gebruiken.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {fixture, cleanup, contract, plan, executing, go, st, prompt, hook, pre, write, bash, denies, agentCall, put} from './helpers.mjs';
import {validateContract, envelopeHash, shortHash, materialChanges, envelopeOf, clock} from '../runtime/core.mjs';
import {registerContract, loadWork, saveWork, withLock, contractFile} from '../runtime/state.mjs';
import {presentProposal} from '../runtime/commands.mjs';
import {runCommand, closeTask} from '../runtime/runner.mjs';
import {assertGate} from '../runtime/gates.mjs';

const met = fn => async () => { const root = fixture(); const cfg = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'aae33cfg-'))); process.env.CLAUDE_CONFIG_DIR = cfg; try { await fn(root, cfg); } finally { cleanup(root); cleanup(cfg); delete process.env.CLAUDE_CONFIG_DIR; clock.ms = () => Date.now(); } };
const msg = fn => { const e = denies(fn); assert.ok(e, 'verwacht een weigering'); return e.message; };
const h = over => envelopeHash(validateContract(structuredClone(contract(over))));
/** Zoals de hook na een Write van contract.json: nieuw voorstel registreren. */
const herplan = (root, over) => { const v = validateContract(structuredClone(contract(over))); put(root, contractFile(v.id), v); return registerContract(root, v); };
const tekst = r => JSON.stringify(r || {});
const wijzig = (root, fn) => withLock(root, () => { const s = loadWork(root, 'W-T'); fn(s); saveWork(root, s); });
const budget = (soft, hard, runs = 20) => ({agent_calls: {soft, hard}, command_runs: runs, external_calls: 0, max_parallel: 1});
const area = (name, ...write) => ({name, write, support: ['tests']});
const git = (root, ...args) => spawnSync('git', args, {cwd: root, encoding: 'utf8'});

// ---- GO is gebonden aan wat is getoond ----
test('GB01 een kale GO, een GO zonder hash of een GO voor een niet getoond voorstel wordt geweigerd; niets is goedgekeurd', met(root => {
  plan(root);
  for (const t of ['AAE GO', 'AAE GO W-T']) { const r = prompt(root, t); assert.match(tekst(r), /GO geweigerd/, t); assert.match(tekst(r), /AAE GO <werkpakket-ID> <korte hash>/); }
  const r = prompt(root, 'AAE GO W-T ' + shortHash(h({})));
  assert.match(tekst(r), /GO geweigerd/); assert.match(tekst(r), /nog niet getoond/); assert.match(tekst(r), /present W-T/);
  assert.equal(st(root).status, 'WAITING_FOR_APPROVAL'); assert.equal(st(root).approved, null);
}));
test('GB02 het doel verandert na het voorstel: de oude GO (met de oude hash) is ongeldig en het nieuwe voorstel moet opnieuw worden getoond', met(root => {
  plan(root); const oud = presentProposal(root, 'W-T');
  herplan(root, {goal: 'Een ander doel dan het getoonde voorstel, dat de gebruiker niet heeft gezien.'});
  const r = prompt(root, oud.exacte_go);
  assert.match(tekst(r), /hoort niet bij het huidige voorstel/);
  assert.equal(st(root).status, 'WAITING_FOR_APPROVAL'); assert.equal(st(root).approved, null);
  go(root); assert.equal(st(root).status, 'EXECUTING', 'na opnieuw tonen telt een nieuwe GO wel');
}));
test('GB03 het doel verandert ná de GO: dat valt buiten de envelop; schrijven stopt tot een nieuwe GO voor het nieuwe doel', met(root => {
  executing(root);
  const oud = st(root).approved.envelope_hash;
  const u = herplan(root, {goal: 'Heel ander doel na de goedkeuring zonder dat de gebruiker daarvoor GO gaf.'});
  assert.equal(u.status, 'NEEDS_HUMAN'); assert.ok(st(root).needs_human.reasons.includes('doel'));
  assert.equal(st(root).approved.envelope_hash, oud, 'de oude goedkeuring blijft het vloerniveau');
  assert.match(msg(() => write(root, 'src/a.js')), /Geen werkpakket in uitvoering/);
  prompt(root, 'AAE VERDER'); assert.equal(st(root).status, 'NEEDS_HUMAN', 'VERDER hervat geen gewijzigd doel');
}));
test('GB04 een materiële envelopwijziging (breder schrijfgebied) maakt de oude GO ongeldig, voor én na de GO', met(root => {
  plan(root); presentProposal(root, 'W-T');
  herplan(root, {envelope: {areas: [area('Broncode', 'src'), area('Applicatie', 'app')]}});
  assert.match(tekst(prompt(root, 'AAE GO')), /GO geweigerd/); assert.equal(st(root).approved, null);
  go(root); assert.equal(st(root).status, 'EXECUTING');
  const u = herplan(root, {envelope: {areas: [area('Broncode', 'src'), area('Applicatie', 'app'), area('Database', 'supabase')]}});
  assert.equal(u.status, 'NEEDS_HUMAN'); assert.ok(st(root).needs_human.reasons.some(r => /schrijfgebied/.test(r)));
  assert.match(msg(() => write(root, 'supabase/x.sql')), /Geen werkpakket in uitvoering/);
}));
test('GB05 alleen de titel verandert: dezelfde hash, de GO blijft staan, geen nieuwe vraag', met(root => {
  assert.equal(h({title: 'Titel A voor het werkpakket'}), h({title: 'Een heel andere titel B'}));
  executing(root);
  const oud = st(root).approved;
  const u = herplan(root, {title: 'Hernoemd werkpakket zonder inhoudelijke wijziging'});
  assert.equal(u.status, 'EXECUTING'); assert.deepEqual(u.reasons, []);
  assert.equal(st(root).approved.envelope_hash, oud.envelope_hash); assert.equal(st(root).contract.title, 'Hernoemd werkpakket zonder inhoudelijke wijziging');
  assert.equal(write(root, 'src/a.js'), null);
  // ook vóór de GO: een hernoemd voorstel hoeft niet opnieuw getoond te worden
  const root2 = fixture();
  try { plan(root2); const p = presentProposal(root2, 'W-T'); herplan(root2, {title: 'Nieuwe naam'}); prompt(root2, p.exacte_go); assert.equal(st(root2).status, 'EXECUTING'); } finally { cleanup(root2); }
}));
test('GB06 alleen plan of technische aanpak verandert (agents, commando\'s, leesscope, extra controle; de bestaande bewijsvloer blijft gelijk): dezelfde hash, de GO blijft staan', met(root => {
  const basis = contract().plan;
  const ander = {...basis, agents: [], commands: [{id: 't_ok', argv: ['node', '--test', 'src/ok.test.mjs'], purpose: 'test', why: 'Een andere uitwerking van dezelfde controle.', watch: [], timeout_ms: 30000, max_runs: 2}],
    read: ['src'], test_plan: [...basis.test_plan, {kind: 'analysis', method: 'inspection', description: 'Een extra controle erbij is plan en mag (bewijs wordt niet lichter).'}]};
  assert.equal(h({}), h({plan: ander}));
  executing(root);
  const u = herplan(root, {plan: ander});
  assert.equal(u.status, 'EXECUTING'); assert.deepEqual(u.reasons, []);
  assert.equal(st(root).approved.envelope_hash, h({}));
}));
test('GB07 JSON-volgorde, witruimte en niet-semantische opmaak geven dezelfde hash', () => {
  const sleutels = o => Array.isArray(o) ? o.map(sleutels) : o && typeof o === 'object' ? Object.fromEntries(Object.keys(o).reverse().map(k => [k, sleutels(o[k])])) : o;
  const basis = {goal: 'Een kleine wijziging in het afgesproken gebied maken en bewijzen.', risk_flags: ['ui', 'background_jobs'], envelope: {
    areas: [area('Eerste', 'src'), area('Tweede', 'app')], acceptance: [{id: 'AC1', text: 'Eerste criterium dat duidelijk is.'}, {id: 'AC2', text: 'Tweede criterium dat duidelijk is.'}],
    decision_points: ['Stop bij een nieuwe productkeuze.', 'Stop bij een wijziging van beveiliging.']}, plan: {...contract().plan, test_plan: [
      ...contract().plan.test_plan, {kind: 'visual', method: 'inspection', description: 'Bekijk het scherm echt.'}, {kind: 'accessibility', method: 'inspection', description: 'Controleer het toetsenbord.'},
      {kind: 'idempotency', method: 'command', description: 'Dubbele uitvoering.'}, {kind: 'retry', method: 'command', description: 'Herhaling.'}]}};
  const a = validateContract(structuredClone(contract(basis)));
  const omgekeerd = structuredClone(a);
  omgekeerd.risk_flags.reverse(); omgekeerd.envelope.areas.reverse(); omgekeerd.envelope.acceptance.reverse(); omgekeerd.envelope.decision_points.reverse();
  omgekeerd.goal = '  Een kleine wijziging  in het afgesproken gebied\n maken en bewijzen. ';
  const b = JSON.parse(JSON.stringify(sleutels(omgekeerd), null, 7));
  assert.equal(envelopeHash(validateContract(b)), envelopeHash(a));
  assert.deepEqual(materialChanges(a, validateContract(structuredClone(b))), []);
  assert.match(envelopeHash(a), /^[0-9a-f]{64}$/); assert.equal(shortHash(envelopeHash(a)).length, 12);
});
test('GB08 zachte budgetten wijzigen de hash niet; een hoger hard budget wel en vraagt een nieuwe GO', met(root => {
  assert.equal(h({envelope: {budgets: budget(1, 4)}}), h({envelope: {budgets: budget(3, 4)}}));
  assert.notEqual(h({envelope: {budgets: budget(2, 4)}}), h({envelope: {budgets: budget(2, 5)}}));
  assert.notEqual(h({envelope: {budgets: budget(2, 4, 20)}}), h({envelope: {budgets: budget(2, 4, 21)}}));
  executing(root, {envelope: {budgets: budget(1, 4)}});
  const zacht = herplan(root, {envelope: {budgets: budget(3, 4)}});
  assert.equal(zacht.status, 'EXECUTING', 'soft aanpassen geeft geen nieuwe GO');
  const hoger = herplan(root, {envelope: {budgets: budget(3, 5)}});
  assert.equal(hoger.status, 'NEEDS_HUMAN'); assert.ok(st(root).needs_human.reasons.includes('budget'));
}));
test('GB08b een lager hard budget valt binnen de envelop en vraagt geen nieuwe GO', met(root => {
  executing(root, {envelope: {budgets: budget(1, 4)}});
  const lager = herplan(root, {envelope: {budgets: budget(1, 3, 10)}});
  assert.equal(lager.status, 'EXECUTING'); assert.deepEqual(lager.reasons, []);
}));
test('GB09 de hash bindt minimaal ID, doel, criteria, schrijfgebied, risico, flags, DB-maximum, providers, git/merge/deploy, harde budgetten en beslisgrenzen', () => {
  const basis = h({});
  const git = (commit, push, merge, deploy) => ({commit, push, merge, deploy});
  const varianten = {
    id: {id: 'W-ANDER'}, doel: {goal: 'Een andere doelomschrijving dan de oorspronkelijke tekst.'}, criterium: {envelope: {acceptance: [{id: 'AC1', text: 'Een ander criterium dan het eerdere.'}]}},
    gebied: {envelope: {areas: [area('Broncode', 'src', 'app')]}}, risico: {risk_class: 'HIGH', risk_flags: [], envelope: {}}, db: {envelope: {db_max: 'A'}},
    commit: {envelope: {git: git(true, [], null, 'none')}}, push: {envelope: {git: git(true, ['claude/werk'], null, 'none')}}, merge: {envelope: {git: git(true, ['claude/werk'], {to: 'staging'}, 'none')}},
    deploy: {envelope: {git: git(false, [], null, 'verify')}}, harde_agents: {envelope: {budgets: budget(2, 6)}}, harde_commandos: {envelope: {budgets: budget(2, 4, 30)}},
    beslisgrens: {envelope: {decision_points: ['Stop altijd bij een nieuwe productkeuze.']}}, fase: {envelope: {phase: 'analysis', areas: []}, plan: {...contract().plan, agents: [], commands: [], test_plan: [{kind: 'analysis', method: 'inspection', description: 'Beschrijf de bevindingen.'}]}}
  };
  const gezien = new Map();
  for (const [naam, over] of Object.entries(varianten)) {
    const x = h(over); assert.notEqual(x, basis, naam + ' moet de hash veranderen');
    assert.ok(!gezien.has(x), naam + ' botst met ' + gezien.get(x)); gezien.set(x, naam);
  }
  const risicovlag = h({risk_flags: ['ui'], plan: {...contract().plan, test_plan: [...contract().plan.test_plan, {kind: 'visual', method: 'inspection', description: 'Bekijk het scherm echt.'}, {kind: 'accessibility', method: 'inspection', description: 'Controleer het toetsenbord.'}]}});
  assert.notEqual(risicovlag, basis, 'een risicovlag verandert de hash');
  const e = envelopeOf(validateContract(structuredClone(contract())));
  for (const sleutel of ['id', 'goal', 'acceptance', 'write', 'risk_class', 'risk_flags', 'db_max', 'providers', 'git', 'budgets', 'decision_points']) assert.ok(sleutel in e, sleutel + ' ontbreekt in de canonieke envelop');
  assert.ok(!('title' in e) && !('plan' in e), 'titel en plan zijn geen onderdeel van de envelop');
});

// ---- elke bewakingshandeling controleert tegen de goedgekeurde volledige hash ----
test('GB10 elke bewakingshandeling controleert de goedgekeurde hash en de envelop; bij een afwijking wordt geweigerd en wacht het pakket op een beslissing', met(async root => {
  const extern = {envelope: {git: {commit: true, push: ['claude/werk'], merge: null, deploy: 'none'}, providers: {github: {tools: ['create_pull_request'], max_calls: 1, owner: 'o', repo: 'r', head: 'claude/werk'}}, budgets: {agent_calls: {soft: 2, hard: 4}, command_runs: 20, external_calls: 1, max_parallel: 1}}};
  executing(root, extern);
  assert.equal(write(root, 'src/a.js'), null);
  const pr = {owner: 'o', repo: 'r', title: 'Titel van de pull request', head: 'claude/werk', base: 'main'}; // base is niet vastgepind: elke base is toegestaan
  const acties = {
    schrijven: () => write(root, 'src/a.js'),
    'gevolgd document': () => write(root, 'docs/aae/PROGRESS.md'),
    agent: () => agentCall(root),
    'runner via hook': () => bash(root, 'node .claude/aae/runtime/cli.mjs run t_ok'),
    project: () => bash(root, 'node .claude/aae/runtime/cli.mjs project'),
    'externe wijziging': () => pre(root, 'mcp__github__create_pull_request', pr, {tool_use_id: 'g1'}),
    gate: () => assertGate(root, st(root), st(root).contract, 'merge'),
    sluiten: () => closeTask(root)
  };
  const herstel = () => wijzig(root, s => { s.status = 'EXECUTING'; s.needs_human = null; s.activity = 'BUILDING'; s.approved.envelope_hash = envelopeHash(s.approved.contract); s.contract = structuredClone(s.approved.contract); });
  const bijAfwijking = async (naam, kapot, patroon) => {
    for (const [handeling, fn] of Object.entries(acties)) {
      herstel(); kapot();
      assert.match(msg(fn), patroon, naam + ' / ' + handeling);
      assert.equal(st(root).status, 'NEEDS_HUMAN', naam + ' / ' + handeling + ': het pakket wacht op een beslissing');
    }
    herstel(); kapot();
    await assert.rejects(() => runCommand(root, 't_ok'), patroon, naam + ' / runner');
    assert.equal(st(root).status, 'NEEDS_HUMAN');
  };
  // 1: de opgeslagen goedgekeurde hash klopt niet met het goedgekeurde contract
  await bijAfwijking('hash', () => wijzig(root, s => { s.approved.envelope_hash = '0'.repeat(64); }), /envelop-hash klopt niet/);
  // 2: het huidige contract valt buiten de goedgekeurde envelop (buiten de registratie om gezet)
  await bijAfwijking('envelop', () => wijzig(root, s => { s.contract.envelope.areas.push(area('Extra', 'app')); }), /buiten de goedgekeurde envelop/);
  // 3: een gewijzigd doel in de state telt ook
  await bijAfwijking('doel', () => wijzig(root, s => { s.contract.goal = 'Heel ander doel dat nooit is goedgekeurd door de gebruiker.'; }), /buiten de goedgekeurde envelop \(doel\)/);
  // 4: zonder afwijking werkt alles zoals eerst (de controle blokkeert niets te veel)
  herstel(); assert.equal(write(root, 'src/a.js'), null); assert.equal(st(root).status, 'EXECUTING');
}));
test('GB11 de GO-melding noemt werkpakket-ID en korte hash; `present` toont dezelfde herkenning', met(root => {
  plan(root);
  const p = presentProposal(root, 'W-T');
  assert.equal(p.id, 'W-T'); assert.equal(p.short_hash, shortHash(h({}))); assert.match(p.vraag, new RegExp('AAE GO W-T.*' + p.short_hash));
  assert.ok(p.samenvatting.some(r => /^Doel: /.test(r)) && p.samenvatting.some(r => /Mag wijzigen: src/.test(r)));
  assert.equal(p.exacte_go, 'AAE GO W-T ' + p.short_hash);
  assert.match(tekst(prompt(root, 'AAE GO W-T 000000000000')), /hoort niet bij het huidige voorstel/, 'een verkeerde hash telt niet');
  assert.ok(denies(() => prompt(root, 'AAE GO W-ANDERS ' + p.short_hash)), 'een verkeerd ID telt niet');
  assert.equal(st(root).approved, null);
  const r = prompt(root, p.exacte_go);
  assert.match(tekst(r), new RegExp('W-T \\(envelop ' + p.short_hash + '\\)'));
  assert.equal(st(root).approved.envelope_hash, h({}));
}));

// ---- LIGHT en analyse ----
test('GB12 LIGHT vraagt precies één GO; een pure analyse start zonder GO maar wijzigt niets gevolgds', met(root => {
  assert.equal(plan(root, {id: 'W-L', risk_class: 'LIGHT'}).status, 'WAITING_FOR_APPROVAL');
  const analyse = {id: 'W-A', envelope: {phase: 'analysis', areas: []}, plan: {...contract().plan, agents: [], commands: [], test_plan: [{kind: 'analysis', method: 'inspection', description: 'Beschrijf de bevindingen en wat niet is gecontroleerd.'}]}};
  const s = plan(root, analyse);
  assert.equal(s.status, 'EXECUTING', 'analyse mag zonder GO starten');
  assert.match(msg(() => write(root, 'src/a.js')), /Analyse-only/);
  assert.match(msg(() => write(root, 'docs/aae/PROGRESS.md')), /analyse-werkpakket wijzigt geen gevolgde bestanden/);
  assert.match(msg(() => bash(root, 'node .claude/aae/runtime/cli.mjs project')), /gevolgd bestand/);
}));
test('GB13 een implementatiepakket of een analyse met een externe schrijftool start nooit zonder GO', met(root => {
  assert.equal(plan(root, {id: 'W-I'}).status, 'WAITING_FOR_APPROVAL');
  const extern = {id: 'W-A2', envelope: {phase: 'analysis', areas: [], providers: {supabase: {project_ref: 'abcdefghij', tools: ['get_project_url', 'execute_sql'], max_calls: 2}}, budgets: {agent_calls: {soft: 2, hard: 4}, command_runs: 20, external_calls: 2, max_parallel: 1}},
    plan: {...contract().plan, agents: [], commands: [], test_plan: [{kind: 'analysis', method: 'inspection', description: 'Beschrijf de bevindingen en wat niet is gecontroleerd.'}]}};
  assert.equal(plan(root, extern).status, 'WAITING_FOR_APPROVAL');
}));

// ---- één simpele regel voor administratie ----
test('GB14 zonder GO geen wijziging aan gevolgde projectdocumenten; genegeerde technische administratie en het eigen voorstel zijn vrij', met(root => {
  for (const p of ['docs/aae/PROGRESS.md', 'docs/aae/DECISIONS.md', 'docs/aae/PROJECT_PROFILE.md']) assert.match(msg(() => write(root, p)), /Zonder AAE GO verander ik geen gevolgde repositorybestanden/, p);
  assert.equal(write(root, 'docs/aae/notes/overleg.md', 'aantekening'), null, 'ongevolgde notitie is vrij');
  assert.equal(pre(root, 'Write', {file_path: path.join(root, 'docs/aae/work/W-T/result.json'), content: '{"a":1}'}), null, 'resultaat is lokale administratie');
  const v = validateContract(structuredClone(contract()));
  assert.equal(pre(root, 'Write', {file_path: path.join(root, contractFile('W-T')), content: JSON.stringify(v)}), null, 'een voorstel registreren hoort bij plannen');
  plan(root);
  assert.match(msg(() => write(root, 'docs/aae/PROGRESS.md')), /Zonder AAE GO/, 'ook niet terwijl het plan op GO wacht');
  assert.match(msg(() => bash(root, 'node .claude/aae/runtime/cli.mjs project')), /gevolgd bestand/);
}));
test('GB15 met GO mag een gevolgd projectdocument wel, binnen de goedgekeurde envelop; tijdens PAUZE niet', met(root => {
  executing(root);
  assert.equal(write(root, 'docs/aae/PROGRESS.md', '# Voortgang'), null);
  assert.equal(write(root, 'docs/aae/DECISIONS.md', '# Besluiten'), null);
  prompt(root, 'AAE PAUZE');
  assert.match(msg(() => write(root, 'docs/aae/PROGRESS.md')), /Zonder AAE GO/);
}));
test('GB16 een bestand dat in een vrij pad toch door git wordt gevolgd, valt onder de GO-regel', met(root => {
  git(root, 'init', '-q');
  put(root, 'docs/aae/notes/gevolgd.md', 'al in de repository');
  git(root, 'add', '-f', 'docs/aae/notes/gevolgd.md');
  assert.equal(git(root, 'ls-files', 'docs/aae/notes/gevolgd.md').stdout.trim(), 'docs/aae/notes/gevolgd.md');
  assert.match(msg(() => write(root, 'docs/aae/notes/gevolgd.md', 'wijziging')), /Zonder AAE GO verander ik geen gevolgde/);
  assert.equal(write(root, 'docs/aae/notes/ongevolgd.md', 'nieuw'), null, 'een ongevolgde notitie blijft vrij');
  executing(root);
  assert.equal(write(root, 'docs/aae/notes/gevolgd.md', 'met GO'), null);
}));
test('GB17 cli preflight schrijft geen gevolgd bestand (docs/aae/project.json) vóór een GO', met(root => {
  const c = validateContract(structuredClone(contract({envelope: {git: {commit: true, push: ['claude/werk'], merge: {to: 'main'}, deploy: 'verify'}}})));
  put(root, contractFile(c.id), c);
  const bron = new URL('../runtime/', import.meta.url), doel = path.join(root, '.claude/aae/runtime');
  fs.mkdirSync(doel, {recursive: true}); for (const f of fs.readdirSync(bron)) fs.copyFileSync(new URL(f, bron), path.join(doel, f));
  const run = (...a) => spawnSync(process.execPath, [path.join(doel, 'cli.mjs'), ...a], {cwd: root, encoding: 'utf8'});
  assert.equal(run('plan', 'W-T').status, 0);
  const r = run('preflight', 'W-T'); assert.equal(r.status, 0, r.stderr);
  assert.ok(!fs.existsSync(path.join(root, 'docs/aae/project.json')), 'geen project.json geschreven');
  assert.ok(loadWork(root, 'W-T').preflight.deploy, 'de deploy-detectie staat wel in de lokale state');
}));
