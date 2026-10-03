/**
 * Hooks bewaken grenzen; de Lead orkestreert. Deze module beslist alleen op basis van status en envelop, nooit op de tekst van een chatbericht.
 * Er is geen Stop-hook: stoppen blokkeren of een commit afdwingen is geen taak van de bewaking.
 */
import fs from 'node:fs';
import path from 'node:path';
import {
  ROLES, FOCI, GuardError, requireThat, safePath, relativeInput, relName, protectedPath, controlKind, isTracked, workIdFromPath, scopeContains, areaAllows,
  validateContract, envelopeHash, digest, now, sourceDigest, bashArgv, safeLocalArgv, dbLevel, atomicJson, VERSION, WORK, text as _text, choice, AGENT_CAP
} from './core.mjs';
import {
  withLock, listWork, loadWork, saveWork, activeWork, guardApproval, log, needsHuman, registerContractUnlocked, loadGlobal, saveGlobal, eventLog, contractFile
} from './state.mjs';
import {liveRows, LIVE, reconcile, finalizeRun, safeFinalize, findTranscript, transcriptFinalText, contentText, duplicateOf, questionHash} from './reports.mjs';
import {orphanedSnapshots} from './snapshot.mjs';
import {classifyExternalCall, projectRefFromInput, projectRefFromResponse, prNumberFromResponse, prHeadShaFromResponse, responseDigest, safeExternalSummary, migrationName, migrationSql} from './integrations.mjs';
import {assertGate, assertPrMerge} from './gates.mjs';
import {context, handlePrompt, bindProbe} from './commands.mjs';
import {importLegacy} from './legacy.mjs';
import {guardSecretRead} from './secrets.mjs';

const READ_TOOLS = new Set(['Read', 'Grep', 'Glob']);
const HARMLESS_MAIN = new Set(['ToolSearch', 'AskUserQuestion', 'TodoWrite', 'TaskCreate', 'TaskGet', 'TaskList', 'TaskUpdate', 'TaskOutput', 'TaskStop', 'EnterPlanMode', 'ExitPlanMode', 'WebSearch', 'WebFetch', 'ListAgents']);
const WRITE_TOOLS = new Set(['Write', 'Edit', 'MultiEdit', 'NotebookEdit']);
const SYSTEM_READ = ['.claude/aae/ENTRY.md', '.claude/aae/docs', '.claude/aae/roles', 'docs/aae/PROJECT_PROFILE.md', 'docs/aae/PROGRESS.md', 'docs/aae/DECISIONS.md'];
const WHY = /^\s*WAAROM-AGENT:\s*(.+)$/m;
const FOCUS_LINE = /^\s*FOCUS:\s*([a-z]+)\s*$/m;
const GENERIC = /^(standaard|voor de zekerheid|best practice|zoals altijd|omdat het kan|iedere|elke|altijd)\b/i;
const CLI = /^node \.claude\/aae\/runtime\/cli\.mjs (status|plan|preflight|reconcile|observe-alive|observe-absent|scope-change|close|run|report|doctor|project|prune|keep-raw|report-template|present|recover)(?: ([A-Za-z0-9_-]+))?$/;
const NEEDS_ARG = new Set(['run', 'report', 'observe-alive', 'observe-absent', 'keep-raw', 'plan', 'preflight', 'present', 'recover']);
const isSubagent = e => Boolean(e.agent_id || e.agent_type);
const toolPath = (root, e) => relativeInput(root, e.tool_input.file_path || e.tool_input.notebook_path, e.cwd || root);

/** Het enige werkpakket dat nu werk mag doen (EXECUTING) of op een mens wacht (NEEDS_HUMAN). */
const active = root => activeWork(root);
const hasLive = st => liveRows(st).some(r => ['reserved', 'running'].includes(r.status));
function liveExternal(st) { return Object.values(st.external_calls || {}).filter(x => ['reserved', 'running', 'unknown'].includes(x.status)); }
function settle(st) {
  if (st.status !== 'EXECUTING') return;
  st.activity = hasLive(st) ? 'WAITING_FOR_AGENT' : st.command_running ? 'TESTING' : (st.activity === 'REVIEWING' ? 'REVIEWING' : 'BUILDING');
}
function denied(root, st, wat, reden) {
  if (st) { st.last_denial = {at: now(), wat, reden}; saveWork(root, st); }
  eventLog(root, 'geweigerd', {wat, reden});
  throw new GuardError(reden);
}

