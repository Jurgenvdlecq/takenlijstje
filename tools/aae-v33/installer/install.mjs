#!/usr/bin/env node
/**
 * AAE 3.3 installer. Standaard alleen een plan; --apply voert uit; --rollback draait een eerdere installatie terug.
 * Geen netwerk, geen git, geen appbuild, geen agentstart. Alle wijzigingen zijn omkeerbaar via .aae-backups/<id>/RESTORE.json.
 *
 * Crash-safe: het terugdraaimanifest (status in_progress) met alle back-upblobs staat atomair en duurzaam op schijf vóór de eerste mutatie.
 * Een kill, SIGINT of stroomuitval halverwege is daarom altijd te herstellen met --rollback. De back-up wordt alleen verwijderd als het
 * ongedaan maken volledig is geslaagd; anders blijft hij staan met status undo_failed.
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const PAYLOAD = path.resolve(HERE, '../payload');
export const VERSION = '3.3.0';
export const MANAGED = '.claude/aae/managed.json';
const GITIGNORE = '.gitignore';
const MARK_START = '# >>> AAE 3.3 (beheerd blok) >>>', MARK_END = '# <<< AAE 3.3 <<<';
const IGNORE_LINES = ['/.claude/aae/state/', '/.claude/aae/private/', '/.aae-backups/', '/docs/aae/work/*/state.json', '/docs/aae/work/*/state.json.tmp-*', '/docs/aae/work/*/state.json.beschadigd-*', '/docs/aae/work/*/result.json', '/docs/aae/work/*/proposal.json', '/docs/aae/work/*/proposal.json.tmp-*', '/docs/aae/work/*/raw/', '/docs/aae/evidence/', '/docs/aae/notes/', '/docs/aae/RESULT.json', '/docs/aae/TASK.json'];
// Het beheerde blok wordt ook herkend zonder afsluitende newline (een handmatig bewerkt .gitignore).
const BLOCK_RE = /\n?# >>> AAE 3\.3 \(beheerd blok\) >>>\r?\n[\s\S]*?# <<< AAE 3\.3 <<<(?:\r?\n|$)/;
const IGNORE_BLOCK = [MARK_START, ...IGNORE_LINES, MARK_END].join('\n');
const HOOK_EVENTS = ['SessionStart', 'UserPromptSubmit', 'PreToolUse', 'PostToolUse', 'PostToolUseFailure', 'SubagentStart', 'SubagentStop'];
const SKIP = ['.claude/aae/state', '.claude/aae/private'];
const SAFE_RESTORE = p => typeof p === 'string' && !p.startsWith('/') && !p.includes('\\') && p.split('/').every(s => s && s !== '.' && s !== '..') && (p.startsWith('.claude/') || p.startsWith('docs/archief/') || p === GITIGNORE);
const OPEN_STATUS = ['in_progress', 'undo_failed'];
const ROLLBACK_STATUS = ['applied', ...OPEN_STATUS];

const sha = b => crypto.createHash('sha256').update(b).digest('hex');
const fail = m => { throw new Error(m); };
const abs = (base, rel) => path.join(base, ...rel.split('/'));
const exists = f => { try { fs.lstatSync(f); return true; } catch { return false; } };
const isLink = f => { try { return fs.lstatSync(f).isSymbolicLink(); } catch { return false; } };
const hashOf = f => exists(f) ? sha(fs.readFileSync(f)) : null;
const cmpVersion = (a, b) => { const x = String(a).split('.').map(Number), y = String(b).split('.').map(Number); for (let i = 0; i < 3; i++) { const d = (x[i] || 0) - (y[i] || 0); if (d) return d < 0 ? -1 : 1; } return 0; };
/** Atomisch en duurzaam: schrijf naar een tijdelijk bestand, fsync, hernoem. Een onderbreking laat altijd het oude of het nieuwe bestand achter, nooit een half bestand. */
function atomicWrite(f, tekst, mode = 0o600) {
  fs.mkdirSync(path.dirname(f), {recursive: true});
  const tmp = f + '.tmp-' + crypto.randomBytes(4).toString('hex'), fd = fs.openSync(tmp, 'w', mode);
  try { fs.writeSync(fd, tekst); fs.fsyncSync(fd); } finally { fs.closeSync(fd); }
  fs.renameSync(tmp, f);
}

