/**
 * Duurzame, goedgekeurde envelop. Bij elke AAE GO schrijft de runtime (nooit het model) als eerste schrijfactie een gevolgde, append-only snapshot:
 * docs/aae/work/<id>/approved/<volgnr>-<hash12>.json. De snapshot bevat de exacte canonieke envelop met de volledige hash, de volledige goedgekeurde
 * envelop, de bewijsvloer en de vorige hash (keten). Een bestaande snapshot wordt nooit overschreven. Na verlies van sessie of container
 * reconstrueert `cli recover` uit deze keten plus de repository-staat wat was goedgekeurd.
 * Deze module leunt alleen op core.mjs (geen cirkel met state.mjs).
 */
import fs from 'node:fs';
import path from 'node:path';
import {WORK, requireThat, safePath, digest, stable, now, envelopeHash, envelopeOf, shortHash, committedInHead} from './core.mjs';

export const SNAPSHOT_SCHEMA = 1;
export const snapshotDir = id => WORK + '/' + id + '/approved';
const NAME = /^(\d{3})-([0-9a-f]{12})\.json$/;
const fileName = (seq, hash) => String(seq).padStart(3, '0') + '-' + hash.slice(0, 12) + '.json';

/** Het goedgekeurde contract zoals het uit een snapshot terugkomt: de envelop en de bewijsvloer, zonder plan (agents en commando's volgen uit een nieuw voorstel). */
export function contractFromSnapshot(s) {
  return {
    schema_version: 4, id: s.work_id, title: s.contract.title, goal: s.contract.goal, risk_class: s.contract.risk_class, risk_flags: s.contract.risk_flags,
    envelope: s.contract.envelope,
    plan: {test_plan: s.evidence_floor, agents: [], commands: [], read: [], open_product_questions: [], keep_raw: false}
  };
}
export function buildSnapshot(c, {sequence, previous_hash, source, at}) {
  const hash = envelopeHash(c);
  const body = {
    schema: SNAPSHOT_SCHEMA, work_id: c.id, sequence, previous_hash: previous_hash || null, approved_at: at || now(), source,
    hash, short_hash: shortHash(hash), envelope: envelopeOf(c),
    contract: {title: c.title, goal: c.goal, risk_class: c.risk_class, risk_flags: c.risk_flags, envelope: c.envelope},
    evidence_floor: c.plan.test_plan.map(t => ({kind: t.kind, method: t.method, description: t.description}))
  };
  body.snapshot_digest = digest(body);
  return body;
}
/** Klopt de inhoud met zichzelf, met de volledige hash en met de keten? Gooit een GuardError met de reden. */
export function verifySnapshot(s, verwachteVolgorde, vorigeHash, bestandsnaam) {
  requireThat(s && typeof s === 'object' && s.schema === SNAPSHOT_SCHEMA, 'Snapshot ' + bestandsnaam + ' heeft een onbekend schema of is onleesbaar.');
  const {snapshot_digest, ...rest} = s;
  requireThat(snapshot_digest === digest(rest), 'Snapshot ' + bestandsnaam + ' is beschadigd of handmatig gewijzigd (inhoud klopt niet met zijn eigen controlegetal).');
  const c = contractFromSnapshot(s);
  requireThat(envelopeHash(c) === s.hash, 'Snapshot ' + bestandsnaam + ': de volledige hash klopt niet met de envelop in het bestand.');
  requireThat(stable(envelopeOf(c)) === stable(s.envelope), 'Snapshot ' + bestandsnaam + ': de canonieke envelop klopt niet met de goedgekeurde envelop.');
  requireThat(s.sequence === verwachteVolgorde, 'Snapshot ' + bestandsnaam + ': volgnummer ' + s.sequence + ' in plaats van ' + verwachteVolgorde + ' (keten onvolledig).');
  requireThat((s.previous_hash || null) === (vorigeHash || null), 'Snapshot ' + bestandsnaam + ': de vorige-hash-keten sluit niet.');
  requireThat(bestandsnaam === fileName(s.sequence, s.hash), 'Snapshot ' + bestandsnaam + ': bestandsnaam hoort niet bij volgnummer en hash.');
  return c;
}
export function listSnapshots(root, id) {
  const dir = path.join(fs.realpathSync(root), snapshotDir(id));
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir).filter(n => NAME.test(n)).sort();
}
const readSnap = (root, id, name) => { const rel = snapshotDir(id) + '/' + name; try { return JSON.parse(fs.readFileSync(safePath(root, rel, {allowMissing: false}), 'utf8')); } catch { requireThat(false, 'Snapshot ' + name + ' is onleesbaar of beschadigd.'); } };
/** Controleert de hele keten. committed=true eist bovendien dat elke snapshot ongewijzigd in HEAD staat (alleen mogelijk in een git-map). */
export function verifyChain(root, id, {committed = false} = {}) {
  const namen = listSnapshots(root, id), keten = []; let vorige = null;
  namen.forEach((naam, i) => {
    const s = readSnap(root, id, naam); verifySnapshot(s, i + 1, vorige, naam); vorige = s.hash; keten.push(s);
    if (committed) {
      const ok = committedInHead(root, snapshotDir(id) + '/' + naam);
      requireThat(ok !== false, 'Snapshot ' + naam + ' is niet (ongewijzigd) in de laatste commit vastgelegd; commit en push hem eerst, anders overleeft hij verlies van de container niet.');
      requireThat(ok !== null, 'Snapshot ' + naam + ' kan niet als vastgelegd worden gecontroleerd: dit is geen git-map.');
    }
  });
  return {chain: keten, namen};
}
/** Schrijft de snapshot voor de goedgekeurde envelop van dit werkpakket (idempotent: bestaat hij al voor deze hash, dan gebeurt er niets). */
export function writeSnapshot(root, st, source = 'AAE GO') {
  requireThat(st.approved && st.approved.contract && st.approved.envelope_hash, 'Geen goedgekeurde envelop om vast te leggen.');
  const {chain} = verifyChain(root, st.id);
  const laatste = chain.at(-1);
  if (laatste && laatste.hash === st.approved.envelope_hash) { st.snapshot = {sequence: laatste.sequence, hash: laatste.hash, path: snapshotDir(st.id) + '/' + fileName(laatste.sequence, laatste.hash)}; return st.snapshot; }
  const s = buildSnapshot(st.approved.contract, {sequence: chain.length + 1, previous_hash: laatste?.hash || null, source, at: st.approved.at});
  requireThat(s.hash === st.approved.envelope_hash, 'De goedgekeurde hash klopt niet met het goedgekeurde contract; snapshot niet geschreven.');
  const rel = snapshotDir(st.id) + '/' + fileName(s.sequence, s.hash), f = safePath(root, rel);
  fs.mkdirSync(path.dirname(f), {recursive: true});
  try { fs.writeFileSync(f, JSON.stringify(s, null, 2) + '\n', {flag: 'wx', mode: 0o644}); } // exclusief: een bestaande snapshot wordt nooit overschreven
  catch (e) { requireThat(false, 'Snapshot ' + rel + ' kon niet worden geschreven: ' + String(e.code || e.message)); }
  verifySnapshot(readSnap(root, st.id, fileName(s.sequence, s.hash)), s.sequence, s.previous_hash, fileName(s.sequence, s.hash));
  st.snapshot = {sequence: s.sequence, hash: s.hash, path: rel};
  return st.snapshot;
}
/** Bij elke bewakingshandeling na een GO: de snapshot van de goedgekeurde envelop bestaat en klopt; ontbreekt hij, dan schrijft de runtime hem alsnog (nooit het model). */
export function ensureSnapshot(root, st) {
  if (!st.approved?.snapshot_required) return null;
  return writeSnapshot(root, st, st.approved.source || 'AAE GO');
}
/** Werkpakketten met een snapshot-map maar zonder bruikbare lokale state (verlies van sessie of container, of beschadigde state): kandidaten voor cli recover. */
export function orphanedSnapshots(root, hasState) {
  const dir = path.join(fs.realpathSync(root), WORK);
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir).filter(id => /^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/.test(id) && listSnapshots(root, id).length > 0 && !hasState(id)).sort();
}
/** Staat de actuele snapshot in HEAD? true/false; null = geen git-map. */
export function snapshotCommitted(root, st) {
  if (!st.approved?.snapshot_required || !st.snapshot) return true;
  return committedInHead(root, st.snapshot.path);
}