// ---------------------------------------------------------------- lezen
function readPermission(root, st, e) {
  const p = guardSecretRead(root, e); // één gedeelde controle voor Read, Grep en Glob, ook voor subagents
  if (!isSubagent(e)) return null;
  const row = st && Object.values(st.agents).find(r => r.agent_id === e.agent_id && ['reserved', 'running', 'unverified'].includes(r.status));
  requireThat(row && row.role === e.agent_type, 'Geen geldige geregistreerde agentaanroep voor deze toolactie.');
  row.last_seen = now(); saveWork(root, st);
  const entry = st.contract.plan.agents.find(a => a.name === row.role && (!a.focus || a.focus === row.focus));
  requireThat(entry, 'Agent niet meer in het plan.');
  requireThat(p && scopeContains([...SYSTEM_READ, ...entry.files, WORK + '/' + st.id, 'docs/aae/evidence', 'docs/aae/notes', '.claude/agents/' + row.role + '.md'], p), 'Agent mag alleen het afgesproken werkpakket lezen; specificeer een toegestaan pad.');
  return null;
}

// ---------------------------------------------------------------- agents
function delegation(root, st, e) {
  requireThat(!isSubagent(e), 'Specialisten mogen geen andere agents starten.');
  const input = e.tool_input || {};
  requireThat(e.tool_use_id, 'Agentaanroep mist tool_use_id. Geen betrouwbare registratie.');
  const role = input.subagent_type;
  requireThat(ROLES.includes(role), 'Agent niet toegestaan. Alleen aae-product-partner, aae-architect of aae-reviewer; geen Explore/Plan/algemene fallback of agentteams.');
  requireThat(!input.run_in_background, 'Vraag foreground aan (run_in_background:false). Achtergrondagents worden niet gebruikt.');
  requireThat(!input.isolation, 'Subagent-worktrees vallen buiten deze registratie.');
  requireThat(!input.resume, 'Hervatten wordt niet ondersteund: start een nieuwe, kleinere opdracht met nieuwe context.');
  requireThat(st && st.status === 'EXECUTING', 'Geen werkpakket in uitvoering. Zonder goedgekeurd werkpakket start ik geen agents.');
  guardApproval(root, st);
  const c = st.contract;
  requireThat(typeof input.prompt === 'string' && input.prompt.length <= 16000, 'Agentoverdracht ontbreekt of is te lang. Geef alleen relevante feiten en bronverwijzingen.');
  const existing = st.agents[e.tool_use_id], signature = digest(input);
  if (existing) { requireThat(existing.input_digest === signature, 'Tool-ID hergebruikt met andere invoer.'); return {hookSpecificOutput: {hookEventName: 'PreToolUse', updatedInput: existing.updated_input}}; }
  const why = WHY.exec(input.prompt);
  requireThat(why && why[1].trim().length >= 20 && !GENERIC.test(why[1].trim()), 'Elke agentaanroep begint met "WAAROM-AGENT: <welke nieuwe informatie of onafhankelijke controle levert dit op, en waarom lever ik dat niet zelf betrouwbaar>".');
  const fm = FOCUS_LINE.exec(input.prompt);
  const focus = role === 'aae-reviewer' ? (fm ? fm[1] : 'code') : null;
  if (focus) choice(focus, FOCI, 'Focus');
  const entry = c.plan.agents.find(a => a.name === role && (!a.focus || a.focus === focus));
  requireThat(entry, 'Deze rol/focus staat niet in het plan (voeg hem toe in proposal.json; dat is vrij binnen de envelop).');
  reconcile(root, st);
  const hash = questionHash(role, focus, input.prompt);
  requireThat(!duplicateOf(st, hash), 'Dezelfde vraag loopt nog of is niet aantoonbaar afgerond. Stem eerst af (cli reconcile) of stel een kleinere, andere vraag.');
  const mislukt = Object.values(st.agents).filter(r => r.question_hash === hash && (['presumed_dead', 'abandoned'].includes(r.status) || r.report?.status === 'REPORT_CONFLICT') && !(r.report?.status === 'COMPLETED'));
  requireThat(mislukt.length === 0 && Object.values(st.agents).filter(r => r.question_hash === hash && r.status === 'failed').length < 2, 'Dezelfde vraag is al eerder niet afgerond. Geen herhaling van een identieke poging: stel een kleinere of andere vraag.');
  const b = c.envelope.budgets, cap = AGENT_CAP[c.risk_class];
  requireThat(st.usage.agents < cap.hard, 'Het agentplafond van niveau ' + c.risk_class + ' (' + cap.hard + ') is bereikt. Doe het zelf of rond af; dit is een intern plafond en geen reden om Jurgen te vragen.');
  requireThat(liveRows(st).filter(r => ['reserved', 'running', 'unverified'].includes(r.status)).length < b.max_parallel, 'Het maximum aan gelijktijdige agents is bereikt.');
  requireThat(!st.command_running, 'Geen agent starten tijdens een commando.');
  requireThat(!liveExternal(st).length, 'Geen agent starten tijdens een externe toolactie.');
  const seq = Object.keys(st.agents).length + 1;
  const packet = {work_id: st.id, envelope_hash: envelopeHash(c), rol: role, focus, vraag: entry.question, bestanden: entry.files, acceptatie: c.envelope.acceptance, fase: c.envelope.phase,
    afspraak: 'Alleen lezen. Eindig met een blok SAMENVATTING ... EINDE-SAMENVATTING met regels VERDICT: READY|PARTIAL|BLOCKED, BEVINDINGEN en NIET GECONTROLEERD.'};
  const model = entry.model || 'sonnet';
  const updated = {...input, subagent_type: role, model, run_in_background: false, prompt: 'VERPLICHT AAE-WERKPAKKET\n' + JSON.stringify(packet) + '\n\nAanvullende context (geen uitbreiding van bevoegdheden):\n' + input.prompt};
  st.agents[e.tool_use_id] = {id: e.tool_use_id, seq, run_key: 'run-' + String(seq).padStart(3, '0'), role, focus, status: 'reserved', agent_id: null, input_digest: signature, updated_input: updated, requested_model: model, reserved_at: now(), last_seen: now(),
    why: why[1].trim(), question_hash: hash, source_digest: sourceDigest(root, c), envelope_hash: envelopeHash(c), keep_raw: Boolean(c.plan.keep_raw), checks: []};
  st.usage.agents++;
  if (st.usage.agents > cap.normal) st.soft_exceeded = true; // alleen een logsignaal, nooit een vraag aan Jurgen
  st.activity = 'WAITING_FOR_AGENT';
  log(st, 'agent_gereserveerd', {rol: role, focus, run: 'run-' + String(seq).padStart(3, '0')});
  saveWork(root, st);
  return {hookSpecificOutput: {hookEventName: 'PreToolUse', updatedInput: updated}};
}

