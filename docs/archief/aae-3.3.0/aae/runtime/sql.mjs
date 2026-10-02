/**
 * AAE 3.3 - SQL-classificatie, default-deny. Geen poging om SQL of functies te begrijpen: een statement is A of B alleen als het precies op één
 * vorm uit VORMEN past; al het andere is C (vraagt AAE BEVESTIG). Functies, procedures en triggers zijn altijd C. Een aanroep telt alleen als zuiver
 * als de exacte naam op PURE_FUNCTIONS staat; namen worden nooit bijgehouden, vergeleken of afgeleid, dus herdefinitie, overloads, schema's, Unicode en quotes
 * hebben geen eigen logica nodig. Bij twijfel: hogere klasse.
 */
const S = String.fromCharCode(0xE000), Q = String.fromCharCode(0xE001); // plaatsvervangers (privégebied): tekstwaarde en geciteerde naam
export const MAX_REGELS = 140; // een test bewaakt dat dit bestand klein blijft

/** Exacte, kleine lijst van zuivere functies (en typen met haakjes). Een andere schrijfwijze, een geciteerde of niet-ASCII naam of een ander schema staat hier nooit op. */
export const PURE_FUNCTIONS = Object.freeze(new Set([
  'count', 'sum', 'avg', 'min', 'max', 'bool_and', 'bool_or', 'array_agg', 'string_agg', 'json_agg', 'jsonb_agg', 'coalesce', 'nullif', 'greatest', 'least',
  'now', 'age', 'date_trunc', 'date_part', 'extract', 'to_char', 'to_date', 'to_timestamp', 'make_date', 'timezone',
  'lower', 'upper', 'initcap', 'length', 'char_length', 'trim', 'ltrim', 'rtrim', 'btrim', 'substring', 'substr', 'position', 'overlay', 'replace', 'concat', 'concat_ws', 'left', 'right', 'split_part', 'format', 'lpad', 'rpad', 'repeat', 'reverse', 'md5',
  'abs', 'round', 'ceil', 'ceiling', 'floor', 'mod', 'power', 'sqrt', 'sign', 'trunc', 'cast',
  'to_json', 'to_jsonb', 'jsonb_typeof', 'jsonb_array_length', 'json_build_object', 'jsonb_build_object', 'json_build_array', 'jsonb_build_array', 'jsonb_array_elements', 'jsonb_array_elements_text', 'array_length', 'cardinality', 'array_to_string', 'unnest', 'generate_series',
  'row_number', 'rank', 'dense_rank', 'lag', 'lead', 'first_value', 'last_value', 'ntile', 'gen_random_uuid',
  'varchar', 'char', 'numeric', 'decimal', 'timestamp', 'timestamptz', 'time', 'interval', 'bit',
  'auth.uid', 'auth.jwt', 'auth.role' // de enige functies uit een gevoelig schema; een andere functie uit auth profiteert hier niet van
]));
// Woorden die direct voor een haakje staan zonder een aanroep te zijn. Alleen woorden die Postgres nooit als functienaam toestaat; een ontbrekend woord geeft hoogstens een false positive (C).
// Woorden die wél een functienaam kunnen zijn (key, over, filter, include, conflict) tellen alleen na hun vaste voorganger.
const KEYWORDS = new Set(['and', 'or', 'not', 'in', 'any', 'all', 'some', 'exists', 'values', 'as', 'case', 'when', 'then', 'else', 'using', 'on', 'where', 'select', 'from', 'check', 'unique', 'default', 'to', 'for', 'with', 'lateral', 'limit', 'offset', 'having', 'group', 'union', 'intersect', 'except', 'between', 'array', 'row', 'returning']);
const NA = {key: ['PRIMARY', 'FOREIGN'], over: [')'], filter: [')'], include: [')'], conflict: ['ON']};
const DECL = new Set(['TABLE', 'INTO', 'REFERENCES', 'EXISTS', 'VIEW']); // een naam die hier voor een haakje staat wordt gedeclareerd of genoemd, niet aangeroepen
const GEVOELIG = new Set(['auth', 'vault', 'net', 'cron', 'supabase_functions', 'pgsodium', 'pg_catalog']);
const PG = /^pg_/i; // elke naam die met pg_ begint (systeemtabellen met wachtwoordhashes, queryteksten of configuratie), zonder of met quotes: nooit zuiver
// Een identifierteken is elk ASCII-letter, cijfer, _ of $, en elk teken vanaf U+0080 (Postgres), behalve de gereserveerde plaatsvervangers.
const ID = 'A-Za-z_\\u0080-\\uDFFF\\uE002-\\u{10FFFF}';
const TOKEN = new RegExp(S + '|' + Q + '|[' + ID + '][' + ID + '0-9$]*|\\d[\\d.]*|::|<>|<=|>=|!=|\\S', 'gu');
const IDENT = new RegExp('^[' + ID + Q + ']', 'u'), KAAL = /^[A-Za-z_][A-Za-z0-9_$]*$/, IDTEKEN = new RegExp('[' + ID + '0-9$]', 'u');

