/**
 * Agentrapporten in lagen en afstemming van agentregistraties.
 * Laag 0: ruwe tekst in .claude/aae/state/raw/<id>/ (niet in git, volledig, met checksum).
 * Laag 1: duurzame samenvatting (max 4 KB) in docs/aae/work/<id>/runs/ (in git).
 * Bronnen (P3, live bewezen): tool_response.content (primair), transcriptbestand van de agent (controle), last_assistant_message (staart/controle).
 * Een run is pas COMPLETED als twee bronnen overeenkomen en de opslag terugleesbaar is.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {STATE_DIR, WORK, requireThat, safePath, atomicText, sha, digest, now, clock} from './core.mjs';
import {log} from './state.mjs';

export const MAX_RAW = 2 * 1024 * 1024;
export const DIGEST_MAX = 4096;
export const KEEP_RAW_FILE = 64 * 1024;
export const KEEP_RAW_TOTAL = 512 * 1024;
export const LIVE = ['reserved', 'running', 'unknown', 'unverified'];
export const liveRows = st => Object.values(st.agents).filter(r => LIVE.includes(r.status));
export const normalizeText = t => String(t ?? '').replace(/\r\n/g, '\n').trimEnd();

/** tool_response.content van een Agent-aanroep naar platte tekst (null als het veld ontbreekt). */
export function contentText(response) {
  const c = response?.content;
  if (typeof c === 'string') return c;
  if (Array.isArray(c)) return c.map(x => typeof x === 'string' ? x : (x && typeof x.text === 'string' ? x.text : '')).join('\n');
  return null;
}

// ---- transcript ----
export function transcriptRoots(opts = {}) {
  if (opts.transcriptRoots) return opts.transcriptRoots;
  return [process.env.CLAUDE_CONFIG_DIR, path.join(os.homedir(), '.claude')].filter(Boolean).map(b => path.join(b, 'projects'));
}
export function findTranscript(agentId, opts = {}) {
  if (!agentId || !/^[A-Za-z0-9_-]{4,80}$/.test(agentId)) return null;
  const hits = [];
  const walk = (dir, depth) => {
    if (depth > 6) return;
    let items; try { items = fs.readdirSync(dir, {withFileTypes: true}); } catch { return; }
    for (const d of items) {
      const p = path.join(dir, d.name);
      if (d.isDirectory()) walk(p, depth + 1);
      else if (d.name === 'agent-' + agentId + '.jsonl' || d.name === 'subagent-' + agentId + '.jsonl') hits.push(p);
    }
  };
  for (const r of transcriptRoots(opts)) walk(r, 0);
  return hits[0] || null;
}
export function sampleTranscript(file) {
  try { const st = fs.statSync(file); return {path: file, size: st.size, mtimeMs: st.mtimeMs}; } catch { return null; }
}
/** Laatste assistent-tekst uit een transcript (JSONL). */
export function transcriptFinalText(file) {
  let raw; try { raw = fs.readFileSync(file, 'utf8'); } catch { return null; }
  let laatste = null;
  for (const line of raw.split('\n')) {
    if (!line.trim()) continue;
    let o; try { o = JSON.parse(line); } catch { continue; }
    const m = o.message || o;
    if (!(m.role === 'assistant' || o.type === 'assistant')) continue;
    const c = m.content;
    const t = typeof c === 'string' ? c : Array.isArray(c) ? c.filter(b => b && b.type === 'text' && typeof b.text === 'string').map(b => b.text).join('\n') : '';
    if (t.trim()) laatste = t;
  }
  return laatste;
}

// ---- samenvatting (laag 1) ----
export function extractDigest(full) {
  const lines = full.split('\n');
  let start = -1, end = -1;
  lines.forEach((l, i) => { if (l.trim() === 'SAMENVATTING') start = i; if (l.trim() === 'EINDE-SAMENVATTING') end = i; });
  if (start >= 0 && end > start) {
    const blok = lines.slice(start, end + 1).join('\n');
    if (blok.length <= 3000) return {tekst: blok, onvolledig: false};
  }
  const kop = full.slice(0, 1500), staart = full.length > 3000 ? full.slice(-1500) : full.slice(1500);
  return {tekst: kop + (staart ? '\n[... ingekort; volledig rapport staat in de ruwe laag ...]\n' + staart : ''), onvolledig: true};
}
export function parseVerdict(full, blok) {
  const v = /^VERDICT:\s*(READY|PARTIAL|BLOCKED)/m.exec(blok || '');
  if (v) return v[1];
  const all = [...full.matchAll(/STATUS:\s*(READY|PARTIAL|BLOCKED)/g)];
  return all.length ? all.at(-1)[1] : 'UNKNOWN';
}
const slug = s => String(s || 'x').replace(/[^A-Za-z0-9_-]/g, '-').slice(0, 40);
const rawDir = id => STATE_DIR + '/raw/' + id;

