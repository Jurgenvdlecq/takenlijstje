// AAE-V33-001E: de SQL-classificatie is default-deny (sql.mjs). Eén tabelgedreven bestand voor alle SQL-scenario's van de eerdere reviews (RB01-RB04, RD01)
// en de laatste blocker (RE01-RE03), plus een mutatiecorpus: een nieuwe reviewvondst is een regel in het corpus, geen nieuwe regex in de code.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fixture, cleanup, plan, st, pre, denies} from './helpers.mjs';
import {classifyDb, classifySql, classifyExternalCall} from '../runtime/integrations.mjs';
import {PURE_FUNCTIONS, scanSql, MAX_REGELS} from '../runtime/sql.mjs';

const k = s => classifyDb(s).klasse, lvl = s => classifySql(s).level;
const alleC = (lijst, msg = '') => { for (const s of lijst) assert.equal(k(s), 'C', msg + s); };
const nooitRead = lijst => { for (const s of lijst) assert.notEqual(lvl(s), 'read', s); };
const CYR_A = String.fromCharCode(0x430), FULL_M = String.fromCharCode(0xFF4D), COMBINING = String.fromCharCode(0x301);

// ---------------------------------------------------------------- RE01: de laatste blocker, letterlijk
const WIPE = 'CREATE FUNCTION public.wipe() RETURNS void LANGUAGE sql AS $$ DELETE FROM tasks $$;';
const CALL = 'SELECT public.wipe();';
const REDEF = 'CREATE OR REPLACE FUNCTION public.wipe() RETURNS void LANGUAGE sql AS $$ SELECT 1 $$;';
test('RE01 een latere onschuldige herdefinitie verlaagt de klasse van een eerdere destructieve functie nooit (reviewscenario van 467ecdd, letterlijk)', () => {
  assert.equal(k(WIPE + '\n' + CALL + '\n' + REDEF), 'C', 'het hele scenario');
  for (const s of [WIPE, CALL, REDEF]) assert.equal(k(s), 'C', 'elk statement apart: ' + s);
  for (const volgorde of [[REDEF, WIPE, CALL], [CALL, REDEF], [REDEF, CALL], [REDEF], [CALL, WIPE, REDEF], [REDEF, REDEF, CALL]]) assert.equal(k(volgorde.join(' ')), 'C', 'andere volgorde: ' + volgorde.length);
  assert.equal(classifyExternalCall('mcp__supabase__apply_migration', {name: 'x', query: WIPE + CALL + REDEF}).db, 'C');
  // ook zonder dat een andere migratie de functie kent: de aanroep is nooit read-only
  assert.equal(lvl(CALL.replace(';', '')), 'change');
});
test('RE01 overloads, dezelfde naam in verschillende schema\'s, Unicode en geciteerde of onleesbare namen: nooit lager dan C', () => {
  const def = (naam, body = 'DELETE FROM tasks', args = '') => 'CREATE FUNCTION ' + naam + '(' + args + ') RETURNS void LANGUAGE sql AS $$ ' + body + ' $$;';
  // twee overloads met dezelfde naam, de tweede onschuldig
  assert.equal(k(def('public.wipe', 'DELETE FROM tasks', 'a int') + def('public.wipe', 'SELECT 1', 'a text') + 'SELECT public.wipe(1);'), 'C');
  assert.equal(k(def('public.wipe', 'SELECT 1', 'a text') + def('public.wipe', 'DELETE FROM tasks', 'a int')), 'C');
  // dezelfde naam in verschillende schema's, ook een kale aanroep
  assert.equal(k(def('a.wipe') + def('b.wipe', 'SELECT 1') + 'SELECT wipe();'), 'C'); assert.equal(k(def('b.wipe', 'SELECT 1') + def('a.wipe') + 'SELECT a.wipe();'), 'C');
  // Unicode en quotes: meerdere schrijfwijzen van "dezelfde" naam
  const namen = ['wipe', '"wipe"', '"Wipe"', 'WIPE', 'wîpe', '"wîpe"', 'w' + 'i' + COMBINING + 'pe', 'w' + CYR_A + 'ipe', FULL_M + 'ipe', '日本語', '😀', '"a b"', '"x""y"', 'public."wipe"', '"public"."wipe"', '"pub lic".wipe', 'é'];
  for (const a of namen) for (const b of namen) assert.equal(k(def(a) + def(b, 'SELECT 1') + 'SELECT ' + a + '(); SELECT ' + b + '();'), 'C', a + ' / ' + b);
  // onleesbare definities en definities in een ander jasje
  alleC(['CREATE FUNCTION 1x() RETURNS void LANGUAGE sql AS $$ SELECT 1 $$;', 'create or replace function f() returns int language sql as $$ select 1 $$', 'CREATE  OR  REPLACE  FUNCTION\n  f ( ) RETURNS int LANGUAGE sql AS $a$ SELECT 1 $a$', "CREATE FUNCTION f() RETURNS int LANGUAGE sql AS 'SELECT 1'",
    'CREATE PROCEDURE p() LANGUAGE sql AS $$ SELECT 1 $$', 'ALTER FUNCTION f() OWNER TO x', 'ALTER FUNCTION f() SET search_path = x', 'ALTER PROCEDURE p() RENAME TO q', 'DROP FUNCTION f()', 'COMMENT ON FUNCTION f() IS \'x\'',
    'CREATE TRIGGER t AFTER INSERT ON a FOR EACH ROW EXECUTE FUNCTION f()', 'CREATE OR REPLACE TRIGGER t AFTER INSERT ON a FOR EACH ROW EXECUTE PROCEDURE f()', 'CREATE CONSTRAINT TRIGGER t AFTER INSERT ON a EXECUTE FUNCTION f()', 'CREATE EVENT TRIGGER e ON ddl_command_start EXECUTE FUNCTION f()',
    'CREATE RULE r AS ON INSERT TO a DO INSTEAD NOTHING', 'CREATE OPERATOR === (LEFTARG = int, RIGHTARG = int, FUNCTION = f)', 'CREATE CAST (int AS text) WITH FUNCTION f(int)', 'CREATE AGGREGATE agg(int) (SFUNC = f, STYPE = int)', 'CREATE EXTENSION dblink', 'CREATE LANGUAGE plx',
    'DO $$ BEGIN NULL; END $$', 'CALL p()', "EXECUTE 'select 1'"], '');
  // een onschuldige body blijft ook C: er is geen uitzondering voor "aantoonbaar onmogelijk gevaarlijk"
  alleC([def('f', 'SELECT 1'), def('f', 'SELECT 1', 'a int'), 'CREATE FUNCTION f() RETURNS int LANGUAGE sql IMMUTABLE AS $$ SELECT 1 $$;', "CREATE FUNCTION f() RETURNS int LANGUAGE sql SET search_path = '' AS $$ SELECT 1 $$;"]);
});

