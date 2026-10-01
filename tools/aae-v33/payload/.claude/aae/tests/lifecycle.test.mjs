// Levenscyclus van agents en rapportopslag (pariteit L01-L07, plus AC5: bronnen, REPORT_LOST/CONFLICT, herstel, idempotentie, retry).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {fixture, cleanup, contract, executing, st, prompt, hook, pre, denies, agentCall, runAgent, REPORT, WHY, writeTranscript, installRuntime, spawnHook, SID} from './helpers.mjs';
import {reconcile, liveRows, finalizeRun, extractDigest, contentText, normalizeText, parseVerdict, DIGEST_MAX} from '../runtime/reports.mjs';
import {saveWork, loadWork} from '../runtime/state.mjs';
import {clock} from '../runtime/core.mjs';

const met = fn => async () => { const root = fixture(); const cfg = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'aae33cfg-'))); process.env.CLAUDE_CONFIG_DIR = cfg; try { await fn(root, cfg); } finally { cleanup(root); cleanup(cfg); delete process.env.CLAUDE_CONFIG_DIR; clock.ms = () => Date.now(); } };
const msg = fn => { const e = denies(fn); assert.ok(e, 'verwacht een weigering'); return e.message; };
const start = (root, id, agentId, vraag) => { agentCall(root, {id, vraag}); hook(root, {hook_event_name: 'SubagentStart', agent_type: 'aae-reviewer', agent_id: agentId}); };
const stop = (root, agentId, last) => hook(root, {hook_event_name: 'SubagentStop', agent_type: 'aae-reviewer', agent_id: agentId, ...(last === undefined ? {} : {last_assistant_message: last})});
const done = (root, id, agentId, content, extra = {}) => hook(root, {hook_event_name: 'PostToolUse', tool_name: 'Agent', tool_use_id: id, tool_input: {}, tool_response: {status: 'completed', agentId, ...(content === undefined ? {} : {content}), ...extra}});

