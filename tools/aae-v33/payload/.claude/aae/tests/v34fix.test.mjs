// AAE-V34-FLOW-FIX: twee geheimenpunten uit de review van 99fc88b. (1) annotated tags worden volledig uitgepakt; een tag naar een blob toont nooit inhoud.
// (2) paden in inhoudelijke git-operaties zijn letterlijk: een bestandsnaam met *, ? of [ kan geen geheim bestand ernaast raken.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {fixture, cleanup, contract, executing, bash, denies, put} from './helpers.mjs';
import {breedLezen, inhoudLezen} from '../runtime/gitlezen.mjs';
import {runCommand} from '../runtime/runner.mjs';

const sh = (root, ...a) => spawnSync('git', ['-c', 'user.email=t@t.nl', '-c', 'user.name=T', '-c', 'commit.gpgsign=false', '-c', 'tag.gpgsign=false', ...a], {cwd: root, encoding: 'utf8'});
const met = fn => async () => { const root = fixture(); try { await fn(root); } finally { cleanup(root); } };
const amsg = async p => { try { await p; } catch (e) { return e.message; } assert.fail('verwacht een weigering'); };
// Een geheim dat de inhoudsscan niet herkent: alleen het pad beschermt het.
const GEHEIM = 'TOPGEHEIM_WAARDE_123';

function repoMetTags(root) {
  put(root, 'src/a.js', 'export const a = 1;\n'); put(root, '.env', GEHEIM + '\n');
  sh(root, 'init', '-q'); sh(root, 'add', '-A'); sh(root, 'commit', '-q', '-m', 'eerste');
  const blob = sh(root, 'rev-parse', 'HEAD:.env').stdout.trim();
  sh(root, 'tag', '-a', 'tblob', '-m', 'tag naar blob', blob);
  sh(root, 'tag', '-a', 'ttag', '-m', 'tag op tag', 'tblob');
  sh(root, 'tag', 'lblob', blob);
  sh(root, 'tag', '-a', 'tcommit', '-m', 'tag naar commit', 'HEAD');
  sh(root, 'tag', '-a', 'ttree', '-m', 'tag naar tree', sh(root, 'rev-parse', 'HEAD^{tree}').stdout.trim());
  return blob;
}

test('FIX-01 een (annotated) tag naar een blob, ook tag-op-tag, toont nooit inhoud; een tag naar een commit of tree blijft toegestaan', met(async root => {
  repoMetTags(root);
  for (const tag of ['tblob', 'ttag', 'lblob']) {
    for (const argv of [['git', 'show', '--stat', tag], ['git', 'show', '--name-only', tag], ['git', 'diff', '--stat', tag, tag], ['git', 'log', '--oneline', tag], ['git', 'ls-tree', '-r', '--name-only', tag]])
      assert.equal(breedLezen(argv, root), false, argv.join(' '));
    assert.ok(denies(() => bash(root, 'git show --stat ' + tag)), 'Bash: ' + tag);
    for (const argv of [['show', '--stat', tag], ['diff', tag, tag, '--', 'src/a.js'], ['grep', '-e', 'TOP', tag, '--', 'src'], ['blame', tag, '--', 'src/a.js']]) {
      let uit = ''; try { uit = inhoudLezen(root, argv).uitvoer; } catch { continue; }
      assert.fail('niet geweigerd: ' + argv.join(' ') + (uit.includes(GEHEIM) ? ' (en het geheim is zichtbaar)' : ''));
    }
  }
  assert.equal(breedLezen(['git', 'show', '--stat', 'tcommit'], root), true, 'tag naar commit');
  assert.equal(breedLezen(['git', 'show', '--name-only', 'ttree'], root), true, 'tag naar tree');
  assert.ok(!inhoudLezen(root, ['show', '--stat', 'tcommit']).uitvoer.includes(GEHEIM));
}));
test('FIX-02 ook via cli run toont een tag naar een blob geen inhoud', met(async root => {
  repoMetTags(root);
  executing(root, {plan: {...contract().plan, commands: [...contract().plan.commands, {id: 'tagblob', argv: ['git', 'show', '--stat', 'ttag'], purpose: 'read', why: 'Tag op tag naar een blob.', watch: [], timeout_ms: 30000, max_runs: 3}]}});
  assert.match(await amsg(runCommand(root, 'tagblob')), /blob/);
}));

