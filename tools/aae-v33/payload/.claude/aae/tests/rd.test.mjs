// AAE-V33-001D: regressietests voor de blokkerende bevindingen B1-B3 van de rereview van commit 5ba1e59 (RD01-RD03) en de hardeningpunten
// korte GO-hash van 12 tekens (RD04) en atomaire, crash-safe snapshot (RD05). RD06 (installer) staat in tools/aae-v33/tests/installer.test.mjs.
// De scenario's komen letterlijk uit het reviewrapport (docs/aae/notes/review-5ba1e59.md).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {spawnSync} from 'node:child_process';
import {fixture, cleanup, contract, plan, executing, st, prompt, put, installRuntime} from './helpers.mjs';
import {validateContract, classifyCommand, extraRefusal, analysisArgv, safeLocalArgv, shortHash, SHORT_HASH_LENGTH, PURPOSES, clock} from '../runtime/core.mjs';
import {classifyDb, classifySql, classifyExternalCall, unsafeCalls, scanSql} from '../runtime/integrations.mjs';
import {analysisFree, loadWork, withLock, saveWork} from '../runtime/state.mjs';
import {presentProposal} from '../runtime/commands.mjs';
import {runCommand} from '../runtime/runner.mjs';
import {createFileAtomic, TEMP_NAME, listSnapshots, snapshotDir, verifyChain, writeSnapshot, ruimTijdelijkeOp} from '../runtime/snapshot.mjs';

const met = fn => async () => { const root = fixture(); const cfg = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'aae33cfg-'))); process.env.CLAUDE_CONFIG_DIR = cfg; try { await fn(root, cfg); } finally { cleanup(root); cleanup(cfg); delete process.env.CLAUDE_CONFIG_DIR; clock.ms = () => Date.now(); } };
const k = s => classifyDb(s).klasse;
const amsg = async p => { try { await p; } catch (e) { return e.message; } assert.fail('verwacht een weigering'); };
const tekst = r => JSON.stringify(r);