test('L01 een late asynchrone startmelding laat een afgerond slot niet herleven', met((root, cfg) => {
  executing(root);
  runAgent(root, {configDir: cfg});
  hook(root, {hook_event_name: 'PostToolUse', tool_name: 'Agent', tool_use_id: 'tu-agent-1', tool_input: {}, tool_response: {status: 'async_launched', agentId: 'abcd1234'}});
  assert.equal(st(root).agents['tu-agent-1'].status, 'stopped');
  assert.equal(liveRows(st(root)).length, 0);
}));
test('L02 vervanger voor hervatten: een nieuwe start bindt aan de nieuwste reservering, nooit aan een oude afgeronde aanroep', met((root, cfg) => {
  executing(root);
  runAgent(root, {id: 'tu-1', agentId: 'aaaa0001', vraag: 'Beoordeel src/a.js.', configDir: cfg});
  agentCall(root, {id: 'tu-2', vraag: 'Beoordeel src/b.js.'});
  hook(root, {hook_event_name: 'SubagentStart', agent_type: 'aae-reviewer', agent_id: 'bbbb0002'});
  assert.equal(st(root).agents['tu-1'].agent_id, 'aaaa0001');
  assert.equal(st(root).agents['tu-2'].agent_id, 'bbbb0002');
  assert.equal(st(root).agents['tu-2'].status, 'running');
}));
test('L03 het rapport blijft bewaard als het stopbericht leeg is: het transcript is de bron, de respons bevestigt later', met((root, cfg) => {
  executing(root);
  start(root, 'tu-1', 'leeg0001', 'Beoordeel src/a.js.');
  writeTranscript(cfg, 'leeg0001', REPORT());
  stop(root, 'leeg0001', '');
  const r = st(root).agents['tu-1'];
  assert.equal(r.status, 'stopped');
  assert.equal(r.report.status, 'REPORT_UNVERIFIED', 'één bron is nog geen COMPLETED');
  assert.ok(fs.readFileSync(path.join(root, r.report.raw_path), 'utf8').includes('BEVINDINGEN'));
  done(root, 'tu-1', 'leeg0001', [{type: 'text', text: REPORT()}]);
  assert.equal(st(root).agents['tu-1'].report.status, 'COMPLETED');
}));
test('L04 een niet-geregistreerde agent krijgt geen toegang en geen registratie', met(root => {
  executing(root);
  const antwoord = hook(root, {hook_event_name: 'SubagentStart', agent_type: 'aae-reviewer', agent_id: 'wild0001'});
  assert.match(antwoord.hookSpecificOutput.additionalContext, /geen toegestane dispatch/);
  assert.equal(Object.keys(st(root).agents).length, 0);
  assert.ok(denies(() => pre(root, 'Read', {file_path: path.join(root, 'src/ok.test.mjs')}, {agent_id: 'wild0001', agent_type: 'aae-reviewer'})));
}));
test('L05 echt gescheiden hookprocessen kunnen niet twee slots reserveren bij max_parallel 1', met(async root => {
  executing(root); installRuntime(root);
  const call = (id, vraag) => spawnHook(root, {hook_event_name: 'PreToolUse', tool_name: 'Agent', tool_use_id: id, tool_input: {subagent_type: 'aae-reviewer', description: 'x', prompt: WHY + vraag, run_in_background: false}});
  const [a, b] = await Promise.all([call('p-1', 'Beoordeel src/a.js uitgebreid.'), call('p-2', 'Beoordeel src/b.js uitgebreid.')]);
  assert.deepEqual([a.code, b.code].sort(), [0, 2]);
  assert.equal(st(root).usage.agents, 1);
  assert.equal(liveRows(st(root)).length, 1);
}));
test('L06 een testauth-sessiebestand komt nooit in de Read-uitvoer van een model (hoofdsessie en specialist)', met(root => {
  executing(root);
  fs.mkdirSync(path.join(root, '.claude/aae/private'), {recursive: true}); fs.writeFileSync(path.join(root, '.claude/aae/private/auth.json'), '{"cookies":[]}');
  assert.ok(denies(() => pre(root, 'Read', {file_path: path.join(root, '.claude/aae/private/auth.json')})));
  assert.ok(denies(() => pre(root, 'Grep', {pattern: 'cookies', path: path.join(root, '.claude/aae/private/auth.json')})));
}));
test('L07 het gebruik van het laatste verzoek wordt niet als totaalverbruik van de run bestempeld', met((root, cfg) => {
  executing(root);
  start(root, 'tu-1', 'usg00001', 'Beoordeel src/a.js.');
  done(root, 'tu-1', 'usg00001', REPORT(), {usage: {input_tokens: 5, output_tokens: 7}, totalDurationMs: 1200, totalToolUseCount: 3});
  const r = st(root).agents['tu-1'];
  assert.deepEqual(r.last_request_usage, {input_tokens: 5, output_tokens: 7});
  assert.equal(r.observed_duration_ms, 1200); assert.equal(r.observed_tool_calls, 3);
  assert.equal(r.usage_total, undefined); assert.equal(st(root).usage.tokens, undefined);
}));