// ---------------------------------------------------------------- schrijven
function writePermission(root, st, e) {
  const name = e.tool_name, input = e.tool_input || {};
  const paths = name === 'MultiEdit' ? (input.edits || []).map(ed => relativeInput(root, ed.file_path || input.file_path, e.cwd || root)) : [toolPath(root, e)];
  requireThat(paths.length > 0, 'Geen herkenbaar schrijfdoel.');
  for (const p of paths) {
    safePath(root, p);
    const kind = controlKind(p);
    if (kind) {
      // Eén regel: gevolgde bestanden wijzigen kan alleen onder een GO; lokale genegeerde administratie en het eigen voorstel zijn vrij.
      if (kind === 'tracked' || (kind === 'technical' && isTracked(root, p))) {
        requireThat(st && st.status === 'EXECUTING', 'Zonder AAE GO verander ik geen gevolgde repositorybestanden (' + p + '). Sparren, onderzoeken en lezen mag wel; vraag een werkpakket met GO voor deze wijziging.');
        guardApproval(root, st);
        requireThat(st.contract.envelope.phase === 'implementation', 'Een analyse-werkpakket wijzigt geen gevolgde bestanden (' + p + ').');
      }
      const wk = workIdFromPath(p);
      if (wk) {
        requireThat(name === 'Write', 'Contract en resultaat altijd als volledig JSON-bestand met Write vervangen.');
        const bestaand = loadWork(root, wk.id);
        if (bestaand) requireThat(!hasLive(bestaand) && !bestaand.command_running, 'Wijzig het contract niet tijdens lopend werk.');
        const obj = JSON.parse(input.content);
        if (wk.kind === 'proposal') { validateContract(obj); requireThat(obj.id === wk.id, 'Het ID in het voorstel moet bij de mapnaam passen.'); }
      }
      continue;
    }
    requireThat(!protectedPath(p), 'AAE/projectinstructies, state, credentials en instellingen zijn beschermd. Gebruik de installer voor systeemupdates.');
    requireThat(st && st.status === 'EXECUTING', 'Geen werkpakket in uitvoering (EXECUTING). Zonder goedgekeurd werkpakket verander ik geen applicatiecode.');
    guardApproval(root, st);
    const c = st.contract;
    requireThat(c.envelope.phase === 'implementation', 'Analyse-only: geen applicatiecode wijzigen.');
    // Geen verplichte commitvolgorde meer: guardApproval heeft de lokale snapshot al gecontroleerd (en zo nodig hersteld); READY eist dat hij klopt en de merge-gate eist dat hij in HEAD staat.
    requireThat(!hasLive(st) && !st.command_running && !liveExternal(st).length, 'Geen bronwijzigingen tijdens agent-, externe tool- of testuitvoering.');
    if (!areaAllows(c, p)) denied(root, st, p, 'Bestand valt buiten de goedgekeurde gebieden: ' + p + '. Binnen een goedgekeurd gebied mag ik vrij bestanden toevoegen; een ander onderdeel van de applicatie vraagt een nieuwe beslissing (cli scope-change).');
    if (!st.files_touched.includes(p)) { st.files_touched.push(p); if (st.files_touched.length > 500) st.files_touched = st.files_touched.slice(-500); saveWork(root, st); }
  }
  return null;
}