// ---------------------------------------------------------------- RD01 (B1)
test('RD01 niet-ASCII functienamen vallen niet buiten de classificatie (reviewscenario: CREATE FUNCTION public.é() … DELETE FROM tasks, daarna SELECT public.é())', () => {
  const f = 'CREATE FUNCTION public.é() RETURNS void LANGUAGE sql AS $$ DELETE FROM tasks $$;';
  assert.equal(k(f), 'C', 'FN_DEF herkende é niet: de body werd niet beoordeeld en de definitie was klasse A');
  assert.equal(k(f + ' SELECT public.é();'), 'C'); assert.equal(k(f + ' SELECT é();'), 'C', 'een kale aanroep erft de klasse van de body');
  assert.equal(classifyExternalCall('mcp__supabase__apply_migration', {name: 'x', query: f + ' SELECT public.é();'}).db, 'C');
  // via execute_sql ging dit als read-only door terwijl de DELETE werd uitgevoerd
  for (const s of ['SELECT public.é()', 'SELECT é()', 'SELECT public."é"()', 'SELECT 日本語()', 'SELECT données.f()', 'SELECT ü(1)']) assert.equal(classifySql(s).level, 'change', s);
  for (const s of ['SELECT public.é();', 'SELECT é();']) assert.notEqual(k(s), 'A', s + ' (een niet-herkende gebruikersfunctie is minimaal B)');
  // andere niet-ASCII namen, ook geciteerd en in procedures
  for (const naam of ['日本語', 'ü', 'Ünï', '"é"', 'mаx']) assert.equal(k('CREATE FUNCTION ' + naam + '() RETURNS void LANGUAGE sql AS $$ TRUNCATE x $$; SELECT ' + naam + '();'), 'C', naam);
  assert.equal(k('CREATE PROCEDURE é() LANGUAGE sql AS $$ DROP TABLE x $$; CALL é();'), 'C');
  // een definitie waarvan de naam niet te lezen is, is nooit klasse A
  assert.equal(k('CREATE FUNCTION 1x() RETURNS void LANGUAGE sql AS $$ SELECT 1 $$;'), 'C');
  // een onschuldige niet-ASCII functie blijft gewoon A
  assert.equal(k('CREATE FUNCTION é() RETURNS int LANGUAGE sql AS $$ SELECT 1 $$;'), 'A');
  // een andere schrijfwijze van dezelfde naam (genormaliseerd) erft ook: é als e + U+0301
  assert.equal(k('CREATE FUNCTION public.é() RETURNS void LANGUAGE sql AS $$ DELETE FROM t $$; SELECT public.é();'), 'C');
});
test('RD01 een geciteerde functienaam is nooit het ingebouwde max (reviewscenario: "Max"(1)); alleen een kale ASCII-naam uit de lijst is alleen-lezen', () => {
  assert.equal(classifySql('SELECT "Max"(1)').level, 'change', '"Max" werd als de ingebouwde max gelezen');
  for (const s of ['SELECT "Max" /* verborgen */ (1)', 'SELECT "Max" -- verborgen\n (1)', 'SELECT "max"(1)', 'SELECT "count"(*) FROM t', 'SELECT public."Max"(x) FROM t', 'SELECT "Lower"(a) FROM t']) assert.equal(classifySql(s).level, 'change', s);
  // een Cyrillische of full-width variant is een andere functie dan max
  for (const s of ['SELECT mаx(1)', 'SELECT ｍａｘ(1)', 'SELECT mаx(1) FROM t']) assert.equal(classifySql(s).level, 'change', s);
  // gewone kale functies blijven alleen-lezen, ook met hoofdletters (Postgres leest ze als kleine letters)
  for (const s of ['SELECT max(1)', 'SELECT Max(x) FROM t', 'SELECT COUNT(*) FROM t', "SELECT lower(a) FROM t WHERE b = 'x'", 'SELECT * FROM "Max"']) assert.equal(classifySql(s).level, 'read', s);
  // een in de migratie gedefinieerde "Max" erft: de naam geldt conservatief voor elke schrijfwijze
  assert.equal(k('CREATE FUNCTION "Max"(int) RETURNS int LANGUAGE sql AS $$ DELETE FROM t RETURNING 1 $$; SELECT max(1);'), 'C');
  // het schaduwen van een ingebouwde functie via de definitie zelf telt ook in INSERT en DEFAULT
  assert.equal(k('INSERT INTO a (b) SELECT "Max"(1)'), 'B'); assert.equal(k('ALTER TABLE t ADD COLUMN x int DEFAULT "Max"(1);'), 'B');
  // de lijst van aanroepen kent alleen kale ASCII-namen als toegestaan
  assert.deepEqual(unsafeCalls('max(1) lower(a)'), []); assert.deepEqual(unsafeCalls('é(1)'), ['é']); assert.deepEqual(unsafeCalls('max(1)', new Set(), new Set(['max'])), ['max']);
});
test('RD01 gereserveerde plaatsvervangertekens in de invoer maken SQL niet betrouwbaar leesbaar; een tekstwaarde lijkt nooit op een aanroep', () => {
  assert.equal(scanSql('SELECT 0').ok, false); assert.equal(classifySql('SELECT 1 /*  */').level, 'change'); assert.equal(k('SELECT '), 'C');
  // DEFAULT 'a' laat een plaatsvervanger achter die naast een haakje niet als functienaam wordt gelezen
  assert.equal(k("CREATE TABLE t3 (id uuid DEFAULT gen_random_uuid(), tekst text DEFAULT 'a', n int DEFAULT (1 + 2));"), 'A');
});