/** Alle gewone bestanden onder dir (posix-relatief). Symlinks zijn een harde fout. */
function walk(base, rel = '', skip = []) {
  const dir = rel ? abs(base, rel) : base;
  if (!exists(dir)) return [];
  const uit = [];
  for (const d of fs.readdirSync(dir, {withFileTypes: true}).sort((a, b) => a.name.localeCompare(b.name))) {
    const r = rel ? rel + '/' + d.name : d.name;
    if (skip.includes(r)) continue;
    if (d.isSymbolicLink()) fail('Symbolische link niet toegestaan: ' + r);
    if (d.isDirectory()) uit.push(...walk(base, r, skip));
    else if (d.isFile()) uit.push(r);
  }
  return uit;
}
export function payloadFiles() {
  const uit = new Map();
  for (const rel of walk(PAYLOAD)) {
    if (!rel.startsWith('.claude/')) fail('Payload mag alleen onder .claude/ staan: ' + rel);
    if (rel === MANAGED) fail('Het beheermanifest wordt door de installer gemaakt, niet meegeleverd.');
    const f = abs(PAYLOAD, rel), st = fs.statSync(f);
    uit.set(rel, {rel, abs: f, sha: sha(fs.readFileSync(f)), mode: st.mode & 0o777});
  }
  if (!uit.size) fail('Lege payload.');
  return uit;
}
export function readManaged(base) {
  const f = abs(base, MANAGED);
  if (!exists(f)) return null;
  const m = JSON.parse(fs.readFileSync(f, 'utf8'));
  if (!m || typeof m.version !== 'string' || !m.files || typeof m.files !== 'object') fail('Beheermanifest is onleesbaar.');
  return m;
}
const installedAae = base => [...walk(base, '.claude/aae', SKIP), ...walk(base, '.claude/agents').filter(p => /\/aae-[^/]+\.md$/.test(p))];
function hooksOk(base) {
  const f = abs(base, '.claude/settings.json');
  if (!exists(f)) return ['.claude/settings.json ontbreekt'];
  let s; try { s = JSON.parse(fs.readFileSync(f, 'utf8')); } catch { return ['.claude/settings.json is onleesbaar']; }
  const h = s.hooks || {}, problemen = [];
  const eigen = g => (g.hooks || []).some(x => (x.args || []).some(a => String(a).endsWith('/.claude/aae/runtime/hook.mjs')));
  for (const e of HOOK_EVENTS) if (!(h[e] || []).some(eigen)) problemen.push('hook ontbreekt in settings.json: ' + e);
  if ((h.Stop || []).some(eigen)) problemen.push('een AAE-Stop-hook staat in settings.json; v3.3 gebruikt geen Stop-hook (verwijder die eerst)');
  return problemen;
}
/** Onafgemaakte installaties of terugdraaiacties (status in_progress of undo_failed): eerst terugdraaien, daarna pas opnieuw installeren. */
function openBackups(base) {
  const dir = abs(base, '.aae-backups'), uit = [];
  if (!exists(dir) || isLink(dir)) return uit;
  for (const n of fs.readdirSync(dir)) {
    const f = path.join(dir, n, 'RESTORE.json');
    if (!exists(f)) { if (exists(path.join(dir, n, 'blobs'))) uit.push({backup: '.aae-backups/' + n, status: 'zonder RESTORE.json'}); continue; }
    try { const r = JSON.parse(fs.readFileSync(f, 'utf8')); if (OPEN_STATUS.includes(r.status)) uit.push({backup: '.aae-backups/' + n, status: r.status}); }
    catch { uit.push({backup: '.aae-backups/' + n, status: 'onleesbaar'}); }
  }
  return uit;
}