/** Schrijft een bronttekst naar laag 0 en leest hem terug. */
function storeSource(root, id, runKey, name, tekst) {
  const rel = rawDir(id) + '/' + runKey + '.' + name + '.src.txt';
  atomicText(root, rel, tekst);
  const terug = fs.readFileSync(safePath(root, rel, {allowMissing: false}), 'utf8');
  requireThat(sha(terug) === sha(tekst), 'Terugleescontrole mislukt voor ' + rel);
  return rel;
}
function loadStored(root, id, runKey) {
  const dir = path.join(fs.realpathSync(root), rawDir(id)), uit = {};
  if (!fs.existsSync(dir)) return uit;
  for (const f of fs.readdirSync(dir)) {
    const m = new RegExp('^' + runKey.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\.([a-z_]+)\\.src\\.txt$').exec(f);
    if (m) uit[m[1]] = fs.readFileSync(path.join(dir, f), 'utf8');
  }
  return uit;
}
const agree = (a, b) => a === b || ((a.length >= 64 && b.length >= 64) && (a.endsWith(b) || b.endsWith(a)));

/**
 * Bepaalt, bewaart en verifieert het volledige rapport van een run. Idempotent: bij een later binnenkomende bron
 * (bijvoorbeeld het transcript) wordt opnieuw beoordeeld met alles wat al bewaard is.
 */
export function finalizeRun(root, st, row, bronnen, opts = {}) {
  const id = st.id, runKey = row.run_key;
  const huidig = {...loadStored(root, id, runKey)};
  for (const [naam, t] of Object.entries(bronnen)) { const n = normalizeText(t); if (n) huidig[naam] = n; }
  const namen = Object.keys(huidig);
  if (!namen.length) { row.report = {status: 'REPORT_LOST', verified: false, sources: [], at: now()}; log(st, 'report_lost', {run: runKey}); return row.report; }
  for (const n of namen) storeSource(root, id, runKey, n, huidig[n]);
  const langste = namen.reduce((x, y) => huidig[y].length > huidig[x].length ? y : x);
  const volledig = huidig[langste];
  const akkoord = namen.filter(n => agree(huidig[n], volledig));
  const conflict = namen.filter(n => !agree(huidig[n], volledig));
  let status = 'REPORT_UNVERIFIED';
  if (conflict.length) status = 'REPORT_CONFLICT';
  else if (akkoord.length >= 2) status = 'COMPLETED';
  const afgekapt = Buffer.byteLength(volledig) > MAX_RAW;
  const opgeslagen = afgekapt ? volledig.slice(0, MAX_RAW / 2) + '\n[... ingekort in de ruwe laag ...]\n' + volledig.slice(-MAX_RAW / 2) : volledig;
  const meta = ['run: ' + runKey, 'rol: ' + row.role, 'focus: ' + (row.focus || '-'), 'agent_id: ' + (row.agent_id || '-'), 'bronnen: ' + akkoord.join('+'), 'status: ' + status, 'sha256: ' + sha(volledig), 'bytes: ' + Buffer.byteLength(volledig)].join('\n');
  const rawRel = rawDir(id) + '/' + runKey + '.md';
  atomicText(root, rawRel, meta + '\n---\n' + opgeslagen + '\n');
  const terug = fs.readFileSync(safePath(root, rawRel, {allowMissing: false}), 'utf8');
  requireThat(terug.endsWith(opgeslagen + '\n'), 'Terugleescontrole van het rapport mislukt.');
  const {tekst: blok, onvolledig} = extractDigest(volledig);
  const verdict = parseVerdict(volledig, blok);
  const nr = String(row.seq || 0).padStart(3, '0');
  const digestRel = WORK + '/' + id + '/runs/' + nr + '-' + slug(row.role) + '-' + slug(row.focus) + '.md';
  let dm = ['# Agentrun ' + runKey, '', '- rol: ' + row.role, '- focus: ' + (row.focus || '-'), '- vraag: ' + String(row.why || '').slice(0, 200), '- start: ' + (row.reserved_at || '-'), '- einde: ' + (row.finished || now()),
    '- status: ' + status, '- verdict: ' + verdict, '- bronnen: ' + akkoord.join(', ') + (conflict.length ? ' (afwijkend: ' + conflict.join(', ') + ')' : ''), '- sha256 ruwe tekst: ' + sha(volledig), '- bytes ruwe tekst: ' + Buffer.byteLength(volledig), onvolledig ? '- samenvatting: onvolledig (kop en staart)' : '- samenvatting: uit SAMENVATTING-blok', '', blok, ''].join('\n');
  while (Buffer.byteLength(dm) > DIGEST_MAX) dm = dm.slice(0, dm.length - 200) + '\n[ingekort]\n';
  atomicText(root, digestRel, dm);
  const keep = opts.keepRaw || row.keep_raw;
  let keepPad = null;
  if (keep) {
    const dir = path.join(fs.realpathSync(root), WORK, id, 'raw');
    const eigen = runKey + '.md';
    const bestaand = fs.existsSync(dir) ? fs.readdirSync(dir).filter(f => f !== eigen).reduce((n, f) => n + fs.statSync(path.join(dir, f)).size, 0) : 0;
    const kort = Buffer.byteLength(volledig) > KEEP_RAW_FILE ? volledig.slice(0, KEEP_RAW_FILE / 2) + '\n[... ingekort; sha256 van het geheel: ' + sha(volledig) + ' ...]\n' + volledig.slice(-KEEP_RAW_FILE / 2) : volledig;
    if (bestaand + Buffer.byteLength(kort) <= KEEP_RAW_TOTAL) { keepPad = WORK + '/' + id + '/raw/' + runKey + '.md'; atomicText(root, keepPad, kort + '\n'); }
    else row.keep_raw_overgeslagen = true;
  }
  row.report = {status, verified: status === 'COMPLETED', sources: akkoord, afwijkend: conflict, raw_path: rawRel, raw_sha256: sha(volledig), raw_bytes: Buffer.byteLength(volledig), raw_afgekapt: afgekapt, digest_path: digestRel, digest_onvolledig: onvolledig, keep_raw_path: keepPad, verdict, at: now()};
  row.reported_status = verdict;
  log(st, 'report', {run: runKey, status, verdict, bronnen: akkoord.length});
  return row.report;
}
export const runCompleted = row => row.status === 'stopped' && row.report?.status === 'COMPLETED';

/**
 * Stemt de agentregistraties af met wat aantoonbaar is. Tijd is alleen aanleiding; een agent geldt pas als dood bij
 * stilte van hookgebeurtenissen, een stilstaand transcript over twee metingen en een bevestiging dat de host hem niet meer kent
 * (of een harde bovengrens). Late resultaten worden altijd nog verwerkt.
 */
export function reconcile(root, st, opts = {}) {
  const nowMs = opts.nowMs ?? clock.ms(), quietMs = opts.quietMs ?? 15 * 60000, gapMs = opts.recheckGapMs ?? 60000, ceilingMs = opts.ceilingMs ?? 60 * 60000;
  const wijzigingen = [];
  // Herstel zonder gebruikersactie: een verloren rapport wordt opnieuw uit het transcript van de agent opgebouwd zodra opslag weer lukt.
  for (const row of Object.values(st.agents)) {
    if (!['stopped', 'presumed_dead'].includes(row.status) || row.report?.status !== 'REPORT_LOST') continue;
    const pad = row.transcript_path || findTranscript(row.agent_id, opts);
    const tekst = pad ? transcriptFinalText(pad) : null;
    if (!tekst) continue;
    try { finalizeRun(root, st, row, {transcript: tekst}, opts); wijzigingen.push({run: row.run_key, naar: 'report_hersteld'}); } catch { /* volgende afstemming probeert opnieuw */ }
  }
  for (const row of liveRows(st)) {
    const sinds = nowMs - Date.parse(row.last_seen || row.reserved_at);
    row.checks ??= [];
    if (row.host_observed?.state === 'alive' && nowMs - row.host_observed.at < quietMs) { row.last_seen = new Date(nowMs).toISOString(); continue; }
    if (sinds < quietMs) continue;
    const pad = row.transcript_path || findTranscript(row.agent_id, opts);
    const s = pad ? sampleTranscript(pad) : null;
    if (s) row.transcript_path = pad;
    const vorige = row.checks.at(-1);
    if (!vorige || nowMs - vorige.at >= gapMs) row.checks.push({at: nowMs, size: s?.size ?? null, mtimeMs: s?.mtimeMs ?? null});
    const [a, b] = row.checks.slice(-2);
    // Zonder vindbaar transcript valt er niets te meten: dat is nooit "stilstaand".
    const stilstaand = Boolean(a && b && a.size !== null && b.size !== null && b.at - a.at >= gapMs && a.size === b.size && a.mtimeMs === b.mtimeMs);
    const hostWeg = row.host_observed?.state === 'absent' || Boolean(row.interrupted_hint);
    if (stilstaand && (hostWeg || sinds >= ceilingMs)) {
      row.status = 'presumed_dead'; row.finished = new Date(nowMs).toISOString();
      const tekst = pad ? transcriptFinalText(pad) : null;
      finalizeRun(root, st, row, tekst ? {transcript: tekst} : {}, opts);
      log(st, 'agent_presumed_dead', {run: row.run_key, gerepareerd: Boolean(tekst)});
      wijzigingen.push({run: row.run_key, naar: 'presumed_dead'});
    } else if (row.status !== 'unverified') { row.status = 'unverified'; log(st, 'agent_unverified', {run: row.run_key}); wijzigingen.push({run: row.run_key, naar: 'unverified'}); }
  }
  return wijzigingen;
}
/** Duplicaatbeveiliging: dezelfde rol met dezelfde vraag start niet opnieuw zolang de eerste niet aantoonbaar voorbij is. */
export const duplicateOf = (st, hash) => Object.values(st.agents).find(r => r.question_hash === hash && LIVE.includes(r.status));
export const questionHash = (role, focus, vraag) => digest({role, focus: focus || null, vraag: String(vraag).trim()});
