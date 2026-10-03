// AAE-V331-001: v3.3.1 maakt de werkstroom lichter zonder de harde grenzen te verzwakken. Elke test heeft een V331-code (acceptatiecriteria A1-A7).
// Elke versoepeling heeft een test; elke blijvende blokkade heeft er ook een (zie ook go-binding.test.mjs en core.test.mjs, waar de oude verwachtingen zijn bijgewerkt).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {fixture, cleanup, contract, executing, st, prompt, write, denies, agentCall, runAgent, REPORT, put} from './helpers.mjs';
import {validateContract, materialChanges, envelopeHash, requiredChecks, AGENT_CAP, RISK_CHECKS, HIGH_FLAGS, clock, now} from '../runtime/core.mjs';
import {registerContract, loadWork, saveWork, withLock, contractFile} from '../runtime/state.mjs';
import {runCommand, reportTemplate, closeTask} from '../runtime/runner.mjs';
import {buildSnapshot, verifySnapshot} from '../runtime/snapshot.mjs';

const met = fn => async () => { const root = fixture(); const cfg = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'aae33cfg-'))); process.env.CLAUDE_CONFIG_DIR = cfg; try { await fn(root, cfg); } finally { cleanup(root); cleanup(cfg); delete process.env.CLAUDE_CONFIG_DIR; clock.ms = () => Date.now(); } };
const geldig = over => validateContract(structuredClone(contract(over)));
const msg = fn => { const e = denies(fn); assert.ok(e, 'verwacht een weigering'); return e.message; };
const herplan = (root, over) => { const v = validateContract(structuredClone(contract(over))); put(root, contractFile(v.id), v); return registerContract(root, v); };
const bewijs = kinds => kinds.map(kind => ({kind, method: 'inspection', description: 'Beschrijf de controle van ' + kind + '.'}));
const hier = path.dirname(fileURLToPath(import.meta.url));
const lees = rel => fs.readFileSync(path.resolve(hier, '..', rel), 'utf8');
const makeResult = (root, receipt) => {
  const t = reportTemplate(root);
  t.status = 'READY'; t.summary = 'Alles bewezen en gecontroleerd binnen het gebied.';
  for (const a of t.criteria) { a.status = 'passed'; a.evidence = ['src/ok.test.mjs']; a.note = 'Bewezen met de test.'; }
  for (const x of t.checks) { x.status = 'passed'; x.note = 'Uitgevoerd en geslaagd.'; x.evidence = x.method === 'command' ? [receipt] : ['src/ok.test.mjs']; }
  put(root, 'docs/aae/work/W-T/result.json', t); return t;
};