// ---------------------------------------------------------------- RE02: één exacte allowlist van zuivere functies
test('RE02 de allowlist is exact: elke vermelding is toegestaan, elke variant erbuiten (schema, geciteerd, Unicode, schrijfwijze) en elke andere functie uit een gevoelig schema is dat niet', () => {
  for (const naam of PURE_FUNCTIONS) assert.equal(lvl('SELECT ' + naam + '(1) FROM t'), 'read', naam);
  assert.equal(lvl('SELECT LOWER(a), Auth.UID(), COUNT(*) FROM t'), 'read', 'Postgres leest een ongeciteerde naam zonder hoofdletters');
  const niet = ['"lower"(a)', '"Lower"(a)', 'public.lower(a)', 'pg_catalog.lower(a)', 'l' + String.fromCharCode(0xF6) + 'wer(a)', 'lowe' + CYR_A + '(a)', FULL_M + 'ax(1)', 'max' + COMBINING + '(1)', 'lower2(a)', 'xlower(a)', 'lower_(a)', 'a.lower(a)', 'public."max"(1)',
    'auth.email()', 'auth.users(1)', 'auth.uid2()', 'auth."uid"()', '"auth".uid()', 'auth.uid.x()', 'vault.create_secret(1)', 'net.http_get(1)', 'cron.schedule(1)', 'supabase_functions.http_request()', 'extensions.uuid_generate_v4()', 'pg_sleep(1)', 'nextval(1)', 'set_config(1, 2, false)', 'dblink_exec(1)', 'version()', 'random()', 'wipe()'];
  for (const f of niet) { assert.equal(lvl('SELECT ' + f), 'change', f); assert.notEqual(k('INSERT INTO t (a) VALUES (' + f.replace(/^/, '') + ')'), 'B', f); }
  // een gevoelig schema met alleen een tabelverwijzing of een niet-geciteerde functie blijft C (ook in een migratie), maar auth.uid() in een beleid is gewoon B
  for (const s of ['SELECT * FROM auth.users', 'SELECT * FROM "auth"."users"', 'SELECT * FROM vault.decrypted_secrets', 'SELECT * FROM cron.job', 'SELECT * FROM net._http_response', 'SELECT * FROM pg_shadow', 'SELECT rolpassword FROM pg_authid', 'SELECT query FROM pg_stat_activity', 'SELECT * FROM pg_catalog.pg_settings']) assert.equal(lvl(s), 'change', s);
  alleC(['INSERT INTO auth.users (id) VALUES (1)', 'UPDATE auth.users SET a = 1 WHERE id = 1', 'CREATE TABLE t (u uuid REFERENCES auth.users (id))', 'CREATE POLICY p ON t FOR SELECT USING (auth.email() = x)', 'CREATE POLICY p ON t USING ("auth".uid() = u)', 'INSERT INTO t (a) VALUES (lower(a))'.replace('lower(a)', 'wipe()'), 'GRANT SELECT ON auth.users TO anon', 'CREATE VIEW v AS SELECT * FROM vault.secrets']);
  assert.equal(k('CREATE POLICY p ON t FOR SELECT USING (user_id = auth.uid());'), 'B'); assert.equal(k('CREATE POLICY p ON t FOR ALL USING ((select auth.uid()) = user_id) WITH CHECK ((select auth.uid()) = user_id);'), 'B');
  assert.equal(k('ALTER TABLE t ADD COLUMN u uuid DEFAULT auth.uid();'), 'A'); assert.equal(k("INSERT INTO t (a) VALUES (lower('X'));"), 'B');
  // een functie die toevallig heet als een woord dat Postgres wel als functienaam toestaat (key, over, filter, include, conflict, join, like, is, set, by) is geen sleutelwoord
  for (const w of ['key', 'over', 'filter', 'include', 'conflict', 'join', 'like', 'ilike', 'is', 'set', 'by', 'recursive']) { assert.equal(lvl('SELECT ' + w + '(1)'), 'change', w); assert.equal(k('INSERT INTO t (a) VALUES (' + w + '(1))'), 'C', w); }
  for (const s of ['SELECT count(*) FILTER (WHERE x > 1), row_number() OVER (PARTITION BY a) FROM t', 'SELECT * FROM t WHERE a IN (1, 2) AND NOT EXISTS (SELECT 1)']) assert.equal(lvl(s), 'read', s);
  for (const [s, klasse] of [['CREATE TABLE t (id int, PRIMARY KEY (id), FOREIGN KEY (id) REFERENCES u (id), UNIQUE (id), CHECK (id > 0));', 'A'], ['INSERT INTO t (a) VALUES (1) ON CONFLICT (a) DO NOTHING;', 'B'], ['CREATE INDEX i ON t (a) INCLUDE (b);', 'A']]) assert.equal(k(s), klasse, s);
  // de lijst zelf blijft klein en bevat geen patronen of schema's buiten auth
  assert.ok(PURE_FUNCTIONS.size < 120, 'de allowlist is klein: ' + PURE_FUNCTIONS.size); for (const n of PURE_FUNCTIONS) assert.ok(/^([a-z_0-9]+|auth\.(uid|jwt|role))$/.test(n), n);
});