/** Wat er zou gebeuren. conflicts ≠ leeg betekent: niets uitvoeren. */
export function planInstall(project) {
  const base = fs.realpathSync(project);
  const conflicts = [], notes = [];
  for (const p of ['.claude', '.claude/aae', '.claude/agents', '.gitignore', '.aae-backups', 'docs/archief']) if (isLink(abs(base, p))) conflicts.push('Symbolische link niet toegestaan als wortel: ' + p + ' (schrijven zou buiten het project kunnen komen).');
  if (!exists(abs(base, '.claude'))) conflicts.push('Geen .claude-map: dit is geen AAE-project.');
  for (const o of openBackups(base)) conflicts.push('Er staat een onafgemaakte installatie of terugdraaiactie (' + o.backup + ', status ' + o.status + '). Draai eerst terug: node tools/aae-v33/installer/install.mjs --project . --rollback ' + o.backup + ' --apply');
  const payload = payloadFiles();
  let managed = null;
  try { managed = readManaged(base); } catch (e) { conflicts.push(e.message); }
  let onbekend = [];
  try { onbekend = installedAae(base); } catch (e) { conflicts.push(e.message); }
  if (!managed && onbekend.length) conflicts.push('Er staat een AAE-systeem zonder beheermanifest; onbekende installatie (' + onbekend.length + ' bestanden). Niet blind overschrijven.');
  if (managed) {
    for (const [p, h] of Object.entries(managed.files)) {
      if (!SAFE_RESTORE(p)) { conflicts.push('Onveilig pad in het beheermanifest: ' + p); continue; }
      const nu = hashOf(abs(base, p));
      if (nu === null) conflicts.push('beheerd bestand ontbreekt: ' + p); else if (nu !== h) conflicts.push('beheerd bestand is gewijzigd: ' + p);
    }
    for (const p of onbekend) if (!Object.hasOwn(managed.files, p) && p !== MANAGED) conflicts.push('onbekend bestand in het AAE-gebied: ' + p);
  }
  for (const p of hooksOk(base)) conflicts.push(p);
  if (exists(abs(base, '.claude/aae/state/lock'))) conflicts.push('Er staat een vergrendeling in de AAE-status; sluit lopende sessies en controleer eerst.');
  const actions = {toevoegen: [], vervangen: [], verwijderen: [], ongewijzigd: [], gitignore: false, archief: null};
  for (const [rel, f] of payload) {
    const nu = hashOf(abs(base, rel));
    if (nu === null) actions.toevoegen.push(rel); else if (nu !== f.sha) actions.vervangen.push(rel); else actions.ongewijzigd.push(rel);
  }
  if (managed) for (const p of Object.keys(managed.files)) if (!payload.has(p)) actions.verwijderen.push(p);
  const gi = exists(abs(base, GITIGNORE)) ? fs.readFileSync(abs(base, GITIGNORE), 'utf8') : '';
  actions.gitignore = !gi.includes(MARK_START);
  const noop = Boolean(managed && managed.version === VERSION && !actions.toevoegen.length && !actions.vervangen.length && !actions.verwijderen.length && !actions.gitignore);
  if (managed && !noop) {
    // Geen downgrade en geen "dezelfde versie met een andere inhoud": verhoog het versienummer van de payload.
    const v = cmpVersion(VERSION, managed.version);
    if (v < 0) conflicts.push('Geïnstalleerd is v' + managed.version + ', nieuwer dan deze payload (v' + VERSION + '): een downgrade wordt niet uitgevoerd.');
    else if (v === 0) conflicts.push('Deze payload heeft dezelfde versie (v' + VERSION + ') als de installatie maar een andere inhoud; verhoog het versienummer.');
  }
  if (managed && !noop && managed.version !== VERSION) {
    actions.archief = 'docs/archief/aae-' + managed.version.replace(/[^A-Za-z0-9._-]/g, '-');
    if (exists(abs(base, actions.archief))) conflicts.push('Het archief bestaat al: ' + actions.archief);
  }
  if (!exists(abs(base, '.claude/aae/state/local.json')) && !walk(base, 'docs/aae/work').length) notes.push('Geen lopende route gevonden; er wordt niets overgenomen.');
  else notes.push('Een lopende v3.2-route wordt bij het eerste hook-event overgenomen (verbruik en receipts blijven behouden) maar wacht daarna op een nieuwe expliciete AAE GO <id> <korte hash>: eenmalige migratiegrens.');
  notes.push('.claude/settings.json, CLAUDE.md en de map .claude/aae/state blijven ongemoeid.');
  return {project: base, from: managed ? managed.version : null, to: VERSION, noop, conflicts, actions, notes};
}