// ---------------------------------------------------------------- Bash
function bashPermission(root, st, e) {
  const input = e.tool_input || {};
  requireThat(fs.realpathSync(e.cwd || root) === fs.realpathSync(root), 'Voer de AAE-runner uit vanuit de projectroot; geen cd-ketens.');
  requireThat(!input.run_in_background, 'Geen onbeheerde shell-achtergrondtaken.');
  const command = String(input.command || '').trim();
  const m = command.match(CLI);
  if (m) {
    requireThat(NEEDS_ARG.has(m[1]) ? Boolean(m[2]) : !m[2], 'Onjuiste runnerargumenten.');
    if (m[1] === 'run' || m[1] === 'close') requireThat(st, 'Geen actief werkpakket voor ' + m[1] + '.');
    if (m[1] === 'run') guardApproval(root, st);
    if (m[1] === 'project') {
      requireThat(st && st.status === 'EXECUTING' && st.contract.envelope.phase === 'implementation', 'cli project schrijft docs/aae/PROGRESS.md (gevolgd bestand): alleen onder een werkpakket in uitvoering met GO.');
      guardApproval(root, st);
    }
    return null;
  }
  const argv = bashArgv(command);
  if (argv && argv[0] === 'git' && safeLocalArgv(argv)) return null;
  throw new GuardError('Geen vrije shell binnen de agentworkflow (geen ; & | > < $( ` of aanhalingstekens). Zet het commando in plan.commands van het contract en gebruik: node .claude/aae/runtime/cli.mjs run <id>. Alleen-lezen git mag direct.');
}