// ---------------------------------------------------------------- RE03: de korte lijst toegestane vormen
test('RE03 elke toegestane vorm (A en B) heeft een goed en een afgewezen voorbeeld; alles buiten de lijst is C (default-deny)', () => {
  const goed = [['CREATE TABLE tasks (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), title varchar(100) NOT NULL, done boolean DEFAULT false, owner uuid REFERENCES auth_x (id) ON DELETE CASCADE, n numeric(10,2), CHECK (char_length(title) > 0));', 'A'],
    ['CREATE TABLE IF NOT EXISTS public.tasks (id int);', 'A'], ['CREATE UNIQUE INDEX i ON tasks (lower(title));', 'A'], ['CREATE INDEX i ON tasks USING gin (title);', 'A'], ['CREATE VIEW v AS SELECT id FROM tasks;', 'A'], ['CREATE SCHEMA IF NOT EXISTS app;', 'A'],
    ['COMMENT ON TABLE tasks IS \'taken\';', 'A'], ['BEGIN; CREATE TABLE a (id int); COMMIT;', 'A'], ['ALTER TABLE tasks ADD COLUMN note text;', 'A'], ['ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;', 'A'],
    ['INSERT INTO tasks (title) VALUES (\'a\');', 'B'], ["INSERT INTO tasks (title) SELECT lower(title) FROM old;", 'B'], ['INSERT INTO tasks (id) VALUES (1) ON CONFLICT (id) DO UPDATE SET id = 2;', 'B'], ['INSERT INTO tasks (id) VALUES (1) ON CONFLICT DO NOTHING;', 'B'],
    ['UPDATE tasks SET done = true WHERE id = 1;', 'B'], ['UPDATE tasks SET a = (SELECT b FROM u WHERE u.id = tasks.id) WHERE id = 3;', 'B'],
    ['CREATE POLICY p ON tasks FOR SELECT USING (owner = auth.uid());', 'B'], ['ALTER POLICY p ON tasks USING (owner = auth.uid());', 'B'], ['CREATE OR REPLACE VIEW v AS SELECT 1;', 'B'],
    ['GRANT SELECT ON tasks TO authenticated;', 'B'], ['GRANT SELECT, INSERT ON TABLE public.tasks TO a, b;', 'B'], ['REVOKE DELETE ON tasks FROM anon;', 'B'],
    ['ALTER TABLE tasks ADD CONSTRAINT u UNIQUE (title);', 'B'], ['ALTER TABLE tasks ALTER COLUMN title SET NOT NULL;', 'B'], ['ALTER TABLE tasks ALTER COLUMN n SET DEFAULT 0;', 'B'], ['ALTER TABLE tasks RENAME TO taken;', 'B'], ['ALTER TABLE tasks RENAME COLUMN a TO b;', 'B']];
  for (const [s, klasse] of goed) assert.equal(k(s), klasse, s);
  assert.equal(k('CREATE TABLE a (id int); UPDATE a SET b = 1 WHERE id = 1; CREATE INDEX i ON a (b);'), 'B', 'de hoogste klasse van alle statements telt');
  // één stap buiten de vorm maakt het C
  const slecht = ['DELETE FROM tasks;', 'TRUNCATE tasks;', 'DROP TABLE tasks;', 'DROP INDEX i;', 'UPDATE tasks SET a = 1;', 'UPDATE tasks SET a = 1 WHERE true;', 'UPDATE tasks SET a = 1 WHERE 1 = 1;', 'UPDATE tasks SET a = (SELECT 1 WHERE true);', 'UPDATE t SET a = (SELECT b FROM u WHERE u.id = 1);',
    'ALTER TABLE tasks DROP COLUMN a;', 'ALTER TABLE tasks ALTER COLUMN a TYPE int;', 'ALTER TABLE tasks DISABLE ROW LEVEL SECURITY;', 'ALTER TABLE tasks NO FORCE ROW LEVEL SECURITY;', 'ALTER TABLE tasks OWNER TO x;', 'ALTER TABLE tasks ADD COLUMN a int, DROP COLUMN b;', 'ALTER TABLE tasks ADD COLUMN a int, ADD COLUMN b int;',
    'CREATE POLICY p ON tasks USING (true);', 'CREATE POLICY p ON tasks FOR ALL TO anon USING (true) WITH CHECK (true);', 'GRANT ALL ON tasks TO anon;', 'GRANT SELECT ON tasks TO PUBLIC;', 'GRANT SELECT ON tasks TO a WITH GRANT OPTION;', 'GRANT postgres TO authenticated;', 'GRANT SELECT ON ALL TABLES IN SCHEMA public TO anon;',
    'ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon;', 'ALTER ROLE authenticated BYPASSRLS;', 'CREATE ROLE evil LOGIN;', 'DROP ROLE x;', 'CREATE USER u;', 'SET ROLE postgres;', 'SET SESSION AUTHORIZATION postgres;', 'SET search_path = auth;', 'SET LOCAL search_path TO auth, public;', "SELECT set_config('search_path', 'auth', false);",
    "COPY tasks TO '/tmp/x';", "COPY tasks FROM PROGRAM 'rm -rf /';", 'ALTER SYSTEM SET x = 1;', 'VACUUM tasks;', 'REINDEX TABLE tasks;', 'LOCK TABLE tasks;', 'REFRESH MATERIALIZED VIEW m;', 'CREATE TYPE s AS ENUM (\'a\');', 'CREATE SEQUENCE s;', 'CREATE TABLE t (a int DEFAULT wipe());', 'CREATE TABLE t2 AS SELECT wipe() AS x;', 'INSERT INTO a (b) SELECT wipe();',
    'WITH x AS (DELETE FROM t RETURNING 1) SELECT 1;', 'WITH x AS (UPDATE t SET a = 1 RETURNING 1) INSERT INTO a SELECT * FROM x;', 'MERGE INTO t USING s ON true WHEN MATCHED THEN DELETE;', 'EXPLAIN ANALYZE DELETE FROM t;', 'SELECT 1;', 'SELECT * INTO nieuw FROM t;', "SELECT dblink_exec('x', 'drop table t');", "SELECT net.http_post('https://x', '{}');", "SELECT cron.schedule('j', '* * * * *', 'SELECT 1');",
    'SELECT pg_terminate_backend(1);', "SELECT pg_read_file('x');", "SET standard_conforming_strings = off; SELECT 'a\\''; DROP TABLE x; SELECT '", 'SET backslash_quote = on;', '', ';', '-- alleen commentaar', 'BEGIN; DROP TABLE x; COMMIT;'];
  alleC(slecht);
  // het scannen faalt gesloten
  const eenS = String.fromCharCode(0xE000);
  alleC(["SELECT E'a\\'b'; DROP TABLE x;", "INSERT INTO a (b) VALUES (E'it\\'s fine');", "SELECT 'a\\nb'", 'SELECT $q$ x; DROP TABLE y;', '/* open DROP TABLE x;', 'SELECT 1 /* open', "SELECT 'open", 'SELECT "open', 'SELECT $ ; DROP TABLE x', 'U&"a" ', "INSERT INTO a (b) VALUES (U&'x')", 'SELECT ' + eenS]);
  assert.equal(scanSql('SELECT 1 -- x\n').ok, true); assert.equal(scanSql('SELECT $1, $a$ x $a$').ok, true); assert.equal(scanSql('SELECT /* a /* geneste */ b */ 1').ok, true);
  // commentaar en tekst verbergen niets, en tekst met streepjes blijft tekst
  assert.equal(k("INSERT INTO a (b) VALUES ('--'); INSERT INTO a (b) VALUES ('/*');"), 'B'); assert.equal(k("SELECT '--';\nDROP TABLE t;\nSELECT '--'"), 'C'); assert.equal(k("SELECT '/*'; DROP TABLE t; SELECT '*/'"), 'C'); assert.equal(k('SELECT 1; /* a /* geneste */ b */ DROP TABLE t;'), 'C');
  // execute_sql: alleen één SELECT/EXPLAIN/VALUES/WITH (SHOW niet, RF01) met uitsluitend zuivere functies is read
  for (const s of ['SELECT 1', "SELECT 'gewone tekst' AS x", 'SELECT $1', "SELECT 'a--b' AS x", 'SELECT count(*) FROM t WHERE x > 1', 'SELECT lower(a), now(), coalesce(b, 0) FROM t ORDER BY 1', 'SELECT jsonb_agg(x) FROM t WHERE y IN (1, 2)', 'SELECT * FROM (SELECT 1) AS s', 'SELECT "a" FROM "t"', 'VALUES (1), (2)', 'EXPLAIN SELECT 1', 'WITH x AS (SELECT 1) SELECT * FROM x', 'SELECT * FROM generate_series(1, 3)']) assert.equal(lvl(s), 'read', s);
  for (const s of ['UPDATE t SET a = 1 WHERE id = 2', 'INSERT INTO t (a) VALUES (1)', 'DROP TABLE t', 'SELECT * FROM t FOR UPDATE', 'WITH x AS (DELETE FROM t RETURNING *) SELECT * FROM x', 'EXPLAIN ANALYZE SELECT 1', 'SELECT * INTO n FROM t', "SELECT 'a' || E'b'", 'SELECT 1 /* open', 'CREATE TABLE a (id int)', 'DO $$ BEGIN NULL; END $$']) assert.equal(lvl(s), 'change', s);
  assert.equal(lvl('SELECT 1; DROP TABLE x'), 'sensitive'); assert.equal(lvl(''), 'blocked'); assert.equal(lvl('   '), 'blocked');
});
test('RE03 het SQL-gedeelte blijft klein: de classificatie staat in één bestand met een bovengrens van regels en kent geen functiebody-scan of naamadministratie meer', () => {
  const bron = fs.readFileSync(new URL('../runtime/sql.mjs', import.meta.url), 'utf8');
  assert.ok(bron.split('\n').length <= MAX_REGELS, 'sql.mjs heeft ' + bron.split('\n').length + ' regels (grens ' + MAX_REGELS + ')');
  for (const woord of ['bodyKlasse', 'funcSleutel', 'FN_DEF', 'normalize(', 'ESCALATIE', 'fns.']) assert.ok(!bron.includes(woord), 'oude uitzonderingslogica terug: ' + woord);
  const integr = fs.readFileSync(new URL('../runtime/integrations.mjs', import.meta.url), 'utf8');
  assert.ok(integr.split('\n').length < 100 && !/\bscanSql\b/.test(integr), 'integrations.mjs bevat geen SQL-logica meer');
});

