// Geheimenscenario's uit de reviews van 99fc88b en 50b61eb. Sinds AAE-V34-AF bestaat de inhoudsroute (cli git) niet meer; deze tests bewijzen dat
// dezelfde scenario's zonder GO geen inhoud kunnen tonen: (1) een tag of tag-op-tag naar een blob, (2) bestandsnamen met *, ? of [ naast een geheim,
// (3) een maphash van een geheime map met een kort pad.
import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {fixture, cleanup, contract, executing, bash, denies, put} from './helpers.mjs';
import * as gitlezen from '../runtime/gitlezen.mjs';
import {runCommand} from '../runtime/runner.mjs';

const {breedLezen, veiligPad} = gitlezen;
const sh = (root, ...a) => spawnSync('git', ['-c', 'user.email=t@t.nl', '-c', 'user.name=T', '-c', 'commit.gpgsign=false', '-c', 'tag.gpgsign=false', ...a], {cwd: root, encoding: 'utf8'});
const met = fn => async () => { const root = fixture(); try { await fn(root); } finally { cleanup(root); } };
const amsg = async p => { try { await p; } catch (e) { return e.message; } assert.fail('verwacht een weigering'); };
const GEHEIM = 'TOPGEHEIM_WAARDE_123';
const CLI = 'node .claude/aae/runtime/cli.mjs git ';
/** Elke inhoudelijke git-vorm met deze revisie en dit pad, direct en via de (verwijderde) opdrachtregel. */
const inhoudVormen = (rev, pad) => [
  'git show ' + rev + ':' + pad, 'git cat-file -p ' + rev + ':' + pad, 'git show ' + rev, 'git cat-file -p ' + rev, 'git diff ' + rev + ' -- ' + pad, 'git grep -e TOP ' + rev + ' -- ' + pad, 'git blame ' + rev + ' -- ' + pad,
  CLI + 'show ' + rev + ':' + pad, CLI + 'cat-file -p ' + rev + ':' + pad, CLI + 'diff ' + rev + ' -- ' + pad, CLI + 'grep -e TOP ' + rev + ' -- ' + pad, CLI + 'blame ' + rev + ' -- ' + pad];

test('FIX-00 (AAE-V34-AF) de inhoudsroute bestaat niet meer', () => {
  assert.equal(gitlezen.inhoudLezen, undefined);
});

test('FIX-01 een (annotated) tag naar een blob, ook tag-op-tag, toont nooit inhoud; een tag naar een commit of tree blijft toegestaan voor namen en statistiek', met(async root => {
  put(root, 'src/a.js', 'export const a = 1;\n'); put(root, '.env', GEHEIM + '\n');
  sh(root, 'init', '-q'); sh(root, 'add', '-A'); sh(root, 'commit', '-q', '-m', 'eerste');
  const blob = sh(root, 'rev-parse', 'HEAD:.env').stdout.trim();
  sh(root, 'tag', '-a', 'tblob', '-m', 'tag naar blob', blob); sh(root, 'tag', '-a', 'ttag', '-m', 'tag op tag', 'tblob'); sh(root, 'tag', 'lblob', blob);
  sh(root, 'tag', '-a', 'tcommit', '-m', 'tag naar commit', 'HEAD'); sh(root, 'tag', '-a', 'ttree', '-m', 'tag naar tree', sh(root, 'rev-parse', 'HEAD^{tree}').stdout.trim());
  for (const tag of ['tblob', 'ttag', 'lblob']) {
    for (const argv of [['git', 'show', '--stat', tag], ['git', 'show', '--name-only', tag], ['git', 'diff', '--stat', tag, tag], ['git', 'log', '--oneline', tag], ['git', 'ls-tree', '-r', '--name-only', tag]])
      assert.equal(breedLezen(argv, root), false, argv.join(' '));
    assert.ok(denies(() => bash(root, 'git show --stat ' + tag)), 'Bash: ' + tag);
    for (const c of inhoudVormen(tag, 'src/a.js')) assert.ok(denies(() => bash(root, c)), c);
  }
  assert.equal(breedLezen(['git', 'show', '--stat', 'tcommit'], root), true, 'tag naar commit');
  assert.equal(breedLezen(['git', 'show', '--name-only', 'ttree'], root), true, 'tag naar tree');
}));
test('FIX-02 ook via cli run toont een tag naar een blob geen inhoud', met(async root => {
  put(root, 'src/a.js', 'export const a = 1;\n'); put(root, '.env', GEHEIM + '\n');
  sh(root, 'init', '-q'); sh(root, 'add', '-A'); sh(root, 'commit', '-q', '-m', 'eerste');
  sh(root, 'tag', '-a', 'tblob', '-m', 'tag naar blob', sh(root, 'rev-parse', 'HEAD:.env').stdout.trim()); sh(root, 'tag', '-a', 'ttag', '-m', 'tag op tag', 'tblob');
  executing(root, {plan: {...contract().plan, commands: [...contract().plan.commands, {id: 'tagblob', argv: ['git', 'show', '--stat', 'ttag'], purpose: 'read', why: 'Tag op tag naar een blob.', watch: [], timeout_ms: 30000, max_runs: 3}]}});
  assert.match(await amsg(runCommand(root, 'tagblob')), /blob/);
}));