// ---------------------------------------------------------------- RD02 (B2)
const LOKAAL = ['read', 'test', 'build', 'preview'], ZWAAR = ['install', 'destructive'];
const VERBODEN = [['gh', 'pr', 'merge', '1'], ['vercel', '--prod'], ['npm', 'publish'], ['curl', '-X', 'POST', 'https://x.example'], ['supabase', 'db', 'push'],
  ['env', 'git', 'push', 'origin', 'main'], ['sh', 'script.sh'], ['bash', '-c', 'git push origin main'], ['xargs', 'curl'], ['npx', 'supabase', 'db', 'push'], ['pnpm', 'dlx', 'supabase', 'db', 'push'], ['npm', 'exec', 'vercel'],
  ['/usr/bin/curl', 'https://x.example'], ['./deploy.sh'], ['node', '-e', 'process.exit(0)'], ['python3', '-c', 'import os'], ['find', '.', '-exec', 'rm', '{}', ';'], ['git', '-c', 'alias.x=!sh', 'status'], ['git', 'push', 'origin', 'x'], ['git', 'merge', 'x'],
  ['psql', '-c', 'DROP TABLE x'], ['docker', 'run', 'x'], ['aws', 's3', 'ls'], ['wrangler', 'deploy'], ['npm', 'run', 'deploy'], ['yarn', 'publish'], ['bun', 'x', 'supabase'], ['sudo', 'rm', '-rf', '/'], ['nohup', 'curl', 'x'], ['timeout', '5', 'curl', 'x'],
  ['awk', 'BEGIN{system("curl x")}'], ['node', '-pe', '1'], ['node', '--eval=1'], ['python3', '-Sc', 'x'], ['deno', 'eval', '1'], ['deno', 'run', 'https://x.example/a.ts'], ['env', '-S', 'git push']];
test('RD02 elk doel krijgt dezelfde inhoudelijke commandocontrole: gh pr merge, vercel --prod, npm publish, curl, supabase db push en wrappers zijn nooit een extra commando (reviewscenario)', () => {
  for (const argv of VERBODEN) for (const doel of [...LOKAAL, ...ZWAAR]) {
    assert.ok(extraRefusal(argv, doel), argv.join(' ') + ' (' + doel + ') hoort geweigerd te worden');
    assert.throws(() => validateContract(structuredClone(contract({envelope: {extra_commands: [{argv, purpose: doel}]}}))), /niet toegestaan/, argv.join(' ') + ' als extra commando met doel ' + doel);
    // en zelfs als het in een envelop zou zijn geraakt: classifyCommand weigert vlak vóór de uitvoering
    const c = contract(); c.envelope.extra_commands = [{argv, purpose: doel}];
    assert.equal(classifyCommand(c, {id: 'x', argv, purpose: doel}).ok, false, argv.join(' ') + ' (' + doel + ')');
  }
  // het doel-label wijzigt nooit wat een programma kan: dezelfde weigering voor alle doelen, hier als gelijkheid van uitkomst
  for (const argv of VERBODEN) assert.equal(new Set([...LOKAAL, ...ZWAAR].map(d => !!extraRefusal(argv, d))).size, 1, argv.join(' '));
});
test('RD02 merge en deploy accepteren helemaal geen extra commando\'s; samenvoegen en uitrollen lopen uitsluitend via hun capabilities en gates', () => {
  for (const argv of [['node', 'scripts/x.mjs'], ['git', 'push', 'origin', 'w:main'], ['npm', 'run', 'build'], ['gh', 'pr', 'merge', '1'], ['vercel', '--prod']]) for (const doel of ['merge', 'deploy']) {
    assert.match(extraRefusal(argv, doel), /accepteert geen extra commando/, argv.join(' ') + ' (' + doel + ')');
    assert.throws(() => validateContract(structuredClone(contract({envelope: {extra_commands: [{argv, purpose: doel}]}}))), /accepteert geen extra commando/);
  }
  // een deploy-commando in het plan bestaat niet meer; een merge alleen als git push origin <werkbranch>:<doel> binnen de merge-capability
  const env = {git: {commit: true, push: ['claude/w'], merge: {to: 'main'}, deploy: 'trigger'}};
  const cmd = (id, argv, purpose) => ({id, argv, purpose, why: 'Een commando met doel ' + purpose + '.', watch: [], timeout_ms: 5000, max_runs: 1});
  const plan0 = contract().plan;
  assert.throws(() => validateContract(structuredClone(contract({envelope: env, plan: {...plan0, commands: [...plan0.commands, cmd('uit', ['node', 'scripts/x.mjs'], 'deploy')]}}))), /Een los deploy-commando bestaat niet/);
  assert.throws(() => validateContract(structuredClone(contract({envelope: env, plan: {...plan0, commands: [...plan0.commands, cmd('sam', ['node', 'scripts/x.mjs'], 'merge')]}}))), /merge accepteert geen extra commando/);
  assert.throws(() => validateContract(structuredClone(contract({envelope: env, plan: {...plan0, commands: [...plan0.commands, cmd('sam', ['git', 'push', 'origin', 'claude/w:andere'], 'merge')]}}))), /Merge alleen als/);
  assert.doesNotThrow(() => validateContract(structuredClone(contract({envelope: env, plan: {...plan0, commands: [...plan0.commands, cmd('sam', ['git', 'push', 'origin', 'claude/w:main'], 'merge')]}}))));
});
test('RD02 gewone, zichtbare extra commando\'s blijven mogelijk; een installatie hoort bij doel install en onbekende tools starten niet via npx', () => {
  for (const [argv, doel] of [[['node', 'scripts/bouw.mjs'], 'build'], [['node', 'scripts/bouw.mjs', '-c', 'cfg'], 'build'], [['node', 'scripts/check.mjs', 'http://localhost:3000'], 'test'], [['node', '--no-warnings', 'scripts/bouw.mjs'], 'build'], [['npm', 'install'], 'install'], [['npm', 'ci'], 'install'], [['pnpm', 'add', 'x'], 'install'], [['npm', 'run', 'build'], 'build'], [['npm', 'test'], 'test'],
    [['git', 'checkout', '-b', 'x'], 'destructive'], [['git', 'clean', '-fd'], 'destructive'], [['rm', '-rf', 'dist'], 'destructive'], [['pip', 'install', 'x'], 'install'], [['node', 'scripts/inst.js'], 'install']]) assert.equal(extraRefusal(argv, doel), null, argv.join(' ') + ' (' + doel + ')');
  assert.match(extraRefusal(['npm', 'install'], 'build'), /hoort bij doel install/); assert.match(extraRefusal(['npx', 'iets'], 'test'), /willekeurige pakketten/);
  assert.ok(extraRefusal(['git', 'status'], 'build'), 'git status hoort bij de vaste lijst, niet bij een lokaal extra commando');
  // elk doel is gedekt door dezelfde functie: een gewoon projectscript mag voor de lokale doelen en install/destructive, nooit voor merge, deploy, commit en push
  for (const doel of PURPOSES) assert.equal(extraRefusal(['node', 'scripts/x.mjs'], doel) === null, [...LOKAAL, ...ZWAAR].includes(doel), doel);
});