for (const naam of ['*', '?env', '[.]env']) {
  test('FIX-03 een bestandsnaam "' + naam + '" naast een geheim maakt van diff of grep geen zoekpatroon dat het geheim raakt', met(async root => {
    put(root, 'src/' + naam, 'onschuldig\n'); put(root, 'src/.env', GEHEIM + '\n'); put(root, 'src/a.js', 'export const a = 1;\n');
    sh(root, 'init', '-q'); sh(root, 'add', '-A'); sh(root, 'commit', '-q', '-m', 'eerste');
    // grep over de map op HEAD: het geheim mag nooit in de uitvoer komen
    let g = {uitvoer: ''}; try { g = inhoudLezen(root, ['grep', '-e', 'TOPGEHEIM', 'HEAD', '--', 'src']); } catch { /* geweigerd is ook goed */ }
    assert.ok(!g.uitvoer.includes(GEHEIM), 'grep toonde het geheim via de naam ' + naam);
    // diff over de map in de werkmap: beide bestanden gewijzigd, alleen het onschuldige mag zichtbaar zijn
    fs.writeFileSync(path.join(root, 'src', naam), 'gewijzigd\n'); fs.writeFileSync(path.join(root, 'src/.env'), GEHEIM + '_NIEUW\n');
    let d = {uitvoer: ''}; try { d = inhoudLezen(root, ['diff', '--', 'src']); } catch { /* geweigerd is ook goed */ }
    assert.ok(!d.uitvoer.includes(GEHEIM), 'diff toonde het geheim via de naam ' + naam);
    let dh = {uitvoer: ''}; try { dh = inhoudLezen(root, ['diff', 'HEAD', '--', 'src']); } catch { /* geweigerd is ook goed */ }
    assert.ok(!dh.uitvoer.includes(GEHEIM), 'diff HEAD toonde het geheim via de naam ' + naam);
  }));
}

// AAE-V34-FLOW-FIX2 (review van 50b61eb): inhoud alleen vanaf een commit. Een maphash plus een kort pad (<map>:state.json) mag het geheimenfilter niet omzeilen.
for (const [map, naam] of [['tests/.auth', 'state.json'], ['.claude/aae/private', 'cookies.json'], ['testauth', 'token.json']]) {
  test('FIX-04 een gevolgd geheim in ' + map + ' wordt niet zichtbaar via een maphash of een tag naar een map', met(async root => {
    put(root, 'src/a.js', 'export const a = 1;\n'); put(root, map + '/' + naam, GEHEIM + '\n');
    sh(root, 'init', '-q'); sh(root, 'add', '-A'); sh(root, 'add', '-f', '--', map + '/' + naam); sh(root, 'commit', '-q', '-m', 'eerste');
    const boom1 = sh(root, 'rev-parse', 'HEAD:' + map).stdout.trim();
    assert.match(boom1, /^[0-9a-f]{40}$/, 'het geheim is gevolgd');
    put(root, map + '/' + naam, GEHEIM + '_TWEE\n'); sh(root, 'add', '-f', '--', map + '/' + naam); sh(root, 'commit', '-q', '-m', 'tweede');
    const boom2 = sh(root, 'rev-parse', 'HEAD:' + map).stdout.trim();
    sh(root, 'tag', '-a', 'tboom', '-m', 'tag naar map', boom2); sh(root, 'tag', 'lboom', boom2);
    sh(root, 'tag', '-a', 'tcommit', '-m', 'tag naar commit', 'HEAD');
    // stap 1: een map opvragen geeft geen maphashes
    const ouder = map.includes('/') ? map.slice(0, map.lastIndexOf('/')) : null;
    if (ouder) for (const argv of [['cat-file', '-p', 'HEAD:' + ouder], ['cat-file', '-p', 'HEAD:src']]) {
      let uit = ''; try { uit = inhoudLezen(root, argv).uitvoer; } catch { continue; }
      assert.fail('niet geweigerd: ' + argv.join(' ') + (uit.includes(boom1.slice(0, 12)) || uit.includes(boom2.slice(0, 12)) ? ' (en de maphash is zichtbaar)' : ''));
    }
    // stap 2: met de maphash (of een tag naar de map) als revisie wordt elke inhoudelijke route geweigerd
    for (const rev of [boom1, boom2, 'tboom', 'lboom']) {
      for (const argv of [['cat-file', '-p', rev + ':' + naam], ['show', rev + ':' + naam], ['grep', '-e', 'TOPGEHEIM', rev, '--', naam], ['diff', boom1, rev, '--', naam], ['diff', rev, '--', naam], ['blame', rev, '--', naam]]) {
        let uit = ''; try { uit = inhoudLezen(root, argv).uitvoer; } catch { continue; }
        assert.fail('niet geweigerd: ' + argv.join(' ') + (uit.includes(GEHEIM) ? ' (en het geheim is zichtbaar)' : ''));
      }
    }
    // inhoud vanaf een commit blijft werken
    assert.match(inhoudLezen(root, ['show', 'HEAD:src/a.js']).uitvoer, /export const a = 1/);
    assert.match(inhoudLezen(root, ['cat-file', '-p', 'tcommit:src/a.js']).uitvoer, /export const a = 1/);
    assert.match(inhoudLezen(root, ['grep', '-e', 'export', 'tcommit', '--', 'src']).uitvoer, /src\/a\.js/);
    assert.equal(inhoudLezen(root, ['diff', 'HEAD~1', 'HEAD', '--', 'src']).uitvoer, '');
    assert.match(inhoudLezen(root, ['blame', 'tcommit', '--', 'src/a.js']).uitvoer, /export const a/);
  }));
}