// ---- A1: GO-binding ----
test('V331-01 plan-, bewijs-, aannames- en beslisstandaardtekst en het agentplafond zijn geen onderdeel van de GO-binding; doel en criteria blijven het wel', () => {
  const a = geldig();
  const b = geldig({envelope: {assumptions: ['Een nieuwe aanname die alleen toelichting is.'], decision_defaults: ['Kies bij twijfel de kortste naam.'], budgets: {agent_calls: {soft: 9, hard: 12}, command_runs: 20, external_calls: 0, max_parallel: 1}}});
  b.plan.test_plan[1].description = 'Een andere omschrijving van dezelfde functionele controle.';
  b.plan.agents = []; b.plan.read = ['src'];
  assert.deepEqual(materialChanges(a, validateContract(b)), []);
  assert.deepEqual(materialChanges(a, geldig({title: 'Een andere titel voor hetzelfde werk'})), []);
  assert.ok(materialChanges(a, geldig({goal: 'Een ander doel dan het eerder goedgekeurde doel van het werkpakket.'})).includes('doel'));
  assert.ok(materialChanges(a, geldig({envelope: {acceptance: [{id: 'AC1', text: 'Iets heel anders dan het eerste criterium.'}]}})).includes('acceptatiecriteria'));
  assert.ok(materialChanges(a, geldig({envelope: {decision_points: ['Stop altijd bij een nieuwe productkeuze.']}})).length === 0, 'een nieuwe beslisgrens erbij is strenger en dus vrij');
  assert.ok(materialChanges(geldig({envelope: {decision_points: ['Stop altijd bij een nieuwe productkeuze.']}}), a).includes('beslisgrenzen'), 'een beslisgrens laten vervallen is wezenlijk');
});
test('V331-02 een risicoverlaging vraagt nooit een nieuwe GO; een risicoverhoging wel', () => {
  const hoog = geldig({risk_class: 'HIGH'});
  assert.deepEqual(materialChanges(hoog, geldig({risk_class: 'STANDARD'})), []);
  assert.deepEqual(materialChanges(hoog, geldig({risk_class: 'LIGHT'})), []);
  const metVlag = geldig({risk_flags: ['ui'], plan: {...contract().plan, test_plan: [...contract().plan.test_plan, ...bewijs(['visual', 'accessibility'])]}});
  assert.deepEqual(materialChanges(metVlag, geldig()), [], 'minder vlaggen, en de controles die alleen door die vlag verplicht waren, mogen vervallen');
  assert.ok(materialChanges(geldig(), hoog).includes('risicoklasse hoger'));
  assert.ok(materialChanges(geldig(), metVlag).includes('risicovlaggen uitgebreid'));
});
test('V331-03 het bewijs wordt nooit stil lichter: een controlesoort verdwijnt niet en de methode wordt niet zwakker; alleen de omschrijving is vrij', () => {
  const basis = contract(); basis.plan.test_plan.push({kind: 'analysis', method: 'command', description: 'Een vrijwillig toegevoegde controle met een commando.'});
  const a = validateContract(structuredClone(basis));
  const zonder = structuredClone(basis); zonder.plan.test_plan = zonder.plan.test_plan.filter(t => t.kind !== 'analysis');
  assert.ok(materialChanges(a, validateContract(zonder)).includes('bewijsplan'), 'een vrijwillige controle laten vervallen is wezenlijk');
  const zwak = structuredClone(basis); zwak.plan.test_plan.find(t => t.kind === 'analysis').method = 'inspection';
  assert.ok(materialChanges(a, validateContract(zwak)).includes('bewijsplan'), 'command naar inspection is zwakker');
  const zwakst = structuredClone(basis); zwakst.plan.test_plan.find(t => t.kind === 'functional').method = 'manual';
  assert.ok(materialChanges(a, validateContract(zwakst)).includes('bewijsplan'), 'command naar manual is zwakker');
  const nieuw = structuredClone(basis); nieuw.plan.test_plan.find(t => t.kind === 'analysis').description = 'Een heel andere omschrijving, zelfde soort en methode.';
  assert.deepEqual(materialChanges(a, validateContract(nieuw)), []);
});
test('V331-04 alles wat niet "tekst" is blijft wezenlijk: gebied, database, git, providers, extra commando\'s en harde budgetten', () => {
  const a = geldig();
  const veranderingen = {
    gebied: {envelope: {areas: [{name: 'Breder', write: ['src', 'app']}]}}, database: {risk_class: 'HIGH', envelope: {db_max: 'A'}}, commit: {envelope: {git: {commit: true, push: [], merge: null, deploy: 'none'}}},
    commandobudget: {envelope: {budgets: {agent_calls: {soft: 1, hard: 2}, command_runs: 99, external_calls: 0, max_parallel: 1}}}, parallel: {envelope: {budgets: {agent_calls: {soft: 1, hard: 2}, command_runs: 20, external_calls: 0, max_parallel: 3}}}
  };
  for (const [naam, over] of Object.entries(veranderingen)) assert.ok(materialChanges(a, geldig(over)).length > 0, naam + ' blijft wezenlijk');
});

