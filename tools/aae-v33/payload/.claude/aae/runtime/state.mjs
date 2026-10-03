/** Eén statusbron per werkpakket: docs/aae/work/<id>/state.json (+ proposal.json, en de gevolgde snapshots in approved/). Statusmachine, vergrendeling en registratie. */
import fs from 'node:fs';
import path from 'node:path';
import {ensureSnapshot} from './snapshot.mjs';
import {
  WORK, STATE_DIR, requireThat, safePath, atomicJson, readJson, now, digest, sha, level,
  validateContract, envelopeHash, materialChanges, analysisArgv
} from './core.mjs';

export const STATUSES = ['PLANNING', 'WAITING_FOR_APPROVAL', 'EXECUTING', 'NEEDS_HUMAN', 'PAUSED', 'READY', 'BLOCKED', 'CANCELLED'];
export const TERMINAL = new Set(['READY', 'CANCELLED']);
export const ACTIVITIES = ['BUILDING', 'TESTING', 'WAITING_FOR_AGENT', 'REVIEWING', 'MERGING', 'DEPLOYING'];
export const TRANSITIONS = {
  PLANNING: ['WAITING_FOR_APPROVAL', 'EXECUTING', 'NEEDS_HUMAN', 'PAUSED', 'CANCELLED'],
  WAITING_FOR_APPROVAL: ['EXECUTING', 'PLANNING', 'NEEDS_HUMAN', 'PAUSED', 'CANCELLED'],
  EXECUTING: ['NEEDS_HUMAN', 'PAUSED', 'READY', 'BLOCKED', 'CANCELLED', 'EXECUTING'],
  NEEDS_HUMAN: ['EXECUTING', 'WAITING_FOR_APPROVAL', 'PLANNING', 'PAUSED', 'BLOCKED', 'CANCELLED', 'NEEDS_HUMAN'],
  PAUSED: ['EXECUTING', 'WAITING_FOR_APPROVAL', 'NEEDS_HUMAN', 'CANCELLED'],
  // v3.4: een PARTIAL/BLOCKED-pakket neemt een aangepast voorstel aan (NEEDS_HUMAN) en wacht dan op precies één GO, zonder AAE VERDER vooraf.
  BLOCKED: ['EXECUTING', 'PLANNING', 'CANCELLED', 'NEEDS_HUMAN'],
  READY: [],
  CANCELLED: []
};
const stateFile = id => WORK + '/' + id + '/state.json';
/** Het voorstel van een werkpakket: lokaal, ongevolgd (genegeerd pad). Het gevolgde, duurzame bewijs van wat is goedgekeurd is de snapshot (snapshot.mjs). */
export const proposalFile = id => WORK + '/' + id + '/proposal.json';
export const contractFile = proposalFile; // verouderde naam, zelfde pad
export const resultFile = id => WORK + '/' + id + '/result.json';

