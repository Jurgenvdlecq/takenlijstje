#!/usr/bin/env node
/**
 * AAE 3.3 installer. Standaard alleen een plan; --apply voert uit; --rollback draait een eerdere installatie terug.
 * Geen netwerk, geen git, geen appbuild, geen agentstart. Alle wijzigingen zijn omkeerbaar via .aae-backups/<id>/RESTORE.json.
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
const IGNORE_LINES = ['/.claude/aae/state/', '/.claude/aae/private/', '/.aae-backups/', '/docs/aae/work/*/state.json', '/docs/aae/work/*/state.json.tmp-*', '/docs/aae/work/*/result.json','/docs/aae/evidence/', '/docs/aae/notes/', '/docs/aae/RESULT.json', '/docs/aae/TASK.json'];
const BLOCK_RE = /\n?# >>> AAE 3\.3 \(beheerd blok\) >>>\n[\s\S]*?# <<< AAE 3\.3 <<<\n/;
const IGNORE_BLOCK =[MARK_START, ...IGNORE_LINES, MARK_END].join('\n');
const HOOK_EVENTS = ['SessionStart', 'UserPromptSubmit', 'PreToolUse', 'PostToolUse', 'PostToolUseFailure', 'SubagentStart', 'SubagentStop'];
const SKIP = ['.claude/aae/state', '.claude/aae/private'];
const SAFE_RESTORE = p => typeof p === 'string' && !p.startsWith('/') && !p.includes('\\') && p.split('/').every(s => s && s !== '.' && s !== '..') && (p.startsWith('.claude/') || p.startsWith('docs/archief/') || p === GITIGNORE);

const sha = b => crypto.createHash('sha256').update(b).digest('hex');
const fail = m => { throw new Error(m); };
const abs = (base, rel) => path.join(base, ...rel.split('/'));
const exists = f => { try { fs.lstatSync(f); return true; } catch { return false; } };
const hashOf = f => exists(f) ? sha(fs.readFileSync(f)) : null;

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