// ---- A2: agentplafond per niveau ----
const vraag = n => 'Beoordeel src/bestand' + n + '.js op regressies, vraag nummer ' + n + '.';
test('V331-05 het agentplafond hangt aan het niveau en is intern: LIGHT 1, NORMAL 2, HIGH 3; erbinnen nooit een nieuwe GO, erboven een duidelijke weigering', met(async (root, cfg) => {
  assert.deepEqual(AGENT_CAP, {LIGHT: {normal: 0, hard: 1}, STANDARD: {normal: 1, hard: 2}, HIGH: {normal: 2, hard: 3}});
  for (const [klasse, hard] of [['LIGHT', 1], ['STANDARD', 2], ['HIGH', 3]]) {
    const r = fixture(); try {
      executing(r, {risk_class: klasse});
      const goedgekeurd = st(r).approved.envelope_hash;
      for (let n = 1; n <= hard; n++) runAgent(r, {id: 'tu-' + n, agentId: 'aaaa000' + n, vraag: vraag(n), configDir: cfg});
      assert.equal(st(r).usage.agents, hard); assert.equal(st(r).status, 'EXECUTING'); assert.equal(st(r).approved.envelope_hash, goedgekeurd, 'de GO blijft precies dezelfde');
      assert.match(msg(() => agentCall(r, {id: 'tu-x', vraag: vraag(99)})), new RegExp('agentplafond van niveau ' + klasse + ' \\(' + hard + '\\)'));
      assert.equal(st(r).status, 'EXECUTING', 'het plafond bereiken is geen NEEDS_HUMAN');
    } finally { cleanup(r); }
  }
}));
test('V331-06 het zachte plafond (normaal gebruik) wordt alleen gelogd: een extra review boven het normale aantal geeft geen vraag en geen nieuwe GO', met(async (root, cfg) => {
  executing(root, {risk_class: 'HIGH'});
  runAgent(root, {id: 'tu-1', agentId: 'aaaa0001', vraag: vraag(1), configDir: cfg}); runAgent(root, {id: 'tu-2', agentId: 'aaaa0002', vraag: vraag(2), configDir: cfg});
  assert.equal(st(root).soft_exceeded, false);
  runAgent(root, {id: 'tu-3', agentId: 'aaaa0003', vraag: vraag(3), configDir: cfg});
  assert.equal(st(root).soft_exceeded, true, 'boven het normale aantal: alleen een logsignaal');
  assert.equal(st(root).status, 'EXECUTING'); assert.equal(st(root).needs_human, null);
}));
test('V331-07 het agentplafond staat niet in de hash: een opgegeven waarde verandert niets', () => {
  const h = hard => envelopeHash(geldig({envelope: {budgets: {agent_calls: {soft: 1, hard}, command_runs: 20, external_calls: 0, max_parallel: 1}}}));
  assert.equal(h(1), h(12));
  const zonder = contract(); delete zonder.envelope.budgets.agent_calls;
  assert.equal(envelopeHash(validateContract(zonder)), h(4), 'het veld mag ook ontbreken');
  assert.deepEqual(geldig({risk_class: 'HIGH'}).envelope.budgets.agent_calls, {soft: 2, hard: 3});
});

// ---- A3: reviewbevinding en herstel binnen één GO ----
test('V331-08 HIGH: een review met een bevinding, een herstel binnen het gebied en een tweede review die READY meldt lopen af met één GO, ongewijzigde hash en zonder NEEDS_HUMAN', met(async (root, cfg) => {
  executing(root, {risk_class: 'HIGH'});
  const goedgekeurd = st(root).approved.envelope_hash;
  await runCommand(root, 't_ok');
  runAgent(root, {id: 'tu-1', agentId: 'bbbb0001', vraag: vraag(1), text: REPORT('PARTIAL', 'Bevinding: src/a.js verwerkt een lege invoer niet.'), configDir: cfg});
  assert.equal(write(root, 'src/a.js', 'export const a = (x = []) => x;\n'), null, 'het herstel valt binnen het goedgekeurde gebied');
  fs.writeFileSync(path.join(root, 'src/a.js'), 'export const a = (x = []) => x;\n'); // de hook geeft alleen toestemming; de wijziging zelf doen we hier
  const r = await runCommand(root, 't_ok');
  runAgent(root, {id: 'tu-2', agentId: 'bbbb0002', vraag: 'Controleer alleen de herstelde invoerverwerking in src/a.js nog eens.', configDir: cfg});
  makeResult(root, r.evidence_path);
  assert.equal(closeTask(root).work_status, 'READY');
  const s = st(root);
  assert.equal(s.approved.envelope_hash, goedgekeurd); assert.equal(envelopeHash(s.contract), goedgekeurd);
  assert.equal(s.history.filter(h => h.type === 'goedkeuring').length, 1, 'precies één GO');
  assert.ok(!s.history.some(h => h.type === 'needs_human' || (h.type === 'status' && h.naar === 'NEEDS_HUMAN')), 'nooit NEEDS_HUMAN');
  assert.equal(s.usage.agents, 2);
}));
test('V331-09 een review geldt alleen voor de bron waarop hij sloeg: na een wijziging is een nieuwe review nodig (binnen het plafond, zonder nieuwe GO)', met(async (root, cfg) => {
  executing(root, {risk_class: 'HIGH'});
  runAgent(root, {id: 'tu-1', agentId: 'cccc0001', vraag: vraag(1), configDir: cfg});
  assert.equal(write(root, 'src/a.js', 'export const a = 2;\n'), null);
  fs.writeFileSync(path.join(root, 'src/a.js'), 'export const a = 2;\n');
  const r = await runCommand(root, 't_ok'); makeResult(root, r.evidence_path);
  assert.throws(() => closeTask(root), /onafhankelijk READY-oordeel/, 'de eerdere review geldt niet voor de nieuwe bron');
  runAgent(root, {id: 'tu-2', agentId: 'cccc0002', vraag: vraag(2), configDir: cfg});
  makeResult(root, r.evidence_path);
  assert.equal(closeTask(root).work_status, 'READY');
}));