// ---------------------------------------------------------------- RD03 (B3)
const ANALYSE = (commands = [], over = {}) => ({id: 'W-A', envelope: {phase: 'analysis', areas: [], ...over}, plan: {...contract().plan, agents: [], commands, test_plan: [{kind: 'analysis', method: 'inspection', description: 'Beschrijf de bevindingen en wat niet is gecontroleerd.'}]}});
const LEES = (id, argv, purpose = 'read') => ({id, argv, purpose, why: 'Een commando in een analyse.', watch: [], timeout_ms: 5000, max_runs: 1});
test('RD03 een GO-vrije analyse voert geen projectcode uit: npx vitest run, npx playwright test, node --test en npx eslint worden vooraf geweigerd (reviewscenario)', met(root => {
  const projectcode = [['npx', 'vitest', 'run'], ['npx', 'playwright', 'test'], ['node', '--test', 'src/ok.test.mjs'], ['npx', 'eslint'], ['npx', 'tsc', '--noEmit'], ['node', 'scripts/x.mjs']];
  for (const argv of projectcode) {
    assert.equal(analysisArgv(argv), false, argv.join(' '));
    // het reviewscenario: {purpose: 'read', argv: ['npx','vitest','run']} was geldig
    assert.throws(() => validateContract(structuredClone(contract(ANALYSE([LEES('p', argv)])))), /valt buiten de envelop.*analyse zonder GO/i, argv.join(' '));
    assert.throws(() => validateContract(structuredClone(contract(ANALYSE([LEES('p', argv, 'test')])))), /Analyse staat alleen leescommando/, argv.join(' ') + ' als test');
    assert.throws(() => validateContract(structuredClone(contract(ANALYSE([], {extra_commands: [{argv, purpose: 'read'}]})))), /extra commando/i, argv.join(' ') + ' als extra commando');
    const c = contract(ANALYSE()); assert.equal(classifyCommand(c, {id: 'p', argv, purpose: 'read'}).ok, false, 'vlak vóór de uitvoering');
    assert.equal(analysisFree(Object.assign(validateContract(structuredClone(contract(ANALYSE()))), {plan: {...contract().plan, commands: [LEES('p', argv)]}})), false, 'start zonder GO is uitgesloten: ' + argv.join(' '));
  }
  // alleen-lezen git blijft kunnen en een analyse met alleen die commando's start zonder GO
  const toegestaan = [['git', 'status', '--porcelain'], ['git', 'log', '--oneline', '-n5'], ['git', 'diff', '--stat'], ['git', 'diff', '--name-only'], ['git', 'show', '--stat', 'HEAD'], ['git', 'rev-parse', 'HEAD'], ['git', 'merge-base', '--is-ancestor', 'HEAD', 'main']];
  for (const argv of toegestaan) assert.equal(analysisArgv(argv), true, argv.join(' '));
  const s = plan(root, ANALYSE(toegestaan.map((argv, i) => LEES('g' + i, argv))));
  assert.equal(s.status, 'EXECUTING', 'een pure analyse met alleen-lezen git start zonder GO');
}));
test('RD03 de bestaande bescherming blijft: git diff en git show tonen geen bestandsinhoud, dus geen .env of andere geheime paden', () => {
  for (const argv of [['git', 'show', 'HEAD:.env'], ['git', 'show', '.env'], ['git', 'show', 'HEAD'], ['git', 'diff'], ['git', 'diff', '.env'], ['git', 'diff', '--cached'], ['git', 'diff', '--cached', '.env'], ['git', 'log', '-p'], ['git', 'show', '--stat', 'HEAD:.env'],
    ['git', 'diff', '--stat', '--', '.env'], ['git', 'diff', '--name-only', '/etc/passwd'], ['git', 'show', '--stat', '../.env']]) {
    assert.equal(safeLocalArgv(argv), false, argv.join(' ')); assert.equal(analysisArgv(argv), false, argv.join(' '));
    assert.throws(() => validateContract(structuredClone(contract(ANALYSE([LEES('p', argv)])))), /valt buiten de envelop/, argv.join(' '));
  }
  // alleen de samenvatting (namen en aantallen) is toegestaan
  for (const argv of [['git', 'diff', '--stat'], ['git', 'diff', '--name-only'], ['git', 'show', '--stat', 'HEAD'], ['git', 'show', '--name-only', 'HEAD']]) assert.equal(analysisArgv(argv), true, argv.join(' '));
});
test('RD03 het runnerpad weigert projectcode in een analyse vóór de start: er wordt niets uitgevoerd (geen detectie achteraf)', met(async root => {
  const s = plan(root, ANALYSE([LEES('g0', ['git', 'status', '--porcelain'])]));
  assert.equal(s.status, 'EXECUTING');
  // een test die een bestand zou schrijven als hij liep
  fs.writeFileSync(path.join(root, 'src/schrijf.test.mjs'), "import test from 'node:test';\nimport fs from 'node:fs';\ntest('x', () => { fs.writeFileSync('src/GESCHREVEN.txt', 'ja'); });\n");
  withLock(root, () => { const x = loadWork(root, 'W-A'); x.contract.plan.commands.push(LEES('vit', ['node', '--test', 'src/schrijf.test.mjs']), LEES('vitest', ['npx', 'vitest', 'run'], 'test')); saveWork(root, x); });
  assert.match(await amsg(runCommand(root, 'vit')), /valt buiten de envelop.*analyse zonder GO/i);
  assert.match(await amsg(runCommand(root, 'vitest')), /valt buiten de envelop/);
  assert.equal(fs.existsSync(path.join(root, 'src/GESCHREVEN.txt')), false, 'er is niets gedraaid');
  assert.equal(st(root, 'W-A').usage.commands, 0, 'er is geen commando gestart of geteld');
}));

