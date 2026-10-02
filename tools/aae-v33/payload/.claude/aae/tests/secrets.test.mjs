// AAE-V33-001F: één gedeelde geheimencontrole voor Read, Grep en Glob (reviewscenario van b4f39b7, letterlijk) en een file:-URL via WebFetch.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fixture, cleanup, pre, denies} from './helpers.mjs';

const met = fn => () => { const root = fixture(); try { fn(root); } finally { cleanup(root); } };
const schrijf = (root, rel, inhoud = 'GEHEIM=1\n') => { fs.mkdirSync(path.dirname(path.join(root, rel)), {recursive: true}); fs.writeFileSync(path.join(root, rel), inhoud); };
const metGeheimen = fn => met(root => { schrijf(root, '.env'); schrijf(root, '.claude/aae/private/auth.json', '{}\n'); schrijf(root, 'src/a.ts', 'const a = 1;\n'); fn(root); });
const weigert = (root, tool, input, msg) => { const e = denies(() => pre(root, tool, input)); assert.ok(e, tool + ' ' + JSON.stringify(input)); if (msg) assert.match(e.message, msg, JSON.stringify(input)); };
const mag = (root, tool, input) => assert.equal(pre(root, tool, input), null, tool + ' ' + JSON.stringify(input));

test('RF02 Grep met glob .env en inhoud, en Grep/Glob op .claude/aae/private zonder slash, lezen geen geheim (reviewscenario, letterlijk)', metGeheimen(root => {
  weigert(root, 'Grep', {pattern: 'GEHEIM', glob: '.env', output_mode: 'content'});
  weigert(root, 'Grep', {pattern: '.', glob: '.env', path: root, output_mode: 'content'});
  for (const p of ['.claude/aae/private', '.claude/aae/private/', path.join(root, '.claude/aae/private'), '.claude/aae/private/auth.json', '.CLAUDE/aae/Private'])
    for (const tool of ['Grep', 'Glob']) weigert(root, tool, tool === 'Grep' ? {pattern: '.', path: p, output_mode: 'content'} : {pattern: '*', path: p});
}));
test('RF02 padvarianten: .ENV, src/../.env, .env.*, absolute paden en .env in een submap worden geweigerd; .env.example mag', metGeheimen(root => {
  schrijf(root, '.env.example', 'NAAM=\n'); schrijf(root, 'src/.env.local');
  for (const p of ['.ENV', '.Env.Local', 'src/../.env', '.env.production', 'src/.env.local', path.join(root, '.env'), './.env']) {
    weigert(root, 'Read', {file_path: path.isAbsolute(p) ? p : path.join(root, p)});
    weigert(root, 'Grep', {pattern: '.', path: p, output_mode: 'content'});
    weigert(root, 'Glob', {pattern: '*', path: p});
  }
  mag(root, 'Read', {file_path: path.join(root, '.env.example')});
  mag(root, 'Grep', {pattern: 'NAAM', path: '.env.example', output_mode: 'content'});
}));
test('RF02 selectors: onbekende parameters en glob-tekens buiten de eenvoudige set worden geweigerd (fail-closed)', metGeheimen(root => {
  weigert(root, 'Read', {file_path: path.join(root, 'src/a.ts'), onbekend: 1});
  weigert(root, 'Grep', {pattern: 'a', path: 'src', bestand: '.env'});
  weigert(root, 'Glob', {pattern: '*.ts', cwd: '.'});
  for (const g of ['{src,.env}', '.e[n]v', '!*.ts', '*.{ts,env}', '.env*', '.ENV', '*private*', '../*', '/etc/*', 'a b', '.claude/aae/priv?te/*', 'src/../.env'])
    for (const [tool, sleutel] of [['Grep', 'glob'], ['Glob', 'pattern']]) weigert(root, tool, {...(tool === 'Grep' ? {pattern: 'a'} : {}), [sleutel]: g, path: 'src'});
  weigert(root, 'Grep', {pattern: 'a', path: 'src', glob: 7});
  weigert(root, 'Read', {file_path: 5});
}));
test('RF02 een brede Grep over een map met een bestaand geheim vraagt een veilige afbakening; gewone zoekopdrachten blijven werken', metGeheimen(root => {
  mag(root, 'Grep', {pattern: 'a', path: 'src'});
  mag(root, 'Grep', {pattern: 'a', glob: '*.ts'});
  mag(root, 'Grep', {pattern: 'a', path: root, glob: 'src/**/*.ts', output_mode: 'content'});
  mag(root, 'Glob', {pattern: '**/*.ts'});
  mag(root, 'Read', {file_path: path.join(root, 'src/a.ts')});
  for (const input of [{pattern: 'a'}, {pattern: 'a', path: '.'}, {pattern: 'a', path: root}, {pattern: 'a', glob: '*.json'}, {pattern: 'a', glob: '*'}, {pattern: 'a', glob: '.*'}, {pattern: 'a', glob: '**/*'}, {pattern: 'a', glob: 'aae/'}, {pattern: 'a', type: 'json'}])
    weigert(root, 'Grep', input, /te breed/);
  weigert(root, 'Glob', {pattern: '*'}, /te breed/);
  weigert(root, 'Glob', {pattern: '.claude/**/*.json'}, /te breed/);
}));
test('RF02 zonder bestaand geheim blijft een brede Grep gewoon werken', met(root => {
  schrijf(root, 'src/a.ts', 'x\n');
  mag(root, 'Grep', {pattern: 'x'}); mag(root, 'Grep', {pattern: 'x', path: root, output_mode: 'content'}); mag(root, 'Glob', {pattern: '*'});
}));
test('RF02 een file:-URL via WebFetch wordt geweigerd; een gewone URL niet', met(root => {
  for (const url of ['file:///etc/passwd', 'FILE:///home/user/.env', ' file:///x', 'file:/' + path.join(root, '.env')]) weigert(root, 'WebFetch', {url, prompt: 'lees'}, /file:/);
  mag(root, 'WebFetch', {url: 'https://example.com', prompt: 'samenvatten'});
}));