// ---- A4/A5: snapshot en NEEDS_HUMAN ----
test('V331-10 NEEDS_HUMAN blijft voor wat echt van Jurgen is (risicoverhoging, scope-change) en komt niet meer door tekst of door een snapshotfout', met(async root => {
  executing(root);
  const tekst = herplan(root, {envelope: {assumptions: ['Alleen een nieuwe aanname.'], decision_defaults: ['Een nieuwe standaardkeuze.']}});
  assert.equal(tekst.status, 'EXECUTING'); assert.deepEqual(tekst.reasons, []);
  const lager = herplan(root, {risk_class: 'LIGHT'});
  assert.equal(lager.status, 'EXECUTING'); assert.deepEqual(lager.reasons, []);
  const hoger = herplan(root, {risk_class: 'HIGH'});
  assert.equal(hoger.status, 'NEEDS_HUMAN'); assert.ok(st(root).needs_human.reasons.includes('risicoklasse hoger'));
}));
test('V331-11 een snapshotfout geeft bij elke bewakingshandeling BLOCKED en nooit NEEDS_HUMAN', met(async root => {
  executing(root);
  const dir = path.join(root, 'docs/aae/work/W-T/approved');
  for (const handeling of [() => write(root, 'src/a.js'), () => agentCall(root, {id: 'tu-s'})]) {
    withLock(root, () => { const s = loadWork(root, 'W-T'); s.status = 'EXECUTING'; s.blockers = []; saveWork(root, s); });
    fs.rmSync(dir, {recursive: true, force: true}); fs.writeFileSync(dir, 'een bestand in plaats van een map');
    assert.ok(denies(handeling));
    assert.equal(st(root).status, 'BLOCKED'); assert.equal(st(root).needs_human, null); assert.match(st(root).blockers[0], /AAE VERDER/);
    fs.rmSync(dir);
  }
  prompt(root, 'AAE VERDER'); assert.equal(st(root).status, 'EXECUTING', 'VERDER hervat dezelfde envelop; geen nieuwe GO');
}));