// ---------------------------------------------------------------- RD04 (korte GO-hash van 12)
test('RD04 de korte GO-hash is 12 hextekens; een oude GO van 8 tekens of een andere lengte wordt geweigerd en er wordt niets goedgekeurd', met(root => {
  assert.equal(SHORT_HASH_LENGTH, 12); assert.equal(shortHash('a'.repeat(64)).length, 12);
  plan(root);
  const p = presentProposal(root, 'W-T');
  assert.equal(p.short_hash.length, 12); assert.match(p.exacte_go, /^AAE GO W-T [0-9a-f]{12}$/); assert.match(p.vraag, new RegExp('AAE GO W-T ' + p.short_hash));
  assert.ok(p.samenvatting.some(r => r.includes('korte hash ' + p.short_hash)), 'present toont de korte hash van 12 tekens');
  const echt = loadWork(root, 'W-T').presented.hash;
  assert.equal(p.short_hash, echt.slice(0, 12));
  for (const fout of [echt.slice(0, 8), echt.slice(0, 11), echt.slice(0, 13), echt.slice(0, 16), echt, 'abcd']) {
    const r = tekst(prompt(root, 'AAE GO W-T ' + fout));
    assert.match(r, /GO geweigerd/, fout.length + ' tekens'); assert.match(r, /precies 12|geen werkpakket|tekens/);
    assert.equal(st(root).approved, null); assert.equal(st(root).status, 'WAITING_FOR_APPROVAL');
  }
  assert.match(tekst(prompt(root, 'AAE GO W-T ' + (echt[0] === 'a' ? 'b' : 'a') + echt.slice(1, 12))), /hoort niet bij het huidige voorstel/, 'een verkeerde hash van 12 tekens telt niet');
  assert.equal(st(root).approved, null);
  const r = prompt(root, p.exacte_go);
  assert.equal(st(root).status, 'EXECUTING'); assert.match(tekst(r), new RegExp('envelop ' + p.short_hash));
  assert.match(tekst(prompt(root, 'AAE GO W-T ' + echt.slice(0, 8))), /GO geweigerd/, 'ook na de GO telt een korte hash van 8 niet');
}));

