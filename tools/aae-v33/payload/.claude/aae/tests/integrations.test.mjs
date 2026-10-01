// Externe integraties en database-klassen (pariteit met I01-I22; DB-A/B/C vervangt de aparte gevoelige GO).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fixture, cleanup, contract, plan, executing, st, prompt, hook, pre, denies, agentCall, put} from './helpers.mjs';
import {validateContract, materialChanges} from '../runtime/core.mjs';
import {classifyDb, classifySql, classifyExternalCall, identifyExternalTool, projectRefFromResponse} from '../runtime/integrations.mjs';

const REF = 'abcdefghij';
const BUDGET = n => ({agent_calls: {soft: 1, hard: 2}, command_runs: 20, external_calls: n, max_parallel: 1});
const prov = (tools = ['get_project_url', 'list_tables', 'execute_sql', 'apply_migration'], max = 10) => ({supabase: {project_ref: REF, tools, max_calls: max}});
const met = fn => async () => { const root = fixture(); try { await fn(root); } finally { cleanup(root); } };
const msg = fn => { const e = denies(fn); assert.ok(e, 'verwacht een weigering'); return e.message; };
let teller = 0;
const probe = (root, ref = REF) => {
  const id = 'probe-' + (++teller);
  pre(root, 'mcp__supabase__get_project_url', {}, {tool_use_id: id});
  hook(root, {hook_event_name: 'PostToolUse', tool_name: 'mcp__supabase__get_project_url', tool_use_id: id, tool_input: {}, tool_response: {content: [{type: 'text', text: 'https://' + ref + '.supabase.co'}]}});
};
/** Voert één externe toolaanroep volledig uit (reservering + afronding). */
const ext = (root, tool, input, response = {content: [{type: 'text', text: 'ok'}]}) => {
  const id = 'x-' + (++teller);
  const r = pre(root, 'mcp__supabase__' + tool, input, {tool_use_id: id});
  hook(root, {hook_event_name: 'PostToolUse', tool_name: 'mcp__supabase__' + tool, tool_use_id: id, tool_input: input, tool_response: response});
  return r;
};
const run = (root, over = {}) => { probe(root); return executing(root, {envelope: {providers: prov(), db_max: 'A', budgets: BUDGET(10)}, ...over}); };