// ---------------------------------------------------------------- extern
function findProviderWork(root, provider) {
  const all = listWork(root).map(id => loadWork(root, id)).filter(s => s && s.contract && s.contract.envelope.providers[provider]);
  return all.find(s => ['EXECUTING', 'NEEDS_HUMAN'].includes(s.status)) || all.find(s => ['PLANNING', 'WAITING_FOR_APPROVAL'].includes(s.status)) || null;
}
function dbGate(root, st, c, input, call) {
  const name = migrationName(input), sql = migrationSql(input);
  requireThat(Boolean(name), 'apply_migration vereist een expliciete migratienaam.');
  requireThat(Boolean(sql.trim()), 'apply_migration vereist expliciete migratie-SQL.');
  const hash = digest({name, sql}), klasse = call.db;
  if (klasse === 'C') {
    if (st.confirmed?.action_hash === hash) { st.confirmed = null; st.pending_decision = null; log(st, 'db_c_bevestigd_uitgevoerd', {naam: name}); return; }
    st.pending_decision = {id: 'db-' + hash.slice(0, 8), action_hash: hash, description: 'database-actie "' + name + '"'};
    needsHuman(st, 'destructief', 'De database-actie "' + name + '" kan gegevens verwijderen of onherstelbaar wijzigen (' + call.redenen.join('; ') + '). Ik voer hem niet uit zonder jouw uitdrukkelijke bevestiging: typ AAE BEVESTIG.', {decision: st.pending_decision.id});
    saveWork(root, st);
    throw new GuardError('DB-C-actie gestopt vóór uitvoering: wacht op AAE BEVESTIG van de gebruiker voor "' + name + '".');
  }
  requireThat(dbLevel(klasse) <= dbLevel(c.envelope.db_max), 'Migratie "' + name + '" is database-klasse ' + klasse + ', maar de envelop staat maximaal ' + c.envelope.db_max + ' toe. Registreer een envelopwijziging (nieuwe goedkeuring).');
}
function preExternal(root, e, call) {
  const input = e.tool_input || {};
  requireThat(call.level !== 'blocked', 'Tool ' + e.tool_name + ' is niet toegestaan binnen AAE (onbekende of schrijvende externe actie).');
  if (call.provider === 'github' && call.level === 'read') return null;
  requireThat(e.tool_use_id, 'Externe tool mist tool_use_id; geen betrouwbare receiptregistratie.');
  const werk = findProviderWork(root, call.provider);
  if (!werk && call.provider === 'supabase' && call.action === 'get_project_url') {
    const g = loadGlobal(root); g.probes = (g.probes || 0) + 1; requireThat(g.probes <= 60, 'Te veel projectbindingsprobes.'); g.probe_open = {...(g.probe_open || {}), [e.tool_use_id]: now()}; saveGlobal(root, g); return null;
  }
  requireThat(werk, 'Maak eerst een werkpakket met ' + call.provider + ' in de envelop.');
  const st = werk, c = st.contract, cfg = c.envelope.providers[call.provider];
  requireThat(cfg.tools.includes(call.action) || call.provider === 'github' && call.level === 'merge' && cfg.tools.includes('merge_pull_request'), 'Tool ' + call.action + ' staat niet in de goedgekeurde envelop.');
  requireThat(st.usage.external < c.envelope.budgets.external_calls, 'Extern toolbudget bereikt.');
  requireThat(Object.values(st.external_calls).filter(x => x.provider === call.provider).length < cfg.max_calls, 'Providerlimiet bereikt voor ' + call.provider + '.');
  requireThat(!liveExternal(st).length, 'Er loopt al een externe toolactie. Wacht op afronding.');
  const change = call.level !== 'read';
  requireThat(!change || st.status === 'EXECUTING', 'Externe wijziging vereist een werkpakket in uitvoering met goedkeuring.');
  if (change) { guardApproval(root, st); requireThat(c.envelope.phase === 'implementation', 'Een analyse-werkpakket doet geen externe wijzigingen.'); }
  requireThat(change || ['PLANNING', 'WAITING_FOR_APPROVAL', 'EXECUTING', 'NEEDS_HUMAN'].includes(st.status), 'Werkpakket is niet beschikbaar voor externe leesacties.');
  if (call.provider === 'supabase') {
    const inRef = projectRefFromInput(input);
    if (inRef) requireThat(inRef === cfg.project_ref, 'Supabase-tool wijst naar een ander project dan de envelop.');
    if (call.action !== 'get_project_url') {
      bindProbe(root, st);
      requireThat(st.supabase_verified?.ref === cfg.project_ref, 'Supabase-project is niet voor dit werkpakket live geverifieerd. Roep eerst get_project_url aan.');
    } else st.supabase_verified = null;
    requireThat(!(call.action === 'execute_sql' && call.level !== 'read'), 'Muterende execute_sql is niet toegestaan. Gebruik apply_migration met een benoemde migratie.');
    if (call.action === 'apply_migration') dbGate(root, st, c, input, call);
  }
  if (call.provider === 'github' && call.level === 'change') {
    requireThat(typeof input.base === 'string' && input.base.length > 0, 'PR-aanmaak vereist expliciete base.');
    requireThat(typeof input.head === 'string' && input.head.length > 0, 'PR-aanmaak vereist expliciete head.');
    requireThat(input.owner === cfg.owner && input.repo === cfg.repo, 'PR-aanmaak wijkt af van de vastgepinde repository in de envelop (' + cfg.owner + '/' + cfg.repo + ').');
    requireThat(input.head === cfg.head, 'PR-head wijkt af van de vastgepinde werkbranch in de envelop (' + cfg.head + ').');
    if (cfg.base) requireThat(input.base === cfg.base, 'PR-base wijkt af van de envelop.');
    // Wordt samenvoegen via een PR toegestaan, dan moet de PR naar precies het afgesproken merge-doel wijzen (anders valt de deploy-check op het verkeerde doel).
    if (cfg.tools.includes('merge_pull_request') && c.envelope.git.merge) requireThat(input.base === c.envelope.git.merge.to, 'PR-base moet het merge-doel uit de envelop zijn (' + c.envelope.git.merge.to + ').');
  }
  if (call.provider === 'github' && call.level === 'merge') {
    const nr = Number(input.pullNumber ?? input.pull_number);
    // Per zelf gemaakte pull request worden nummer, repository en doelbranch onthouden; alleen exact die combinatie mag worden samengevoegd.
    const rec = (st.created_prs || []).find(p => p.number === nr && p.owner === input.owner && p.repo === input.repo);
    requireThat(Number.isInteger(nr) && rec, 'merge_pull_request alleen voor een pull request die dit werkpakket zelf heeft gemaakt, met dezelfde owner/repo als bij create_pull_request.');
    requireThat(rec.base === c.envelope.git.merge?.to, 'De pull request wijst niet naar het merge-doel uit de envelop.');
    requireThat(input.owner === cfg.owner && input.repo === cfg.repo, 'merge_pull_request wijkt af van de vastgepinde repository in de envelop (' + cfg.owner + '/' + cfg.repo + ').');
    // De merge is gebonden aan de remote PR-head én aan de gereviewde READY-commit: expectedHeadSha is verplicht en alle sha's moeten gelijk zijn.
    requireThat(typeof input.expectedHeadSha === 'string' && /^[0-9a-f]{40}([0-9a-f]{24})?$/i.test(input.expectedHeadSha), 'merge_pull_request vereist expectedHeadSha (de volledige sha van de PR-head die is gereviewd).');
    assertPrMerge(root, st, c, {number: nr, expectedHeadSha: input.expectedHeadSha.toLowerCase()});
  }
  st.usage.external++;
  st.external_calls[e.tool_use_id] = {id: e.tool_use_id, provider: call.provider, action: call.action, level: call.level, status: 'reserved', at: now(), summary: safeExternalSummary(call, input)};
  log(st, 'extern_gereserveerd', {provider: call.provider, actie: call.action, niveau: call.level});
  saveWork(root, st);
  return null;
}