// ---------------------------------------------------------------- RD05 (atomaire snapshot)
const kind = (root, code) => spawnSync(process.execPath, ['--input-type=module', '-e', code], {cwd: root, encoding: 'utf8', env: {...process.env}});
const SNAP = import.meta.resolve('../runtime/snapshot.mjs'), STATE = import.meta.resolve('../runtime/state.mjs');
const snapDir = root => path.join(root, snapshotDir('W-T'));
test('RD05 een snapshot wordt atomair en zonder overschrijven aangemaakt: tijdelijk bestand, hardlink, map-sync, temp opgeruimd', met(root => {
  const dir = path.join(root, 'x'); fs.mkdirSync(dir);
  const f = path.join(dir, '001-abcdefabcdef.json');
  createFileAtomic(f, '{"a":1}\n'); assert.equal(fs.readFileSync(f, 'utf8'), '{"a":1}\n'); assert.equal(fs.statSync(f).mode & 0o777, 0o644);
  assert.deepEqual(fs.readdirSync(dir), ['001-abcdefabcdef.json'], 'geen tijdelijk bestand achtergebleven');
  assert.throws(() => createFileAtomic(f, '{"a":2}\n'), /EEXIST|bestaat al/, 'een bestaande snapshot wordt nooit overschreven');
  assert.equal(fs.readFileSync(f, 'utf8'), '{"a":1}\n'); assert.deepEqual(fs.readdirSync(dir), ['001-abcdefabcdef.json'], 'ook na een geweigerde schrijfactie geen restje');
  assert.equal(TEMP_NAME.test('.tmp-123-abcdef12-001-abcdefabcdef.json'), true); assert.equal(TEMP_NAME.test('001-abcdefabcdef.json'), false);
}));
test('RD05 een onderbreking tussen schrijven en hernoemen laat nooit een halve snapshot onder de echte naam achter; de volgende schrijfactie of recover herstelt zonder handmatige actie', met(async root => {
  executing(root);
  const bestand = listSnapshots(root, 'W-T')[0]; assert.ok(bestand);
  const inhoud = fs.readFileSync(path.join(snapDir(root), bestand), 'utf8');
  // simuleer: de snapshot is nog niet op schijf (het scenario van de review: schrijven direct naar de eindnaam)
  fs.unlinkSync(path.join(snapDir(root), bestand));
  const code = punt => 'import {writeSnapshot} from ' + JSON.stringify(SNAP) + '; import {loadWork} from ' + JSON.stringify(STATE) + '; const st = loadWork(' + JSON.stringify(root) + ', "W-T"); writeSnapshot(' + JSON.stringify(root) + ', st, "AAE GO", {crashAfter: ' + JSON.stringify(punt) + '});';
  const r1 = kind(root, code('temp'));
  assert.equal(r1.signal, 'SIGKILL', 'het kindproces is halverwege gestorven: ' + r1.stderr);
  assert.deepEqual(listSnapshots(root, 'W-T'), [], 'geen (halve) snapshot onder de echte naam');
  assert.ok(fs.readdirSync(snapDir(root)).some(n => TEMP_NAME.test(n)), 'er blijft alleen een tijdelijk restje achter');
  // de keten is nog geldig (leeg) en de volgende schrijfactie ruimt het restje op en schrijft de snapshot
  const s = loadWork(root, 'W-T'); withLock(root, () => writeSnapshot(root, s, 'AAE GO'));
  assert.deepEqual(listSnapshots(root, 'W-T'), [bestand]); assert.equal(fs.readFileSync(path.join(snapDir(root), bestand), 'utf8'), inhoud, 'identiek aan het origineel');
  assert.deepEqual(fs.readdirSync(snapDir(root)), [bestand], 'geen restje meer');
  assert.doesNotThrow(() => verifyChain(root, 'W-T'));
  // een onderbreking ná het hernoemen: de snapshot is volledig, het restje wordt genegeerd en opgeruimd
  fs.unlinkSync(path.join(snapDir(root), bestand));
  const r2 = kind(root, code('link')); assert.equal(r2.signal, 'SIGKILL');
  assert.deepEqual(listSnapshots(root, 'W-T'), [bestand], 'de snapshot staat er volledig');
  assert.equal(fs.readFileSync(path.join(snapDir(root), bestand), 'utf8'), inhoud);
  assert.doesNotThrow(() => verifyChain(root, 'W-T'));
  assert.ok(ruimTijdelijkeOp(root, 'W-T') >= 1, 'het restje van het gestorven proces wordt opgeruimd'); assert.deepEqual(fs.readdirSync(snapDir(root)), [bestand]);
}));
test('RD05 recover ruimt het restje van een onderbroken snapshot-schrijfactie op en herstelt het pakket zonder handmatige actie', met(async root => {
  installRuntime(root);
  executing(root);
  fs.writeFileSync(path.join(snapDir(root), '.tmp-999999-deadbeef-002-aaaaaaaaaaaa.json'), '{"half":'); // restje van een gestorven proces (pid bestaat niet)
  assert.deepEqual(listSnapshots(root, 'W-T').length, 1, 'een restje telt niet als snapshot');
  const sh = (...a) => spawnSync('git', ['-c', 'user.email=t@t.nl', '-c', 'user.name=T', '-c', 'commit.gpgsign=false', ...a], {cwd: root, encoding: 'utf8'});
  sh('init', '-q'); sh('add', '-A', '--', 'docs/aae/work/W-T/approved/001-' + loadWork(root, 'W-T').snapshot.hash.slice(0, 12) + '.json'); sh('commit', '-q', '-m', 'snapshot');
  fs.rmSync(path.join(root, 'docs/aae/work/W-T/state.json'), {force: true}); fs.rmSync(path.join(root, '.claude/aae/state'), {recursive: true, force: true}); fs.mkdirSync(path.join(root, '.claude/aae/state'), {recursive: true});
  const uit = spawnSync(process.execPath, [path.join(root, '.claude/aae/runtime/cli.mjs'), 'recover', 'W-T'], {cwd: root, encoding: 'utf8'});
  assert.equal(uit.status, 0, uit.stderr); assert.equal(JSON.parse(uit.stdout).status, 'PAUSED');
  assert.ok(!fs.readdirSync(snapDir(root)).some(n => TEMP_NAME.test(n)), 'het restje is opgeruimd');
}));
