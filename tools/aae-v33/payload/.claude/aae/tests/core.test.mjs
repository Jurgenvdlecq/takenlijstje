import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  sourceDigest, validateContract, safeLocalArgv, bashArgv, classifyCommand, areaAllows, protectedPath, materialChanges, envelopeHash, relName, scopeContains, requiredChecks
} from '../runtime/core.mjs';
import {contract} from './helpers.mjs';

const geldig = over => validateContract(structuredClone(contract(over)));
const faalt = (over, deel) => assert.throws(() => validateContract(structuredClone(contract(over))), e => e.message.includes(deel), 'verwacht fout met: ' + deel);

test('contract schema 4: een geldig contract wordt geaccepteerd en onbekende velden niet', () => {
  assert.equal(geldig().id, 'W-T');
  const c = contract(); c.extra = 1;
  assert.throws(() => validateContract(c), /onbekend veld/);
  const c3 = contract(); c3.schema_version = 3;
  assert.throws(() => validateContract(c3), /schema_version 4/);
});
test('contract: de kwaliteitsondergrens (scope, functional, regression) is verplicht en risicovlaggen voegen bewijs toe', () => {
  const c = contract(); c.plan.test_plan = c.plan.test_plan.filter(t => t.kind !== 'regression');
  assert.throws(() => validateContract(c), /kwaliteitsondergrens: regression/);
  assert.throws(() => validateContract(structuredClone(contract({risk_flags: ['external_effects']}))), /kwaliteitsondergrens: failure-handling/);
  assert.equal(requiredChecks(contract({risk_flags: ['external_effects']})).includes('failure-handling'), true);
});
test('contract: autorisatie, financieel of gevoelige gegevens vereisen HIGH', () => {
  faalt({risk_flags: ['authorization']}, 'risicoklasse HIGH');
});
test('contract: analyse mag geen gebieden, git-schrijfacties of databasewijziging hebben', () => {
  faalt({envelope: {phase: 'analysis'}}, 'Analyse mag geen schrijfgebieden');
});
test('contract: pushen naar main of een beschermde branch kan niet in de envelop', () => {
  faalt({envelope: {git: {commit: true, push: ['main'], merge: null, deploy: 'none'}}}, 'beschermd');
});
test('contract: een gebied mag geen systeembestanden of administratie bevatten', () => {
  faalt({envelope: {areas: [{name: 'Systeem', write: ['.claude/aae'], support: []}]}}, 'Systeembestanden');
  faalt({envelope: {areas: [{name: 'Admin', write: ['docs/aae/work'], support: []}]}}, 'Systeembestanden');
});
test('contract: een commando buiten de envelop wordt geweigerd bij registratie', () => {
  const c = contract(); c.plan.commands.push({id: 'x', argv: ['rm', '-rf', 'src'], purpose: 'test', why: 'Verwijderen als test.', watch: [], timeout_ms: 5000, max_runs: 1});
  assert.throws(() => validateContract(c), /valt buiten de envelop/);
});

test('B6 behouden: node --test accepteert alleen concrete testbestanden, geen mappen of scripts', () => {
  assert.equal(safeLocalArgv(['node', '--test', 'tools/x/a.test.mjs']), true);
  assert.equal(safeLocalArgv(['node', '--test', 'tools/x']), false);
  assert.equal(safeLocalArgv(['node', '--test']), false);
  assert.equal(safeLocalArgv(['node', 'script.mjs']), false);
  assert.equal(safeLocalArgv(['node', '--test', '--import=x.mjs', 'a.test.mjs']), false);
  assert.equal(safeLocalArgv(['node', '--test', '../a.test.mjs']), false);
  assert.equal(safeLocalArgv(['node', '--test', '/etc/a.test.mjs']), false);
});
test('lokale argv-allowlist: veilige lees- en testcommando\'s ja, gevaarlijke varianten nee', () => {
  assert.equal(safeLocalArgv(['git', 'status', '--porcelain']), true);
  assert.equal(safeLocalArgv(['git', 'diff', '--stat']), true);
  assert.equal(safeLocalArgv(['git', 'push']), false);
  assert.equal(safeLocalArgv(['git', 'log', '-n5', '--oneline']), true);
  assert.equal(safeLocalArgv(['npx', 'tsc', '--noEmit']), true);
  assert.equal(safeLocalArgv(['npx', 'eslint', '--fix']), false);
  assert.equal(safeLocalArgv(['curl', 'https://example.com']), false);
});
test('bashArgv: shell-metatekens maken van een Bash-opdracht nooit een argv', () => {
  for (const s of ['git status; rm -rf x', 'git status && ls', 'git status | cat', 'git status > f', 'git status $(x)', 'git "status"', 'git status `x`', 'git status *'])
    assert.equal(bashArgv(s), null, s);
  assert.deepEqual(bashArgv('git status --porcelain'), ['git', 'status', '--porcelain']);
});

