/** AAE 3.3 - smalle classificatie van externe tools en database-klassen DB-A/B/C. Geen geheimen, geen generieke MCP-vrijgave. */
import crypto from 'node:crypto';
import {SUPABASE_TOOLS_ALL, GITHUB_WRITE_TOOLS} from './core.mjs';

export const SUPABASE_READ_TOOLS = Object.freeze(['get_project_url', 'list_tables', 'list_extensions', 'list_migrations', 'query_logs', 'get_advisors', 'generate_typescript_types', 'search_docs']);
export const SUPABASE_SQL_TOOL = 'execute_sql';
export const SUPABASE_CHANGE_TOOLS = Object.freeze(['apply_migration']);
const readStart = new Set(['SELECT', 'SHOW', 'EXPLAIN', 'VALUES', 'WITH']);
const forbiddenReadTokens = new Set(['INSERT', 'UPDATE', 'DELETE', 'MERGE', 'CREATE', 'ALTER', 'DROP', 'TRUNCATE', 'GRANT', 'REVOKE', 'VACUUM', 'CALL', 'DO', 'COPY', 'COMMENT', 'REFRESH', 'REINDEX', 'CLUSTER', 'ANALYZE', 'LOCK', 'SET', 'RESET', 'INTO']);
// Functies met bijwerkingen buiten gewone tabelgegevens (bestanden, andere databases, sessies, configuratie, volgnummers): nooit "alleen lezen" en in een migratie destructief.
const EXTERNAL_NAMES = 'DBLINK\\w*|LO_\\w+|PG_READ_\\w+|PG_LS_\\w+|PG_STAT_FILE|PG_RELOAD_CONF|PG_TERMINATE_BACKEND|PG_CANCEL_BACKEND|PG_SWITCH_WAL|PG_CREATE_\\w+|PG_DROP_\\w+';
const EXTERNAL_FN = new RegExp('\\b(' + EXTERNAL_NAMES + ')\\s*\\(', 'i'); // bijwerkingen buiten gewone tabelgegevens
const SIDE_EFFECT_FN = new RegExp('\\b(' + EXTERNAL_NAMES + '|PG_ADVISORY\\w*|PG_SLEEP\\w*|PG_NOTIFY|SET_CONFIG|NEXTVAL|SETVAL|LASTVAL)\\s*\\(', 'i'); // ook sessie/volgnummer-effecten: nooit "alleen lezen"
const readOnlyPhrases = [SIDE_EFFECT_FN, /ALTER\s+TABLE[\s\S]*\bDROP\b/i, /DISABLE\s+ROW\s+LEVEL\s+SECURITY/i, /SECURITY\s+DEFINER/i, /pg_terminate_backend\s*\(/i, /pg_cancel_backend\s*\(/i, /set_config\s*\(/i, /nextval\s*\(/i, /setval\s*\(/i];
// Uitgaand netwerkverkeer of een extern schema vanuit de database (pg_net, http-extensie, supabase_functions): nooit alleen-lezen, in een migratie DB-C.
const NETWORK_FN = /\b(NET|PG_NET|SUPABASE_FUNCTIONS)\s*\.\s*[A-Za-z_]|\bHTTP(?:_\w+)?\s*\(/i;

/**
 * Positieve lijst van zuivere functies voor alleen-lezen SQL. Een functie buiten deze lijst (cron.*, net.http_*, pg_temp.*, gebruikersfuncties
 * zoals public.f()) maakt execute_sql altijd tot een wijziging; wat niet bekend is, is nooit "alleen lezen".
 */
export const READ_FUNCTIONS = Object.freeze(new Set([
  'count', 'sum', 'avg', 'min', 'max', 'bool_and', 'bool_or', 'every', 'array_agg', 'string_agg', 'json_agg', 'jsonb_agg', 'json_build_object', 'jsonb_build_object', 'json_build_array', 'jsonb_build_array',
  'coalesce', 'nullif', 'greatest', 'least', 'now', 'current_date', 'current_time', 'current_timestamp', 'localtime', 'localtimestamp', 'age', 'date_trunc', 'date_part', 'extract', 'to_char', 'to_date', 'to_timestamp', 'make_date', 'make_timestamp',
  'lower', 'upper', 'initcap', 'length', 'char_length', 'octet_length', 'trim', 'ltrim', 'rtrim', 'btrim', 'substring', 'substr', 'position', 'overlay', 'replace', 'concat', 'concat_ws', 'left', 'right', 'split_part', 'regexp_replace', 'regexp_match', 'regexp_matches', 'format', 'lpad', 'rpad', 'repeat', 'reverse', 'md5', 'encode', 'decode',
  'abs', 'round', 'ceil', 'ceiling', 'floor', 'mod', 'power', 'sqrt', 'sign', 'trunc', 'random_page_cost',
  'cast', 'to_json', 'to_jsonb', 'jsonb_typeof', 'json_typeof', 'jsonb_extract_path', 'jsonb_extract_path_text', 'jsonb_array_elements', 'jsonb_array_elements_text', 'jsonb_each', 'jsonb_each_text', 'jsonb_object_keys', 'jsonb_array_length', 'array_length', 'cardinality', 'array_to_string', 'unnest', 'generate_series', 'array_position',
  'row_number', 'rank', 'dense_rank', 'lag', 'lead', 'first_value', 'last_value', 'ntile', 'gen_random_uuid', 'uuid_generate_v4',
  'varchar', 'char', 'numeric', 'decimal', 'timestamp', 'timestamptz', 'time', 'bit', 'interval', 'date', 'text'
]));
// Woorden die direct voor een haakje kunnen staan zonder een functieaanroep te zijn.
const NOT_A_CALL = new Set(['and', 'or', 'not', 'in', 'any', 'all', 'some', 'exists', 'values', 'from', 'join', 'on', 'using', 'where', 'select', 'as', 'case', 'when', 'then', 'else', 'end', 'over', 'filter', 'within', 'between', 'like', 'ilike', 'similar', 'set', 'into', 'returning', 'by', 'partition', 'order', 'group', 'having', 'limit', 'offset', 'union', 'intersect', 'except', 'array', 'row', 'lateral', 'distinct', 'with', 'table', 'only', 'is', 'null', 'true', 'false', 'unique', 'primary', 'key', 'references', 'check', 'default', 'constraint', 'index', 'view', 'rows', 'range', 'groups', 'recursive', 'materialized', 'asc', 'desc', 'nulls', 'collate', 'at', 'to', 'for', 'if', 'conflict', 'do', 'nothing', 'update', 'insert', 'delete']);
// Postgres staat in identifiers elk teken buiten ASCII toe (letters, accenten, Cyrillisch, CJK): elk teken vanaf U+0080 telt als identifierteken, zodat een naam als é of 日本 nooit onzichtbaar blijft.
// De privégebied-tekens U+E000/U+E001 zijn gereserveerd voor de plaatsvervangers van weggehaalde tekst (zie scanSql) en zijn dus nooit een identifierteken; staan ze in de invoer zelf, dan is de SQL niet betrouwbaar te lezen.
const ID_START = 'A-Za-z_\\u0080-\\uDFFF\\uE002-\\u{10FFFF}', ID_CONT = ID_START + '0-9$';
const NAAM = '[' + ID_START + '][' + ID_CONT + ']*';
const ASCII_NAAM = /^[A-Za-z_][A-Za-z0-9_$]*$/;
/** Conservatieve sleutel voor "is dit dezelfde functie": Unicode-genormaliseerd en zonder hoofdletters; meer treffers is hier veiliger (een hogere klasse wordt geërfd). */
export const funcSleutel = naam => String(naam).normalize('NFKC').toLowerCase();
/** Functieaanroepen in (gestripte) SQL die niet op de allowlist staan. Een geciteerde, niet-ASCII of schema-gekwalificeerde naam is nooit toegestaan; alleen een kale ASCII-naam uit de lijst is alleen-lezen. */
export function unsafeCalls(text, extra = new Set(), geciteerd = new Set()) {
  const uit = [];
  for (const m of String(text || '').matchAll(new RegExp('((?:' + NAAM + '\\s*\\.\\s*)*)(' + NAAM + ')\\s*\\(', 'gu'))) {
    const schema = m[1].replace(/\s+/g, '').replace(/\.$/, ''), ruw = m[2], sleutel = funcSleutel(ruw);
    const kaal = ASCII_NAAM.test(ruw), schemaLaag = schema.toLowerCase();
    // Een naam die ergens als "naam"( is geciteerd is een eigen functie (hoofdlettergevoelig), nooit het ingebouwde sleutelwoord of de ingebouwde functie.
    if (geciteerd.has(sleutel)) { if (!schema && extra.has(sleutel)) continue; uit.push((schema ? schema + '.' : '') + ruw); continue; }
    if (!schema && kaal && NOT_A_CALL.has(ruw.toLowerCase())) continue;
    if (schemaLaag === 'pg_catalog' && kaal && READ_FUNCTIONS.has(ruw.toLowerCase())) continue;
    if (!schema && ((kaal && READ_FUNCTIONS.has(ruw.toLowerCase())) || extra.has(sleutel))) continue;
    uit.push((schema ? schema + '.' : '') + ruw);
  }
  return uit;
}

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
// Sleutelwoorden die als geciteerde identifier ("where") nooit als sleutelwoord gelezen mogen worden.
const RESERVED_QUOTED = /^(select|from|where|set|insert|update|delete|into|values|drop|truncate|alter|create|grant|revoke|union|join|on|and|or|not|as|with|returning|using|table|only|do|execute|call|copy|merge|conflict|group|order|having|limit|offset|case|when|then|else|end|in|is|null|like|between|exists|all|any|distinct|default|cascade|restrict|function|procedure|trigger|policy|role|user|schema|view|index|extension)$/i;
/** Staat er vanaf positie i (na witruimte en commentaar, ook geneste blokcommentaar) een openingshaakje? Zo verbergt "Max" /* x *\/ (1) zich niet achter commentaar. */
function volgtHaakje(s, i) {
  const n = s.length;
  while (i < n) {
    if (/\s/.test(s[i])) { i++; continue; }
    if (s[i] === '-' && s[i + 1] === '-') { while (i < n && s[i] !== '\n' && s[i] !== '\r') i++; continue; }
    if (s[i] === '/' && s[i + 1] === '*') { let d = 1; i += 2; while (i < n && d) { if (s[i] === '/' && s[i + 1] === '*') { d++; i += 2; } else if (s[i] === '*' && s[i + 1] === '/') { d--; i += 2; } else i++; } continue; }
    return s[i] === '(';
  }
  return false;
}
/**
 * Eén doorlopende scan op volgorde van voorkomen (commentaar, geneste blokcommentaar, $tag$-blokken, E'..', '..', "..", U&"..").
 * Zo kan een string het begin van commentaar niet nabootsen of andersom. ok=false: iets is niet afgesloten of niet te lezen (ook U&-notatie),
 * dus niet betrouwbaar. Tekst tussen aanhalingstekens verdwijnt uit de tekst maar blijft beschikbaar in literals (referentie: een plaatsvervanger van privégebied-tekens met het volgnummer).
 */
export function scanSql(sql) {
  const s = String(sql || ''), n = s.length; let uit = '', i = 0, ok = true; const literals = [], geciteerd = new Set();
  // Postgres staat in identifiers en $-tags ook letters buiten ASCII toe; elk niet-ASCII teken telt hier als identifierteken.
  const ident = ch => /[A-Za-z0-9_$]/.test(ch || '') || /[^\x00-\x7F]/.test(ch || '');
  const tekst = (sluit, esc) => { // i staat net na het openingsteken
    while (i < n) {
      if (esc && s[i] === '\\') { i += 2; continue; }
      if (s[i] === sluit) { if (s[i + 1] === sluit) { i += 2; continue; } i++; return true; }
      i++;
    }
    return false;
  };
  if (/[]/.test(s)) ok = false; // gereserveerde plaatsvervangertekens in de invoer: niet betrouwbaar te lezen
  const lit = (kind, body) => { literals.push({kind, body}); return ' ' + (literals.length - 1) + ' '; };
  while (i < n) {
    const c = s[i], d = s[i + 1], vorige = uit.slice(-1);
    if (c === '-' && d === '-') { while (i < n && s[i] !== '\n' && s[i] !== '\r') i++; uit += ' '; continue; }
    if (c === '/' && d === '*') {
      let diepte = 1; i += 2;
      while (i < n && diepte) { if (s[i] === '/' && s[i + 1] === '*') { diepte++; i += 2; } else if (s[i] === '*' && s[i + 1] === '/') { diepte--; i += 2; } else i++; }
      if (diepte) ok = false; uit += ' '; continue;
    }
    if (c === '$' && !ident(vorige)) {
      const m = /^\$(?:[\p{L}_][\p{L}\p{N}_]*)?\$/u.exec(s.slice(i, i + 80));
      if (m) { const eind = s.indexOf(m[0], i + m[0].length); if (eind < 0) { ok = false; i = n; } else { uit += lit('dollar', s.slice(i + m[0].length, eind)); i = eind + m[0].length; continue; } uit += ' '; continue; }
      if (!/\d/.test(d || '')) { ok = false; } // een losse $ die geen parameter ($1) of geldige tag is: niet betrouwbaar te lezen
    }
    // U&"..." en U&'...': Unicode-escapes verbergen elke naam (U&"a\0075th" is auth). Niet te lezen, dus nooit alleen-lezen en in een migratie DB-C.
    if ((c === 'U' || c === 'u') && d === '&' && (s[i + 2] === '"' || s[i + 2] === "'") && !ident(vorige)) {
      ok = false; const q = s[i + 2]; i += 3; if (!tekst(q, false)) ok = false; uit += ' _UQ_ '; continue;
    }
    if ((c === 'E' || c === 'e') && d === "'" && !ident(vorige)) { i += 2; const start = i; if (!tekst("'", true)) ok = false; uit += lit('estring', s.slice(start, Math.max(start, i - 1))); continue; }
    // Een gewone string kent geen backslash-escape, behalve als standard_conforming_strings uit staat; een backslash erin maakt de SQL daarom niet betrouwbaar te lezen.
    if (c === "'") { const start = i; i++; if (!tekst("'", false)) ok = false; const body = s.slice(start + 1, Math.max(start + 1, i - 1)); if (s.slice(start, i).includes('\\')) ok = false; uit += lit('string', body.replace(/''/g, "'")); continue; }
    if (c === '"') { // een geciteerde identifier blijft zichtbaar (anders verbergt "dblink_exec"(...) of "auth"."users" zich voor de regels); een sleutelwoord of een bijzondere naam wordt een neutrale placeholder
      const start = i; i++; if (!tekst('"', false)) ok = false;
      const inhoud = s.slice(start + 1, i - 1);
      // Een naam met een bijzonder teken (é, 日本) blijft leesbaar zodat functiedefinities en -aanroepen elkaar vinden; alleen een echt onleesbare naam (spaties, leestekens) of een sleutelwoord wordt een neutrale placeholder.
      const leesbaar = new RegExp('^[' + ID_START + '][' + ID_CONT + ']*$', 'u').test(inhoud) && !RESERVED_QUOTED.test(inhoud);
      uit += leesbaar ? ' ' + inhoud + ' ' : ' _Q_ ';
      // "naam"( : een geciteerde functienaam is hoofdlettergevoelig en dus nooit het ingebouwde max/count/…
      if (leesbaar && volgtHaakje(s, i)) geciteerd.add(funcSleutel(inhoud));
      continue;
    }
    uit += c; i++;
  }
  return {text: uit, ok, literals, geciteerd};
}
export const stripSql = sql => scanSql(sql).text;
/** Staat er een WHERE op haakjesdiepte 0? Een WHERE in een subquery beperkt de UPDATE zelf niet. */
export function topWhere(t) {
  let d = 0;
  for (let i = 0; i < t.length; i++) {
    const ch = t[i];
    if (ch === '(') d++; else if (ch === ')') d = Math.max(0, d - 1);
    else if (d === 0 && t.slice(i, i + 5).toUpperCase() === 'WHERE' && !/\w/.test(t[i - 1] || ' ') && !/\w/.test(t[i + 5] || ' ')) return true;
  }
  return false;
}
/** Niet-afgesloten tekst, commentaar of $-blok, of een U&-notatie: de SQL is niet betrouwbaar te lezen en wordt als destructief (migratie) of muterend (execute_sql) behandeld. */
export const unparsable = sql => !scanSql(sql).ok;
const statements = sql => stripSql(sql).split(';').map(x => x.trim()).filter(Boolean);
export function sqlText(input = {}) { for (const k of ['query', 'sql', 'statement']) if (typeof input[k] === 'string') return input[k]; return ''; }
export function migrationSql(input = {}) { return typeof input.query === 'string' ? input.query : typeof input.sql === 'string' ? input.sql : ''; }
export function migrationName(input = {}) { return String(input.name || input.migration_name || '').trim(); }

/** Alleen-lezen-herkenning voor execute_sql (conservatief); muterende SQL gaat via een benoemde apply_migration. */
export function classifySql(sql) {
  const raw = String(sql || '');
  if (!raw.trim()) return {level: 'blocked', reason: 'SQL ontbreekt.'};
  const sc = scanSql(raw);
  if (!sc.ok) return {level: 'change', reason: 'SQL is niet betrouwbaar te lezen (niet-afgesloten tekst of commentaar, of een U&-notatie).'};
  const st = sc.text.split(';').map(x => x.trim()).filter(Boolean);
  if (st.length !== 1) return {level: 'sensitive', reason: 'Meerdere SQL-statements in een execute_sql-call zijn niet toegestaan.'};
  const tokens = (st[0].match(/[A-Za-z_][A-Za-z0-9_$]*/g) || []).map(x => x.toUpperCase());
  if (readStart.has(tokens[0] || '') && !tokens.some(t => forbiddenReadTokens.has(t)) && !readOnlyPhrases.some(r => r.test(st[0])) && !NETWORK_FN.test(st[0]) && !/\bauth\s*\./i.test(st[0]) && !/\bvault\s*\.\s*decrypted_secrets\b/i.test(st[0]) && !/\bvault\s*\.\s*secrets\b[\s\S]*\bsecret\b/i.test(st[0]) && !/\b_Q_\s*[.(]/.test(st[0])) {
    const vreemd = unsafeCalls(st[0], new Set(), sc.geciteerd);
    if (vreemd.length) return {level: 'change', reason: 'Functie buiten de alleen-lezen-allowlist (' + [...new Set(vreemd)].slice(0, 4).join(', ') + '): behandeld als wijziging; gebruik een benoemde apply_migration.'};
    return {level: 'read', reason: 'Conservatief als read-only SQL herkend.'};
  }
  return {level: 'change', reason: 'Muterende SQL hoort via apply_migration.'};
}

// ---- database-klassen ----
const RANG = {A: 1, B: 2, C: 3};
const max = (a, b) => RANG[b] > RANG[a] ? b : a;
// Machtigingen en rollen: elke verruiming van wie de rij-beveiliging of de authenticatie kan omzeilen is destructief (DB-C).
const ESCALATIE = [
  [/\b(SUPERUSER|BYPASSRLS|CREATEROLE|REPLICATION)\b/, 'rol met SUPERUSER/BYPASSRLS/CREATEROLE/REPLICATION'],
  [/\bNO FORCE ROW LEVEL SECURITY\b/, 'NO FORCE ROW LEVEL SECURITY'],
  [/^(CREATE|ALTER|DROP) (ROLE|USER|GROUP)\b/, 'rol of gebruiker maken, wijzigen of verwijderen'],
  [/^(SET (SESSION |LOCAL )?ROLE|SET SESSION AUTHORIZATION|RESET (ROLE|SESSION AUTHORIZATION))\b/, 'rol of sessie-autorisatie overnemen'],
  [/\bOWNER TO\b/, 'eigenaar wijzigen'],
  [/^ALTER DEFAULT PRIVILEGES\b/, 'standaardrechten wijzigen'],
  [/^GRANT\b(?!.*\bON\b)/, 'rollidmaatschap toekennen'],
  [/^GRANT\b.*\bALL( PRIVILEGES)?\b.*\bTO\b.*\b(ANON|AUTHENTICATED|PUBLIC)\b/, 'alle rechten toekennen aan anon/authenticated/public'],
  [/^(CREATE|ALTER) POLICY\b.*\b(USING|WITH CHECK)\s*\(\s*TRUE\s*\)/, 'beleid dat alles toestaat (USING/WITH CHECK (true))']
];
const FN_DEF = new RegExp('^CREATE (?:OR REPLACE )?(?:FUNCTION|PROCEDURE)\\s+((?:' + NAAM + '\\s*\\.\\s*)*)(' + NAAM + ')\\s*\\(', 'iu');
/** Begint dit statement als een functie- of procedure-definitie? (Ook als FN_DEF de naam niet kan lezen: dat is dan onbetrouwbaar en telt als DB-C.) */
const IS_FN_DEF = /^CREATE (?:OR REPLACE )?(?:FUNCTION|PROCEDURE)\b/i;
const verwijzingen = (t, literals) => [...String(t).matchAll(/(\d+)/g)].map(m => literals[Number(m[1])]).filter(Boolean);
// Roept deze tekst de functie met deze (genormaliseerde) naam aan? Ruim bedoeld: een naam die een stukje van een andere naam is, matcht niet, maar een andere schrijfwijze van dezelfde naam wel.
const roept = (tekst, sleutel) => new RegExp('(?<![' + ID_CONT + '])' + sleutel.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\s*\\(', 'iu').test(String(tekst).normalize('NFKC'));

/** Klasse van één statement. In een functiebody (inBody) is een onbekend of procedureel stuk gewoon A. */
function klasseStatement(U, raw, ctx) {
  const {inBody, literals, fns} = ctx, geciteerd = ctx.geciteerd || new Set();
  const r = (k, t) => ({k, r: t});
  if (/^(DO|CALL)\b/.test(U) || /\bEXECUTE\b(?!\s+(FUNCTION|PROCEDURE)\b)/.test(U) || /\bCOPY\b.*\bPROGRAM\b/.test(U) || /^ALTER SYSTEM\b/.test(U)) return r('C', 'voert willekeurige code uit (DO/CALL/EXECUTE/COPY PROGRAM/ALTER SYSTEM)');
  if (/^COPY\b/.test(U)) return r('C', 'COPY leest of schrijft bestanden of invoer buiten de tabelgegevens');
  for (const [re, tekst] of ESCALATIE) if (re.test(U)) return r('C', tekst);
  if (/^SET\b.*\b(SEARCH_PATH|STANDARD_CONFORMING_STRINGS|BACKSLASH_QUOTE|ESCAPE_STRING_WARNING)\b/.test(U) || /\bSET_CONFIG\s*\(/.test(U)) return r('C', 'zoekpad of tekstinstelling wijzigen (kan auth/vault of de leesregels omzeilen)');
  if (NETWORK_FN.test(U) || EXTERNAL_FN.test(U)) return r('C', 'functie of schema met bijwerkingen buiten gewone tabelgegevens (netwerk, bestanden, andere databases)');
  // Destructieve woorden tellen waar ze ook staan (EXPLAIN ANALYZE DELETE, WITH x AS (DELETE ...), MERGE ...), behalve waar ze alleen een regel beschrijven (beleid, trigger, GRANT) of een verwijzingsactie zijn (ON DELETE CASCADE).
  const U2 = U.replace(/\bON (DELETE|UPDATE)\b/g, ' ');
  const beschrijft = /^(CREATE|ALTER)\s+(OR REPLACE\s+)?(POLICY|TRIGGER|RULE)\b|^(GRANT|REVOKE|COMMENT|SECURITY LABEL)\b/.test(U);
  if (!beschrijft && /\b(DELETE|TRUNCATE|MERGE)\b/.test(U2)) return r('C', 'bevat DELETE/TRUNCATE/MERGE');
  if (!beschrijft && !/^(UPDATE|INSERT)\b/.test(U) && /\bUPDATE\b/.test(U2)) return r('C', 'UPDATE binnen een ander statement (EXPLAIN/WITH)');
  if (/\bDROP\b/.test(U)) return r('C', 'DROP');
  if (/\bTRUNCATE\b/.test(U)) return r('C', 'TRUNCATE');
  if (/^DELETE\b/.test(U)) return r('C', 'DELETE');
  if (/DISABLE ROW LEVEL SECURITY/.test(U)) return r('C', 'RLS uitzetten');
  if (/\b(AUTH|VAULT)\s*\./.test(U) || /\b_UQ_\b/.test(U)) return r('C', 'auth/vault direct of onleesbare naam');
  if (/ALTER COLUMN .* (SET DATA )?TYPE\b/.test(U)) return r('C', 'onomkeerbare typewijziging');
  if (/\bCRON\s*\.\s*(SCHEDULE|SCHEDULE_IN_DATABASE|UNSCHEDULE|ALTER_JOB)\b/.test(U)) {
    // De commandotekst van een cron-job draait later, permanent en zonder toezicht: scan hem als functiebody.
    let k = 'B', t = 'cron-job';
    for (const l of verwijzingen(raw, literals)) { const b = bodyKlasse(l.body, fns, (ctx.diepte || 0) + 1); if (RANG[b.k] > RANG[k]) { k = b.k; t = 'cron-job met opdracht die ' + b.r; } }
    return r(k, t);
  }
  if (/\bCRON\s*\./.test(U)) return r('C', 'cron direct');
  if (/^INSERT\b/.test(U) && /\bDO UPDATE\b/.test(U)) return r('B', 'upsert (ON CONFLICT DO UPDATE)');
  if (/^UPDATE\b/.test(U)) return topWhere(U) && !/\bWHERE\s+(TRUE|1\s*=\s*1)\b/.test(U) ? r('B', 'backfill/UPDATE met WHERE') : r('C', 'UPDATE zonder (echte) WHERE op het hoogste niveau');
  if (/SECURITY DEFINER/.test(U)) return r('B', 'SECURITY DEFINER');
  if (/^(GRANT|REVOKE)\b/.test(U)) return r('B', 'GRANT/REVOKE');
  if (/^(ALTER|CREATE) POLICY\b/.test(U)) return r('B', 'beleid (toegangsgrens) maken of wijzigen');
  if (/ADD (CONSTRAINT|CHECK|UNIQUE|PRIMARY KEY|FOREIGN KEY)\b/.test(U) || /SET NOT NULL/.test(U)) return r('B', 'constraint aanscherpen');
  if (/ADD COLUMN\b/.test(U) && /NOT NULL/.test(U) && !/DEFAULT/.test(U)) return r('B', 'NOT NULL-kolom zonder default');
  if (/\bRENAME\b/.test(U) || /^CREATE (OR REPLACE )?TRIGGER\b/.test(U) || /^ALTER (TRIGGER|FUNCTION)\b/.test(U) || /^CREATE EXTENSION\b/.test(U)) return r('B', 'hernoemen/trigger/functie/extensie');
  if (/^INSERT INTO\b/.test(U)) {
    // Een INSERT die een niet-herkende functie aanroept, voert code uit die hier niet te classificeren is: minimaal B.
    const zonderDoel = String(raw).replace(/^\s*INSERT\s+INTO\s+[^\s(]+(?:\s*\([^)]*\))?/i, '');
    const vreemd = unsafeCalls(zonderDoel, new Set([...(fns ? fns.keys() : [])]), geciteerd);
    if (vreemd.length) return r('B', 'roept een niet-herkende functie aan (' + [...new Set(vreemd)].slice(0, 3).join(', ') + ')');
  }
  if (/^CREATE (OR REPLACE )?(UNIQUE )?(INDEX|VIEW|TABLE|TYPE|SEQUENCE|POLICY|FUNCTION|PROCEDURE|SCHEMA)\b/.test(U) || /^CREATE (TEMP |TEMPORARY )?TABLE\b/.test(U) || /ADD COLUMN\b/.test(U) || /ENABLE ROW LEVEL SECURITY/.test(U) || /^COMMENT ON\b/.test(U) || /^INSERT INTO\b/.test(U)) {
    // Een DEFAULT of een AS SELECT die een niet-herkende functie aanroept, voert die functie uit (of laat haar later uitvoeren): minimaal B.
    if (!/^(INSERT INTO|COMMENT ON|CREATE (OR REPLACE )?(FUNCTION|PROCEDURE))\b/.test(U)) {
      const stukken = [...String(raw).matchAll(/\bDEFAULT\b((?:[^,();]|\([^()]*\))*)/gi)].map(m => m[1]).join(' ') + ' ' + (/\bAS\s+((?:SELECT|WITH|VALUES)\b[\s\S]*)$/i.exec(String(raw))?.[1] || '');
      const vreemd = unsafeCalls(stukken, new Set([...(fns ? fns.keys() : [])]), geciteerd);
      if (vreemd.length) return r('B', 'DEFAULT of AS SELECT roept een niet-herkende functie aan (' + [...new Set(vreemd)].slice(0, 3).join(', ') + ')');
    }
    return r('A', 'additief');
  }
  return inBody ? r('A', 'procedureel') : r('B', 'onbekend statement: ' + U.slice(0, 40));
}
// Procedurele kopjes in een functiebody die zelf geen statement zijn.
function stripControl(p) {
  let t = String(p).trim();
  for (let i = 0; i < 6; i++) {
    const v = t;
    t = t.replace(/^(BEGIN|DECLARE|THEN|ELSE|LOOP|EXCEPTION)\b\s*/i, '').replace(/^END(\s+(IF|LOOP|CASE))?\b\s*/i, '').replace(/^(IF|ELSIF|WHILE|FOR|WHEN)\b[\s\S]*?\b(THEN|LOOP)\b\s*/i, '').replace(/^(PERFORM|RETURN QUERY|RETURN)\b\s*/i, 'SELECT ');
    if (t === v) break;
  }
  return t;
}
/** Klasse van de body van een functie (of van de opdracht van een cron-job): wat de functie later uitvoert telt mee. */
function bodyKlasse(tekst, fns, diepte = 0) {
  if (diepte > 4) return {k: 'C', r: 'te diep geneste functiebody'};
  const sc = scanSql(tekst);
  if (!sc.ok) return {k: 'C', r: 'onleesbare functiebody uitvoert'};
  let hoogste = 'A', reden = 'alleen additieve of procedurele stappen uitvoert';
  for (const stuk of sc.text.split(';')) {
    const p = stripControl(stuk); const U = p.replace(/\s+/g, ' ').trim().toUpperCase(); if (!U) continue;
    let k = klasseStatement(U, p, {inBody: true, literals: sc.literals, fns, diepte, geciteerd: sc.geciteerd});
    if (fns) for (const [naam, f] of fns) if (roept(p, naam) && RANG[f.k] > RANG[k.k]) k = {k: f.k, r: 'functie ' + naam + ' aanroept die ' + f.r};
    if (RANG[k.k] > RANG[hoogste]) { hoogste = k.k; reden = k.r; }
  }
  return {k: hoogste, r: reden};
}

/**
 * Database-klassen op basis van de echte SQL:
 *  A laag risico/backward compatible (nieuwe tabel, kolom, index, additief beleid);
 *  B middel (backfill met WHERE, constraint, bestaand beleid, security definer, grants, cron);
 *  C hoog/destructief (DROP, TRUNCATE, DELETE, UPDATE zonder WHERE, RLS uit of omzeild, auth/vault, rollen, netwerk, typewijziging, onleesbare SQL).
 * De body van een functie telt mee, evenals elke latere aanroep ervan. Onbekende statements tellen als B, nooit stil als A.
 */
export function classifyDb(sql) {
  const sc = scanSql(sql);
  const lijst = sc.text.split(';').map(x => x.trim()).filter(Boolean);
  if (!lijst.length) return {klasse: 'C', redenen: ['Lege of onleesbare migratie.']};
  if (!sc.ok) return {klasse: 'C', redenen: ['C: de SQL is niet betrouwbaar te lezen (niet-afgesloten tekst of blok, of een U&-notatie); behandeld als destructief.']};
  let hoogste = 'A'; const redenen = [];
  const zet = (k, t) => { hoogste = max(hoogste, k); redenen.push(k + ': ' + t); };
  // Eerst de functies die in deze migratie worden gemaakt (hun body bepaalt wat een latere aanroep doet).
  const fns = new Map();
  for (const s of lijst) {
    const plat = s.replace(/\s+/g, ' ').replace(/^CREATE (OR REPLACE )?/i, 'CREATE $1');
    const m = FN_DEF.exec(plat);
    if (!m) { if (IS_FN_DEF.test(plat)) { zet('C', 'functie- of procedure-definitie waarvan de naam niet te lezen is: de body kan niet betrouwbaar worden beoordeeld'); } continue; }
    let k = 'A', t = 'alleen additieve of procedurele stappen uitvoert';
    for (const l of verwijzingen(s, sc.literals)) { const b = bodyKlasse(l.body, fns, 1); if (RANG[b.k] > RANG[k]) { k = b.k; t = b.r; } }
    fns.set(funcSleutel(m[2]), {k, r: t});
  }
  for (const s of lijst) {
    const U = s.replace(/\s+/g, ' ').toUpperCase();
    const maakt = FN_DEF.exec(s.replace(/\s+/g, ' ')); const eigen = maakt ? funcSleutel(maakt[2]) : null;
    if (maakt) {
      const f = fns.get(eigen);
      if (RANG[f.k] >= RANG.B) { zet(f.k, 'functie ' + eigen + ' voert uit: ' + f.r); continue; }
    }
    let k = klasseStatement(U, s, {inBody: false, literals: sc.literals, fns, geciteerd: sc.geciteerd});
    // Een latere aanroep van een in deze migratie gemaakte functie (of een trigger of cron-job die haar aanroept) erft de klasse van de body.
    for (const [naam, f] of fns) if (naam !== eigen && roept(s, naam) && RANG[f.k] >= RANG[k.k]) k = {k: max(f.k, 'B'), r: 'roept functie ' + naam + ' aan, die ' + f.r};
    zet(k.k, k.r);
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