for (const naam of ['*', '?env', '[.]env']) {
  test('FIX-03 een bestandsnaam "' + naam + '" naast een geheim geeft zonder GO geen toegang tot inhoud', met(async root => {
    put(root, 'src/' + naam, 'onschuldig\n'); put(root, 'src/.env', GEHEIM + '\n'); put(root, 'src/a.js', 'export const a = 1;\n');
    sh(root, 'init', '-q'); sh(root, 'add', '-A'); sh(root, 'commit', '-q', '-m', 'eerste');
    assert.equal(veiligPad('src/' + naam), false, 'een naam met een jokerteken is nooit een veilig pad');
    for (const c of [...inhoudVormen('HEAD', 'src'), 'git diff -- src', 'git grep -e TOP -- src', CLI + 'diff -- src', CLI + 'grep -e TOP HEAD -- src']) assert.ok(denies(() => bash(root, c)), c);
  }));
}

for (const [map, naam] of [['tests/.auth', 'state.json'], ['.claude/aae/private', 'cookies.json'], ['testauth', 'token.json']]) {
  test('FIX-04 een gevolgd geheim in ' + map + ' wordt niet zichtbaar via een maphash of een tag naar een map', met(async root => {
    put(root, 'src/a.js', 'export const a = 1;\n'); put(root, map + '/' + naam, GEHEIM + '\n');
    sh(root, 'init', '-q'); sh(root, 'add', '-A'); sh(root, 'add', '-f', '--', map + '/' + naam); sh(root, 'commit', '-q', '-m', 'eerste');
    const boom = sh(root, 'rev-parse', 'HEAD:' + map).stdout.trim();
    assert.match(boom, /^[0-9a-f]{40}$/, 'het geheim is gevolgd');
    sh(root, 'tag', '-a', 'tboom', '-m', 'tag naar map', boom); sh(root, 'tag', 'lboom', boom);
    const ouder = map.includes('/') ? map.slice(0, map.lastIndexOf('/')) : 'src';
    // stap 1: een map opvragen met inhoud of objecthashes kan niet
    for (const c of ['git cat-file -p HEAD:' + ouder, 'git ls-tree HEAD ' + ouder, 'git ls-tree -r HEAD', CLI + 'cat-file -p HEAD:' + ouder]) assert.ok(denies(() => bash(root, c)), c);
    // stap 2: met de maphash of een tag naar de map wordt elke inhoudelijke vorm geweigerd
    for (const rev of [boom, 'tboom', 'lboom']) for (const c of inhoudVormen(rev, naam)) assert.ok(denies(() => bash(root, c)), c);
    // ook met een actief werkpakket buiten een gepland commando om
    executing(root);
    for (const c of inhoudVormen(boom, naam)) assert.ok(denies(() => bash(root, c)), 'met werkpakket: ' + c);
  }));
}