/** Eén proces tegelijk schrijft; geen eigenaar-sessie. Een achtergebleven lock van een dode PID wordt niet gestolen (zie doctor). */
export function withLock(root, fn) {
  const dir = safePath(root, STATE_DIR); fs.mkdirSync(dir, {recursive: true, mode: 0o700});
  const lock = path.join(dir, 'lock'), until = Date.now() + 3000;
  for (;;) {
    try { fs.mkdirSync(lock); fs.writeFileSync(path.join(lock, 'owner.json'), JSON.stringify({pid: process.pid, at: now()})); break; }
    catch (e) { if (e.code !== 'EEXIST') throw e; requireThat(Date.now() < until, 'AAE-status is vergrendeld. Geen automatische herhaallus; controleer doctor.'); Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 15); }
  }
  try { return fn(); } finally { fs.rmSync(lock, {recursive: true, force: true}); }
}
export function listWork(root) {
  const dir = path.join(fs.realpathSync(root), WORK);
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir).filter(n => fs.existsSync(path.join(dir, n, 'state.json'))).sort();
}
export function loadWork(root, id) {
  const f = path.join(fs.realpathSync(root), stateFile(id));
  if (!fs.existsSync(f)) return null;
  const st = JSON.parse(fs.readFileSync(safePath(root, stateFile(id), {allowMissing: false}), 'utf8'));
  requireThat(st.version === 4, 'Onbekende stateversie voor ' + id + '. Niet automatisch resetten.');
  return st;
}
export function saveWork(root, st) { st.updated = now(); atomicJson(root, stateFile(st.id), st); }
export function newState(id) {
  return {
    version: 4, id, status: 'PLANNING', activity: null, created: now(), updated: now(),
    contract: null, proposed: null, approved: null, presented: null, snapshot: null, recovered: null, needs_human: null, pending_decision: null, confirmed: null, blockers: [],
    usage: {agents: 0, commands: 0, external: 0}, agents: {}, command_counts: {}, receipts: [], command_running: null,
    external_calls: {}, external_receipts: [], extra_fp: {}, supabase_verified: null, preflight: null, files_touched: [], soft_exceeded: false,
    legacy: false, history: []
  };
}
export function log(st, type, detail = {}) { st.history.push({at: now(), type, ...detail}); if (st.history.length > 200) st.history = st.history.slice(-200); }
export function transition(st, to, why = '') {
  requireThat(STATUSES.includes(to), 'Onbekende status ' + to);
  requireThat(TRANSITIONS[st.status].includes(to), 'Ongeldige statusovergang ' + st.status + ' → ' + to + '.');
  const from = st.status; st.status = to;
  if (to !== 'EXECUTING') st.activity = to === 'NEEDS_HUMAN' ? st.activity : null;
  if (to !== 'NEEDS_HUMAN') st.needs_human = null;
  log(st, 'status', {van: from, naar: to, reden: why});
}
export function needsHuman(st, kind, summary, extra = {}) {
  st.status === 'NEEDS_HUMAN' || transition(st, 'NEEDS_HUMAN', kind);
  st.needs_human = {kind, summary, at: now(), ...extra};
  log(st, 'needs_human', {kind, summary});
}
/** v3.4: zichtbare tellers per werkpakket (uit de geschiedenis): hoeveel GO's, NEEDS_HUMAN, BLOCKED en agentruns kostte dit doel? */
export function tellers(st) {
  const h = st.history || [];
  return {go: h.filter(x => x.type === 'goedkeuring').length, needs_human: h.filter(x => x.type === 'needs_human').length, blocked: h.filter(x => x.type === 'status' && x.naar === 'BLOCKED').length, agentruns: st.usage?.agents || 0};
}
export function contractOf(root, id) { return validateContract(readJson(root, contractFile(id))); }

/** De werkpakketten die nu werk mogen doen of op een mens wachten. Meer dan één actief pakket is een fout (één bouwer per werkmap). */
export function activeWork(root) {
  const ids = listWork(root).map(id => loadWork(root, id)).filter(s => s && ['EXECUTING', 'NEEDS_HUMAN'].includes(s.status));
  requireThat(ids.length <= 1, 'Meer dan één actief werkpakket (' + ids.map(s => s.id).join(', ') + '). Pauzeer of annuleer er een.');
  return ids[0] || null;
}
/**
 * Bewakingshandeling: controleert de goedgekeurde hash en envelop (assertApproval). Klopt het niet, dan wordt de handeling geweigerd en wacht
 * het werkpakket op een beslissing van Jurgen (NEEDS_HUMAN); een nieuwe `cli present` + `AAE GO` keurt dan de actuele envelop opnieuw goed.
 */