// ---------------------------------------------------------------- de scenario's van eerdere rondes, nu als tabel (RB01-RB04, RD01)
test('RB01 U&-identifiers, E-strings, het zoekpad en een sleutelwoord als alias omzeilen de SQL-regels niet (reviewscenario van 5e64919)', () => {
  alleC(['INSERT INTO U&"a\\0075th".users (id) VALUES (1)', 'UPDATE U&"a\\0075th".users SET x = 1 WHERE id = 1', "SELECT U&\"d\\0062link_exec\"('c', 'DROP TABLE x')", "SELECT U&'abc'", 'DELETE FROM U&"t"',
    'SET search_path = auth; INSERT INTO users (id) VALUES (1)', 'SET LOCAL search_path TO auth, public; UPDATE users SET a = 1 WHERE id = 1', "SELECT set_config('search_path', 'auth', false); INSERT INTO users (id) VALUES (1)", 'UPDATE t AS "where" SET x = 1']);
  nooitRead(['SELECT * FROM U&"a\\0075th".users', "SELECT U&\"d\\0062link_exec\"('c', 'x')", 'SELECT u&"x" FROM t', "SELECT set_config('search_path','auth',false)"]);
  assert.equal(classifyExternalCall('mcp__supabase__execute_sql', {query: 'SELECT * FROM U&"a\\0075th".users'}).level, 'change');
  assert.equal(k('UPDATE t SET x = 1 WHERE id = 2'), 'B', 'een echte WHERE blijft B');
});
test('RB02 cron.schedule, net.http_* en vergelijkbare functies gaan nooit als read-only door (ook niet vóór de GO) en zijn in een migratie C', () => {
  const cron = "SELECT cron.schedule('j','* * * * *','DELETE FROM klanten')", net = "SELECT net.http_post(url := 'https://x.example', body := '{}'::jsonb)";
  for (const s of [cron, net, "SELECT cron.unschedule('j')", "SELECT http_get('https://x.example')", 'SELECT supabase_functions.http_request()', 'SELECT pg_temp.f()', 'SELECT public.f()', 'SELECT version()', 'SELECT mijn_functie(1)']) assert.equal(lvl(s), 'change', s);
  alleC([cron, net, "SELECT cron.schedule('j','* * * * *','SELECT 1')", "SELECT http_post('https://x', 'a')", "COPY klanten TO '/tmp/x.csv'", "COPY klanten FROM '/tmp/x.csv'", "SELECT dblink_exec('x', 'drop table t')", 'SELECT lo_unlink(1)', "SELECT pg_read_file('x')", 'SELECT pg_advisory_lock(1)', 'SELECT pg_sleep(5)', 'SELECT lastval()']);
  nooitRead(["SELECT dblink_exec('x', 'drop table t')", 'SELECT lo_unlink(1)', "SELECT pg_read_file('x')", "SELECT pg_ls_dir('.')", 'SELECT * INTO nieuw FROM t', 'SELECT pg_advisory_lock(1)', 'SELECT pg_sleep(5)', 'SELECT lastval()', 'SELECT nextval(\'s\')']);
});
test('RB02 het reviewscenario vóór de GO: een cron- of net-aanroep via execute_sql wordt in PLANNING en WAITING_FOR_APPROVAL geweigerd', () => {
  const root = fixture();
  try {
    const REF = 'abcdefghij', BUDGET = {agent_calls: {soft: 1, hard: 2}, command_runs: 20, external_calls: 4, max_parallel: 1};
    plan(root, {envelope: {providers: {supabase: {project_ref: REF, tools: ['get_project_url', 'execute_sql'], max_calls: 4}}, db_max: 'A', budgets: BUDGET}});
    assert.equal(st(root).status, 'WAITING_FOR_APPROVAL');
    for (const [id, query] of [['c1', "SELECT cron.schedule('j','* * * * *','DELETE FROM klanten')"], ['c2', "SELECT net.http_post(url := 'https://x.example', body := '{}'::jsonb)"]]) {
      const e = denies(() => pre(root, 'mcp__supabase__execute_sql', {query, project_id: REF}, {tool_use_id: id}));
      assert.match(e.message, /werkpakket in uitvoering|Muterende execute_sql/);
    }
  } finally { cleanup(root); }
});
test('RB03 een functie met destructieve SQL en een latere aanroep, in elke vorm, is nooit lager dan C (reviewscenario pg_temp.f() en public.f()); een onbekende aanroep is nooit read', () => {
  const f = 'CREATE FUNCTION pg_temp.f() RETURNS void LANGUAGE sql AS $$ DELETE FROM klanten $$;';
  alleC([f, f + ' SELECT pg_temp.f();', 'SELECT pg_temp.f();', 'CREATE FUNCTION wis() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN DELETE FROM log; RETURN NEW; END; $$; CREATE TRIGGER t AFTER INSERT ON a FOR EACH ROW EXECUTE FUNCTION wis();',
    "CREATE FUNCTION a1() RETURNS int LANGUAGE sql AS $$ SELECT net.http_get('https://x') $$;", "CREATE FUNCTION a2() RETURNS void LANGUAGE plpgsql AS $$ BEGIN EXECUTE 'drop table x'; END; $$;", 'CREATE FUNCTION a3() RETURNS void LANGUAGE plpgsql AS $$ BEGIN UPDATE t SET a = 1; END; $$;',
    'CREATE FUNCTION public.f() RETURNS int LANGUAGE sql AS $$ SELECT 1 $$;', 'CREATE FUNCTION g() RETURNS void LANGUAGE plpgsql AS $$ BEGIN INSERT INTO log VALUES (now()); END; $$;',
    'ALTER TABLE t ADD COLUMN x int DEFAULT public.vreemd();', 'CREATE TABLE t2 AS SELECT public.vreemd() AS x;', 'INSERT INTO a (b) SELECT public.vreemd()', 'INSERT INTO a (b) VALUES (public.vreemd())']);
  assert.equal(classifyExternalCall('mcp__supabase__apply_migration', {name: 'x', query: f + ' SELECT pg_temp.f();'}).db, 'C');
  assert.equal(lvl('SELECT public.f()'), 'change', 'een gebruikersfunctie is nooit read-only');
  assert.equal(k('ALTER TABLE t ADD COLUMN gemaakt timestamptz DEFAULT now();'), 'A'); assert.equal(k("CREATE TABLE t3 (id uuid DEFAULT gen_random_uuid(), tekst text DEFAULT 'a', n int DEFAULT (1 + 2));"), 'A');
});
test('RB04 BYPASSRLS, SUPERUSER, NO FORCE ROW LEVEL SECURITY en vergelijkbare RLS- en auth-escalaties zijn DB-C', () => {
  alleC(['ALTER ROLE authenticated BYPASSRLS', 'ALTER ROLE authenticator SUPERUSER', 'CREATE ROLE evil LOGIN BYPASSRLS', 'ALTER TABLE klanten NO FORCE ROW LEVEL SECURITY', 'CREATE ROLE x CREATEROLE', 'ALTER ROLE x REPLICATION', 'DROP ROLE x', 'CREATE USER u',
    'SET ROLE postgres', 'SET SESSION AUTHORIZATION postgres', 'ALTER TABLE t OWNER TO postgres', 'ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon', 'GRANT postgres TO authenticated',
    'GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO anon', 'GRANT ALL ON t TO PUBLIC', 'CREATE POLICY p ON t FOR ALL TO anon USING (true) WITH CHECK (true)', 'ALTER POLICY p ON t USING (true)']);
  assert.equal(k('ALTER TABLE a ENABLE ROW LEVEL SECURITY;'), 'A'); assert.equal(k('GRANT SELECT ON a TO x;'), 'B'); assert.equal(k('CREATE POLICY p ON a FOR SELECT USING (b = current_user);'), 'B');
});
test('RD01 niet-ASCII en geciteerde functienamen vallen niet buiten de classificatie (reviewscenario van 5ba1e59: public.é() en "Max"(1))', () => {
  const f = 'CREATE FUNCTION public.é() RETURNS void LANGUAGE sql AS $$ DELETE FROM tasks $$;';
  alleC([f, f + ' SELECT public.é();', f + ' SELECT é();', 'SELECT public.é();', 'SELECT é();', 'SELECT "Max"(1);', 'SELECT public."é"();']);
  nooitRead(['SELECT public.é()', 'SELECT é()', 'SELECT public."é"()', 'SELECT 日本語()', 'SELECT données.f()', 'SELECT ü(1)', 'SELECT "Max"(1)', 'SELECT "max"(1)', 'SELECT "count"(*) FROM t', 'SELECT public."Max"(x) FROM t', 'SELECT "Max" /* verborgen */ (1)', 'SELECT "Max" -- verborgen\n (1)',
    'SELECT m' + CYR_A + 'x(1)', 'SELECT ' + FULL_M + 'ax(1)', 'SELECT 😀()']);
  for (const s of ['SELECT max(1)', 'SELECT Max(x) FROM t', 'SELECT COUNT(*) FROM t', "SELECT lower(a) FROM t WHERE b = 'x'", 'SELECT * FROM "Max"']) assert.equal(lvl(s), 'read', s);
});

