import fs from 'node:fs';
import path from 'node:path';
import {spawn, spawnSync} from 'node:child_process';
import {
  STATE_DIR, requireThat, safePath, readJson, atomicJson, now, digest, sourceDigest, envelopeHash, classifyCommand, commandFingerprint, commandRefs, areaWrite, scopeContains, VERSION
} from './core.mjs';
import {withLock, activeWork, loadWork, saveWork, log, transition, resultFile, listWork, TERMINAL} from './state.mjs';
import {liveRows} from './reports.mjs';
import {assertReady, assertGate} from './gates.mjs';
import {extraKey} from './commands.mjs';
import {gitHead, candidateFiles, stagedFiles, secretHits} from './gitops.mjs';

const hasLive = st => liveRows(st).some(r => ['reserved', 'running'].includes(r.status));
const NON_LOCAL = ['install', 'destructive', 'merge', 'deploy'];

/** Voert een in het plan vastgelegd argv uit zonder shell. De bewaking controleert de klasse tegen de envelop; projectprogramma's blijven krachtige code, geen sandbox. */
export async function runCommand(root, cmdId) {
  const launch = withLock(root, () => {
    const st = activeWork(root);
    requireThat(st, 'Geen actief werkpakket.');
    requireThat(st.status === 'EXECUTING', 'Werkpakket is niet in uitvoering (' + st.status + '). Een commando draait alleen binnen een goedgekeurd werkpakket.');
    const c = st.contract, m = c.plan.commands.find(x => x.id === cmdId);
    requireThat(m, 'Commando niet in het plan: ' + cmdId);
    const k = classifyCommand(c, m);
    requireThat(k.ok, 'Commando valt buiten de envelop: ' + k.reason);
    requireThat(!hasLive(st) && !st.command_running, 'Geen commandoloop naast agentcontrole of andere commando\'s.');
    const fp = commandFingerprint(root, m);
    if (k.kind === 'extra') {
      const rec = st.extra_fp[extraKey(m)];
      if (NON_LOCAL.includes(m.purpose)) requireThat(rec && rec.fp === fp, 'Commando of diens bronnen zijn niet (meer) gelijk aan wat de GO goedkeurde. Vraag een nieuwe goedkeuring.');
      else if (rec) {
        const nu = Object.fromEntries(commandRefs(root, m));
        for (const [p, h] of Object.entries(nu)) requireThat(rec.refs[p] === h || scopeContains(areaWrite(c), p), 'Een bewaakt bestand buiten de schrijfgebieden is gewijzigd: ' + p);
      }
    }
    if (m.purpose === 'commit' && m.argv[0] === 'git') {
      // Geen geheimen in een commit: controleer wat er klaargezet wordt (add) en wat er al klaarstaat (commit). Alleen namen en soort, nooit de inhoud.
      const kandidaten = m.argv[1] === 'add' ? candidateFiles(root, m.argv.slice(4)) : m.argv[1] === 'commit' ? stagedFiles(root) : [];
      const geheimen = secretHits(root, kandidaten);
      requireThat(!geheimen.length, 'Mogelijk geheim in de commit (' + geheimen.slice(0, 5).map(h => h.path + ': ' + h.reden).join('; ') + '). Verwijder of negeer het bestand (.gitignore) en probeer opnieuw.');
    }
    if (m.purpose === 'merge') assertGate(root, st, c, 'merge', m.argv[0] === 'git' ? m.argv : null);
    if (m.purpose === 'deploy') assertGate(root, st, c, 'deploy');
    requireThat(st.usage.commands < c.envelope.budgets.command_runs, 'Totaal commandobudget bereikt.');
    requireThat((st.command_counts[cmdId] || 0) < m.max_runs, 'Maximum aantal runs voor ' + cmdId + ' bereikt.');
    const src = sourceDigest(root, c);
    const verwant = st.receipts.filter(r => r.command_fingerprint === fp && r.source_after === src).slice(-2);
    requireThat(!(verwant.length === 2 && verwant.every(r => r.exit_code !== 0)), 'Twee gelijke mislukte pogingen zonder bronwijziging. Verander de hypothese, niet dezelfde opdracht blijven herhalen.');
    st.usage.commands++; st.command_counts[cmdId] = (st.command_counts[cmdId] || 0) + 1;
    const runId = 'run-' + st.usage.commands;
    st.command_running = {id: runId, command: cmdId, started: now(), pid: process.pid};
    st.activity = m.purpose === 'merge' ? 'MERGING' : m.purpose === 'deploy' ? 'DEPLOYING' : ['test', 'build', 'preview'].includes(m.purpose) ? 'TESTING' : 'BUILDING';
    log(st, 'commando_gestart', {commando: cmdId, doel: m.purpose, run: runId});
    saveWork(root, st);
    return {m, fp, src, id: st.id, runId, eh: envelopeHash(c), contract: c};
  });
  const logRel = STATE_DIR + '/logs/' + launch.id + '-' + launch.runId + '.txt';
  const logPath = safePath(root, logRel); fs.mkdirSync(path.dirname(logPath), {recursive: true, mode: 0o700});
  const fd = fs.openSync(logPath, 'w', 0o600);
  let captured = 0, tail = '', truncated = false;
  const output = buf => {
    const b = Buffer.from(buf); tail = (tail + b.toString('utf8')).slice(-2500);
    if (captured < 1024 * 1024) { const keep = b.subarray(0, 1024 * 1024 - captured); fs.writeSync(fd, keep); captured += keep.length; } else truncated = true;
  };
  const started = Date.now(); let result;
  try {
    result = await new Promise(resolve => {
      const m = launch.m;
      // NODE_TEST_CONTEXT hoort bij een bovenliggende node --test-run; geërfd laat het een geneste testrun altijd "slagen". Een commando draait altijd los.
      // npm_config_yes=false: npx installeert nooit stilzwijgend een ontbrekend pakket.
      const env = {...process.env, CI: '1', npm_config_yes: 'false'}; delete env.NODE_TEST_CONTEXT;
      const child = spawn(m.argv[0], m.argv.slice(1), {cwd: fs.realpathSync(root), shell: false, detached: process.platform !== 'win32', env, stdio: ['ignore', 'pipe', 'pipe']});
      let timedOut = false, spawnError = null;
      const kill = () => { try { if (process.platform !== 'win32') process.kill(-child.pid, 'SIGKILL'); else child.kill('SIGKILL'); } catch { /* al weg */ } };
      const timer = setTimeout(() => { timedOut = true; kill(); }, m.timeout_ms);
      child.stdout?.on('data', output); child.stderr?.on('data', output);
      child.on('error', err => { spawnError = err.message; output(Buffer.from(err.message)); });
      child.on('close', (code, signal) => { clearTimeout(timer); resolve({exit_code: typeof code === 'number' ? code : timedOut ? 124 : 1, signal: signal || null, timed_out: timedOut, error: spawnError}); });
    });
  } finally { fs.closeSync(fd); }
  const sourceAfter = sourceDigest(root, launch.contract);
  const receipt = {schema_version: 4, id: launch.id, envelope_hash: launch.eh, run_id: launch.runId, command_id: launch.m.id, argv: launch.m.argv, purpose: launch.m.purpose, command_fingerprint: launch.fp,
    source_before: launch.src, source_after: sourceAfter, ...result, duration_ms: Date.now() - started, finished: now(), log_path: logRel, log_truncated: truncated};
  const receiptPath = 'docs/aae/evidence/' + launch.id + '/' + launch.runId + '.json';
  withLock(root, () => {
    const st = loadWork(root, launch.id);
    st.command_running = null;
    const nu = envelopeHash(st.contract);
    st.receipts.push({...receipt, evidence_path: receiptPath, envelope_hash: nu === launch.eh ? launch.eh : null});
    atomicJson(root, receiptPath, receipt);
    if (st.status === 'EXECUTING') st.activity = 'BUILDING';
    log(st, 'commando_klaar', {commando: launch.m.id, exit: receipt.exit_code});
    saveWork(root, st);
  });
  return {...receipt, evidence_path: receiptPath, tail, warning: 'Commandoreceipt bewijst uitvoering, niet inhoudelijke correctheid of veiligheid van projectcode.'};
}
export function reportTemplate(root) {
  return withLock(root, () => {
    const st = activeWork(root); requireThat(st, 'Geen actief werkpakket.');
    const c = st.contract;
    return {schema_version: 4, id: c.id, envelope_hash: envelopeHash(c), source_digest: sourceDigest(root, c), git_head: gitHead(root), status: 'PARTIAL', summary: 'Vul in wat aantoonbaar is uitgevoerd; geen verondersteld bewijs.',
      criteria: c.envelope.acceptance.map(a => ({id: a.id, status: 'not_run', evidence: [], note: ''})),
      checks: c.plan.test_plan.map(t => ({kind: t.kind, method: t.method, status: 'not_run', evidence: [], note: ''}))};
  });
}
export function closeTask(root) {
  return withLock(root, () => {
    const st = activeWork(root); requireThat(st, 'Geen actief werkpakket.');
    requireThat(st.status === 'EXECUTING', 'Werkpakket is niet in uitvoering.');
    const c = st.contract;
    requireThat(!hasLive(st) && !st.command_running, 'Er loopt nog werk.');
    const r = readJson(root, resultFile(c.id)), src = sourceDigest(root, c);
    requireThat(r.schema_version === 4 && r.id === c.id && r.envelope_hash === envelopeHash(c), 'Resultaat hoort niet bij dit werkpakket en deze envelop.');
    requireThat(r.source_digest === src, 'Broncode veranderd sinds bewijsrapport. Maak relevante controles opnieuw, niet blind een nieuwe hash.');
    requireThat(['READY', 'PARTIAL', 'BLOCKED'].includes(r.status), 'Ongeldige eindstatus.');
    requireThat(typeof r.summary === 'string' && r.summary.trim().length >= 5, 'Samenvatting ontbreekt.');
    requireThat(Array.isArray(r.criteria) && Array.isArray(r.checks), 'Resultaat mist criteria of controles.');
    if (r.status === 'READY') assertReady(root, st, c, '');
    st.result = r.status;
    // Alleen een bewezen READY sluit af. PARTIAL en BLOCKED laten het pakket open (BLOCKED), met de reden zichtbaar; VERDER hervat binnen dezelfde GO.
    if (r.status !== 'READY') st.blockers = [(r.status === 'PARTIAL' ? 'Gedeeltelijk afgerond: ' : 'Vastgelopen: ') + r.summary.trim().slice(0, 300)];
    transition(st, r.status === 'READY' ? 'READY' : 'BLOCKED', 'close ' + r.status);
    atomicJson(root, STATE_DIR + '/results/' + c.id + '.json', r);
    saveWork(root, st);
    return {id: c.id, status: r.status, work_status: st.status, not_deployed: true, note: 'Administratief afgerond. READY is geen publicatie- of deploymenttoestemming.'};
  });
}
const digestBytes = b => digest(b.toString('base64'));
export function doctor(root) {
  const checks = [];
  const add = (name, ok, detail) => checks.push({name, status: ok ? 'PASS' : 'ATTENTION', detail});
  add('node', Number(process.versions.node.split('.')[0]) >= 20, process.version);
  const settings = readJson(root, '.claude/settings.json'), hooks = settings.hooks || {};
  for (const event of ['SessionStart', 'UserPromptSubmit', 'PreToolUse', 'PostToolUse', 'PostToolUseFailure', 'SubagentStart', 'SubagentStop']) {
    add('hook ' + event, (hooks[event] || []).some(g => (g.hooks || []).some(h => h.command === 'node' && h.args?.some(a => a.endsWith('/.claude/aae/runtime/hook.mjs')))), 'Projectconfig; bevestig in Claude Code met /hooks.');
  }
  add('geen Stop-hook van AAE', !(hooks.Stop || []).some(g => (g.hooks || []).some(h => h.args?.some(a => a.endsWith('/.claude/aae/runtime/hook.mjs')))), 'AAE gebruikt geen Stop-hook.');
  add('permissions', settings.permissions?.defaultMode !== 'bypassPermissions', 'Geen bypassPermissions gebruiken.');
  const mf = '.claude/aae/managed.json';
  if (fs.existsSync(safePath(root, mf))) {
    const m = readJson(root, mf), changed = [];
    for (const [p, hash] of Object.entries(m.files)) { try { if (digestFile(fs.readFileSync(safePath(root, p, {allowMissing: false}))) !== hash) changed.push(p); } catch { changed.push(p); } }
    add('managed_integrity', changed.length === 0, changed.length ? changed.join(', ') : 'Beheerde bestanden komen overeen met installatie.');
    add('versie', m.version === VERSION, 'manifest ' + m.version + ', runtime ' + VERSION);
  } else add('managed_integrity', false, 'Installatiemanifest ontbreekt.');
  const lock = path.join(fs.realpathSync(root), STATE_DIR, 'lock', 'owner.json');
  let lockOk = true, lockDetail = 'geen lock';
  if (fs.existsSync(lock)) { try { const o = JSON.parse(fs.readFileSync(lock, 'utf8')); let levend = true; try { process.kill(o.pid, 0); } catch { levend = false; } lockOk = levend; lockDetail = levend ? 'lock van levend proces ' + o.pid : 'achtergebleven lock van dood proces ' + o.pid + ' (veilig te verwijderen na controle)'; } catch { lockOk = false; lockDetail = 'onleesbare lock'; } }
  add('lock', lockOk, lockDetail);
  const werk = listWork(root).map(id => loadWork(root, id)).filter(Boolean).map(s => ({id: s.id, status: s.status, activity: s.activity, legacy: s.legacy}));
  return {version: VERSION, checks, werkpakketten: werk, live_validation: 'NOT_RUN_BY_DOCTOR', limitations: ['Geen OS-sandbox. Goedgekeurde projectcommando\'s kunnen doen wat de gebruiker op deze machine mag.', 'Geen exact tegoed of tokenverbruik berekend.', 'Globale/managed hooks kunnen aanvullend gedrag veroorzaken.']};
}
import {createHash} from 'node:crypto';
const digestFile = b => createHash('sha256').update(b).digest('hex');
export const _unused = {spawnSync, TERMINAL, digestBytes};
