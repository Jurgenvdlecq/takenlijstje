/**
 * Overgang van v3.2 (docs/aae/TASK.json + .claude/aae/state/local.json) naar v3.3 (docs/aae/work/<id>/).
 * Een lopende, goedgekeurde route blijft goedgekeurd: contract, gebruik, receipts en agentregistraties worden overgenomen.
 * Idempotent: bestaat de v3.3-status al, dan gebeurt er niets.
 */
import fs from 'node:fs';
import path from 'node:path';
import {
  requireThat, safePath, readJson, atomicJson, digest, stable, now, validateContract, envelopeHash, classifyCommand, commandFingerprint, safeLocalArgv, LOCAL, STATE_DIR, WORK, relName, protectedPath
} from './core.mjs';
import {listWork, loadWork, saveWork, newState, log, approve, contractFile, withLock, eventLog} from './state.mjs';

const TASK = 'docs/aae/TASK.json';
const FOCUS = {
  'aae-security-reviewer': ['aae-reviewer', 'security'], 'aae-code-reviewer': ['aae-reviewer', 'code'], 'aae-test-writer': ['aae-reviewer', 'tests'],
  'aae-plan-critic': ['aae-reviewer', 'plan'], 'aae-ux-reviewer': ['aae-reviewer', 'ux'], 'aae-visual-qa': ['aae-reviewer', 'visual'],
  'aae-performance-reviewer': ['aae-reviewer', 'performance'], 'aae-accessibility-reviewer': ['aae-reviewer', 'accessibility'],
  'aae-product-analyst': ['aae-product-partner', null], 'aae-product-designer': ['aae-product-partner', null], 'aae-visual-designer': ['aae-product-partner', null],
  'aae-solution-architect': ['aae-architect', null], 'aae-supervisor': ['aae-architect', null]
};
export const mapRole = name => FOCUS[name] || [name, null];
const gitBranchFrom = argv => { const a = argv.slice(2).filter(x => !['-u', '--set-upstream', 'origin'].includes(x)); return a.length === 1 ? a[0] : null; };