const gitC = (git, extra = {}) => geldig({envelope: {git, ...extra}});
test('gitguard: commit alleen add -A -- <toegestane paden> en commit -m <tekst>', () => {
  const c = gitC({commit: true, push: [], merge: null, deploy: 'none'});
  assert.equal(classifyCommand(c, {argv: ['git', 'add', '-A', '--', 'src'], purpose: 'commit'}).ok, true);
  assert.equal(classifyCommand(c, {argv: ['git', 'add', '-A', '--', '.'], purpose: 'commit'}).ok, false);
  assert.equal(classifyCommand(c, {argv: ['git', 'add', '-A', '--', 'app'], purpose: 'commit'}).ok, false);
  assert.equal(classifyCommand(c, {argv: ['git', 'add', '.'], purpose: 'commit'}).ok, false);
  assert.equal(classifyCommand(c, {argv: ['git', 'commit', '-m', 'Titel', '-m', 'Toelichting'], purpose: 'commit'}).ok, true);
  assert.equal(classifyCommand(c, {argv: ['git', 'commit', '--amend', '-m', 'x'], purpose: 'commit'}).ok, false);
  assert.equal(classifyCommand(c, {argv: ['git', 'reset', '--hard'], purpose: 'commit'}).ok, false);
});
test('gitguard: commit zonder commit-capability is niet toegestaan', () => {
  assert.equal(classifyCommand(geldig(), {argv: ['git', 'commit', '-m', 'x'], purpose: 'commit'}).ok, false);
});
test('gitguard: push alleen naar een afgesproken werkbranch; nooit main, force of refspec', () => {
  const c = gitC({commit: true, push: ['claude/werk-1'], merge: null, deploy: 'none'});
  const p = argv => classifyCommand(c, {argv, purpose: 'push'}).ok;
  assert.equal(p(['git', 'push', '-u', 'origin', 'claude/werk-1']), true);
  assert.equal(p(['git', 'push', 'origin', 'claude/werk-1']), true);
  assert.equal(p(['git', 'push', '-u', 'origin', 'main']), false);
  assert.equal(p(['git', 'push', '--force', 'origin', 'claude/werk-1']), false);
  assert.equal(p(['git', 'push', '-u', 'origin', 'claude/werk-2']), false);
  assert.equal(p(['git', 'push', 'origin', 'claude/werk-1:main']), false);
  assert.equal(p(['git', 'push', 'origin', '+claude/werk-1']), false);
});
test('gitguard: merge is een aparte capability en alleen naar het afgesproken doel', () => {
  const geen = gitC({commit: true, push: ['claude/werk-1'], merge: null, deploy: 'none'});
  assert.equal(classifyCommand(geen, {argv: ['git', 'push', 'origin', 'claude/werk-1:main'], purpose: 'merge'}).ok, false);
  const met = gitC({commit: true, push: ['claude/werk-1'], merge: {to: 'main'}, deploy: 'verify'});
  assert.equal(classifyCommand(met, {argv: ['git', 'push', 'origin', 'claude/werk-1:main'], purpose: 'merge'}).ok, true);
  assert.equal(classifyCommand(met, {argv: ['git', 'push', 'origin', 'claude/werk-1:release'], purpose: 'merge'}).ok, false);
  assert.equal(classifyCommand(met, {argv: ['git', 'push', 'origin', 'claude/anders:main'], purpose: 'merge'}).ok, false);
});
test('commandoklassen: install/deploy/destructief alleen als exact goedgekeurd extra commando', () => {
  const c = geldig();
  assert.equal(classifyCommand(c, {argv: ['npm', 'ci'], purpose: 'install'}).ok, false);
  const e = geldig({envelope: {extra_commands: [{argv: ['npm', 'ci'], purpose: 'install'}]}});
  assert.equal(classifyCommand(e, {argv: ['npm', 'ci'], purpose: 'install'}).ok, true);
  assert.equal(classifyCommand(e, {argv: ['npm', 'ci', '--force'], purpose: 'install'}).ok, false);
});