// ---- A6: niveauregels ----
const PROV = {supabase: {project_ref: 'abcdefghij', tools: ['get_project_url', 'list_tables'], max_calls: 2}};
const metEnv = e => ({risk_class: 'STANDARD', envelope: e});
test('V331-12 HIGH is verplicht bij database, Supabase, merge, deploy en een destructief extra commando; een gewone commit, push of PR-aanmaak is NORMAL', () => {
  const git = (merge, deploy) => ({commit: true, push: ['claude/w'], merge, deploy});
  for (const [naam, e] of Object.entries({
    database: {db_max: 'A'}, supabase: {providers: PROV, budgets: {agent_calls: {soft: 1, hard: 2}, command_runs: 20, external_calls: 2, max_parallel: 1}},
    merge: {git: git({to: 'main'}, 'none')}, deploy: {git: git(null, 'verify')}, destructief: {extra_commands: [{argv: ['rm', '-rf', 'src/oud'], purpose: 'destructive'}]}
  })) {
    assert.throws(() => validateContract(structuredClone({...contract(metEnv(e)), risk_class: 'STANDARD'})), /HIGH is verplicht bij/, naam);
    assert.doesNotThrow(() => validateContract(structuredClone(contract({risk_class: 'HIGH', envelope: e}))), naam + ' met HIGH');
  }
  assert.doesNotThrow(() => validateContract(structuredClone(contract({envelope: {git: git(null, 'none')}}))), 'commit en push zijn gewoon NORMAL');
  const pr = {github: {tools: ['create_pull_request'], max_calls: 1, owner: 'o', repo: 'r', head: 'claude/w'}};
  assert.doesNotThrow(() => validateContract(structuredClone(contract({envelope: {git: git(null, 'none'), providers: pr, budgets: {agent_calls: {soft: 1, hard: 2}, command_runs: 20, external_calls: 1, max_parallel: 1}}}))), 'alleen een PR aanmaken is NORMAL');
});
test('V331-13 LIGHT is alleen voor kleine, lokale wijzigingen: geen externe diensten, database, merge, deploy, extra commando\'s of andere risicovlaggen dan ui', () => {
  const extern = {github: {tools: ['create_pull_request'], max_calls: 1, owner: 'o', repo: 'r', head: 'claude/w'}};
  const geweigerd = {
    github: {git: {commit: true, push: ['claude/w'], merge: null, deploy: 'none'}, providers: extern, budgets: {agent_calls: {soft: 0, hard: 1}, command_runs: 20, external_calls: 1, max_parallel: 1}},
    install: {extra_commands: [{argv: ['npm', 'ci'], purpose: 'install'}]}
  };
  for (const [naam, e] of Object.entries(geweigerd)) assert.throws(() => validateContract(structuredClone(contract({risk_class: 'LIGHT', envelope: e}))), /LIGHT is alleen voor kleine/, naam);
  assert.throws(() => validateContract(structuredClone(contract({risk_class: 'LIGHT', risk_flags: ['background_jobs'], plan: {...contract().plan, test_plan: [...contract().plan.test_plan, ...bewijs(['idempotency', 'retry'])]}}))), /LIGHT is alleen voor kleine/);
  const ui = contract({risk_class: 'LIGHT', risk_flags: ['ui']}); ui.plan.test_plan.push(...bewijs(['visual', 'accessibility']));
  assert.doesNotThrow(() => validateContract(structuredClone(ui)), 'ui mag in LIGHT');
  assert.doesNotThrow(() => validateContract(structuredClone(contract({risk_class: 'LIGHT', envelope: {git: {commit: true, push: ['claude/w'], merge: null, deploy: 'none'}}}))), 'commit en push mogen in LIGHT');
});
test('V331-14 customer_claims is een aparte HIGH-vlag met een eigen verplichte controle (claims-review); migration is nu ook HIGH', () => {
  assert.ok(HIGH_FLAGS.includes('customer_claims') && HIGH_FLAGS.includes('migration'));
  assert.deepEqual(RISK_CHECKS.customer_claims, ['claims-review']);
  const basis = {risk_flags: ['customer_claims'], plan: {...contract().plan, test_plan: [...contract().plan.test_plan]}};
  assert.throws(() => validateContract(structuredClone(contract({...basis, risk_class: 'HIGH'}))), /kwaliteitsondergrens: claims-review/);
  basis.plan.test_plan.push(...bewijs(['claims-review']));
  assert.throws(() => validateContract(structuredClone(contract({...basis, risk_class: 'STANDARD'}))), /klantclaims vereisen risicoklasse HIGH/);
  assert.doesNotThrow(() => validateContract(structuredClone(contract({...basis, risk_class: 'HIGH'}))));
  assert.ok(requiredChecks(contract({risk_flags: ['customer_claims']})).includes('claims-review'));
  assert.ok(!requiredChecks(contract({risk_flags: ['ui']})).includes('claims-review'), 'een gewone commerciële tekst of een UI-wijziging is geen customer_claims');
});

// ---- compatibiliteit met bestaande GO's en snapshots ----
test('V331-15 een goedkeuring en snapshot van vóór 3.3.1 (met een eigen agentplafond in de envelop) blijft geldig: dezelfde hash en geen wezenlijke wijziging', () => {
  const oud = validateContract(structuredClone(contract()));
  oud.envelope.budgets.agent_calls = {soft: 3, hard: 8}; // zoals v3.3.0 het in een goedgekeurde envelop bewaarde
  const hash = envelopeHash(oud), s = buildSnapshot(oud, {sequence: 1, previous_hash: null, source: 'AAE GO', at: now()});
  assert.equal(s.hash, hash);
  assert.doesNotThrow(() => verifySnapshot(s, 1, null, '001-' + hash.slice(0, 12) + '.json'), 'een bestaande snapshot blijft verifieerbaar');
  assert.deepEqual(materialChanges(oud, geldig()), [], 'het nieuwe contract (plafond per niveau) valt binnen de oude envelop');
});

// ---- A7: documenten ----
test('V331-16 ENTRY.md en REFERENTIE.md beschrijven het beslisschema, de nieuwe-GO-regels, het vaste agentplafond, de NEEDS_HUMAN-regel en de zijprojectregel; ENTRY.md blijft kort', () => {
  const entry = lees('ENTRY.md'), ref = lees('docs/REFERENTIE.md');
  for (const woord of ['LIGHT', 'NORMAL', 'HIGH', 'nieuwe GO', 'NEEDS_HUMAN', 'verbeterpunten.md', 'customer_claims', 'zijproject']) assert.ok(entry.includes(woord), 'ENTRY.md noemt ' + woord);
  for (const woord of ['LIGHT 1', 'NORMAL 2', 'HIGH 3', 'customer_claims', 'claims-review', 'BLOCKED']) assert.ok(ref.includes(woord), 'REFERENTIE.md noemt ' + woord);
  assert.ok(entry.split('\n').length <= 60, 'ENTRY.md blijft kort (' + entry.split('\n').length + ' regels)');
});