/** Zet een v3.2-contract (schema 3) om naar het v3.3-model. */
export function adaptLegacyContract(t) {
  const klasse = t.risk === 'high' || t.mode === 'high-assurance' ? 'HIGH' : t.mode === 'standard' ? 'STANDARD' : 'LIGHT';
  const git = {commit: false, push: [], merge: null, deploy: 'none'};
  const extra = [], commands = [];
  for (const m of t.commands) {
    let purpose = m.purpose; const a = m.argv;
    if (a[0] === 'git' && (a[1] === 'add' || a[1] === 'commit')) { purpose = 'commit'; git.commit = true; }
    else if (a[0] === 'git' && a[1] === 'push') {
      const b = gitBranchFrom(a);
      if (a.length === 4 && /^[^:]+:[^:]+$/.test(a[3]) && m.gate === 'ready') { const [from, to] = a[3].split(':'); purpose = 'merge'; git.merge = {to}; if (!git.push.includes(from)) git.push.push(from); git.commit = true; }
      else if (b && !b.includes(':')) { purpose = 'push'; git.commit = true; if (!git.push.includes(b)) git.push.push(b); }
      else { purpose = 'deploy'; extra.push({argv: a, purpose}); }
    } else if (purpose === 'publish') { purpose = 'deploy'; extra.push({argv: a, purpose}); }
    else if (['install', 'destructive'].includes(purpose)) extra.push({argv: a, purpose});
    else if (LOCAL.includes(purpose) && !safeLocalArgv(a)) extra.push({argv: a, purpose});
    // Een v3.2-gate ("ready") bestaat in v3.3 alleen als merge-capability; elders zou de overname de gate stil laten vervallen.
    if (m.gate === 'ready' && purpose !== 'merge') throw new Error('Het v3.2-gatecommando ' + m.id + ' (gate "ready") kan niet als merge-capability worden overgenomen.');
    const eenmalig = ['merge', 'deploy', 'install', 'destructive'].includes(purpose);
    commands.push({id: m.id, argv: a, purpose, why: m.why, watch: m.watch, timeout_ms: m.timeout_ms, max_runs: eenmalig ? 1 : purpose === 'push' || purpose === 'commit' ? Math.min(m.max_runs, 30) : m.max_runs, _legacyPurpose: m.purpose});
  }
  // Een v3.2-GO voor een merge naar een branch die automatisch deployt dekt ook die uitrol; v3.3 maakt dat expliciet (verify).
  if (git.merge) git.deploy = 'verify';
  const uniek = []; for (const x of extra) if (!uniek.some(y => stable(y) === stable(x))) uniek.push(x);
  const providers = {};
  const sup = t.integrations?.supabase, gh = t.integrations?.github;
  if (sup) providers.supabase = {project_ref: sup.project_ref, tools: sup.tools, max_calls: sup.max_calls};
  if (gh) providers.github = {tools: gh.tools, max_calls: gh.max_calls, base: gh.base, head: gh.head};
  const hard = Math.min(t.budget.agent_calls, 12);
  const writes = (t.scope.write || []).filter(p => { try { return !protectedPath(relName(p)); } catch { return false; } });
  const c = {
    schema_version: 4, id: t.id, title: t.title, goal: t.goal, risk_class: klasse, risk_flags: t.risk_flags,
    envelope: {
      phase: t.phase,
      areas: writes.length ? [{name: 'Bestaande schrijfscope (overgenomen uit v3.2)', write: writes, support: []}] : [],
      db_max: sup && (sup.tools.includes('apply_migration') || (sup.sensitive_migrations || []).length) ? 'B' : 'none',
      providers, git,
      budgets: {agent_calls: {soft: Math.min(3, hard), hard}, command_runs: Math.min(t.budget.command_runs, 200), external_calls: t.budget.external_calls || 0, max_parallel: Math.min(Math.max(t.budget.max_parallel || 1, 1), 3)},
      acceptance: t.acceptance, assumptions: [], decision_defaults: [], decision_points: t.decision_points || [], extra_commands: uniek
    },
    plan: {
      read: t.scope.read || [], test_plan: t.test_plan,
      agents: t.agents.map(a => { const [name, focus] = mapRole(a.name); const o = {name, question: a.question, files: a.files, model: a.model}; if (focus) o.focus = focus; return o; }),
      commands: commands.map(({_legacyPurpose, ...rest}) => rest), open_product_questions: [], keep_raw: false
    }
  };
  return {contract: c, legacyPurposes: Object.fromEntries(commands.map(m => [m.id, m._legacyPurpose]))};
}