// ---------------------------------------------------------------- RF01: gevoelige database-informatie (reviewscenario van b4f39b7, letterlijk)
test('RF01 een naam die met pg_ begint is nooit zuiver, zonder of met quotes, in elke hoofdletterstand en schema; SHOW is geen vrije read', () => {
  const rel = ['pg_shadow', 'pg_authid', 'pg_stat_activity', 'pg_settings', 'pg_user_mapping', 'pg_roles'];
  for (const r of rel) for (const naam of [r, '"' + r + '"', r.toUpperCase(), '"' + r.toUpperCase() + '"', 'pg_catalog.' + r, 'public."' + r + '"', '"pg_catalog"."' + r + '"', 'Pg_' + r.slice(3)]) {
    const s = 'SELECT * FROM ' + naam;
    assert.equal(lvl(s), 'change', s); assert.equal(k(s), 'C', s);
    assert.equal(k('CREATE TABLE a (id int); ' + s), 'C', s); assert.equal(k('CREATE VIEW v AS ' + s), 'C', s);
  }
  for (const s of ['SHOW ALL', 'show all', 'SHOW search_path', 'SHOW "all"', 'SHOW transaction_isolation']) { assert.equal(lvl(s), 'change', s); assert.equal(k(s), 'C', s); }
  assert.equal(lvl('SELECT 1; SELECT * FROM "pg_shadow"'), 'sensitive');
  // gewone leesvormen blijven read; een geciteerde naam zonder pg_ is geen pg_-naam
  for (const s of ['SELECT * FROM "pgtasks"', 'SELECT * FROM tasks WHERE a = \'pg_shadow\'', 'SELECT 1 -- pg_shadow', 'SELECT * FROM "tasks"']) assert.equal(lvl(s), 'read', s);
});

