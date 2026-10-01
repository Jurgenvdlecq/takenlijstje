// Draait de volledige v3.3-testsuite uit de payload (tools/aae-v33/payload/.claude/aae/tests) via één bestand.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const dir = path.resolve(here, '../payload/.claude/aae/tests');
const bestanden = fs.existsSync(dir) ? fs.readdirSync(dir).filter(f => f.endsWith('.test.mjs')).sort() : [];

test('v3.3-suite: de payload bevat testbestanden (een lege suite is geen bewijs)', () => {
  assert.ok(bestanden.length > 0, 'geen testbestanden in ' + dir);
});

for (const f of bestanden) await import(pathToFileURL(path.join(dir, f)).href);
