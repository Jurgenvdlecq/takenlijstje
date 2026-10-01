// Hulpfuncties voor de v3.3-tests. Alles draait op een wegwerpmap; er wordt nooit in het echte project geschreven.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawn} from 'node:child_process';
import {handleEvent} from '../runtime/events.mjs';
import {validateContract, now, envelopeHash} from '../runtime/core.mjs';
import {registerContract, loadWork, saveWork, contractFile, withLock} from '../runtime/state.mjs';

export const SID = 'sessie-1';
export function fixture() {
  const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'aae33-')));
  for (const d of ['docs/aae/work', '.claude/aae/state', 'src', 'tests']) fs.mkdirSync(path.join(root, d), {recursive: true});
  fs.writeFileSync(path.join(root, 'package.json'), '{"name":"fixture","private":true}\n');
  fs.writeFileSync(path.join(root, 'src/ok.test.mjs'), "import test from 'node:test';\ntest('ok', () => {});\n");
  fs.writeFileSync(path.join(root, 'src/rood.test.mjs'), "import test from 'node:test';\ntest('rood', () => { throw new Error('bewust rood'); });\n");
  return root;
}
export const cleanup = root => fs.rmSync(root, {recursive: true, force: true});

/** Een geldig STANDARD-contract; overrides ondiep samengevoegd per niveau (envelope/plan apart). */
export function contract(over = {}) {
  const id = over.id || 'W-T';
  const base = {
    schema_version: 4, id, title: 'Testwerkpakket', goal: 'Een kleine wijziging in het afgesproken gebied maken en bewijzen.', risk_class: 'STANDARD', risk_flags: [],
    envelope: {
      phase: 'implementation', areas: [{name: 'Broncode', write: ['src'], support: ['tests']}], db_max: 'none', providers: {},
      git: {commit: false, push: [], merge: null, deploy: 'none'},
      budgets: {agent_calls: {soft: 2, hard: 4}, command_runs: 20, external_calls: 0, max_parallel: 1},
      acceptance: [{id: 'AC1', text: 'De wijziging werkt zoals afgesproken.'}], assumptions: [], decision_defaults: [], decision_points: [], extra_commands: []
    },
    plan: {
      test_plan: [
        {kind: 'scope', method: 'inspection', description: 'Controleer dat alleen het afgesproken gebied is gewijzigd.'},
        {kind: 'functional', method: 'command', description: 'Draai de testbestanden van het gebied.'},
        {kind: 'regression', method: 'command', description: 'Draai de bestaande tests opnieuw.'}
      ],
      agents: [{name: 'aae-reviewer', focus: 'code', question: 'Beoordeel de wijziging op regressies.', files: ['src']}],
      commands: [{id: 't_ok', argv: ['node', '--test', 'src/ok.test.mjs'], purpose: 'test', why: 'Draait de testbestanden van het gebied.', watch: [], timeout_ms: 60000, max_runs: 5}],
      open_product_questions: [], keep_raw: false
    }
  };
  const c = {...base, ...over, envelope: {...base.envelope, ...(over.envelope || {})}, plan: {...base.plan, ...(over.plan || {})}};
  return c;
}
export function put(root, rel, value) {
  const f = path.join(root, rel); fs.mkdirSync(path.dirname(f), {recursive: true});
  fs.writeFileSync(f, typeof value === 'string' ? value : JSON.stringify(value, null, 2) + '\n');
}
/** Registreert het contract en zet een verse preflight zodat een STANDARD/HIGH-pakket naar WAITING_FOR_APPROVAL kan. */
export function plan(root, over = {}) {
  const c = validateContract(contract(over));
  put(root, contractFile(c.id), c);
  registerContract(root, c);
  withLock(root, () => { const st = loadWork(root, c.id); st.preflight = {at: now(), checks: [{name: 'node', status: 'pass'}]}; saveWork(root, st); });
  registerContract(root, c);
  return loadWork(root, c.id);
}
export const hook = (root, e) => handleEvent(root, {session_id: SID, cwd: root, ...e});
export const prompt = (root, text) => hook(root, {hook_event_name: 'UserPromptSubmit', prompt: text});
/** Plan + exacte GO: het werkpakket staat in EXECUTING. */
export function executing(root, over = {}) {
  plan(root, over); prompt(root, 'AAE GO');
  return loadWork(root, (over.id || 'W-T'));
}
export const st = (root, id = 'W-T') => loadWork(root, id);
export const pre = (root, tool_name, tool_input, extra = {}) => hook(root, {hook_event_name: 'PreToolUse', tool_name, tool_input, tool_use_id: 'tu-' + Math.random().toString(36).slice(2, 8), ...extra});
export const write = (root, rel, content = 'x') => pre(root, 'Write', {file_path: path.join(root, rel), content});
export const bash = (root, command) => pre(root, 'Bash', {command});
export function denies(fn) { try { fn(); return false; } catch (e) { return e; } }