// ---------------------------------------------------------------- mutatiecorpus
// Gevaarlijke basisstatements; elke mutatie hiervan moet C blijven (migratie) en nooit read-only zijn (execute_sql). Een nieuwe vondst van een reviewer is een regel in BASIS of MUTATIES.
const BASIS = ['DELETE FROM tasks', 'TRUNCATE tasks', 'DROP TABLE tasks', 'UPDATE tasks SET a = 1', 'ALTER TABLE tasks DROP COLUMN a', 'ALTER TABLE tasks DISABLE ROW LEVEL SECURITY', "SELECT cron.schedule('j', '* * * * *', 'DELETE FROM tasks')", "SELECT net.http_post('https://x', '{}')",
  'ALTER ROLE authenticated BYPASSRLS', 'CREATE POLICY p ON tasks USING (true)', 'SET search_path = auth', "COPY tasks TO '/tmp/x'", 'DO $$ BEGIN DELETE FROM tasks; END $$', WIPE.slice(0, -1), REDEF.slice(0, -1), 'SELECT public.wipe()', 'CALL wipe()',
  'CREATE TRIGGER t AFTER INSERT ON tasks FOR EACH ROW EXECUTE FUNCTION wipe()', 'SELECT * FROM pg_shadow', 'SELECT * FROM auth.users', 'INSERT INTO auth.users (id) VALUES (1)', 'GRANT ALL ON tasks TO anon', 'SELECT wipe(1, 2)', 'WITH x AS (DELETE FROM tasks RETURNING 1) SELECT * FROM x',
  'SELECT * FROM "pg_shadow"', 'SELECT * FROM "pg_authid"', 'SELECT * FROM "pg_stat_activity"', 'SELECT * FROM "pg_settings"', 'SHOW ALL', 'SHOW search_path']; // laatste regel: reviewscenario van b4f39b7 (RF01)