/** Wat er zou gebeuren. conflicts ≠ leeg betekent: niets uitvoeren. */
export function planInstall(project) {
  const base = fs.realpathSync(project);
  const conflicts = [], notes = [];
  if (!exists(abs(base, '.claude'))) conflicts.push('Geen .claude-map: dit is geen AAE-project.');
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
  if (managed && !noop && managed.version !== VERSION) {
    actions.archief = 'docs/archief/aae-' + managed.version.replace(/[^A-Za-z0-9._-]/g, '-');
    if (exists(abs(base, actions.archief))) conflicts.push('Het archief bestaat al: ' + actions.archief);
  }
  if (!exists(abs(base, '.claude/aae/state/local.json')) && !walk(base, 'docs/aae/work').length) notes.push('Geen lopende route gevonden; er wordt niets overgenomen.');
  else notes.push('Een lopende v3.2-route wordt bij het eerste hook-event automatisch overgenomen (GO, verbruik en receipts blijven behouden).');
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
/** Voert het plan uit. Bij elke fout wordt alles teruggedraaid. opts.failAfter is alleen voor tests. */
export function apply(project, opts = {}) {
  const plan = planInstall(project);
  if (plan.conflicts.length) fail('Conflicten; niets uitgevoerd:\n- ' + plan.conflicts.join('\n- '));
  if (plan.noop) return {id: null, noop: true, plan};
  const base = plan.project, payload = payloadFiles(), managed = readManaged(base);
  const id = new Date().toISOString().replace(/[:.]/g, '-') + '-' + crypto.randomBytes(3).toString('hex');
  const backupRel = '.aae-backups/' + id, backup = abs(base, backupRel);
  const entries = [], undo = [], dirsCreated = [];
  let n = 0;
  const tick = () => { if (opts.failAfter != null && ++n > opts.failAfter) fail('Gesimuleerde fout (test).'); };
  const dir = d => { const eerste = fs.mkdirSync(d, {recursive: true}); if (eerste) dirsCreated.push(path.relative(base, eerste).split(path.sep).join('/')); };
  const bewaar = rel => { // blob van het huidige bestand (alleen als het bestaat)
    const f = abs(base, rel); if (!exists(f)) return {before: null, mode: null};
    const buf = fs.readFileSync(f), h = sha(buf), blob = path.join(backup, 'blobs', h);
    if (!exists(blob)) { fs.mkdirSync(path.dirname(blob), {recursive: true}); fs.writeFileSync(blob, buf, {mode: 0o600}); }
    return {before: h, mode: (fs.statSync(f).mode & 0o777).toString(8)};
  };
  const zet = (rel, buf, mode) => {
    tick();
    const f = abs(base, rel), voor = bewaar(rel); dir(path.dirname(f));
    fs.writeFileSync(f, buf, {mode}); fs.chmodSync(f, mode);
    entries.push({path: rel, before: voor.before, after: sha(buf), mode: voor.mode});
    undo.push(() => { if (voor.before) { fs.writeFileSync(f, fs.readFileSync(path.join(backup, 'blobs', voor.before)), {mode: parseInt(voor.mode, 8)}); } else fs.rmSync(f, {force: true}); });
  };
  const weg = rel => {
    tick();
    const f = abs(base, rel), voor = bewaar(rel); if (!voor.before) return;
    fs.rmSync(f, {force: true});
    entries.push({path: rel, before: voor.before, after: null, mode: voor.mode});
    undo.push(() => { dir(path.dirname(f)); fs.writeFileSync(f, fs.readFileSync(path.join(backup, 'blobs', voor.before)), {mode: parseInt(voor.mode, 8)}); });
  };
  try {
    fs.mkdirSync(path.join(backup, 'blobs'), {recursive: true, mode: 0o700});
    // 1. archief van de vorige versie (leesbare kopie)
    if (plan.actions.archief && managed) for (const p of Object.keys(managed.files)) { const buf = fs.readFileSync(abs(base, p)); zet(plan.actions.archief + '/' + p.replace(/^\.claude\//, ''), buf, 0o644); }
    // 2. nieuwe bestanden en vervangingen
    for (const [rel, f] of payload) if (hashOf(abs(base, rel)) !== f.sha) zet(rel, fs.readFileSync(f.abs), f.mode & 0o111 ? 0o755 : 0o644);
    // 3. verouderde beheerde bestanden
    for (const p of plan.actions.verwijderen) weg(p);
    // 4. gitignore-blok
    if (plan.actions.gitignore) { const f = abs(base, GITIGNORE), oud = exists(f) ? fs.readFileSync(f, 'utf8') : ''; zet(GITIGNORE, Buffer.from((oud && !oud.endsWith('\n') ? oud + '\n' : oud) + (oud ? '\n' : '') + IGNORE_BLOCK + '\n'), exists(f) ? fs.statSync(f).mode & 0o777 : 0o644); }
    // 5. beheermanifest
    const files = Object.fromEntries([...payload.values()].sort((a, b) => a.rel.localeCompare(b.rel)).map(f => [f.rel, f.sha]));
    zet(MANAGED, Buffer.from(JSON.stringify({version: VERSION, files}, null, 2) + '\n'), 0o644);
    // 6. opruimen van lege mappen van verwijderde bestanden
    for (const p of plan.actions.verwijderen) { let d = path.dirname(abs(base, p)); while (d.startsWith(base + path.sep) && d !== base && exists(d) && !fs.readdirSync(d).length) { fs.rmdirSync(d); d = path.dirname(d); } }
    // 7. controle: hashes en doctor (doctor schrijft niets en neemt geen route over)
    const slecht = [...payload.values()].filter(f => hashOf(abs(base, f.rel)) !== f.sha).map(f => f.rel);
    if (slecht.length) fail('Controle mislukt, afwijkende bestanden: ' + slecht.join(', '));
    const doc = spawnSync(process.execPath, [abs(base, '.claude/aae/runtime/cli.mjs'), 'doctor'], {cwd: base, encoding: 'utf8', timeout: 30000});
    if (doc.status !== 0) fail('doctor faalde: ' + (doc.stderr || doc.stdout || '').slice(0, 400));
    const dr = JSON.parse(doc.stdout), aandacht = dr.checks.filter(c => c.status !== 'PASS');
    if (aandacht.length) fail('doctor meldt aandachtspunten: ' + aandacht.map(c => c.name + ' (' + c.detail + ')').join('; '));
    fs.writeFileSync(path.join(backup, 'RESTORE.json'), JSON.stringify({schema: 1, status: 'applied', created: new Date().toISOString(), from: plan.from, to: VERSION, archive: plan.actions.archief, dirs_created: dirsCreated.sort((a, b) => b.length - a.length), files: entries}, null, 2) + '\n');
    return {id, backup: backupRel, plan, geschreven: entries.length};
  } catch (e) {
    for (const u of undo.reverse()) { try { u(); } catch { /* best effort; de back-up blijft staan */ } }
    for (const d of [...dirsCreated].sort((a, b) => b.length - a.length)) { try { rmEmptyTree(abs(base, d)); } catch { /* al weg */ } }
    fs.rmSync(backup, {recursive: true, force: true});
    throw e;
  }
}

/** Plan voor terugdraaien: alleen als niets sinds de installatie is gewijzigd. */
export function planRollback(project, backupRel) {
  const base = fs.realpathSync(project);
  if (!/^\.aae-backups\/[A-Za-z0-9._-]+$/.test(backupRel) || /^\.{1,2}$/.test(backupRel.split('/')[1])) fail('Ongeldig back-uppad: ' + backupRel);
  const rf = abs(base, backupRel + '/RESTORE.json');
  if (!exists(rf)) fail('RESTORE.json niet gevonden in ' + backupRel);
  const r = JSON.parse(fs.readFileSync(rf, 'utf8')), conflicts = [];
  if (r.schema !== 1 || r.status !== 'applied' || !Array.isArray(r.files)) fail('RESTORE.json is niet bruikbaar (niet "applied" of onbekend schema).');
  for (const e of r.files) {
    if (!SAFE_RESTORE(e.path)) { conflicts.push('Onveilig pad in RESTORE.json: ' + e.path); continue; }
    const nu = hashOf(abs(base, e.path));
    // .gitignore is gedeeld: eigen regels na de installatie zijn geen conflict; alleen het beheerde blok wordt verwijderd.
    const gedeeldeGitignore = e.path === GITIGNORE && nu !== null && BLOCK_RE.test(fs.readFileSync(abs(base, e.path), 'utf8'));
    if (nu !== e.after && !gedeeldeGitignore) conflicts.push('gewijzigd sinds de installatie: ' + e.path);
    if (e.before) { const blob = abs(base, backupRel + '/blobs/' + e.before); if (hashOf(blob) !== e.before) conflicts.push('back-upblob ontbreekt of is beschadigd voor ' + e.path); }
  }
  const werk = walk(base, 'docs/aae/work').filter(p => p.endsWith('/state.json'));
  const notes = werk.length ? ['Voortgang van werkpakketten na de installatie staat alleen in ' + werk.join(', ') + '; v3.2 kent die niet en gaat verder vanaf het moment van installeren.'] : [];
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
      const f = abs(base, e.path);
      if (e.path === GITIGNORE && hashOf(f) !== e.after) { // alleen het beheerde blok eruit; eigen regels blijven
        const rest = fs.readFileSync(f, 'utf8').replace(BLOCK_RE, '');
        if (!rest.trim() && !e.before) fs.rmSync(f, {force: true}); else fs.writeFileSync(f, rest);
        continue;
      }
      if (e.before) { fs.mkdirSync(path.dirname(f), {recursive: true}); fs.writeFileSync(f, fs.readFileSync(abs(base, backupRel + '/blobs/' + e.before)), {mode: parseInt(e.mode, 8)}); fs.chmodSync(f, parseInt(e.mode, 8)); }
      else fs.rmSync(f, {force: true});
    }
    for (const d of r.dirs_created || []) { if (d !== 'docs' && !SAFE_RESTORE(d + '/x')) continue; try { rmEmptyTree(abs(base, d)); } catch { /* niet leeg: laten staan */ } }
    for (const e of r.files) if (e.before && e.path !== GITIGNORE && hashOf(abs(base, e.path)) !== e.before) fail('Controle na terugdraaien mislukt voor ' + e.path);
    if (exists(abs(base, GITIGNORE)) && fs.readFileSync(abs(base, GITIGNORE), 'utf8').includes(MARK_START)) fail('Het beheerde .gitignore-blok staat er nog.');
    for (const e of r.files) if (!e.before && exists(abs(base, e.path))) fail('Bestand zou weg moeten zijn: ' + e.path);
    const rf = abs(base, backupRel + '/RESTORE.json'); fs.writeFileSync(rf, JSON.stringify({...r, status: 'rolled_back', rolled_back: new Date().toISOString()}, null, 2) + '\n');
    return {backup: backupRel, hersteld: r.files.length, plan};
  } catch (err) {
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