/** Verwijdert lege mappen onder (en inclusief) d; een map met inhoud blijft staan. */
function rmEmptyTree(d) {
  let st; try { st = fs.lstatSync(d); } catch { return; }
  if (!st.isDirectory()) return;
  for (const e of fs.readdirSync(d, {withFileTypes: true})) if (e.isDirectory()) rmEmptyTree(path.join(d, e.name));
  if (!fs.readdirSync(d).length) fs.rmdirSync(d);
}
const manifestPad = backup => path.join(backup, 'RESTORE.json');
const schrijfManifest = (backup, m) => atomicWrite(manifestPad(backup), JSON.stringify(m, null, 2) + '\n');

/** Zet één bestand terug naar de toestand vóór de installatie (idempotent: een bestand dat al op die toestand staat blijft gelijk). */
function herstelEen(base, backupRel, e) {
  const f = abs(base, e.path);
  if (e.path === GITIGNORE && hashOf(f) !== e.after && hashOf(f) !== e.before) { // alleen het beheerde blok eruit; eigen regels blijven
    const rest = fs.readFileSync(f, 'utf8').replace(BLOCK_RE, '');
    if (!rest.trim() && !e.before) fs.rmSync(f, {force: true}); else fs.writeFileSync(f, rest);
    return;
  }
  if (e.before) { fs.mkdirSync(path.dirname(f), {recursive: true}); fs.writeFileSync(f, fs.readFileSync(abs(base, backupRel + '/blobs/' + e.before)), {mode: parseInt(e.mode, 8)}); fs.chmodSync(f, parseInt(e.mode, 8)); }
  else fs.rmSync(f, {force: true});
}
/** Controle na het terugzetten: alle bestanden staan op de toestand van vóór de installatie. Geeft de afwijkingen terug. */
function controleerHersteld(base, r) {
  const slecht = [];
  for (const e of r.files) {
    if (e.before && e.path !== GITIGNORE && hashOf(abs(base, e.path)) !== e.before) slecht.push('Controle na terugdraaien mislukt voor ' + e.path);
    if (!e.before && e.path !== GITIGNORE && exists(abs(base, e.path))) slecht.push('Bestand zou weg moeten zijn: ' + e.path);
  }
  if (exists(abs(base, GITIGNORE)) && fs.readFileSync(abs(base, GITIGNORE), 'utf8').includes(MARK_START)) slecht.push('Het beheerde .gitignore-blok staat er nog.');
  return slecht;
}
const ruimMappenOp = (base, r) => { for (const d of r.dirs_created || []) { if (d !== 'docs' && !SAFE_RESTORE(d + '/x')) continue; try { rmEmptyTree(abs(base, d)); } catch { /* niet leeg: laten staan */ } } };