/** Haalt commentaar, tekstwaarden, $-blokken en geciteerde namen weg. ok=false: niet afgesloten, U&-notatie, E'..' of een backslash in tekst: niet betrouwbaar te lezen. */
export function scanSql(sql) {
  const s = String(sql || ''), n = s.length, fout = {text: '', ok: false, quoted: []}, quoted = []; let i = 0, uit = '';
  if (s.includes(S) || s.includes(Q)) return fout;
  const sluit = q => { while (i < n) { if (s[i] === q) { if (s[i + 1] === q) { i += 2; continue; } i++; return true; } i++; } return false; };
  while (i < n) {
    const c = s[i], d = s[i + 1], los = !IDTEKEN.test(s[i - 1] || ' ');
    if (c === '-' && d === '-') { while (i < n && s[i] !== '\n') i++; uit += ' '; continue; }
    if (c === '/' && d === '*') { let diep = 1; i += 2; while (i < n && diep) { if (s[i] === '/' && s[i + 1] === '*') { diep++; i += 2; } else if (s[i] === '*' && s[i + 1] === '/') { diep--; i += 2; } else i++; } if (diep) return fout; uit += ' '; continue; }
    if (c === '$' && los) {
      const m = /^\$([\p{L}_][\p{L}\p{N}_]*)?\$/u.exec(s.slice(i, i + 80));
      if (m) { const e = s.indexOf(m[0], i + m[0].length); if (e < 0) return fout; i = e + m[0].length; uit += ' ' + S + ' '; continue; }
      if (!/\d/.test(d || '')) return fout;
    }
    if (los && ((/[Uu]/.test(c) && d === '&') || (/[Ee]/.test(c) && d === "'"))) return fout;
    if (c === "'") { const a = i++; if (!sluit("'") || s.slice(a, i).includes('\\')) return fout; uit += ' ' + S + ' '; continue; }
    if (c === '"') { const a = ++i; if (!sluit('"')) return fout; quoted.push(s.slice(a, i - 1).replace(/""/g, '"')); uit += ' ' + Q + ' '; continue; }
    uit += c; i++;
  }
  return {text: uit, ok: true, quoted};
}
const pgNaam = sc => sc.quoted.some(x => PG.test(x)) || tokens(sc.text).some(t => PG.test(t)); // één controle voor alle statements: een pg_-naam is nooit zuiver
const tokens = s => s.match(TOKEN) || [];
const norm = tok => tok.join(' ').toUpperCase().replace(/ ?\. ?/g, '.');
const boven = (tok, f) => { let d = 0; for (const t of tok) { if (t === '(') d++; else if (t === ')') d--; else if (!d && f(t)) return true; } return false; }; // komt dit teken op haakjesdiepte 0 voor?

