/** AAE 3.3 - smalle classificatie van externe tools en database-klassen DB-A/B/C. Geen geheimen, geen generieke MCP-vrijgave. */
import crypto from 'node:crypto';
import {SUPABASE_TOOLS_ALL, GITHUB_WRITE_TOOLS} from './core.mjs';

export const SUPABASE_READ_TOOLS = Object.freeze(['get_project_url', 'list_tables', 'list_extensions', 'list_migrations', 'query_logs', 'get_advisors', 'generate_typescript_types', 'search_docs']);
export const SUPABASE_SQL_TOOL = 'execute_sql';
export const SUPABASE_CHANGE_TOOLS = Object.freeze(['apply_migration']);
const readStart = new Set(['SELECT', 'SHOW', 'EXPLAIN', 'VALUES', 'WITH']);
const forbiddenReadTokens = new Set(['INSERT', 'UPDATE', 'DELETE', 'MERGE', 'CREATE', 'ALTER', 'DROP', 'TRUNCATE', 'GRANT', 'REVOKE', 'VACUUM', 'CALL', 'DO', 'COPY', 'COMMENT', 'REFRESH', 'REINDEX', 'CLUSTER', 'ANALYZE', 'LOCK', 'SET', 'RESET']);
const readOnlyPhrases = [/ALTER\s+TABLE[\s\S]*\bDROP\b/i, /DISABLE\s+ROW\s+LEVEL\s+SECURITY/i, /SECURITY\s+DEFINER/i, /pg_terminate_backend\s*\(/i, /pg_cancel_backend\s*\(/i, /set_config\s*\(/i, /nextval\s*\(/i, /setval\s*\(/i];

function suffixMatch(name, provider, action) {
  const n = String(name || '').toLowerCase();
  if (!n.includes(provider)) return false;
  const a = action.toLowerCase();
  return n === a || n.endsWith('__' + a) || n.endsWith(':' + a) || n.endsWith('/' + a) || n.endsWith('.' + a) || n.endsWith('_' + a);
}
/** Alleen toolnamen die aantoonbaar bij Supabase of GitHub horen worden herkend; de rest blijft onbekend (geblokkeerd). */
export function identifyExternalTool(name) {
  for (const action of SUPABASE_TOOLS_ALL) if (suffixMatch(name, 'supabase', action)) return {provider: 'supabase', action};
  const n = String(name || '');
  if (/^mcp__github__/i.test(n)) return {provider: 'github', action: n.replace(/^mcp__github__/i, '').toLowerCase()};
  return null;
}
/**
 * Eén doorlopende scan op volgorde van voorkomen (commentaar, geneste blokcommentaar, $tag$-blokken, E'..', '..', "..").
 * Zo kan een string het begin van commentaar niet nabootsen of andersom. ok=false: iets is niet afgesloten, dus niet betrouwbaar te lezen.
 */
export function scanSql(sql) {
  const s = String(sql || ''), n = s.length; let uit = '', i = 0, ok = true;
  const ident = ch => /[A-Za-z0-9_$]/.test(ch || '');
  const tekst = (sluit, esc) => { // i staat net na het openingsteken
    while (i < n) {
      if (esc && s[i] === '\\') { i += 2; continue; }
      if (s[i] === sluit) { if (s[i + 1] === sluit) { i += 2; continue; } i++; return true; }
      i++;
    }
    return false;
  };
  while (i < n) {
    const c = s[i], d = s[i + 1], vorige = uit.slice(-1);
    if (c === '-' && d === '-') { while (i < n && s[i] !== '\n' && s[i] !== '\r') i++; uit += ' '; continue; }
    if (c === '/' && d === '*') {
      let diepte = 1; i += 2;
      while (i < n && diepte) { if (s[i] === '/' && s[i + 1] === '*') { diepte++; i += 2; } else if (s[i] === '*' && s[i + 1] === '/') { diepte--; i += 2; } else i++; }
      if (diepte) ok = false; uit += ' '; continue;
    }
    if (c === '$' && !ident(vorige)) {
      const m = /^\$(?:[A-Za-z_][A-Za-z0-9_]*)?\$/.exec(s.slice(i, i + 80));
      if (m) { const eind = s.indexOf(m[0], i + m[0].length); if (eind < 0) { ok = false; i = n; } else i = eind + m[0].length; uit += ' '; continue; }
    }
    if ((c === 'E' || c === 'e') && d === "'" && !ident(vorige)) { i += 2; if (!tekst("'", true)) ok = false; uit += ' '; continue; }
    if (c === "'") { i++; if (!tekst("'", false)) ok = false; uit += ' '; continue; }
    if (c === '"') { i++; if (!tekst('"', false)) ok = false; uit += ' '; continue; }
    uit += c; i++;
  }
  return {text: uit, ok};
}
export const stripSql = sql => scanSql(sql).text;
/** Niet-afgesloten tekst, commentaar of $-blok: de SQL is niet betrouwbaar te lezen en wordt als destructief (migratie) of muterend (execute_sql) behandeld. */
export const unparsable = sql => !scanSql(sql).ok;
const statements = sql => stripSql(sql).split(';').map(x => x.trim()).filter(Boolean);
export function sqlText(input = {}) { for (const k of ['query', 'sql', 'statement']) if (typeof input[k] === 'string') return input[k]; return ''; }
export function migrationSql(input = {}) { return typeof input.query === 'string' ? input.query : typeof input.sql === 'string' ? input.sql : ''; }
export function migrationName(input = {}) { return String(input.name || input.migration_name || '').trim(); }

/** Alleen-lezen-herkenning voor execute_sql (conservatief); muterende SQL gaat via een benoemde apply_migration. */
export function classifySql(sql) {
  const raw = String(sql || '');
  if (!raw.trim()) return {level: 'blocked', reason: 'SQL ontbreekt.'};
  if (unparsable(raw)) return {level: 'change', reason: 'SQL is niet betrouwbaar te lezen (niet-afgesloten tekst of commentaar).'};
  const st = statements(raw);
  if (st.length !== 1) return {level: 'sensitive', reason: 'Meerdere SQL-statements in een execute_sql-call zijn niet toegestaan.'};
  const tokens = (st[0].match(/[A-Za-z_][A-Za-z0-9_$]*/g) || []).map(x => x.toUpperCase());
  if (readStart.has(tokens[0] || '') && !tokens.some(t => forbiddenReadTokens.has(t)) && !readOnlyPhrases.some(r => r.test(st[0])) && !/\bauth\s*\./i.test(st[0]) && !/\bvault\s*\.\s*decrypted_secrets\b/i.test(st[0]) && !/\bvault\s*\.\s*secrets\b[\s\S]*\bsecret\b/i.test(st[0])) return {level: 'read', reason: 'Conservatief als read-only SQL herkend.'};
  return {level: 'change', reason: 'Muterende SQL hoort via apply_migration.'};
}

/**
 * Database-klassen op basis van de echte SQL:
 *  A laag risico/backward compatible (nieuwe tabel, kolom, index, additief beleid);
 *  B middel (backfill met WHERE, constraint, bestaand beleid, security definer, grants, cron);
 *  C hoog/destructief (DROP, TRUNCATE, DELETE, UPDATE zonder WHERE, RLS uit, auth/vault, typewijziging).
 * Onbekende statements tellen als B, nooit stil als A.
 */
export function classifyDb(sql) {
  const lijst = statements(sql);
  if (!lijst.length) return {klasse: 'C', redenen: ['Lege of onleesbare migratie.']};
  if (unparsable(sql)) return {klasse: 'C', redenen: ['C: de SQL is niet betrouwbaar te lezen (niet-afgesloten tekst of blok); behandeld als destructief.']};
  const rang = {A: 1, B: 2, C: 3};
  let hoogste = 'A'; const redenen = [];
  const zet = (k, r) => { if (rang[k] > rang[hoogste]) hoogste = k; redenen.push(k + ': ' + r); };
  for (const s of lijst) {
    const U = s.replace(/\s+/g, ' ').toUpperCase();
    // Statements die willekeurige code uitvoeren, tellen als destructief: hun inhoud is niet vooraf te classificeren.
    if (/^(DO|CALL)\b/.test(U) || /\bEXECUTE\b(?!\s+(FUNCTION|PROCEDURE)\b)/.test(U) || /\bCOPY\b.*\bPROGRAM\b/.test(U) || /^ALTER SYSTEM\b/.test(U)) { zet('C', 'voert willekeurige code uit (DO/CALL/EXECUTE/COPY PROGRAM/ALTER SYSTEM)'); continue; }
    if (/^(WITH|MERGE)\b/.test(U) && /\b(DELETE|UPDATE|MERGE|TRUNCATE)\b/.test(U)) { zet('C', 'WITH/MERGE met DELETE/UPDATE/MERGE'); continue; }
    if (/\bDROP\b/.test(U)) { zet('C', 'DROP'); continue; }
    if (/\bTRUNCATE\b/.test(U)) { zet('C', 'TRUNCATE'); continue; }
    if (/^DELETE\b/.test(U)) { zet('C', 'DELETE'); continue; }
    if (/DISABLE ROW LEVEL SECURITY/.test(U)) { zet('C', 'RLS uitzetten'); continue; }
    if (/\b(AUTH|VAULT)\s*\./.test(U)) { zet('C', 'auth/vault direct'); continue; }
    if (/ALTER COLUMN .* (SET DATA )?TYPE\b/.test(U)) { zet('C', 'onomkeerbare typewijziging'); continue; }
    if (/^UPDATE\b/.test(U)) { /\bWHERE\b/.test(U) ? zet('B', 'backfill/UPDATE met WHERE') : zet('C', 'UPDATE zonder WHERE'); continue; }
    if (/\bCRON\.(SCHEDULE|UNSCHEDULE|ALTER_JOB)\b/.test(U)) { zet('B', 'cron-job'); continue; }
    if (/\bCRON\s*\./.test(U)) { zet('C', 'cron direct'); continue; }
    if (/SECURITY DEFINER/.test(U)) { zet('B', 'SECURITY DEFINER'); continue; }
    if (/^(GRANT|REVOKE)\b/.test(U)) { zet('B', 'GRANT/REVOKE'); continue; }
    if (/^(ALTER|CREATE) POLICY\b/.test(U)) { zet('B', 'beleid (toegangsgrens) maken of wijzigen'); continue; }
    if (/ADD (CONSTRAINT|CHECK|UNIQUE|PRIMARY KEY|FOREIGN KEY)\b/.test(U) || /SET NOT NULL/.test(U)) { zet('B', 'constraint aanscherpen'); continue; }
    if (/ADD COLUMN\b/.test(U) && /NOT NULL/.test(U) && !/DEFAULT/.test(U)) { zet('B', 'NOT NULL-kolom zonder default'); continue; }
    if (/\bRENAME\b/.test(U) || /^CREATE (OR REPLACE )?TRIGGER\b/.test(U) || /^ALTER (TRIGGER|FUNCTION)\b/.test(U) || /^CREATE EXTENSION\b/.test(U)) { zet('B', 'hernoemen/trigger/functie/extensie'); continue; }
    if (/^CREATE (OR REPLACE )?(UNIQUE )?(INDEX|VIEW|TABLE|TYPE|SEQUENCE|POLICY|FUNCTION|SCHEMA)\b/.test(U) || /^CREATE (TEMP |TEMPORARY )?TABLE\b/.test(U) || /ADD COLUMN\b/.test(U) || /ENABLE ROW LEVEL SECURITY/.test(U) || /^COMMENT ON\b/.test(U) || /^INSERT INTO\b/.test(U)) { zet('A', 'additief'); continue; }
    zet('B', 'onbekend statement: ' + U.slice(0, 40));
  }
  return {klasse: hoogste, redenen};
}

export function classifyExternalCall(toolName, input = {}) {
  const id = identifyExternalTool(toolName); if (!id) return null;
  if (id.provider === 'supabase') {
    if (SUPABASE_READ_TOOLS.includes(id.action)) return {...id, level: 'read'};
    if (id.action === SUPABASE_SQL_TOOL) return {...id, ...classifySql(sqlText(input))};
    if (id.action === 'apply_migration') { const c = classifyDb(migrationSql(input)); return {...id, level: 'change', db: c.klasse, redenen: c.redenen}; }
  }
  if (id.provider === 'github') {
    if (/^(get|list|search)_/.test(id.action)) return {...id, level: 'read'};
    if (GITHUB_WRITE_TOOLS.includes(id.action)) return {...id, level: id.action === 'merge_pull_request' ? 'merge' : 'change'};
    return {...id, level: 'blocked'};
  }
  return {...id, level: 'blocked'};
}
export function projectRefFromInput(input = {}) { for (const k of ['project_ref', 'projectRef', 'project_id', 'projectId']) if (typeof input[k] === 'string' && input[k].trim()) return input[k].trim(); return null; }
function collectText(v, depth = 0) {
  if (depth > 5 || v === null || v === undefined) return '';
  if (typeof v === 'string') return v.slice(0, 20000);
  if (Array.isArray(v)) return v.slice(0, 30).map(x => collectText(x, depth + 1)).join('\n');
  if (typeof v === 'object') return Object.entries(v).slice(0, 80).map(([k, x]) => k + ' ' + collectText(x, depth + 1)).join('\n');
  return String(v);
}
export function projectRefFromResponse(response) { const m = collectText(response).match(/https:\/\/([a-z0-9-]{5,})\.supabase\.co\b/i); return m ? m[1] : null; }
/** Het nummer van een zojuist gemaakte pull request uit de toolrespons (null als het niet te vinden is: dan kan er niets worden samengevoegd). */
export function prNumberFromResponse(response) {
  if (Number.isInteger(response?.number) && response.number > 0) return response.number;
  const m = collectText(response).match(/(?:"number"\s*:\s*|\/pull\/)(\d{1,9})\b/); // alleen een gestructureerd veld of een pull-URL, geen vrije tekst
  return m ? Number(m[1]) : null;
}
export const responseDigest = response => crypto.createHash('sha256').update(collectText(response)).digest('hex');
export const inputDigest = input => crypto.createHash('sha256').update(JSON.stringify(input || {})).digest('hex');
export function safeExternalSummary(call, input = {}) {
  const out = {provider: call.provider, action: call.action, level: call.level, input_digest: inputDigest(input)};
  if (call.provider === 'supabase') {
    const ref = projectRefFromInput(input); if (ref) out.project_ref = ref;
    if (call.action === 'apply_migration') { const n = migrationName(input); if (n) out.migration_name = n; out.sql_digest = crypto.createHash('sha256').update(migrationSql(input)).digest('hex'); if (call.db) out.db_klasse = call.db; }
    if (call.action === 'execute_sql') out.sql_digest = crypto.createHash('sha256').update(sqlText(input)).digest('hex');
  }
  if (call.provider === 'github') for (const k of ['base', 'head', 'title']) if (typeof input[k] === 'string') out[k] = input[k].slice(0, 240);
  return out;
}