/** Neemt de lopende v3.2-taak over als v3.3-werkpakket (alleen als daar nog geen status voor bestaat). */
export function importLegacy(root) {
  let t, s;
  try { t = readJson(root, TASK); } catch { return null; }
  try { s = readJson(root, STATE_DIR + '/local.json'); } catch { return null; }
  if (!t || t.schema_version !== 3 || !s || s.version !== 3 || !s.task || s.task.id !== t.id) return null;
  if (loadWork(root, t.id)) return null;
  const lt = s.task;
  return withLock(root, () => {
    if (loadWork(root, t.id)) return null;
    let c, legacyPurposes;
    try { const adapted = adaptLegacyContract(t); legacyPurposes = adapted.legacyPurposes; c = validateContract(adapted.contract); }
    catch (e) {
      const st = newState(t.id); st.legacy = true; st.status = 'BLOCKED'; st.blockers = ['Overgenomen v3.2-contract past niet in v3.3: ' + e.message];
      log(st, 'legacy_import_mislukt', {fout: e.message}); saveWork(root, st); eventLog(root, 'legacy_import_mislukt', {id: t.id}); return {id: t.id, status: 'BLOCKED'};
    }
    const st = newState(t.id); st.legacy = true; st.contract = c;
    const hash = envelopeHash(c);
    const goedgekeurd = lt.approval?.digest === lt.digest;
    st.usage = {agents: lt.usage?.agents || 0, commands: lt.usage?.commands || 0, external: lt.usage?.external || 0};
    st.command_counts = {...(lt.command_counts || {})};
    st.receipts = (lt.command_receipts || []).map(r => ({...r, envelope_hash: r.route_digest === lt.digest ? hash : null}));
    st.external_calls = {...(lt.external_calls || {})}; st.external_receipts = [...(lt.external_receipts || [])];
    const sv = s.integrations?.supabase; if (sv?.verified_ref && (sv.verified_task === lt.id)) st.supabase_verified = {ref: sv.verified_ref, at: sv.verified_at};
    for (const [tid, r] of Object.entries(lt.calls || {})) {
      const [role, focus] = mapRole(r.role);
      const seq = Object.keys(st.agents).length + 1;
      st.agents[tid] = {id: tid, seq, run_key: 'run-' + String(seq).padStart(3, '0'), role, focus, status: ['stopped', 'failed', 'abandoned'].includes(r.status) ? r.status : 'unverified', agent_id: r.agent_id || null, reserved_at: r.at, last_seen: r.finished || r.at, finished: r.finished || null,
        why: 'overgenomen uit v3.2', question_hash: null, source_digest: r.source_digest || null, envelope_hash: r.task_digest === lt.digest ? hash : null, reported_status: r.reported_status || 'UNKNOWN', checks: [],
        report: r.report_summary ? {status: 'REPORT_UNVERIFIED', verified: false, legacy: true, verdict: r.reported_status || 'UNKNOWN', sources: ['staart_v32']} : null};
    }
    // Alleen een bewezen READY telt als READY; PARTIAL en BLOCKED blijven zichtbaar open (zoals v3.3 zelf afsluit).
    if (lt.status === 'closed') { st.status = lt.result === 'READY' ? 'READY' : 'BLOCKED'; st.result = lt.result; if (st.status === 'BLOCKED') st.blockers = ['Overgenomen v3.2-taak was afgesloten als ' + String(lt.result || 'onbekend') + '.']; }
    else if (lt.status === 'pending') { st.proposed = c; st.status = 'WAITING_FOR_APPROVAL'; }
    else if (lt.status === 'paused') { st.proposed = c; st.status = 'PAUSED'; st.paused_from = 'EXECUTING'; }
    else {
      if (goedgekeurd) { st.approved = {envelope_hash: hash, contract: c, at: lt.approval.at || now(), source: 'v3.2 GO (overgenomen)'}; st.status = 'EXECUTING'; st.activity = 'BUILDING'; }
      else if (t.approval_required === false && c.risk_class === 'LIGHT') { st.proposed = c; approve(st, c, 'v3.2 LIGHT-route zonder GO-eis (overgenomen)'); }
      else { st.proposed = c; st.status = 'WAITING_FOR_APPROVAL'; log(st, 'legacy_zonder_geldige_go', {reden: 'geen of verouderde v3.2-goedkeuring; een nieuwe AAE GO is nodig'}); }
    }
    // Niet-lokale commando's blijven alleen goedgekeurd als hun bronnen sinds de v3.2-GO niet zijn veranderd.
    st.extra_fp = {};
    for (const m of c.plan.commands) {
      if (classifyCommand(c, m).kind !== 'extra') continue;
      const rec = lt.approved_commands?.[m.id];
      const fpLegacy = digest({argv: m.argv, purpose: legacyPurposes[m.id], timeout_ms: m.timeout_ms, refs: commandFingerprintRefs(root, m)});
      const approvedFp = typeof rec === 'string' ? rec : rec?.fingerprint;
      if (approvedFp && approvedFp === fpLegacy) st.extra_fp[digest({argv: m.argv, purpose: m.purpose})] = {fp: commandFingerprint(root, m), refs: Object.fromEntries(commandRefs(root, m))};
    }
    log(st, 'legacy_import', {van: lt.status, digest: String(lt.digest).slice(0, 12)});
    atomicJson(root, contractFile(t.id), c);
    saveWork(root, st); eventLog(root, 'legacy_import', {id: t.id, status: st.status});
    return {id: t.id, status: st.status};
  });
}
// De v3.2-vingerafdruk gebruikt dezelfde bronverwijzingen (package.json e.d. + watch).
import {commandRefs} from './core.mjs';
function commandFingerprintRefs(root, m) { return commandRefs(root, m); }
export const _legacyListWork = listWork;