/** Waarom dit statement nooit "zuiver" is: een gevoelig of geciteerd schema, of een aanroep die niet exact op PURE_FUNCTIONS staat. */
function onveilig(tok, U) {
  const index = /^CREATE (UNIQUE )?INDEX /.test(U);
  for (let i = 0; i < tok.length; i++) {
    const t = tok[i];
    if (tok[i + 1] === '.' && (t === Q || (KAAL.test(t) && GEVOELIG.has(t.toLowerCase())))) { // alleen een exacte, toegestane aanroep zoals auth.uid() mag een gevoelig schema noemen
      let e = i; while (tok[e + 1] === '.' && IDENT.test(tok[e + 2] || '')) e += 2;
      const delen = tok.slice(i, e + 1).filter(x => x !== '.');
      if (t === Q || tok[e + 1] !== '(' || !delen.every(d => KAAL.test(d)) || !PURE_FUNCTIONS.has(delen.join('.').toLowerCase())) return t === Q ? 'geciteerd schema' : 'gevoelig schema (' + t + ')';
    }
    if (tok[i + 1] === '(' && IDENT.test(t)) {
      let j = i; while (j >= 2 && tok[j - 1] === '.' && IDENT.test(tok[j - 2])) j -= 2;
      const delen = tok.slice(j, i + 1).filter(x => x !== '.'), naam = delen.join('.').toLowerCase(), vorige = (tok[j - 1] || '').toUpperCase(), kaal = delen.every(d => KAAL.test(d));
      if (!(kaal && (PURE_FUNCTIONS.has(naam) || (delen.length === 1 && (KEYWORDS.has(naam) || (NA[naam] || []).includes(vorige))))) && !DECL.has(vorige) && !(index && (vorige === 'ON' || vorige === 'USING'))) return 'aanroep van een functie die niet op de lijst van zuivere functies staat';
    }
  }
  return null;
}