test('T16 gebieden: bestanden binnen een goedgekeurd patroon en ondersteunende categorie zijn vrij', () => {
  const c = geldig();
  assert.equal(areaAllows(c, 'src/nieuw/diep/bestand.ts'), true);
  assert.equal(areaAllows(c, 'tests/a.test.ts'), true);
  assert.equal(areaAllows(c, 'src'), true);
});
test('T17 gebieden: buiten het goedgekeurde gebied is niet vrij (ook niet met overeenkomende voorvoegsels)', () => {
  const c = geldig();
  assert.equal(areaAllows(c, 'app/page.tsx'), false);
  assert.equal(areaAllows(c, 'srcgeheim/x.ts'), false);
  assert.equal(areaAllows(c, 'package-lock.json'), false);
  assert.equal(areaAllows(c, 'supabase/migrations/1.sql'), false);
});
test('protectedPath: .claude, CLAUDE.md, .git, .env en docs/aae zijn beschermd; .env.example niet', () => {
  for (const p of ['.claude/settings.json', 'CLAUDE.md', '.git/config', '.env', '.env.local', 'docs/aae/work/x/state.json', '.aae-backups/a']) assert.equal(protectedPath(p), true, p);
  for (const p of ['src/a.ts', '.env.example', 'docs/PROGRESS.md']) assert.equal(protectedPath(p), false, p);
});
test('relName en scopeContains: onveilige paden worden geweigerd', () => {
  for (const p of ['../x', '/abs', 'a/../b', 'a\\b', 'a/*', '~/x']) assert.throws(() => relName(p), p);
  assert.equal(scopeContains(['src'], 'src/a/b.ts'), true);
  assert.equal(scopeContains(['src'], 'srcx/a.ts'), false);
});