// ---------------------------------------------------------------- PreToolUse
export function preTool(root, e) {
  const name = e.tool_name, input = e.tool_input || {};
  requireThat(typeof name === 'string', 'Toolnaam ontbreekt.');
  requireThat(e.permission_mode !== 'bypassPermissions', 'AAE ondersteunt geen bypassPermissions. Herstart met normale hostrechten.');
  e = {...e, tool_input: input};
  importLegacy(root);
  return withLock(root, () => {
    const st = active(root);
    if (name === 'Agent' || name === 'Task') return delegation(root, st, e);
    if (READ_TOOLS.has(name)) return readPermission(root, st, e);
    if (isSubagent(e)) {
      if (name === 'SubagentHandback') { requireThat(st && Object.values(st.agents).some(r => r.agent_id === e.agent_id && ['reserved', 'running', 'unverified'].includes(r.status)), 'Onbekende agent'); return null; }
      throw new GuardError('AAE-specialisten zijn read-only: geen shell, schrijven, skills, MCP of verdere delegatie. Lever advies/testcode aan de hoofdsessie.');
    }
    const external = classifyExternalCall(name, input);
    if (external) return preExternal(root, e, external);
    if (name === 'WebFetch') requireThat(!/^\s*file:/i.test(String(input.url || '')), 'Een file:-adres via WebFetch kan lokale geheimen lezen en wordt niet toegelaten.');
    if (HARMLESS_MAIN.has(name)) return null;
    if (WRITE_TOOLS.has(name)) return writePermission(root, st, e);
    if (name === 'Bash' || name === 'PowerShell') return bashPermission(root, st, e);
    throw new GuardError('Tool ' + name + ' is niet door AAE v' + VERSION + ' geclassificeerd. Niet omzeilen via MCP/skills/agentteams.');
  });
}