const EXECUTABEL = /^(CREATE|ALTER|DROP|COMMENT ON|REPLACE)\b[^(]*\b(FUNCTION|PROCEDURE|ROUTINE|TRIGGER|RULE|OPERATOR|AGGREGATE|EXTENSION|CAST)\b|^(DO|CALL|EXECUTE)\b/;
const ALTER = '^ALTER TABLE (IF EXISTS )?(ONLY )?\\S+ ', enkel = (U, tok) => !boven(tok, t => t === ','); // één actie per ALTER TABLE
const VORMEN = [ // [vorm, klasse, uitleg, extra voorwaarde]; wat hier niet op past is C
  [/^CREATE (TEMP |TEMPORARY |UNLOGGED )?TABLE /, 'A', 'nieuwe tabel'], [/^CREATE (UNIQUE )?INDEX /, 'A', 'nieuwe index'], [/^CREATE VIEW /, 'A', 'nieuwe view'], [/^CREATE SCHEMA /, 'A', 'nieuw schema'],
  [/^COMMENT ON (TABLE|COLUMN|INDEX|VIEW|SCHEMA) /, 'A', 'commentaar'], [/^(BEGIN|COMMIT)$/, 'A', 'transactiegrens'],
  [new RegExp(ALTER + '(ADD COLUMN |ENABLE ROW LEVEL SECURITY$)'), 'A', 'kolom of RLS erbij', enkel],
  [/^INSERT INTO /, 'B', 'rijen toevoegen'], [/^UPDATE /, 'B', 'UPDATE met WHERE', (U, tok) => boven(tok, t => t.toUpperCase() === 'WHERE') && !/ WHERE (TRUE|1 = 1)( |$)/.test(U)],
  [/^(CREATE|ALTER) POLICY /, 'B', 'beleid', U => !/\( TRUE \)/.test(U)], [/^CREATE OR REPLACE VIEW /, 'B', 'view vervangen'],
  [/^(GRANT|REVOKE) (SELECT|INSERT|UPDATE|DELETE)( , (SELECT|INSERT|UPDATE|DELETE))* ON (TABLE )?\S+ (TO|FROM) (?!PUBLIC\b)\S+( , \S+)*$/, 'B', 'smalle GRANT/REVOKE'],
  [new RegExp(ALTER + '(ADD (CONSTRAINT|PRIMARY KEY|UNIQUE|FOREIGN KEY|CHECK) |ALTER COLUMN \\S+ SET (NOT NULL|DEFAULT )|RENAME (TO|COLUMN) )'), 'B', 'constraint of hernoemen', enkel]
];
const klasse = s => {
  const tok = tokens(s), U = norm(tok);
  if (EXECUTABEL.test(U)) return ['C', 'functie, procedure, trigger of ander uitvoerbaar object (altijd C)'];
  const w = onveilig(tok, U); if (w) return ['C', w];
  const v = VORMEN.find(([re, , , ok]) => re.test(U) && (!ok || ok(U, tok)));
  return v ? [v[1], v[2]] : ['C', 'geen toegestane vorm (default-deny)'];
};
const statements = text => text.split(';').map(x => x.trim()).filter(Boolean);

/** Database-klasse van een migratie: de hoogste klasse van zijn statements (A, B of C). */
export function classifyDb(sql) {
  const sc = scanSql(sql), lijst = statements(sc.text);
  if (!sc.ok) return {klasse: 'C', redenen: ['C: de SQL is niet betrouwbaar te lezen (niet afgesloten, U&-notatie, E-string of backslash); behandeld als destructief.']};
  if (!lijst.length) return {klasse: 'C', redenen: ['C: lege migratie.']};
  if (pgNaam(sc)) return {klasse: 'C', redenen: ['C: een naam die met pg_ begint (systeemtabel of -functie) is nooit zuiver.']};
  const uit = lijst.map(klasse), rang = {A: 1, B: 2, C: 3};
  return {klasse: uit.reduce((h, [k]) => rang[k] > rang[h] ? k : h, 'A'), redenen: uit.map(([k, r]) => k + ': ' + r)};
}
/** execute_sql: alleen één SELECT/EXPLAIN/VALUES/WITH (SHOW niet) zonder schrijf- of bijwerkingswoorden en met uitsluitend zuivere aanroepen is read; al het andere is een wijziging. */
export function classifySql(sql) {
  if (!String(sql || '').trim()) return {level: 'blocked', reason: 'SQL ontbreekt.'};
  const sc = scanSql(sql), lijst = statements(sc.text);
  if (!sc.ok) return {level: 'change', reason: 'SQL is niet betrouwbaar te lezen.'};
  if (lijst.length !== 1) return {level: 'sensitive', reason: 'Meerdere SQL-statements in een execute_sql-call zijn niet toegestaan.'};
  if (pgNaam(sc)) return {level: 'change', reason: 'Een naam die met pg_ begint (systeemtabel of -functie) is nooit zuiver: behandeld als wijziging.'};
  const tok = tokens(lijst[0]), U = norm(tok), w = onveilig(tok, U);
  const leest = /^(SELECT|EXPLAIN|VALUES|WITH) /.test(U + ' ') && !/\b(INSERT|UPDATE|DELETE|MERGE|CREATE|ALTER|DROP|TRUNCATE|GRANT|REVOKE|COPY|CALL|DO|EXECUTE|INTO|ANALYZE|VACUUM|LOCK|SET|RESET|REFRESH|COMMENT)\b/.test(U);
  return leest && !w ? {level: 'read', reason: 'Alleen-lezen SQL met uitsluitend zuivere functies.'} : {level: 'change', reason: w ? w + ': behandeld als wijziging; gebruik een benoemde apply_migration.' : 'Muterende SQL hoort via apply_migration.'};
}