test('review: branchnamen als HEAD, refs/heads/main of revisiesyntaxis zijn nooit een toegestane werkbranch', () => {
  for (const b of ['HEAD', 'head', 'refs/heads/main', 'heads/main', 'tags/v1', 'MAIN', 'Main', 'a..b', 'a//b', 'x.lock', 'x/', 'x@{1}', 'release/1']) {
    assert.throws(() => validateContract(structuredClone(contract({envelope: {git: {commit: true, push: [b], merge: null, deploy: 'none'}}}))), /Pushbranch ongeldig/, b);
  }
  assert.doesNotThrow(() => validateContract(structuredClone(contract({envelope: {git: {commit: true, push: ['claude/werk-1'], merge: null, deploy: 'none'}}}))));
  const c = validateContract(structuredClone(contract({envelope: {git: {commit: true, push: ['claude/w'], merge: null, deploy: 'none'}}})));
  for (const argv of [['git', 'push', 'origin', 'HEAD'], ['git', 'push', 'origin', 'refs/heads/main'], ['git', 'push', 'origin', 'MAIN'], ['git', 'push', 'origin', 'HEAD:claude/w']]) assert.equal(classifyCommand(c, {argv, purpose: 'push'}).ok, false, argv.join(' '));
});
test('review: hoofdletters, afsluitende punten/spaties en korte Windows-namen omzeilen de beschermde paden niet', () => {
  for (const p of ['.Claude/aae/x', 'claude.MD', 'DOCS/AAE/work/W/state.json', '.GIT/config', '.ENV.local']) assert.equal(protectedPath(p), true, p);
  for (const p of ['docs/aae./x', 'docs/aae /x', 'CLAUDE~1.MD', 'a/b.']) assert.throws(() => relName(p), /Onveilig pad/, p);
  assert.throws(() => validateContract(structuredClone(contract({envelope: {areas: [{name: 'Systeem', write: ['.Claude/aae'], support: []}]}}))), /Systeembestanden/);
});
test('review: preflight voert alleen bekende programma\'s uit en bevraagt alleen gewone hostnamen', () => {
  const met = pf => structuredClone(contract({plan: {...contract().plan, preflight: pf}}));
  assert.doesNotThrow(() => validateContract(met({tools: ['node', 'git'], hosts: ['api.supabase.co'], env_names: ['SUPABASE_URL'], fixtures: [{source: 'probe', path: 'tests/fixtures/x.json'}]})));
  for (const pf of [{tools: ['./evil']}, {tools: ['rm']}, {tools: ['/bin/sh']}, {hosts: ['localhost']}, {hosts: ['evil.com/pad']}, {hosts: ['a@b.com']}, {hosts: ['169.254.169.254']}, {env_names: ['lowercase']}, {fixtures: [{source: 'x', path: '../x'}]}, {onbekend: 1}])
    assert.throws(() => validateContract(met(pf)), undefined, JSON.stringify(pf));
});
test('review: de bronvingerafdruk omvat de goedgekeurde ondersteunende categorie (tests)', () => {
  const dir = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'aae33dig-')));
  try {
    fs.mkdirSync(path.join(dir, 'src')); fs.mkdirSync(path.join(dir, 'tests')); fs.writeFileSync(path.join(dir, 'tests/a.test.ts'), '1');
    const c = validateContract(structuredClone(contract())), a = sourceDigest(dir, c);
    fs.writeFileSync(path.join(dir, 'tests/a.test.ts'), '2');
    assert.notEqual(sourceDigest(dir, c), a);
  } finally { fs.rmSync(dir, {recursive: true, force: true}); }
});
test('envelophash: een plan-wijziging (agent/commando) verandert de envelop niet; een gebied wel', () => {
  const a = geldig(), b = geldig(); b.plan.agents.push({name: 'aae-architect', question: 'Ontwerp een kleinere variant.', files: ['src']});
  assert.equal(envelopeHash(a), envelopeHash(validateContract(b)));
  const c = geldig({envelope: {areas: [{name: 'Breder', write: ['src', 'app'], support: []}]}});
  assert.notEqual(envelopeHash(a), envelopeHash(c));
});
test('materialChanges: binnen de envelop is vrij; breder gebied, hoger risico, database, git en budget niet', () => {
  const a = geldig();
  assert.deepEqual(materialChanges(a, geldig({plan: {...a.plan, agents: []}})), []);
  assert.ok(materialChanges(a, geldig({envelope: {areas: [{name: 'Breder', write: ['src', 'app'], support: []}]}})).some(x => x.startsWith('schrijfgebied')));
  assert.ok(materialChanges(a, geldig({risk_class: 'HIGH'})).includes('risicoklasse hoger'));
  assert.ok(materialChanges(a, geldig({risk_class: 'LIGHT'})).includes('risicoklasse lager (bewijs lichter)'));
  assert.ok(materialChanges(a, geldig({envelope: {db_max: 'A'}})).includes('database-klasse'));
  assert.ok(materialChanges(a, geldig({envelope: {git: {commit: true, push: [], merge: null, deploy: 'none'}}})).includes('git commit'));
  assert.ok(materialChanges(a, geldig({envelope: {budgets: {agent_calls: {soft: 2, hard: 6}, command_runs: 20, external_calls: 0, max_parallel: 1}}})).includes('budget'));
  assert.ok(materialChanges(a, geldig({envelope: {acceptance: [{id: 'AC1', text: 'Iets heel anders dan eerst.'}]}})).includes('acceptatiecriteria'));
});
test('materialChanges: meer parallelle agents is een budgetverruiming', () => {
  const a = geldig(), b = geldig({envelope: {budgets: {agent_calls: {soft: 2, hard: 4}, command_runs: 20, external_calls: 0, max_parallel: 2}}});
  assert.ok(materialChanges(a, b).includes('budget'));
  assert.deepEqual(materialChanges(b, a), []);
});
test('B5 behouden: een merge-gate kan niet stilletjes uit de envelop verdwijnen', () => {
  const m = geldig({envelope: {git: {commit: true, push: ['claude/w'], merge: {to: 'main'}, deploy: 'verify'}}});
  const zonder = geldig({envelope: {git: {commit: true, push: ['claude/w'], merge: null, deploy: 'verify'}}});
  assert.ok(materialChanges(m, zonder).includes('merge-gate verdwenen'));
});
test('materialChanges: de bewijsvloer mag niet lichter worden', () => {
  const a = geldig(), b = geldig(); b.plan.test_plan[1].description = 'Een andere, lichtere omschrijving van de test.';
  assert.ok(materialChanges(a, validateContract(b)).includes('bewijsplan'));
});