const MUTATIES = {
  identiek: s => s, hoofdletters: s => s.toUpperCase(), kleine_letters: s => s.toLowerCase(), commentaar_overal: s => s.replace(/ /g, ' /* x */ '), regelcommentaar: s => s.replace(/ /g, ' -- x\n '), nieuwe_regels: s => s.replace(/ /g, '\n\t'), dubbele_spaties: s => s.replace(/ /g, '   '),
  voorafgaande_puntkomma: s => ';' + s, afgesloten: s => s + ';', na_een_onschuldig_statement: s => 'CREATE TABLE a (id int); ' + s, voor_een_onschuldig_statement: s => s + '; CREATE TABLE b (id int)', in_een_transactie: s => 'BEGIN; ' + s + '; COMMIT',
  geciteerde_namen: s => s.replace(/\b(tasks|wipe)\b/g, '"$1"'), unicode_namen: s => s.replace(/\bwipe\b/g, 'wîpe').replace(/\btasks\b/g, 'täsks'), ander_schema: s => s.replace(/public\.wipe/g, 'andere.wipe'), schema_voor_naam: s => s.replace(/\bwipe\(/g, 'x.wipe('),
  u_ampersand: s => s.replace(/\btasks\b/, 'U&"tasks"'), dollar_tag: s => s.replace(/\$\$/g, '$tag$'), dubbele_definitie_ervoor: s => REDEF + ' ' + s, onschuldige_definitie_erna: s => s + '; ' + REDEF, overload_erbij: s => 'CREATE FUNCTION public.wipe(a int) RETURNS void LANGUAGE sql AS $$ SELECT 1 $$; ' + s
};
test('mutatiecorpus: elke gevaarlijke basis blijft in elke mutatie C (migratie) en nooit read-only (execute_sql)', () => {
  let n = 0;
  for (const basis of BASIS) for (const [naam, muteer] of Object.entries(MUTATIES)) {
    const s = muteer(basis); n++;
    assert.equal(k(s), 'C', naam + ': ' + s); assert.notEqual(lvl(s), 'read', naam + ': ' + s);
  }
  assert.ok(n > 400, 'het corpus is groot genoeg: ' + n);
});
test('mutatiecorpus: de mutaties maken onschuldige SQL niet onnodig gevaarlijk (precisie): een gewone tabel blijft A, in elke schrijfwijze', () => {
  for (const [naam, muteer] of Object.entries({identiek: s => s, hoofdletters: s => s.toUpperCase(), commentaar_overal: s => s.replace(/ /g, ' /* x */ '), nieuwe_regels: s => s.replace(/ /g, '\n\t'), geciteerde_namen: s => s.replace(/\btasks\b/g, '"tasks"'), unicode_namen: s => s.replace(/\btasks\b/g, 'täsks'), afgesloten: s => s + ';', transactie: s => 'BEGIN; ' + s + '; COMMIT'}))
    assert.equal(k(muteer('CREATE TABLE tasks (id int, title text)')), 'A', naam);
});