test('I01 get_project_url is de enige begrensde Supabase-probe vóór een werkpakket', met(root => {
  probe(root);
  assert.equal(JSON.parse(fs.readFileSync(path.join(root, '.claude/aae/state/global.json'), 'utf8')).supabase_probe.ref, REF);
  assert.match(msg(() => pre(root, 'mcp__supabase__list_tables', {}, {tool_use_id: 'z1'})), /Maak eerst een werkpakket/);
  assert.match(msg(() => pre(root, 'mcp__supabase__execute_sql', {query: 'SELECT 1'}, {tool_use_id: 'z2'})), /Maak eerst een werkpakket/);
}));
test('I02 een bekende alleen-lezen Supabase-tool is toegestaan binnen een actief werkpakket', met(root => {
  run(root);
  assert.equal(ext(root, 'list_tables', {project_id: REF}), null);
  assert.equal(st(root).usage.external, 1);
}));
test('I03 een onbekende Supabase-tool blijft geblokkeerd', met(root => {
  run(root);
  assert.match(msg(() => pre(root, 'mcp__supabase__delete_project', {}, {tool_use_id: 'q1'})), /niet door AAE/);
  assert.match(msg(() => pre(root, 'mcp__supabase__pause_project', {}, {tool_use_id: 'q2'})), /niet door AAE/);
}));
test('I04 SELECT via execute_sql is toegestaan en het bewijs bewaart geen ruw resultaat', met(root => {
  run(root);
  ext(root, 'execute_sql', {query: 'SELECT 1', project_id: REF}, {content: [{type: 'text', text: 'GEHEIM-RESULTAAT-123'}]});
  const ontvangst = st(root).external_receipts.at(-1);
  const inhoud = fs.readFileSync(path.join(root, ontvangst.evidence_path), 'utf8');
  assert.ok(!inhoud.includes('GEHEIM-RESULTAAT-123'));
  assert.match(ontvangst.result_digest, /^[0-9a-f]{64}$/);
}));
test('I05 een UPDATE via execute_sql kan niet als gewone lees- of wijzigactie draaien', met(root => {
  run(root);
  assert.match(msg(() => pre(root, 'mcp__supabase__execute_sql', {query: 'UPDATE t SET a = 1 WHERE id = 2', project_id: REF}, {tool_use_id: 'u1'})), /Muterende execute_sql/);
}));
test('I06 apply_migration is geblokkeerd vóór de GO en toegestaan daarna', met(root => {
  probe(root);
  plan(root, {envelope: {providers: prov(), db_max: 'A', budgets: BUDGET(10)}});
  const call = {name: 'nieuwe_tabel', query: 'CREATE TABLE notities (id int);', project_id: REF};
  assert.match(msg(() => pre(root, 'mcp__supabase__apply_migration', call, {tool_use_id: 'm1'})), /vereist een werkpakket in uitvoering/);
  prompt(root, 'AAE GO');
  assert.equal(ext(root, 'apply_migration', call), null);
}));
test('I07 het externe toolbudget staat los van het agentbudget', met(root => {
  run(root, {envelope: {providers: prov(), db_max: 'A', budgets: {agent_calls: {soft: 0, hard: 0}, command_runs: 20, external_calls: 10, max_parallel: 1}}});
  ext(root, 'list_tables', {project_id: REF}); ext(root, 'list_tables', {project_id: REF});
  assert.equal(st(root).usage.external, 2); assert.equal(st(root).usage.agents, 0);
  assert.match(msg(() => agentCall(root)), /Hard agentplafond/);
}));
test('I08 een verkeerde Supabase-projectverwijzing in de invoer wordt geblokkeerd', met(root => {
  run(root);
  assert.match(msg(() => pre(root, 'mcp__supabase__list_tables', {project_id: 'anderproject'}, {tool_use_id: 'w1'})), /ander project/);
}));
test('I09 een mislukte Supabase-aanroep verbruikt budget maar start geen herstelagents', met(root => {
  run(root);
  pre(root, 'mcp__supabase__list_tables', {project_id: REF}, {tool_use_id: 'f1'});
  hook(root, {hook_event_name: 'PostToolUseFailure', tool_name: 'mcp__supabase__list_tables', tool_use_id: 'f1', tool_input: {}, error: 'time-out'});
  assert.equal(st(root).usage.external, 1); assert.equal(st(root).usage.agents, 0);
  assert.equal(st(root).external_calls.f1.status, 'failed');
}));
test('I10 vervanger voor de aparte gevoelige GO: klasse B past alleen als de envelop B toestaat; klasse C vraagt altijd AAE BEVESTIG', met(root => {
  run(root);
  assert.match(msg(() => pre(root, 'mcp__supabase__apply_migration', {name: 'backfill', query: 'UPDATE notities SET a = 1 WHERE id = 2;', project_id: REF}, {tool_use_id: 'b1'})), /database-klasse B/);
  const root2 = fixture();
  try {
    probe(root2);
    executing(root2, {envelope: {providers: prov(), db_max: 'B', budgets: BUDGET(10)}});
    assert.equal(ext(root2, 'apply_migration', {name: 'backfill', query: 'UPDATE notities SET a = 1 WHERE id = 2;', project_id: REF}), null);
    assert.match(msg(() => pre(root2, 'mcp__supabase__apply_migration', {name: 'weg', query: 'DROP TABLE notities;', project_id: REF}, {tool_use_id: 'c1'})), /AAE BEVESTIG/);
  } finally { cleanup(root2); }
}));
test('I11 ToolSearch is toegestaan voor de hoofdsessie maar niet voor specialisten', met(root => {
  executing(root);
  assert.equal(pre(root, 'ToolSearch', {query: 'x'}), null);
  assert.match(msg(() => pre(root, 'ToolSearch', {query: 'x'}, {agent_id: 'sub00001', agent_type: 'aae-reviewer'})), /read-only/);
}));
test('I12 GitHub: PR-aanmaak is aan de envelop gebonden, lezen is vrij en samenvoegen blijft geblokkeerd zonder capability', met(root => {
  assert.equal(pre(root, 'mcp__github__get_file_contents', {path: 'README.md'}), null);
  assert.match(msg(() => pre(root, 'mcp__github__create_pull_request', {base: 'main', head: 'claude/w', title: 'x'}, {tool_use_id: 'g0'})), /Maak eerst een werkpakket met github/);
  assert.match(msg(() => pre(root, 'mcp__github__push_files', {}, {tool_use_id: 'g9'})), /niet toegestaan/);
  executing(root, {envelope: {providers: {github: {tools: ['create_pull_request'], max_calls: 2, base: 'main', head: 'claude/w'}}, budgets: BUDGET(2)}});
  assert.equal(pre(root, 'mcp__github__create_pull_request', {base: 'main', head: 'claude/w', title: 'x'}, {tool_use_id: 'g1'}), null);
  hook(root, {hook_event_name: 'PostToolUse', tool_name: 'mcp__github__create_pull_request', tool_use_id: 'g1', tool_input: {}, tool_response: {}});
  assert.match(msg(() => pre(root, 'mcp__github__merge_pull_request', {pullNumber: 1}, {tool_use_id: 'g2'})), /staat niet in de goedgekeurde envelop/);
}));
test('I13 de vlag "migration" maakt een pakket niet automatisch HIGH', () => {
  const c = contract({risk_flags: ['migration']}); c.plan.test_plan.push(...['migration', 'rollback', 'data-preservation'].map(kind => ({kind, method: 'inspection', description: 'Beschrijf de controle van ' + kind + '.'})));
  assert.equal(validateContract(structuredClone(c)).risk_class, 'STANDARD');
});
test('I14 de SQL-classificatie weigert bijwerkingen in SELECT en meerdere statements', () => {
  assert.equal(classifySql('SELECT 1').level, 'read');
  assert.equal(classifySql('SELECT 1; DROP TABLE x').level, 'sensitive');
  for (const s of ['SELECT * FROM t FOR UPDATE', 'SELECT pg_terminate_backend(1)', "SELECT set_config('a','b',false)", 'WITH x AS (DELETE FROM t RETURNING *) SELECT * FROM x', 'SELECT nextval(\'s\')', 'SELECT * FROM auth.users'])
    assert.equal(classifySql(s).level, 'change', s);
  assert.equal(classifySql('').level, 'blocked');
});
test('I15 DML in een functielichaam wordt niet aangezien voor een directe DELETE', () => {
  const f = 'CREATE OR REPLACE FUNCTION opruim() RETURNS void LANGUAGE plpgsql AS $$ BEGIN DELETE FROM oud; END; $$;';
  assert.equal(classifyDb(f).klasse, 'A');
  assert.equal(classifyDb('CREATE FUNCTION f() RETURNS int LANGUAGE sql SECURITY DEFINER AS $$ SELECT 1 $$;').klasse, 'B');
  assert.equal(classifyDb('DELETE FROM oud;').klasse, 'C');
});
test('I16 een gewoon bericht mag opnieuw proben zonder een oud werkpakket te heractiveren', met(root => {
  probe(root); prompt(root, 'Vervolgvraag zonder commando'); probe(root);
  assert.equal(fs.readdirSync(path.join(root, 'docs/aae/work')).length, 0);
}));
test('I17 de Supabase-verificatie hoort bij het werkpakket en overleeft vervolgberichten (R10)', met(root => {
  run(root);
  assert.equal(st(root).supabase_verified.ref, REF);
  prompt(root, 'Een vervolgbericht'); prompt(root, 'Nog een bericht');
  assert.equal(st(root).supabase_verified.ref, REF);
  assert.equal(ext(root, 'list_tables', {project_id: REF}), null);
}));
test('I18 apply_migration faalt gesloten zonder expliciete naam of SQL', met(root => {
  run(root);
  assert.match(msg(() => pre(root, 'mcp__supabase__apply_migration', {query: 'CREATE TABLE x (id int);', project_id: REF}, {tool_use_id: 'n1'})), /migratienaam/);
  assert.match(msg(() => pre(root, 'mcp__supabase__apply_migration', {name: 'leeg', project_id: REF}, {tool_use_id: 'n2'})), /migratie-SQL/);
}));
test('I19 PR-aanmaak vereist een expliciete, passende base en head', met(root => {
  executing(root, {envelope: {providers: {github: {tools: ['create_pull_request'], max_calls: 3, base: 'main', head: 'claude/w'}}, budgets: BUDGET(3)}});
  assert.match(msg(() => pre(root, 'mcp__github__create_pull_request', {head: 'claude/w'}, {tool_use_id: 'a1'})), /expliciete base/);
  assert.match(msg(() => pre(root, 'mcp__github__create_pull_request', {base: 'main'}, {tool_use_id: 'a2'})), /expliciete head/);
  assert.match(msg(() => pre(root, 'mcp__github__create_pull_request', {base: 'develop', head: 'claude/w'}, {tool_use_id: 'a3'})), /PR-base wijkt af/);
}));
test('I20 een bevestiging (AAE BEVESTIG) overleeft een vervolgbericht niet (R8)', met(root => {
  run(root, {envelope: {providers: prov(), db_max: 'B', budgets: BUDGET(10)}});
  const call = {name: 'weg', query: 'DROP TABLE notities;', project_id: REF};
  assert.match(msg(() => pre(root, 'mcp__supabase__apply_migration', call, {tool_use_id: 'd1'})), /AAE BEVESTIG/);
  prompt(root, 'AAE BEVESTIG'); prompt(root, 'een gewoon vervolgbericht');
  assert.equal(st(root).confirmed, null);
  assert.match(msg(() => pre(root, 'mcp__supabase__apply_migration', call, {tool_use_id: 'd2'})), /AAE BEVESTIG/, 'opnieuw bevestigen is nodig');
}));
test('I21 een geplande niet-destructieve migratie blijft werken na vervolgberichten onder dezelfde GO (R8)', met(root => {
  run(root);
  prompt(root, 'vervolg'); prompt(root, 'vervolg 2');
  assert.equal(ext(root, 'apply_migration', {name: 'nieuwe_tabel', query: 'CREATE TABLE notities (id int);', project_id: REF}), null);
}));
test('I22 het verbreden van de Supabase-integratie is een wezenlijke wijziging', () => {
  const a = validateContract(structuredClone(contract({envelope: {providers: prov(['get_project_url', 'list_tables'], 5), budgets: BUDGET(5)}})));
  const b = validateContract(structuredClone(contract({envelope: {providers: prov(['get_project_url', 'list_tables', 'execute_sql'], 5), budgets: BUDGET(5)}})));
  const c = validateContract(structuredClone(contract({envelope: {providers: {supabase: {project_ref: 'anderproject', tools: ['get_project_url'], max_calls: 5}}, budgets: BUDGET(5)}})));
  assert.ok(materialChanges(a, b).includes('provider supabase'));
  assert.ok(materialChanges(a, c).includes('provider supabase'));
  assert.deepEqual(materialChanges(b, a), []);
});

