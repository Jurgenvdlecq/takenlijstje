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