test('rapport: een samenvatting wordt uit het blok gehaald; zonder blok komen kop en staart met een melding, altijd ≤ 4 KB', () => {
  const blok = extractDigest(REPORT());
  assert.equal(blok.onvolledig, false); assert.ok(blok.tekst.startsWith('SAMENVATTING')); assert.ok(blok.tekst.endsWith('EINDE-SAMENVATTING'));
  const zonder = extractDigest('x'.repeat(20000));
  assert.equal(zonder.onvolledig, true); assert.ok(zonder.tekst.length <= 3200);
  assert.equal(contentText({content: 'tekst'}), 'tekst'); assert.equal(contentText({content: [{type: 'text', text: 'a'}, {type: 'text', text: 'b'}]}), 'a\nb'); assert.equal(contentText({}), null);
  assert.equal(normalizeText('a\r\nb  \n'), 'a\nb');
});
test('rapport: een staart-only last_assistant_message stemt overeen met de volledige tekst (twee bronnen)', met((root, cfg) => {
  executing(root);
  const lang = REPORT('READY', 'Lange toelichting op de bevindingen. '.repeat(100));
  start(root, 'tu-1', 'staart01', 'Beoordeel src/a.js.');
  stop(root, 'staart01', lang.slice(-1800));
  done(root, 'tu-1', 'staart01', lang);
  assert.equal(st(root).agents['tu-1'].report.status, 'COMPLETED');
}));
test('rapport: een ingekorte respons (kop) en het volledige transcript stemmen overeen; de volledige tekst wordt bewaard', met((root, cfg) => {
  executing(root);
  const lang = REPORT('READY', 'Lange toelichting op de bevindingen. '.repeat(100));
  start(root, 'tu-1', 'kop00001', 'Beoordeel src/a.js.');
  writeTranscript(cfg, 'kop00001', lang);
  stop(root, 'kop00001', lang.slice(-1800));
  done(root, 'tu-1', 'kop00001', lang.slice(0, 2000));
  const r = st(root).agents['tu-1'];
  assert.equal(r.report.status, 'COMPLETED');
  assert.ok(fs.readFileSync(path.join(root, r.report.raw_path), 'utf8').includes('EINDE-SAMENVATTING'), 'het einde staat in de ruwe laag');
}));
test('review: een sjabloonregel "READY|PARTIAL|BLOCKED" is geen oordeel; de laatste eenduidige regel wint', () => {
  assert.equal(parseVerdict('x', 'SAMENVATTING\nVERDICT: READY|PARTIAL|BLOCKED\nEINDE-SAMENVATTING'), 'UNKNOWN');
  assert.equal(parseVerdict('x', 'VERDICT: READY\nVERDICT: BLOCKED'), 'BLOCKED');
  assert.equal(parseVerdict('tekst\nSTATUS: PARTIAL', ''), 'PARTIAL');
  assert.equal(parseVerdict('Een tekst met STATUS: READY midden in een zin', ''), 'UNKNOWN');
});
test('rapport: afwijkende bronnen geven REPORT_CONFLICT en tellen niet als onafhankelijk READY-bewijs', met((root, cfg) => {
  executing(root);
  start(root, 'tu-1', 'conf0001', 'Beoordeel src/a.js.');
  writeTranscript(cfg, 'conf0001', REPORT('PARTIAL'));
  stop(root, 'conf0001', REPORT('PARTIAL'));
  done(root, 'tu-1', 'conf0001', REPORT('READY'));
  const r = st(root).agents['tu-1'];
  assert.equal(r.report.status, 'REPORT_CONFLICT'); assert.equal(r.report.verified, false);
}));
test('rapport: mislukte opslag geeft REPORT_LOST en wordt zonder gebruikersactie hersteld uit het transcript', met((root, cfg) => {
  executing(root);
  start(root, 'tu-1', 'lost0001', 'Beoordeel src/a.js.');
  writeTranscript(cfg, 'lost0001', REPORT());
  fs.writeFileSync(path.join(root, '.claude/aae/state/raw'), 'geen map');
  stop(root, 'lost0001', REPORT());
  assert.equal(st(root).agents['tu-1'].report.status, 'REPORT_LOST');
  fs.rmSync(path.join(root, '.claude/aae/state/raw'));
  const s = st(root); const w = reconcile(root, s); saveWork(root, s);
  assert.deepEqual(w.map(x => x.naar), ['report_hersteld']);
  const r = st(root).agents['tu-1'];
  assert.notEqual(r.report.status, 'REPORT_LOST');
  assert.ok(fs.existsSync(path.join(root, r.report.raw_path)));
}));
test('review: een verloren rapport wordt ook uit de bewaarde handback hersteld, en dezelfde vraag mag daarna opnieuw', met((root, cfg) => {
  executing(root);
  start(root, 'tu-1', 'hand0001', 'Beoordeel src/a.js.');
  fs.writeFileSync(path.join(root, '.claude/aae/state/raw'), 'geen map');
  const s0 = st(root); s0.agents['tu-1'].handback_text = REPORT(); saveWork(root, s0);
  stop(root, 'hand0001', REPORT());
  assert.equal(st(root).agents['tu-1'].report.status, 'REPORT_LOST');
  fs.rmSync(path.join(root, '.claude/aae/state/raw'));
  const s = st(root); assert.deepEqual(reconcile(root, s).map(x => x.naar), ['report_hersteld']); saveWork(root, s);
  assert.notEqual(st(root).agents['tu-1'].report.status, 'REPORT_LOST');
  assert.ok(agentCall(root, {id: 'tu-2', vraag: 'Beoordeel src/a.js.'}), 'een herstelbaar verloren rapport blokkeert dezelfde vraag niet');
}));
test('review: zonder transcript is alleen een hostbevestiging bewijs: hint of tijd geeft "onbevestigd", pas "host kent hem niet meer" geeft presumed_dead', met(root => {
  executing(root);
  start(root, 'tu-a', 'geen00001', 'Beoordeel src/a.js.');
  const t0 = Date.now(), s = st(root);
  s.agents['tu-a'].interrupted_hint = true;
  for (const m of [20, 22, 200]) reconcile(root, s, {nowMs: t0 + m * 60000});
  assert.equal(s.agents['tu-a'].status, 'unverified');
  s.agents['tu-a'].host_observed = {state: 'absent', at: t0}; reconcile(root, s, {nowMs: t0 + 203 * 60000});
  assert.equal(s.agents['tu-a'].status, 'presumed_dead');
}));
test('rapport: zonder enige bron is het resultaat REPORT_LOST (geen verzonnen rapport)', met(root => {
  const s = executing(root);
  const row = {run_key: 'run-009', role: 'aae-reviewer', focus: 'code', seq: 9};
  assert.equal(finalizeRun(root, s, row, {}).status, 'REPORT_LOST');
}));
test('idempotentie: dubbele stop- en afrondgebeurtenissen veranderen niets en starten niets', met((root, cfg) => {
  executing(root);
  runAgent(root, {configDir: cfg});
  const voor = st(root);
  const bestanden = fs.readdirSync(path.join(root, 'docs/aae/work/W-T/runs'));
  stop(root, 'abcd1234', REPORT()); done(root, 'tu-agent-1', 'abcd1234', REPORT()); stop(root, 'abcd1234', REPORT());
  const na = st(root);
  assert.equal(na.usage.agents, voor.usage.agents); assert.equal(na.agents['tu-agent-1'].status, 'stopped'); assert.equal(na.agents['tu-agent-1'].report.status, 'COMPLETED');
  assert.deepEqual(fs.readdirSync(path.join(root, 'docs/aae/work/W-T/runs')), bestanden);
  assert.equal(Object.keys(na.agents).length, 1);
}));
test('retry: na een vastgestelde dood mag een kleinere vraag, een identieke vraag niet (geen lus)', met((root, cfg) => {
  executing(root, {envelope: {budgets: {agent_calls: {soft: 2, hard: 6}, command_runs: 20, external_calls: 0, max_parallel: 1}}});
  const vraag = 'Beoordeel src/a.js en src/b.js volledig.';
  start(root, 'tu-a', 'dood0001', vraag);
  writeTranscript(cfg, 'dood0001', REPORT());
  const t0 = Date.now(), s = st(root);
  reconcile(root, s, {nowMs: t0 + 20 * 60000}); reconcile(root, s, {nowMs: t0 + 22 * 60000});
  s.agents['tu-a'].host_observed = {state: 'absent', at: t0}; reconcile(root, s, {nowMs: t0 + 24 * 60000}); saveWork(root, s);
  assert.equal(st(root).agents['tu-a'].status, 'presumed_dead');
  assert.match(msg(() => agentCall(root, {id: 'tu-b', vraag})), /eerder niet afgerond/);
  assert.ok(agentCall(root, {id: 'tu-c', vraag: 'Beoordeel alleen src/a.js, kleiner.'}));
  assert.equal(st(root).usage.agents, 2);
}));
test('late resultaten worden altijd verwerkt, ook nadat de agent als dood is aangemerkt', met((root, cfg) => {
  executing(root);
  start(root, 'tu-a', 'laat0001', 'Beoordeel src/a.js.');
  writeTranscript(cfg, 'laat0001', REPORT());
  const t0 = Date.now(), s = st(root);
  reconcile(root, s, {nowMs: t0 + 20 * 60000}); reconcile(root, s, {nowMs: t0 + 22 * 60000});
  s.agents['tu-a'].host_observed = {state: 'absent', at: t0}; reconcile(root, s, {nowMs: t0 + 24 * 60000}); saveWork(root, s);
  assert.equal(st(root).agents['tu-a'].status, 'presumed_dead');
  stop(root, 'laat0001', REPORT()); done(root, 'tu-a', 'laat0001', REPORT());
  assert.equal(st(root).agents['tu-a'].status, 'stopped');
  assert.equal(st(root).agents['tu-a'].report.status, 'COMPLETED');
}));
test('een hosthint "levend" houdt een stille agent in leven; een vervolgbericht geeft alleen een onderbrekingshint (geen dood)', met((root, cfg) => {
  executing(root);
  start(root, 'tu-a', 'leef0001', 'Beoordeel src/a.js.');
  const t0 = Date.now(), s = st(root);
  s.agents['tu-a'].host_observed = {state: 'alive', at: t0 + 19 * 60000};
  reconcile(root, s, {nowMs: t0 + 20 * 60000});
  assert.equal(s.agents['tu-a'].status, 'running');
  prompt(root, 'Hoe staat het ervoor?');
  assert.equal(st(root).agents['tu-a'].interrupted_hint, true);
  assert.notEqual(st(root).agents['tu-a'].status, 'presumed_dead');
}));