test('DB-klassen: A (additief), B (middel), C (destructief) op echte SQL; onbekend is nooit stilzwijgend A', () => {
  const k = s => classifyDb(s).klasse;
  for (const s of ['CREATE TABLE a (id int);', 'ALTER TABLE a ADD COLUMN b text;', 'CREATE INDEX i ON a (b);', 'ALTER TABLE a ENABLE ROW LEVEL SECURITY;']) assert.equal(k(s), 'A', s);
  for (const s of ['CREATE POLICY p ON a FOR SELECT USING (true);', 'UPDATE a SET b = 1 WHERE id = 1;', 'ALTER TABLE a ADD CONSTRAINT c UNIQUE (b);', 'GRANT SELECT ON a TO x;', 'ALTER TABLE a ALTER COLUMN b SET NOT NULL;', "SELECT cron.schedule('j','* * * * *','SELECT 1');", 'ALTER TABLE a RENAME TO b;', 'VACUUM a;']) assert.equal(k(s), 'B', s);
  for (const s of ['DROP TABLE a;', 'TRUNCATE a;', 'DELETE FROM a;', 'UPDATE a SET b = 1;', 'ALTER TABLE a DISABLE ROW LEVEL SECURITY;', 'ALTER TABLE a ALTER COLUMN b TYPE int;', "INSERT INTO auth.users (id) VALUES (1);", 'ALTER TABLE a DROP COLUMN b;', '']) assert.equal(k(s), 'C', s);
  assert.equal(k('CREATE TABLE a (id int); DROP TABLE b;'), 'C', 'de hoogste klasse van alle statements telt');
});
test('DB-klassen (review): DO-blokken, EXECUTE, CALL en E-strings kunnen een destructieve stap niet als A of B verbergen', () => {
  const k = s => classifyDb(s).klasse;
  for (const s of ['DO $$ BEGIN DROP TABLE x; END $$;', "DO $f$ BEGIN EXECUTE 'drop table x'; END $f$;", "DO LANGUAGE plpgsql $$ BEGIN DELETE FROM x; END $$;", "EXECUTE 'drop table x';", 'CALL opruimen();', "COPY x FROM PROGRAM 'rm -rf /';", 'ALTER SYSTEM SET x = 1;',
    "SELECT E'a\\'b'; DROP TABLE x;", "SELECT 'a' || 'b; DROP TABLE x;", 'SELECT $q$ x; DROP TABLE y;', '/* open DROP TABLE x;']) assert.equal(k(s), 'C', s);
  assert.equal(k("CREATE TRIGGER t AFTER INSERT ON a FOR EACH ROW EXECUTE FUNCTION f();"), 'B', 'EXECUTE FUNCTION is een gewone trigger');
  assert.equal(k("INSERT INTO a (b) VALUES (E'it\\'s fine');"), 'A', 'een gewone E-string blijft leesbaar');
});
test('DB-klassen (review ronde 3): een string die op commentaar lijkt, verbergt geen destructief statement; WITH/MERGE met DELETE is C', () => {
  const k = s => classifyDb(s).klasse;
  for (const s of ["SELECT '--';\nDROP TABLE t;\nSELECT '--'", "SELECT '/*'; DROP TABLE t; SELECT '*/'", "SELECT '--', 1; DROP TABLE t; -- x", 'SELECT 1; /* a /* geneste */ b */ DROP TABLE t;',
    'WITH x AS (DELETE FROM t RETURNING 1) SELECT 1', 'MERGE INTO t USING s ON true WHEN MATCHED THEN DELETE', 'WITH x AS (UPDATE t SET a = 1 RETURNING 1) SELECT * FROM x']) assert.equal(k(s), 'C', s);
  assert.equal(k("INSERT INTO a (b) VALUES ('--'); INSERT INTO a (b) VALUES ('/*');"), 'A', 'strings met streepjes of sterretjes blijven gewoon strings');
  for (const s of ["SELECT '--';\nDROP TABLE t;\nSELECT '--'", "SELECT '/*'; DROP TABLE t; SELECT '*/'", "SELECT 1 /* open", "SELECT 'open"]) assert.notEqual(classifySql(s).level, 'read', s);
  assert.equal(classifySql("SELECT 'a--b' AS x").level, 'read'); assert.equal(classifySql('SELECT $1').level, 'read');
});
test('DB-klassen (review ronde 4): niet-ASCII $-tags en identifiers, EXPLAIN ANALYZE, upserts en functies met bijwerkingen', () => {
  const k = s => classifyDb(s).klasse;
  for (const s of ["SELECT $é$ ' $é$; DROP TABLE x; SELECT $é$ ' $é$", 'SELECT é$a$; DROP TABLE x; SELECT é$a$', 'SELECT $ ; DROP TABLE x', 'EXPLAIN ANALYZE DELETE FROM t', 'EXPLAIN ANALYZE UPDATE t SET a = 1', "SELECT dblink_exec('x', 'drop table t')", 'TRUNCATE t, u;'])
    assert.equal(k(s), 'C', s);
  for (const s of ["SELECT $é$ ' $é$; DROP TABLE x; SELECT $é$ ' $é$", 'SELECT é$a$; DROP TABLE x; SELECT é$a$', 'SELECT $ ; DROP TABLE x']) assert.notEqual(classifySql(s).level, 'read', s);
  assert.equal(k('CREATE TABLE b (a int REFERENCES t (id) ON DELETE CASCADE);'), 'A', 'ON DELETE CASCADE is een verwijzingsactie');
  assert.equal(k('CREATE POLICY p ON a FOR DELETE USING (true);'), 'B', 'een beleid beschrijft alleen een regel');
  assert.equal(k('INSERT INTO a (b) VALUES (1) ON CONFLICT (b) DO UPDATE SET b = 2;'), 'B');
  assert.equal(k('GRANT DELETE ON a TO x;'), 'B');
  assert.equal(k('SELECT $1'), 'B', 'een gewone parameter blijft leesbaar');
});
test('DB-klassen (review ronde 5): bijwerkingenfuncties zijn nooit "read", backslashes in gewone strings en schakelaars voor stringgedrag zijn C', () => {
  for (const s of ["SELECT dblink_exec('x', 'drop table t')", "SELECT lo_unlink(1)", "SELECT pg_read_file('x')", "SELECT pg_ls_dir('.')", 'SELECT * INTO nieuw FROM t', "SELECT pg_advisory_lock(1)", "SELECT pg_sleep(5)", "SELECT lastval()"])
    assert.notEqual(classifySql(s).level, 'read', s);
  const k = s => classifyDb(s).klasse;
  for (const s of ["SET standard_conforming_strings = off; SELECT 'a\\''; DROP TABLE x; SELECT '", "SELECT 'pad\\naam'", 'SET backslash_quote = on;', "SELECT lo_unlink(1)", "INSERT INTO auth.users (id) VALUES (1) ON CONFLICT (id) DO UPDATE SET id = 2;"]) assert.equal(k(s), 'C', s);
  assert.equal(k("ALTER TABLE t ALTER COLUMN id SET DEFAULT nextval('s');"), 'B', 'een gewone volgnummer-default is geen C');
  assert.equal(classifySql("SELECT 'gewone tekst' AS x").level, 'read');
});
test('review: een pull request kan alleen worden samengevoegd als dit werkpakket hem zelf heeft gemaakt, en dan nog achter de gate', met(root => {
  const git = {commit: true, push: ['claude/w'], merge: {to: 'main'}, deploy: 'verify'};
  executing(root, {envelope: {git, providers: {github: {tools: ['create_pull_request', 'merge_pull_request'], max_calls: 4, base: 'main', head: 'claude/w'}}, budgets: BUDGET(4)}});
  assert.match(msg(() => pre(root, 'mcp__github__merge_pull_request', {pullNumber: 1}, {tool_use_id: 'k0'})), /zelf heeft gemaakt/);
  const maak = {owner: 'o', repo: 'r', base: 'main', head: 'claude/w', title: 'x'};
  pre(root, 'mcp__github__create_pull_request', maak, {tool_use_id: 'k1'});
  hook(root, {hook_event_name: 'PostToolUse', tool_name: 'mcp__github__create_pull_request', tool_use_id: 'k1', tool_input: maak, tool_response: {content: [{type: 'text', text: '{"number": 12, "url": "https://github.com/o/r/pull/12"}'}]}});
  assert.deepEqual(st(root).created_prs, [{number: 12, owner: 'o', repo: 'r', base: 'main'}]);
  assert.match(msg(() => pre(root, 'mcp__github__create_pull_request', {owner: 'o', repo: 'r', base: 'develop', head: 'claude/w', title: 'x'}, {tool_use_id: 'k5'})), /PR-base wijkt af|merge-doel/);
  assert.match(msg(() => pre(root, 'mcp__github__merge_pull_request', {pullNumber: 99}, {tool_use_id: 'k2'})), /zelf heeft gemaakt/);
  assert.match(msg(() => pre(root, 'mcp__github__merge_pull_request', {owner: 'o', repo: 'andere', pullNumber: 12}, {tool_use_id: 'k4'})), /dezelfde owner\/repo/);
  assert.match(msg(() => pre(root, 'mcp__github__merge_pull_request', {owner: 'o', repo: 'r', pullNumber: 12}, {tool_use_id: 'k3'})), /result\.json ontbreekt/);
}));
test('review ronde 4: een PR die samengevoegd mag worden, moet naar het merge-doel wijzen (anders valt de deploy-check op het verkeerde doel)', met(root => {
  executing(root, {envelope: {git: {commit: true, push: ['claude/w'], merge: {to: 'staging'}, deploy: 'verify'}, providers: {github: {tools: ['create_pull_request', 'merge_pull_request'], max_calls: 4}}, budgets: BUDGET(4)}});
  assert.match(msg(() => pre(root, 'mcp__github__create_pull_request', {owner: 'o', repo: 'r', base: 'main', head: 'claude/w', title: 'x'}, {tool_use_id: 'm1'})), /merge-doel/);
  assert.equal(pre(root, 'mcp__github__create_pull_request', {owner: 'o', repo: 'r', base: 'staging', head: 'claude/w', title: 'x'}, {tool_use_id: 'm2'}), null);
}));
test('review: een bevestiging overleeft een pauze niet', met(root => {
  run(root, {envelope: {providers: prov(), db_max: 'B', budgets: BUDGET(10)}});
  const call = {name: 'weg', query: 'DROP TABLE notities;', project_id: REF};
  assert.match(msg(() => pre(root, 'mcp__supabase__apply_migration', call, {tool_use_id: 'p1'})), /AAE BEVESTIG/);
  prompt(root, 'AAE BEVESTIG'); assert.ok(st(root).confirmed);
  prompt(root, 'AAE PAUZE'); assert.equal(st(root).confirmed, null);
}));
test('toolherkenning: alleen aantoonbaar Supabase- of GitHub-tools worden herkend', () => {
  assert.deepEqual(identifyExternalTool('mcp__Supabase__execute_sql'), {provider: 'supabase', action: 'execute_sql'});
  assert.equal(identifyExternalTool('mcp__onbekend__execute_sql'), null);
  assert.equal(classifyExternalCall('mcp__github__push_files', {}).level, 'blocked');
  assert.equal(classifyExternalCall('mcp__github__list_commits', {}).level, 'read');
  assert.equal(projectRefFromResponse({content: [{type: 'text', text: 'url: https://abcdefghij.supabase.co/rest'}]}), REF);
});