export function guardApproval(root, st) {
  try { assertApproval(st); }
  catch (e) {
    if (st && st.status === 'EXECUTING') { needsHuman(st, 'material_change', e.message, {reasons: ['goedkeuring ongeldig']}); saveWork(root, st); }
    throw e;
  }
  // Een snapshotfout is technisch, geen beslissing van Jurgen: eerst automatisch herproberen (ensureSnapshot), daarna BLOCKED met een korte reden (geen NEEDS_HUMAN).
  try { ensureSnapshot(root, st); }
  catch (e) { blockSnapshot(root, st, e); throw e; }
}
/** Een blijvende technische snapshotfout zet het pakket op BLOCKED; AAE VERDER hervat dezelfde envelop zodra de snapshot weer klopt. */
export function blockSnapshot(root, st, err) {
  if (st && st.status === 'EXECUTING') {
    transition(st, 'BLOCKED', 'snapshot');
    st.blockers = ['Snapshot van de goedgekeurde envelop kon niet worden vastgelegd of geverifieerd: ' + String(err.message).slice(0, 200) + ' Herstel het technisch en stuur AAE VERDER (dezelfde envelop, geen nieuwe GO).'];
    log(st, 'snapshot_geblokkeerd', {fout: String(err.message).slice(0, 200)});
    saveWork(root, st);
  }
}
/**
 * Alleen een pure analyse start zonder GO: sparren, onderzoeken en lezen. Geen gevolgde bestanden, geen git-, database- of externe wijziging,
 * geen niet-lokale commando's. Elke andere route, ook LIGHT, vraagt precies één AAE GO.
 */
export function analysisFree(c) {
  const e = c.envelope;
  return e.phase === 'analysis' && e.areas.length === 0 && e.db_max === 'none' && e.git.deploy === 'none' && !e.git.commit && e.git.push.length === 0 && e.git.merge === null &&
    e.extra_commands.length === 0 && (c.plan.commands || []).every(m => m.purpose === 'read' && analysisArgv(m.argv)) && !e.providers.github && !(e.providers.supabase?.tools || []).some(t => ['apply_migration', 'execute_sql'].includes(t));
}
/**
 * Invariant bij elke bewakingshandeling: de opgeslagen goedgekeurde hash hoort bij het opgeslagen goedgekeurde contract en het huidige
 * contract valt daarbinnen. Zo kan een gewijzigde state of een ongemerkt gewijzigd contract nooit stilzwijgend meelopen op een oude GO.
 */
export function assertApproval(st) {
  const a = st && st.approved;
  requireThat(a && a.contract && a.envelope_hash, 'Geen goedgekeurde envelop voor ' + (st?.id || 'dit werkpakket') + '. Vraag AAE GO.');
  requireThat(a.contract.id === st.id, 'De goedkeuring hoort niet bij dit werkpakket. Vraag opnieuw AAE GO.');
  requireThat(envelopeHash(a.contract) === a.envelope_hash, 'De goedgekeurde envelop-hash klopt niet met het goedgekeurde contract (state aangepast?). Vraag opnieuw AAE GO.');
  const w = materialChanges(a.contract, st.contract);
  requireThat(!w.length, 'Het huidige contract valt buiten de goedgekeurde envelop (' + w.join(', ') + '). Vraag AAE GO voor de wijziging.');
}
const fresh = (iso, hours = 24) => iso && Date.now() - Date.parse(iso) <= hours * 3600 * 1000;
/** Bepaalt de volgende status voor een voorgesteld contract dat nog geen goedkeuring heeft. */
export function planningOutcome(st, c) {
  const blockers = [];
  if (c.plan.open_product_questions.length) blockers.push('Er staan nog productvragen open: ' + c.plan.open_product_questions.length + '. Stel ze eerst gebundeld aan de gebruiker.');
  const needsPreflight = c.risk_class !== 'LIGHT' && c.envelope.phase === 'implementation';
  if (needsPreflight && !(st.preflight && fresh(st.preflight.at))) blockers.push('Preflight ontbreekt of is verouderd (cli preflight).');
  if (needsPreflight && st.preflight && st.preflight.checks.some(x => x.status === 'fail')) blockers.push('Preflight meldt blokkades: ' + st.preflight.checks.filter(x => x.status === 'fail').map(x => x.name).join(', '));
  return blockers;
}
/**
 * Registreert (herregistreert) het contract van een werkpakket vanuit proposal.json. Het contract is al gevalideerd.
 * Binnen de goedgekeurde envelop verandert er niets aan de goedkeuring; erbuiten wordt het voorstel NEEDS_HUMAN tot een expliciete GO.
 */