// ---------------------------------------------------------------- levenscyclus
function findRow(root, pred) {
  for (const id of listWork(root)) {
    const st = loadWork(root, id); if (!st || ['READY', 'CANCELLED'].includes(st.status)) continue;
    const row = Object.values(st.agents).find(pred);
    if (row) return {st, row};
  }
  return null;
}
/** Een gelezen pull request (pull_request_read get) legt vast welke head-sha de remote op dat moment heeft; alleen dat telt als waarneming voor een merge. */
function observePullRequest(root, e) {
  const werk = findProviderWork(root, 'github'); if (!werk || werk.status !== 'EXECUTING') return false;
  const nr = Number(e.tool_input?.pullNumber ?? e.tool_input?.pull_number), sha = prHeadShaFromResponse(e.tool_response);
  if (!Number.isInteger(nr) || !sha) return false;
  werk.pr_observed = {...(werk.pr_observed || {}), [String(nr)]: {sha, at: now(), owner: e.tool_input?.owner, repo: e.tool_input?.repo, bron: 'pull_request_read'}};
  log(werk, 'pr_gelezen', {nummer: nr, sha: sha.slice(0, 12)}); saveWork(root, werk); return true;
}
function externalLifecycle(root, e) {
  if (e.hook_event_name === 'PostToolUse' && /^mcp__github__pull_request_read$/i.test(String(e.tool_name)) && (e.tool_input?.method ?? 'get') === 'get') { observePullRequest(root, e); return false; }
  const hit = listWork(root).map(id => loadWork(root, id)).find(s => s && s.external_calls[e.tool_use_id]);
  if (!hit) {
    if (e.hook_event_name === 'PostToolUse' && /get_project_url$/i.test(String(e.tool_name))) {
      const g = loadGlobal(root); if (g.probe_open?.[e.tool_use_id]) {
        const ref = projectRefFromResponse(e.tool_response); delete g.probe_open[e.tool_use_id];
        if (ref) g.supabase_probe = {ref, at: now()};
        saveGlobal(root, g); return true;
      }
    }
    return false;
  }
  const st = hit, row = st.external_calls[e.tool_use_id];
  if (e.hook_event_name === 'PostToolUseFailure') { row.status = 'failed'; row.finished = now(); log(st, 'extern_mislukt', {provider: row.provider, actie: row.action}); saveWork(root, st); return true; }
  if (e.hook_event_name !== 'PostToolUse') return false;
  row.status = 'stopped'; row.finished = now(); row.result_digest = responseDigest(e.tool_response);
  if (row.provider === 'supabase' && row.action === 'get_project_url') {
    const ref = projectRefFromResponse(e.tool_response), cfg = st.contract.envelope.providers.supabase;
    row.observed_project_ref = ref || null;
    if (ref) {
      if (cfg && cfg.project_ref !== ref) { row.status = 'mismatch'; log(st, 'supabase_project_mismatch', {verwacht: cfg.project_ref, gezien: ref}); }
      else { st.supabase_verified = {ref, at: now()}; log(st, 'supabase_project_geverifieerd', {project_ref: ref}); }
    }
  }
  if (row.provider === 'github' && row.action === 'create_pull_request') {
    const nr = prNumberFromResponse(e.tool_response);
    if (nr) {
      st.created_prs = [...(st.created_prs || []).filter(p => !(p.number === nr && p.owner === e.tool_input?.owner && p.repo === e.tool_input?.repo)), {number: nr, owner: e.tool_input?.owner, repo: e.tool_input?.repo, base: e.tool_input?.base, head: e.tool_input?.head}];
      const sha = prHeadShaFromResponse(e.tool_response); if (sha) st.pr_observed = {...(st.pr_observed || {}), [String(nr)]: {sha, at: now(), owner: e.tool_input?.owner, repo: e.tool_input?.repo, bron: 'create_pull_request'}};
    }
  }
  const index = st.external_receipts.length + 1;
  const receipt = {schema_version: 1, id: st.id, envelope_hash: envelopeHash(st.contract), provider: row.provider, action: row.action, level: row.level, status: row.status, summary: row.summary, result_digest: row.result_digest, observed_project_ref: row.observed_project_ref || null, finished: row.finished};
  const rp = 'docs/aae/evidence/' + st.id + '/external-' + index + '.json'; atomicJson(root, rp, receipt);
  st.external_receipts.push({...receipt, evidence_path: rp}); row.evidence_path = rp;
  saveWork(root, st); return true;
}
export function lifecycle(root, e) {
  importLegacy(root);
  return withLock(root, () => {
    if (externalLifecycle(root, e)) return null;
    const ev = e.hook_event_name;
    if (ev === 'SubagentStart') {
      const hit = findRow(root, r => (r.role === e.agent_type && r.status === 'reserved' && (!r.agent_id || r.agent_id === e.agent_id)) || (r.agent_id === e.agent_id && ['running', 'unverified', 'presumed_dead'].includes(r.status)));
      if (!hit) { eventLog(root, 'unmatched_subagent_start', {rol: e.agent_type}); return context('SubagentStart', 'AAE: geen toegestane dispatch gevonden. Doe geen projectwerk; rapporteer aan de hoofdsessie.'); }
      const {st, row} = hit;
      row.agent_id = e.agent_id; row.status = 'running'; row.started = now(); row.last_seen = now();
      if (e.agent_transcript_path) row.transcript_path = e.agent_transcript_path;
      st.activity = st.status === 'EXECUTING' ? 'WAITING_FOR_AGENT' : st.activity; saveWork(root, st);
      return context('SubagentStart', 'AAE: alleen lezen en de toegewezen vraag beantwoorden. Geen tools buiten Read/Grep/Glob, geen nieuwe agents. Eindig met SAMENVATTING ... EINDE-SAMENVATTING (VERDICT: READY|PARTIAL|BLOCKED).');
    }
    if (ev === 'SubagentStop') {
      const hit = findRow(root, r => r.agent_id === e.agent_id && ['running', 'reserved', 'unverified', 'presumed_dead', 'unknown'].includes(r.status));
      if (hit) {
        const {st, row} = hit;
        row.status = 'stopped'; row.finished = now(); row.last_seen = now();
        if (e.agent_transcript_path) row.transcript_path = e.agent_transcript_path;
        const pad = row.transcript_path || findTranscript(row.agent_id);
        if (pad) row.transcript_path = pad;
        const tekst = pad ? transcriptFinalText(pad) : null;
        const bron = {};
        const last = e.last_assistant_message || row.handback_text || null;
        if (last) bron.last_message = last;
        if (tekst) bron.transcript = tekst;
        safeFinalize(root, st, row, bron);
        settle(st); saveWork(root, st);
      }
      return null; // een stop wordt nooit geblokkeerd: geen review-lussen
    }
    if (e.tool_name === 'SubagentHandback' && ev === 'PostToolUse') {
      const hit = findRow(root, r => r.agent_id === e.agent_id && ['running', 'reserved', 'unverified'].includes(r.status));
      if (hit) { hit.row.handback_text = String(e.tool_input?.message || e.tool_input?.report || ''); saveWork(root, hit.st); }
      return null;
    }
    if (['Agent', 'Task'].includes(e.tool_name)) {
      const hit = findRow(root, r => r.id === e.tool_use_id);
      if (!hit) return null;
      const {st, row} = hit;
      if (ev === 'PostToolUseFailure') { row.status = 'failed'; row.finished = now(); log(st, 'agent_mislukt', {run: row.run_key}); settle(st); saveWork(root, st); return null; }
      const r = e.tool_response || {};
      if (r.agentId) row.agent_id = row.agent_id || r.agentId;
      if (r.resolvedModel) row.observed_model = r.resolvedModel;
      if (Number.isFinite(r.totalDurationMs)) row.observed_duration_ms = r.totalDurationMs;
      if (Number.isFinite(r.totalToolUseCount)) row.observed_tool_calls = r.totalToolUseCount;
      if (r.usage) row.last_request_usage = r.usage; // uitdrukkelijk niet het totaal van de hele run
      if (r.status === 'completed') {
        if (row.status !== 'stopped') { row.status = 'stopped'; row.finished = now(); }
        const bron = {}; const content = contentText(r); if (content) bron.content = content;
        const pad = row.transcript_path || findTranscript(row.agent_id); if (pad) { row.transcript_path = pad; const tt = transcriptFinalText(pad); if (tt) bron.transcript = tt; }
        safeFinalize(root, st, row, bron);
      } else if (r.status === 'async_launched' && !['stopped', 'failed', 'abandoned'].includes(row.status)) row.status = 'running';
      else if (row.status === 'reserved') row.status = 'unverified';
      settle(st); saveWork(root, st);
      return null;
    }
    if (ev === 'PostToolUse' && WRITE_TOOLS.has(e.tool_name)) {
      try {
        const p = toolPath(root, e), wk = workIdFromPath(p);
        if (wk && wk.kind === 'proposal') {
          const c = validateContract(JSON.parse(fs.readFileSync(safePath(root, p, {allowMissing: false}), 'utf8')));
          registerContractUnlocked(root, c);
        }
      } catch (err) { eventLog(root, 'registratie_mislukt', {fout: String(err.message).slice(0, 200)}); }
    }
    return null;
  });
}
function sessionStart(root, e) {
  importLegacy(root);
  return withLock(root, () => {
    const st = activeWork(root);
    if (st) { const w = reconcile(root, st); if (w.length) saveWork(root, st); }
    eventLog(root, 'session_start', {sessie: e.session_id});
    let orphan = []; try { orphan = orphanedSnapshots(root, id => { try { return Boolean(loadWork(root, id)); } catch { return false; } }); } catch { /* geen hint */ }
    return context('SessionStart', 'AAE v' + VERSION + ' geladen. ' + (st ? 'Werkpakket ' + st.id + ': ' + st.status + (st.activity ? ' (' + st.activity + ')' : '') + '.' : 'Geen actief werkpakket.') + (orphan.length ? ' De lokale status van ' + orphan.join(', ') + ' ontbreekt of is beschadigd terwijl er een goedgekeurde snapshot is: herstel met node .claude/aae/runtime/cli.mjs recover <id> (het pakket komt terug als PAUSED en hervat pas na AAE VERDER).' : '') + ' Zie .claude/aae/ENTRY.md.');
  });
}
export function handleEvent(root, e) {
  requireThat(e && typeof e === 'object', 'Hookinvoer ontbreekt.');
  switch (e.hook_event_name) {
    case 'SessionStart': return sessionStart(root, e);
    case 'UserPromptSubmit': return handlePrompt(root, e);
    case 'PreToolUse': return preTool(root, e);
    case 'SubagentStart': case 'SubagentStop': case 'PostToolUse': case 'PostToolUseFailure': return lifecycle(root, e);
    case 'Stop': return null; // geen Stop-hook-logica: stoppen is aan de gebruiker; close controleert het bewijs
    case 'SessionEnd': eventLog(root, 'session_end', {sessie: e.session_id}); return null;
    default: throw new Error('Niet-ondersteund AAE hook-event: ' + e.hook_event_name);
  }
}
