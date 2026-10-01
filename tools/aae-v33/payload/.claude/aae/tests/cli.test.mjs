// De opdrachtregel (cli.mjs) als echt proces op een wegwerpmap: plan, preflight, run, rapportage, projectie en afstemming.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {fixture, cleanup, contract, put, st, prompt, runAgent, installRuntime, executing} from './helpers.mjs';
import {validateContract, clock} from '../runtime/core.mjs';
import {contractFile} from '../runtime/state.mjs';

const met = fn => async () => { const root = fixture(); const cfg = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'aae33cfg-'))); process.env.CLAUDE_CONFIG_DIR = cfg; installRuntime(root); try { await fn(root, cfg); } finally { cleanup(root); cleanup(cfg); delete process.env.CLAUDE_CONFIG_DIR; clock.ms = () => Date.now(); } };
const cli = (root, ...args) => { const r = spawnSync(process.execPath, [path.join(root, '.claude/aae/runtime/cli.mjs'), ...args], {cwd: root, encoding: 'utf8', env: {...process.env}}); let json = null; try { json = JSON.parse(r.stdout); } catch { /* geen JSON */ } return {code: r.status, json, out: r.stdout, err: r.stderr}; };
const schrijf = (root, over = {}) => { const c = validateContract(structuredClone(contract(over))); put(root, contractFile(c.id), c); return c; };

test('CLI: plan, preflight, GO, run, report-template, project, prune en reconcile werken als proces', met(root => {
  schrijf(root);
  const plan = cli(root, 'plan', 'W-T');
  assert.equal(plan.code, 0, plan.err); assert.equal(plan.json.status, 'PLANNING'); assert.match(plan.json.blockers.join(' '), /Preflight/);
  const pre = cli(root, 'preflight', 'W-T');
  assert.equal(pre.code, 0, pre.err); assert.equal(pre.json.status, 'WAITING_FOR_APPROVAL'); assert.ok(pre.json.checks.some(c => c.name === 'node' && c.status === 'pass'));
  prompt(root, 'AAE GO');
  assert.equal(st(root).status, 'EXECUTING');
  const run = cli(root, 'run', 't_ok');
  assert.equal(run.code, 0, run.out + run.err); assert.equal(run.json.exit_code, 0);
  const tpl = cli(root, 'report-template');
  assert.equal(tpl.json.status, 'PARTIAL'); assert.match(tpl.json.envelope_hash, /^[0-9a-f]{64}$/);
  const proj = cli(root, 'project'), proj2 = cli(root, 'project');
  assert.equal(proj.code, 0, proj.err); assert.equal(proj2.code, 0);
  const md = fs.readFileSync(path.join(root, 'docs/aae/PROGRESS.md'), 'utf8');
  assert.equal(md.split('AAE-V33 START').length - 1, 1, 'precies één gegenereerd blok'); assert.match(md, /Werkpakket W-T is in uitvoering/);
  assert.deepEqual(cli(root, 'prune').json.verwijderd, []);
  assert.deepEqual(cli(root, 'reconcile').json.wijzigingen, []);
  assert.match(cli(root, 'status').json.plain[0], /W-T/);
}));
test('CLI: onbekende opdrachten, ontbrekende argumenten en te veel argumenten geven een duidelijke foutcode', met(root => {
  for (const args of [['bestaat-niet'], ['plan'], ['run'], ['status', 'a', 'b']]) { const r = cli(root, ...args); assert.equal(r.code, 2, args.join(' ')); assert.match(r.err, /^AAE: /); }
  assert.equal(cli(root, 'plan', 'W-ONBEKEND').code, 2);
}));
test('CLI: een agentrapport is terug te vinden en optioneel te bewaren; een onbekende agent wordt geweigerd', met((root, cfg) => {
  executing(root);
  runAgent(root, {configDir: cfg});
  const rep = cli(root, 'report', 'run-001');
  assert.equal(rep.code, 0, rep.err); assert.equal(rep.json.status, 'stopped'); assert.ok(fs.existsSync(path.join(root, rep.json.lees_de_ruwe_tekst_met_Read_op)));
  const keep = cli(root, 'keep-raw', 'run-001');
  assert.equal(keep.code, 0, keep.err); assert.ok(fs.existsSync(path.join(root, keep.json.keep_raw)));
  assert.equal(cli(root, 'observe-absent', 'bestaat-niet-1').code, 2);
}));
test('CLI + commando\'s: een preflight-fout wordt gebundeld gemeld (NEEDS_HUMAN); AAE VERDER zet het plan terug naar PLANNING met een verse preflight-eis', met(root => {
  schrijf(root, {plan: {...contract().plan, preflight: {env_names: ['AAE_TEST_ONTBREEKT_2'], hosts: []}}});
  cli(root, 'plan', 'W-T');
  const pre = cli(root, 'preflight', 'W-T');
  assert.equal(pre.json.status, 'NEEDS_HUMAN'); assert.equal(pre.json.acties.length, 1); assert.match(pre.json.acties[0], /AAE_TEST_ONTBREEKT_2/);
  prompt(root, 'AAE GO');
  assert.equal(st(root).status, 'NEEDS_HUMAN', 'een GO lost een externe voorwaarde niet op');
  prompt(root, 'AAE VERDER');
  assert.equal(st(root).status, 'PLANNING'); assert.match(st(root).blockers.join(' '), /Preflight/);
}));
test('CLI: scope-change legt een beslisvraag vast en AAE VERDER hervat binnen dezelfde envelop', met(root => {
  executing(root);
  const r = cli(root, 'scope-change');
  assert.equal(r.code, 0, r.err); assert.equal(r.json.status, 'NEEDS_HUMAN');
  prompt(root, 'AAE VERDER');
  assert.equal(st(root).status, 'EXECUTING');
}));
