// P3: bewijs dat de actieve AAE-runtime tijdens de meting nooit is bewerkt.
// Vergelijkt de werkbestanden met de gecommitte versie (HEAD) en controleert dat .claude en CLAUDE.md schoon zijn.
import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const git = (...args) => {
  const r = spawnSync('git', args, {cwd: root, encoding: 'utf8', shell: false});
  return {code: r.status, out: (r.stdout || '').trim(), err: (r.stderr || '').trim()};
};

test('P3: hook.mjs en settings.json zijn byte-identiek aan de gecommitte versie', () => {
  for (const p of ['.claude/aae/runtime/hook.mjs', '.claude/settings.json']) {
    const werk = git('hash-object', p);
    const commit = git('rev-parse', 'HEAD:' + p);
    assert.equal(werk.code, 0, werk.err);
    assert.equal(commit.code, 0, commit.err);
    assert.equal(werk.out, commit.out, p + ' wijkt af van HEAD');
  }
});

test('P3: geen enkel bestand onder .claude of CLAUDE.md wijkt af van HEAD', () => {
  const r = git('status', '--porcelain', '--', '.claude', 'CLAUDE.md');
  assert.equal(r.code, 0, r.err);
  assert.deepEqual(r.out.split('\n').filter(Boolean), []);
});

test('P3: de werkbranch bevat geen W-03-commit', () => {
  const w03 = [
    'f2e76072436d1cc4897ff71020714072de1fc623',
    '2b2ae6c9763ce63b7b0fc465a3a95d4328efff55',
    '3456dc379309ecc65a8d1a7538b170c64358e506',
    'f71cc0fb88fd1ffc7014833aac8adc5f4f62609a',
    'ecc38cb40657d570dd6193d5b60687637bdd440e'
  ];
  for (const sha of w03) {
    const r = git('merge-base', '--is-ancestor', sha, 'HEAD');
    assert.equal(r.code, 1, 'W-03-commit ' + sha.slice(0, 7) + ' zit in de geschiedenis van de werkbranch');
  }
});