export const WHY = 'WAAROM-AGENT: onafhankelijke controle van de wijziging die ik zelf niet onbevooroordeeld kan doen\nFOCUS: code\n';
export function agentCall(root, {id = 'tu-agent-1', vraag = 'Beoordeel src/a.js op regressies.', role = 'aae-reviewer', prompt: p} = {}) {
  return pre(root, 'Agent', {subagent_type: role, description: 'Review', prompt: p ?? (WHY + vraag), run_in_background: false}, {tool_use_id: id});
}
export const REPORT = (verdict = 'READY', extra = '') => ['Ik heb de wijziging bekeken.', extra, 'SAMENVATTING', 'VERDICT: ' + verdict, 'BEVINDINGEN: geen blokkerende bevindingen gevonden in het gebied src.', 'NIET GECONTROLEERD: de browser.', 'EINDE-SAMENVATTING'].filter(Boolean).join('\n');
export function writeTranscript(configDir, agentId, text) {
  const dir = path.join(configDir, 'projects', 'p', 'sessie', 'subagents'); fs.mkdirSync(dir, {recursive: true});
  const f = path.join(dir, 'agent-' + agentId + '.jsonl');
  fs.writeFileSync(f, [JSON.stringify({type: 'user', message: {role: 'user', content: 'vraag'}}), JSON.stringify({type: 'assistant', message: {role: 'assistant', content: [{type: 'text', text}]}})].join('\n') + '\n');
  return f;
}
/** Doorloopt een volledige agentrun: reservering, start, afronding via PostToolUse (content) en SubagentStop. */
export function runAgent(root, {id = 'tu-agent-1', agentId = 'abcd1234', text = REPORT(), vraag, role, transcript = true, configDir} = {}) {
  agentCall(root, {id, vraag, role});
  hook(root, {hook_event_name: 'SubagentStart', agent_type: role || 'aae-reviewer', agent_id: agentId});
  if (transcript && configDir) writeTranscript(configDir, agentId, text);
  hook(root, {hook_event_name: 'SubagentStop', agent_type: role || 'aae-reviewer', agent_id: agentId, last_assistant_message: text});
  hook(root, {hook_event_name: 'PostToolUse', tool_name: 'Agent', tool_use_id: id, tool_input: {}, tool_response: {status: 'completed', agentId, content: [{type: 'text', text}]}});
}
/** Kopieert de runtime naar de fixture, zodat de hook als echt los proces kan draaien (projectroot wordt vanaf het scriptpad bepaald). */
export function installRuntime(root) {
  const bron = new URL('../runtime/', import.meta.url), doel = path.join(root, '.claude/aae/runtime');
  fs.mkdirSync(doel, {recursive: true});
  for (const f of fs.readdirSync(bron)) fs.copyFileSync(new URL(f, bron), path.join(doel, f));
  return doel;
}
export function spawnHook(root, event) {
  return new Promise(resolve => {
    const child = spawn(process.execPath, [path.join(root, '.claude/aae/runtime/hook.mjs')], {cwd: root, stdio: ['pipe', 'pipe', 'pipe']});
    let stdout = '', stderr = '';
    child.stdout.on('data', d => { stdout += d; }); child.stderr.on('data', d => { stderr += d; });
    child.on('close', code => resolve({code, stdout, stderr}));
    child.stdin.end(typeof event === 'string' ? event : JSON.stringify({session_id: SID, cwd: root, ...event}));
  });
}
export const hash = c => envelopeHash(validateContract(structuredClone(c)));
