/** AAE 3.3 - smalle classificatie van externe tools. De SQL-klassen DB-A/B/C staan in sql.mjs (default-deny). Geen geheimen, geen generieke MCP-vrijgave. */
import crypto from 'node:crypto';
import {SUPABASE_TOOLS_ALL, GITHUB_WRITE_TOOLS} from './core.mjs';
import {classifyDb, classifySql} from './sql.mjs';

export {classifyDb, classifySql};
export const SUPABASE_READ_TOOLS = Object.freeze(['get_project_url', 'list_tables', 'list_extensions', 'list_migrations', 'query_logs', 'get_advisors', 'generate_typescript_types', 'search_docs']);
export const SUPABASE_SQL_TOOL = 'execute_sql';
export const SUPABASE_CHANGE_TOOLS = Object.freeze(['apply_migration']);

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
export function sqlText(input = {}) { for (const k of ['query', 'sql', 'statement']) if (typeof input[k] === 'string') return input[k]; return ''; }
export function migrationSql(input = {}) { return typeof input.query === 'string' ? input.query : typeof input.sql === 'string' ? input.sql : ''; }
export function migrationName(input = {}) { return String(input.name || input.migration_name || '').trim(); }

export function classifyExternalCall(toolName, input = {}) {
  const id = identifyExternalTool(toolName); if (!id) return null;
  if (id.provider === 'supabase') {
    if (SUPABASE_READ_TOOLS.includes(id.action)) return {...id, level: 'read'};
    if (id.action === SUPABASE_SQL_TOOL) return {...id, ...classifySql(sqlText(input))};
    if (id.action === 'apply_migration') { const c = classifyDb(migrationSql(input)); return {...id, level: 'change', db: c.klasse, redenen: c.redenen}; }
  }
  if (id.provider === 'github') {
    if (/^(get|list|search|pull_request_read)/.test(id.action)) return {...id, level: 'read'};
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
  const t = collectText(response);
  const m = t.match(/"number"\s*:\s*(\d{1,9})\b/) || (/"number"/.test(t) ? null : t.match(/\/pull\/(\d{1,9})\b/)); // een gestructureerd veld gaat voor; een pull-URL alleen als er geen "number" is
  return m ? Number(m[1]) : null;
}
/** De head-sha van een pull request uit een toolrespons (create_pull_request of pull_request_read get): alleen een volledige 40-/64-hex sha telt. */
export function prHeadShaFromResponse(response) {
  const kies = v => typeof v === 'string' && /^[0-9a-f]{40}([0-9a-f]{24})?$/i.test(v) ? v.toLowerCase() : null;
  const direct = kies(response?.head?.sha) || kies(response?.head_sha) || kies(response?.headSha) || kies(response?.pull_request?.head?.sha);
  if (direct) return direct;
  const t = collectText(response);
  const m = /"head"\s*:\s*\{[^}]*?"sha"\s*:\s*"([0-9a-f]{40}(?:[0-9a-f]{24})?)"/i.exec(t) || /head\s+sha\s*[:=]\s*"?([0-9a-f]{40}(?:[0-9a-f]{24})?)\b/i.exec(t);
  return m ? m[1].toLowerCase() : null;
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
  if (call.provider === 'github') for (const k of ['base', 'head', 'title', 'owner', 'repo', 'expectedHeadSha']) if (typeof input[k] === 'string') out[k] = input[k].slice(0, 240);
  return out;
}
