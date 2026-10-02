// Referentie: draait de bestaande v3.2-testsuite op de baseline (.claude/aae/tests) via één bestand.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const dir = path.resolve(here, '../../../.claude/aae/tests');
const bestanden = fs.existsSync(dir) ? fs.readdirSync(dir).filter(f => f.endsWith('.test.mjs')).sort() : [];

test('v3.2-referentiesuite: de testbestanden van de baseline zijn aanwezig', () => {
  assert.ok(bestanden.length >= 5, 'verwacht minstens 5 testbestanden (guard, integrations, lifecycle, runner, visual), gevonden: ' + bestanden.join(', '));
});

for (const f of bestanden) await import(pathToFileURL(path.join(dir, f)).href);