export function registerContract(root, c) { return withLock(root, () => registerContractUnlocked(root, c)); }
export function registerContractUnlocked(root, c) {
  {
    let st = loadWork(root, c.id);
    const created = !st;
    if (!st) st = newState(c.id);
    requireThat(!['READY', 'CANCELLED'].includes(st.status), 'Werkpakket ' + c.id + ' is afgerond. Gebruik een nieuw ID.');
    let reasons = [];
    if (st.approved && ['EXECUTING', 'PAUSED', 'BLOCKED', 'NEEDS_HUMAN'].includes(st.status)) {
      reasons = materialChanges(st.approved.contract, c);
      if (!reasons.length) { st.contract = c; st.proposed = null; log(st, 'contract', {binnen_envelop: true, hash: envelopeHash(c).slice(0, 12)}); }
      else { st.proposed = c; needsHuman(st, 'material_change', 'Wezenlijke wijziging buiten de goedgekeurde envelop: ' + reasons.join(', '), {reasons}); }
    } else {
      st.proposed = c; st.contract = c;
      st.blockers = planningOutcome(st, c);
      if (st.status === 'PLANNING' || st.status === 'WAITING_FOR_APPROVAL') {
        if (!st.blockers.length && analysisFree(c)) { approve(st, c, 'ANALYSE (zonder GO: alleen lezen en onderzoeken)'); }
        else if (!st.blockers.length && st.status === 'PLANNING') transition(st, 'WAITING_FOR_APPROVAL', 'plan klaar');
        else if (st.blockers.length && st.status === 'WAITING_FOR_APPROVAL') transition(st, 'PLANNING', 'blokkades');
      }
    }
    if (created) log(st, 'aangemaakt', {klasse: c.risk_class});
    saveWork(root, st);
    return {id: st.id, status: st.status, activity: st.activity, created, reasons, blockers: st.blockers, envelope_hash: envelopeHash(c)};
  }
}
/** Zet goedkeuring: bewaart het goedgekeurde contract als vloer voor latere wijzigingen. */
export function approve(st, c, source) {
  st.approved = {envelope_hash: envelopeHash(c), contract: c, at: now(), source};
  st.contract = c; st.proposed = null; st.blockers = []; st.presented = null;
  st.extra_fp = {};
  if (st.status !== 'EXECUTING') transition(st, 'EXECUTING', 'goedgekeurd (' + source + ')');
  st.activity = 'BUILDING';
  log(st, 'goedkeuring', {bron: source, hash: st.approved.envelope_hash.slice(0, 12)});
}
export const ownerDigest = c => sha(JSON.stringify(digest(c)));

// ---- globale hulpstatus (alleen niet-gevoelige tellers) ----
const GLOBAL = STATE_DIR + '/global.json';
export function loadGlobal(root) { try { return readJson(root, GLOBAL); } catch { return {version: 1, supabase_probe: null, probes: 0}; } }
export function saveGlobal(root, g) { atomicJson(root, GLOBAL, g); }
export function eventLog(root, type, detail = {}) {
  try {
    const f = safePath(root, STATE_DIR + '/events.jsonl'); fs.mkdirSync(path.dirname(f), {recursive: true, mode: 0o700});
    if (fs.existsSync(f) && fs.statSync(f).size > 256 * 1024) fs.renameSync(f, f + '.1');
    fs.appendFileSync(f, JSON.stringify({at: now(), type, ...detail}) + '\n', {mode: 0o600});
  } catch { /* een logfout mag nooit een hookbeslissing blokkeren */ }
}