/** Voert het plan uit. Bij een fout wordt alles teruggedraaid; lukt dat niet volledig, dan blijft de back-up staan (undo_failed). opts.failAfter en opts.failUndoAfter zijn alleen voor tests. */
export function apply(project, opts = {}) {
  const plan = planInstall(project);
  if (plan.conflicts.length) fail('Conflicten; niets uitgevoerd:\n- ' + plan.conflicts.join('\n- '));
  if (plan.noop) return {id: null, noop: true, plan};
  const base = plan.project, payload = payloadFiles(), managed = readManaged(base);
  const id = new Date().toISOString().replace(/[:.]/g, '-') + '-' + crypto.randomBytes(3).toString('hex');
  const backupRel = '.aae-backups/' + id, backup = abs(base, backupRel);
  let n = 0, c = 0;
  // opts.failAfter (een fout die netjes wordt teruggedraaid) en opts.crashAfter (het proces wordt hard gedood, zonder kans op ongedaan maken) zijn alleen voor tests.
  const tick = () => { if (opts.failAfter != null && ++n > opts.failAfter) fail('Gesimuleerde fout (test).'); if (opts.crashAfter != null && ++c > opts.crashAfter) process.kill(process.pid, 'SIGKILL'); };
  // 1. Het hele plan vooraf: elk doelbestand met zijn toestand van vóór de installatie (blob) en de beoogde toestand erna.
  const doelen = [];
  if (plan.actions.archief && managed) for (const p of Object.keys(managed.files)) doelen.push({rel: plan.actions.archief + '/' + p.replace(/^\.claude\//, ''), buf: fs.readFileSync(abs(base, p)), mode: 0o644});
  for (const [rel, f] of payload) if (hashOf(abs(base, rel)) !== f.sha) doelen.push({rel, buf: fs.readFileSync(f.abs), mode: f.mode & 0o111 ? 0o755 : 0o644});
  for (const p of plan.actions.verwijderen) doelen.push({rel: p, buf: null, mode: null});
  if (plan.actions.gitignore) { const f = abs(base, GITIGNORE), oud = exists(f) ? fs.readFileSync(f, 'utf8') : ''; doelen.push({rel: GITIGNORE, buf: Buffer.from((oud && !oud.endsWith('\n') ? oud + '\n' : oud) + (oud ? '\n' : '') + IGNORE_BLOCK + '\n'), mode: exists(f) ? fs.statSync(f).mode & 0o777 : 0o644}); }
  const files = Object.fromEntries([...payload.values()].sort((a, b) => a.rel.localeCompare(b.rel)).map(f => [f.rel, f.sha]));
  doelen.push({rel: MANAGED, buf: Buffer.from(JSON.stringify({version: VERSION, files}, null, 2) + '\n'), mode: 0o644});
  const entries = [], dirs = new Set();
  fs.mkdirSync(path.join(backup, 'blobs'), {recursive: true, mode: 0o700});
  for (const d of doelen) {
    const f = abs(base, d.rel); let before = null, mode = null;
    if (exists(f)) {
      const buf = fs.readFileSync(f); before = sha(buf); mode = (fs.statSync(f).mode & 0o777).toString(8);
      const blob = path.join(backup, 'blobs', before);
      if (!exists(blob)) fs.writeFileSync(blob, buf, {mode: 0o600});
    }
    if (d.buf === null && before === null) continue; // niets te verwijderen
    entries.push({path: d.rel, before, after: d.buf === null ? null : sha(d.buf), mode});
    // mappen die er nog niet zijn en door dit bestand ontstaan
    let ouder = path.dirname(d.rel);
    const keten = []; while (ouder && ouder !== '.' && !exists(abs(base, ouder))) { keten.push(ouder); ouder = path.dirname(ouder); }
    for (const k of keten) dirs.add(k);
  }
  const manifest = {schema: 1, status: 'in_progress', created: new Date().toISOString(), from: plan.from, to: VERSION, archive: plan.actions.archief, dirs_created: [...dirs].sort((a, b) => b.length - a.length), files: entries};
  schrijfManifest(backup, manifest); // duurzaam vóór de eerste mutatie: vanaf hier is elke onderbreking met --rollback te herstellen
  try {
    // 2. Mutaties
    for (const d of doelen) {
      tick();
      const f = abs(base, d.rel);
      if (d.buf === null) { fs.rmSync(f, {force: true}); continue; }
      fs.mkdirSync(path.dirname(f), {recursive: true});
      fs.writeFileSync(f, d.buf, {mode: d.mode}); fs.chmodSync(f, d.mode);
    }
    // 3. opruimen van lege mappen van verwijderde bestanden
    for (const p of plan.actions.verwijderen) { let d = path.dirname(abs(base, p)); while (d.startsWith(base + path.sep) && d !== base && exists(d) && !fs.readdirSync(d).length) { fs.rmdirSync(d); d = path.dirname(d); } }
    // 4. controle: hashes en doctor (doctor schrijft niets en neemt geen route over)
    const slecht = [...payload.values()].filter(f => hashOf(abs(base, f.rel)) !== f.sha).map(f => f.rel);
    if (slecht.length) fail('Controle mislukt, afwijkende bestanden: ' + slecht.join(', '));
    const doc = spawnSync(process.execPath, [abs(base, '.claude/aae/runtime/cli.mjs'), 'doctor'], {cwd: base, encoding: 'utf8', timeout: 30000});
    if (doc.status !== 0) fail('doctor faalde: ' + (doc.stderr || doc.stdout || '').slice(0, 400));
    const dr = JSON.parse(doc.stdout), aandacht = dr.checks.filter(c => c.status !== 'PASS');
    if (aandacht.length) fail('doctor meldt aandachtspunten: ' + aandacht.map(c => c.name + ' (' + c.detail + ')').join('; '));
    schrijfManifest(backup, {...manifest, status: 'applied', applied: new Date().toISOString()});
    return {id, backup: backupRel, plan, geschreven: entries.length};
  } catch (e) {
    // Ongedaan maken: elke stap onafhankelijk. De back-up verdwijnt alleen als alles aantoonbaar terug is; anders blijft hij staan (undo_failed).
    const fouten = [];
    let k = 0;
    for (const en of [...entries].reverse()) { try { if (opts.failUndoAfter != null && ++k > opts.failUndoAfter) fail('Gesimuleerde fout in het ongedaan maken (test).'); herstelEen(base, backupRel, en); } catch (err) { fouten.push(en.path + ': ' + err.message); } }
    ruimMappenOp(base, manifest);
    fouten.push(...controleerHersteld(base, manifest));
    if (!fouten.length) { fs.rmSync(backup, {recursive: true, force: true}); throw e; }
    try { schrijfManifest(backup, {...manifest, status: 'undo_failed', undo_failures: fouten, error: String(e.message).slice(0, 300)}); } catch { /* het in_progress-manifest staat al op schijf */ }
    throw new Error(e.message + '\nHet ongedaan maken is niet volledig gelukt (' + fouten.length + ' punten). De back-up blijft staan in ' + backupRel + ' (status undo_failed). Draai terug met: node tools/aae-v33/installer/install.mjs --project . --rollback ' + backupRel + ' --apply');
  }
}

/** Plan voor terugdraaien: alleen als niets sinds de installatie is gewijzigd. Ook een onderbroken installatie (in_progress) of mislukt ongedaan maken (undo_failed) is terug te draaien. */
export function planRollback(project, backupRel) {
  const base = fs.realpathSync(project);
  if (!/^\.aae-backups\/[A-Za-z0-9._-]+$/.test(backupRel) || /^\.{1,2}$/.test(backupRel.split('/')[1])) fail('Ongeldig back-uppad: ' + backupRel);
  const rf = abs(base, backupRel + '/RESTORE.json');
  if (!exists(rf)) fail('RESTORE.json niet gevonden in ' + backupRel);
  const r = JSON.parse(fs.readFileSync(rf, 'utf8')), conflicts = [];
  if (r.schema !== 1 || !ROLLBACK_STATUS.includes(r.status) || !Array.isArray(r.files)) fail('RESTORE.json is niet "applied" (status: ' + String(r.status) + '; terugdraaien kan bij applied, in_progress of undo_failed) of heeft een onbekend schema.');
  for (const e of r.files) {
    if (!SAFE_RESTORE(e.path)) { conflicts.push('Onveilig pad in RESTORE.json: ' + e.path); continue; }
    const nu = hashOf(abs(base, e.path));
    // .gitignore is gedeeld: eigen regels na de installatie zijn geen conflict; alleen het beheerde blok wordt verwijderd.
    const gedeeldeGitignore = e.path === GITIGNORE && nu !== null && BLOCK_RE.test(fs.readFileSync(abs(base, e.path), 'utf8'));
    // Na een onderbreking (of een eerder deels gelukt terugdraaien) staat een bestand op de toestand van vóór óf na de installatie; alles anders is een latere wijziging.
    if (nu !== e.after && nu !== e.before && !gedeeldeGitignore) conflicts.push('gewijzigd sinds de installatie: ' + e.path);
    if (e.before) { const blob = abs(base, backupRel + '/blobs/' + e.before); if (hashOf(blob) !== e.before) conflicts.push('back-upblob ontbreekt of is beschadigd voor ' + e.path); }
  }
  const werk = walk(base, 'docs/aae/work').filter(p => p.endsWith('/state.json'));
  const notes = werk.length ? ['Voortgang van werkpakketten na de installatie staat alleen in ' + werk.join(', ') + '; v3.2 kent die niet en gaat verder vanaf het moment van installeren.'] : [];
  if (r.status !== 'applied') notes.push('Dit is een ' + (r.status === 'in_progress' ? 'onderbroken installatie' : 'installatie waarvan het ongedaan maken niet volledig lukte') + '; terugdraaien zet alles terug naar de toestand van vóór de installatie.');
  return {project: base, backup: backupRel, restore: r, conflicts, notes};
}
export function rollback(project, backupRel, opts = {}) {
  const plan = planRollback(project, backupRel);
  if (plan.conflicts.length) fail('Conflicten; niets teruggedraaid:\n- ' + plan.conflicts.join('\n- '));
  const base = plan.project, r = plan.restore;
  const bewaard = r.files.map(e => ({e, nu: exists(abs(base, e.path)) ? fs.readFileSync(abs(base, e.path)) : null, mode: exists(abs(base, e.path)) ? fs.statSync(abs(base, e.path)).mode & 0o777 : null}));
  let n = 0;
  try {
    for (const e of [...r.files].reverse()) {
      if (opts.failAfter != null && ++n > opts.failAfter) fail('Gesimuleerde fout (test).');
      herstelEen(base, backupRel, e);
    }
    ruimMappenOp(base, r);
    const slecht = controleerHersteld(base, r); if (slecht.length) fail(slecht[0]);
    schrijfManifest(abs(base, backupRel), {...r, status: 'rolled_back', rolled_back: new Date().toISOString()});
    return {backup: backupRel, hersteld: r.files.length, plan};
  } catch (err) {
    // Het manifest blijft ongewijzigd (in_progress/undo_failed/applied): het terugdraaien is gewoon te herhalen.
    for (const {e, nu, mode} of bewaard.reverse()) { try { const f = abs(base, e.path); if (nu === null) fs.rmSync(f, {force: true}); else { fs.mkdirSync(path.dirname(f), {recursive: true}); fs.writeFileSync(f, nu, {mode}); } } catch { /* best effort */ } }
    throw err;
  }
}

// ---- opdrachtregel ----
function uitleg(plan) {
  const regels = [];
  regels.push('AAE ' + (plan.from || 'geen') + ' → ' + plan.to + ' in ' + plan.project);
  if (plan.noop) regels.push('Niets te doen: v' + VERSION + ' is al geïnstalleerd en ongewijzigd.');
  else {
    regels.push('Toevoegen: ' + plan.actions.toevoegen.length + ' · vervangen: ' + plan.actions.vervangen.length + ' · verwijderen: ' + plan.actions.verwijderen.length + ' · ongewijzigd: ' + plan.actions.ongewijzigd.length + (plan.actions.gitignore ? ' · .gitignore-blok toevoegen' : ''));
    if (plan.actions.archief) regels.push('Archief van de vorige versie: ' + plan.actions.archief);
  }
  for (const n of plan.notes) regels.push('Let op: ' + n);
  if (plan.conflicts.length) { regels.push('CONFLICTEN (niets wordt uitgevoerd):'); for (const c of plan.conflicts) regels.push('  - ' + c); }
  return regels.join('\n');
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const args = process.argv.slice(2), val = k => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : null; };
    const project = val('--project') || '.', doApply = args.includes('--apply'), rb = val('--rollback');
    for (const a of args) if (!['--project', '--apply', '--rollback', '--json'].includes(a) && a !== project && a !== rb) fail('Onbekend argument: ' + a);
    let uit;
    if (rb) {
      const plan = planRollback(project, rb);
      if (!doApply) { console.log(plan.conflicts.length ? 'CONFLICTEN:\n- ' + plan.conflicts.join('\n- ') : 'Plan: ' + plan.restore.files.length + ' bestanden terugzetten naar v' + (plan.restore.from || 'geen') + '.\nVoer opnieuw uit met --apply om terug te draaien.'); for (const n of plan.notes) console.log('Let op: ' + n); uit = {plan}; }
      else { uit = rollback(project, rb); console.log('Teruggedraaid: ' + uit.hersteld + ' bestanden hersteld.'); }
    } else {
      const plan = planInstall(project);
      if (!doApply) { console.log(uitleg(plan)); if (!plan.conflicts.length && !plan.noop) console.log('Voer opnieuw uit met --apply om te installeren.'); uit = {plan}; }
      else { uit = apply(project); console.log(uit.noop ? 'Niets te doen.' : 'Geïnstalleerd. Back-up: ' + uit.backup + '\nTerugdraaien: node tools/aae-v33/installer/install.mjs --project . --rollback ' + uit.backup); }
    }
    if (args.includes('--json')) console.log(JSON.stringify(uit, null, 2));
    if (uit.plan?.conflicts?.length) process.exitCode = 1;
  } catch (e) { console.error('AAE-installer: ' + e.message); process.exitCode = 2; }
}
