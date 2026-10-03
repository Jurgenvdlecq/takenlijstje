/**
 * Gebruikersopdrachten. Alleen exacte AAE-commando's veranderen een goedkeuring; elk ander bericht is een voortzetting
 * (continuation_event) en laat status en GO ongemoeid. Interne hook-meldingen raken dit pad nooit.
 */
import {requireThat, digest, now, classifyCommand, commandFingerprint, commandRefs, stable, envelopeHash, shortHash, SHORT_HASH_LENGTH, AGENT_CAP} from './core.mjs';
import {
  withLock, listWork, loadWork, saveWork, log, transition, approve, assertApproval, blockSnapshot, TERMINAL, loadGlobal, saveGlobal, eventLog, needsHuman, tellers
} from './state.mjs';
import {gitHead} from './gitops.mjs';
import {writeSnapshot, writeSnapshotRetry} from './snapshot.mjs';
import {liveRows, reconcile} from './reports.mjs';
import {importLegacy} from './legacy.mjs';

const CMD = /^AAE (GO|PAUZE|VERDER|STATUS|ANNULEER|BEVESTIG)(?: ([A-Za-z0-9_-]+))?(?: ([0-9a-f]{4,64}))?$/; // exacte tekst, hoofdletters; geen afgeleide of vermomde varianten. GO: AAE GO <id> <korte hash van exact 12 tekens>; een andere lengte wordt bij de GO met uitleg geweigerd.
export const context = (event, msg) => ({hookSpecificOutput: {hookEventName: event, additionalContext: msg}});
export const extraKey = m => digest({argv: m.argv, purpose: m.purpose});

/** Niet-lokale of niet-allowlist-commando's die bij GO zijn goedgekeurd worden vastgepind op de inhoud van hun bronnen. */
export function recordExtraFingerprints(root, st) {
  const c = st.contract; st.extra_fp = {};
  for (const m of c.plan.commands) { if (classifyCommand(c, m).kind === 'extra') st.extra_fp[extraKey(m)] = {fp: commandFingerprint(root, m), refs: Object.fromEntries(commandRefs(root, m))}; }
}
/** Een Supabase-projectcontrole die vóór het pakket is gedaan, geldt voor dit werkpakket. */
export function bindProbe(root, st) {
  const g = loadGlobal(root), want = st.contract?.envelope.providers.supabase?.project_ref;
  if (want && g.supabase_probe?.ref === want && !st.supabase_verified) { st.supabase_verified = {ref: want, at: g.supabase_probe.at}; }
}
const TEKST = {PLANNING: 'wordt voorbereid', WAITING_FOR_APPROVAL: 'wacht op jouw GO', EXECUTING: 'is in uitvoering', NEEDS_HUMAN: 'wacht op jouw beslissing', PAUSED: 'is gepauzeerd', READY: 'is klaar', BLOCKED: 'zit vast', CANCELLED: 'is geannuleerd'};
const ACT = {BUILDING: 'er wordt gebouwd', TESTING: 'er wordt getest', WAITING_FOR_AGENT: 'een controleur kijkt mee', REVIEWING: 'er wordt gereviewd', MERGING: 'er wordt samengevoegd', DEPLOYING: 'er wordt uitgerold'};
export function plainSummary(root) {
  const regels = [], tech = [];
  for (const id of listWork(root)) {
    const st = loadWork(root, id); if (!st || (TERMINAL.has(st.status) && st.status === 'CANCELLED')) continue;
    let r = 'Werkpakket ' + id + ' ' + (st.status === 'BLOCKED' && st.result === 'PARTIAL' ? 'is gedeeltelijk klaar' : TEKST[st.status]) + (st.activity ? ' (' + ACT[st.activity] + ')' : '') + '.';
    if (st.status === 'BLOCKED' && st.blockers.length) r += ' ' + st.blockers[0];
    if (st.status === 'NEEDS_HUMAN' && st.needs_human) r += ' ' + st.needs_human.summary;
    if (st.status === 'PLANNING' && st.blockers.length) r += ' Nog nodig: ' + st.blockers.join(' ');
    regels.push(r);
    tech.push({id, status: st.status, activity: st.activity, agents: st.usage.agents, commando_runs: st.usage.commands, live_agents: liveRows(st).length, soft_overschreden: st.soft_exceeded, tellers: tellers(st), review: st.human_review ? {verdict: st.human_review.verdict, sha: st.human_review.sha.slice(0, 12)} : null});
  }
  if (!regels.length) regels.push('Er is geen actief werkpakket. Zonder goedgekeurd werkpakket verandert er niets aan de applicatie.');
  return {plain: regels, technical: tech};
}
const kandidaten = (root, pred) => listWork(root).map(id => loadWork(root, id)).filter(s => s && pred(s));
function kies(root, id, pred, wat) {
  const lijst = kandidaten(root, s => (!id || s.id === id) && pred(s));
  if (id) requireThat(lijst.length === 1, 'Werkpakket ' + id + ' is niet in een toestand voor ' + wat + '.');
  requireThat(lijst.length <= 1, 'Meerdere werkpakketten komen in aanmerking (' + lijst.map(s => s.id).join(', ') + '). Noem het ID: AAE ' + wat + ' <id>.');
  return lijst[0] || null;
}
const dbTekst = {none: 'geen databasewijzigingen', A: 'databasewijzigingen klasse A (zonder risico voor bestaande gegevens)', B: 'databasewijzigingen tot klasse B (aanvullend en herstelbaar)'};
/**
 * Toont het voorstel waarvoor een GO gevraagd wordt en legt vast wélke versie is getoond. De gebruiker herkent het voorstel aan ID en korte hash;
 * intern telt alleen de volledige hash. Een GO telt alleen voor precies deze hash.
 */
export function presentProposal(root, id) {
  return withLock(root, () => {
    const st = loadWork(root, id); requireThat(st, 'Onbekend werkpakket ' + id + '.');
    requireThat(['PLANNING', 'WAITING_FOR_APPROVAL', 'PAUSED', 'NEEDS_HUMAN'].includes(st.status), 'Werkpakket ' + id + ' wacht niet op goedkeuring (' + st.status + ').');
    const c = st.proposed || st.contract; requireThat(c, 'Nog geen voorstel voor ' + id + '. Maak eerst proposal.json en voer cli plan uit.');
    const e = c.envelope, hash = envelopeHash(c), kort = shortHash(hash);
    const providers = Object.entries(e.providers).map(([naam, p]) => naam === 'supabase'
      ? 'supabase (project ' + p.project_ref + '; tools: ' + p.tools.join(', ') + '; max ' + p.max_calls + ' aanroepen)'
      : 'github (' + p.owner + '/' + p.repo + '; werkbranch ' + p.head + (p.base ? ' naar ' + p.base : '') + '; tools: ' + p.tools.join(', ') + '; max ' + p.max_calls + ' aanroepen)');
    const steun = [...new Set(e.areas.flatMap(a => a.support || []))];
    const extra = e.extra_commands.map(x => {
      const reden = (c.plan.commands.find(m => m.purpose === x.purpose && stable(m.argv) === stable(x.argv)) || {}).why;
      return '  - [' + x.purpose + '] ' + x.argv.join(' ') + (reden ? ' — reden: ' + reden : '') + ' — BUITEN de standaardlijst' + (x.argv[0] === 'node' ? ' en voert projectcode uit' : '');
    });
    const regels = [
      'Werkpakket ' + id + ' — korte hash ' + kort + ' (alleen ter herkenning; intern telt de volledige hash).',
      'Doel: ' + c.goal,
      'Fase: ' + (e.phase === 'analysis' ? 'analyse (alleen lezen en onderzoeken)' : 'implementatie') + '. Risico: ' + c.risk_class + (c.risk_flags.length ? ' (' + c.risk_flags.join(', ') + ')' : '') + '.',
      e.areas.length ? 'Mag wijzigen: ' + [...new Set(e.areas.flatMap(a => a.write))].join(', ') + (steun.length ? ' (ondersteunend: ' + steun.join(', ') + ')' : '') : 'Wijzigt geen projectbestanden (alleen lezen en onderzoeken).',
      'Git: ' + [e.git.commit ? 'committen' : 'niet committen', e.git.push.length ? 'pushen naar ' + e.git.push.join(', ') : 'niet pushen', e.git.merge ? 'samenvoegen naar ' + e.git.merge.to : 'geen samenvoeging', e.git.deploy === 'none' ? 'geen uitrol' : 'uitrol: ' + e.git.deploy].join('; ') + '.',
      'Database: ' + (dbTekst[e.db_max] || e.db_max) + '.',
      'Externe diensten: ' + (providers.length ? providers.join(' | ') : 'geen') + '.',
      'Harde budgetten: ' + e.budgets.command_runs + ' commando\'s, ' + (e.budgets.external_calls ?? 0) + ' externe aanroepen, ' + (e.budgets.max_parallel ?? 2) + ' tegelijk. Agents: intern plafond van niveau ' + c.risk_class + ' (hoogstens ' + AGENT_CAP[c.risk_class].hard + ', normaal ' + AGENT_CAP[c.risk_class].normal + '); dat hoef jij niet te beheren.',
      'Acceptatiecriteria (' + e.acceptance.length + '):', ...e.acceptance.map(a => '  - ' + a.id + ': ' + a.text),
      'Extra commando\'s buiten de standaardlijst (' + e.extra_commands.length + ')' + (e.extra_commands.length ? ':' : ': geen.'), ...extra,
      'Beslisstandaarden: ' + (e.decision_defaults.length ? e.decision_defaults.join(' | ') : 'geen') + '.',
      'Aannames: ' + (e.assumptions.length ? e.assumptions.join(' | ') : 'geen') + '.',
      'Stopmomenten voor jou: ' + (e.decision_points.length ? e.decision_points.join(' | ') : 'geen vastgelegd') + '.'
    ];
    if (st.human_review) regels.push('Review van Jurgen: ' + st.human_review.verdict + ' op commit ' + st.human_review.sha.slice(0, 12) + ' (' + st.human_review.at + ').');
    for (const n of st.legacy_notes || []) regels.push('Let op (overname uit v3.2): ' + n);
    if (st.blockers?.length) regels.push('Let op, nog niet klaar om te starten: ' + st.blockers.join(' '));
    st.presented = {hash, at: now()}; log(st, 'voorstel_getoond', {hash: kort}); saveWork(root, st);
    return {id, short_hash: kort, status: st.status, samenvatting: regels, exacte_go: 'AAE GO ' + id + ' ' + kort, vraag: 'Stuur als los bericht exact: AAE GO ' + id + ' ' + kort + ' (alleen geldig voor envelop ' + kort + '). Verandert het voorstel, dan vraag ik opnieuw.'};
  });
}
/**
 * v3.4: AAE REVIEW <id> <sha12> READY|BLOCKED - Jurgens eigen reviewoordeel, alleen als los bericht in exact deze vorm (dit pad wordt uitsluitend door de
 * UserPromptSubmit-hook bereikt; geen tool, agent, bestand of hook-melding kan het geven). Gebonden aan de huidige HEAD; zichtbaar in geschiedenis en resultaat.
 */
const REVIEW = /^AAE REVIEW ([A-Za-z0-9][A-Za-z0-9_-]{0,63}) ([0-9a-f]{12}) (READY|BLOCKED)$/;
function menselijkeReviewOpdracht(root, prompt) {
  const m = REVIEW.exec(prompt);
  const weiger = reden => { eventLog(root, 'review_geweigerd', {reden}); return context('UserPromptSubmit', 'AAE: REVIEW niet vastgelegd: ' + reden + ' De enige geldige vorm is een los bericht: AAE REVIEW <werkpakket-ID> <eerste 12 tekens van de huidige commit> READY|BLOCKED.'); };
  if (!m) return weiger('het bericht heeft niet exact de vorm (hoofdletters, ID, 12 kleine hextekens, READY of BLOCKED, niets meer).');
  const [, id, kort, verdict] = m;
  const st = loadWork(root, id);
  if (!st || TERMINAL.has(st.status)) return weiger('werkpakket ' + id + ' bestaat niet of is al afgerond.');
  const head = gitHead(root);
  if (!head) return weiger('de huidige commit (HEAD) is niet te bepalen.');
  if (head.slice(0, 12) !== kort) return weiger('de 12 tekens horen niet bij de huidige HEAD (' + head.slice(0, 12) + ').');
  st.human_review = {door: 'Jurgen', bron: 'UserPromptSubmit', sha: head, verdict, at: now(), envelope_hash: st.contract ? envelopeHash(st.contract) : null};
  log(st, 'human_review', {sha: head.slice(0, 12), verdict});
  saveWork(root, st); eventLog(root, 'review', {id, sha: head.slice(0, 12), verdict});
  return context('UserPromptSubmit', 'AAE: REVIEW ' + verdict + ' van Jurgen vastgelegd voor ' + id + ' op commit ' + head.slice(0, 12) + '. ' + (verdict === 'READY' ? 'Dit telt als het vereiste reviewoordeel zolang HEAD exact deze commit is en de gebieden schoon zijn.' : 'READY is geblokkeerd tot een nieuwe review op een nieuwe commit.'));
}
function pauzeer(st, why) { st.paused_from = st.status; st.confirmed = null; transition(st, 'PAUSED', why); st.activity = null; } // een bevestiging overleeft een pauze niet

export function handlePrompt(root, e) {
  const prompt = String(e.prompt || '').trim();
  requireThat(String(e.session_id || ''), 'Sessie-ID ontbreekt.');
  importLegacy(root);
  if (/^AAE REVIEW\b/.test(prompt)) return withLock(root, () => menselijkeReviewOpdracht(root, prompt));
  const m = prompt.match(CMD);
  return withLock(root, () => {
    if (!m) {
      // Voortzetting: raakt de goedkeuring niet aan. Alleen een openstaande gevoelige bevestiging is eenmalig en vervalt.
      let actief = null;
      for (const st of kandidaten(root, s => ['EXECUTING', 'NEEDS_HUMAN'].includes(s.status))) {
        actief = st; let wijzig = false;
        if (st.confirmed) { st.confirmed = null; log(st, 'bevestiging_vervallen'); wijzig = true; }
        for (const r of liveRows(st)) { if (!r.interrupted_hint) { r.interrupted_hint = true; wijzig = true; } }
        if (reconcile(root, st).length) wijzig = true;
        if (wijzig) saveWork(root, st);
      }
      eventLog(root, 'continuation', {actief: actief?.id || null});
      return actief ? context('UserPromptSubmit', 'AAE v3.3: werkpakket ' + actief.id + ' (' + actief.status + ') blijft zoals het was; dit bericht verandert de goedkeuring niet.') : null;
    }
    const actie = m[1], id = m[2] || null;
    if (actie === 'STATUS') return context('UserPromptSubmit', JSON.stringify(plainSummary(root)));
    if (actie === 'PAUZE') {
      const st = kies(root, id, s => ['PLANNING', 'WAITING_FOR_APPROVAL', 'EXECUTING', 'NEEDS_HUMAN'].includes(s.status), 'PAUZE');
      if (!st) return context('UserPromptSubmit', 'AAE: er is niets om te pauzeren.');
      pauzeer(st, 'AAE PAUZE'); saveWork(root, st); eventLog(root, 'pauze', {id: st.id});
      return context('UserPromptSubmit', 'AAE: ' + st.id + ' is gepauzeerd. Stop lopend werk; er wordt geen proces geannuleerd. AAE VERDER hervat dezelfde goedgekeurde envelop (geen nieuwe GO).');
    }
    if (actie === 'ANNULEER') {
      const st = kies(root, id, s => !TERMINAL.has(s.status), 'ANNULEER');
      if (!st) return context('UserPromptSubmit', 'AAE: er is niets om te annuleren.');
      for (const r of liveRows(st)) r.status = 'abandoned';
      st.status === 'CANCELLED' || transition(st, 'CANCELLED', 'AAE ANNULEER'); st.approved = st.approved; saveWork(root, st); eventLog(root, 'annuleer', {id: st.id});
      return context('UserPromptSubmit', 'AAE: ' + st.id + ' is geannuleerd.');
    }
    if (actie === 'BEVESTIG') {
      const st = kies(root, id, s => ['NEEDS_HUMAN', 'EXECUTING'].includes(s.status) && s.pending_decision, 'BEVESTIG');
      if (!st) return context('UserPromptSubmit', 'AAE: er staat geen beslissing open die een bevestiging vraagt.');
      st.confirmed = {action_hash: st.pending_decision.action_hash, at: now()};
      if (st.status === 'NEEDS_HUMAN') transition(st, 'EXECUTING', 'AAE BEVESTIG');
      st.activity = 'BUILDING'; log(st, 'bevestigd', {actie: st.pending_decision.id}); saveWork(root, st); eventLog(root, 'bevestig', {id: st.id});
      return context('UserPromptSubmit', 'AAE: bevestiging geldt alleen voor de ene beschreven actie (' + st.pending_decision.description + ') en vervalt zodra die is uitgevoerd of bij het volgende gewone bericht.');
    }
    if (actie === 'VERDER') {
      // Hervatten kan vanuit PAUSED, BLOCKED en een wachtende beslissing zonder gevoelige actie (extern, scope); een gevoelige DB-stap vraagt AAE BEVESTIG.
      const st = kies(root, id, s => ['PAUSED', 'BLOCKED'].includes(s.status) || (s.status === 'NEEDS_HUMAN' && ['extern', 'scope_change', 'snapshot'].includes(s.needs_human?.kind) && !s.pending_decision), 'VERDER');
      if (!st) return context('UserPromptSubmit', 'AAE: er is geen gepauzeerd, vastgelopen of wachtend werkpakket om te hervatten.');
      if (st.approved) {
        // VERDER hervat uitsluitend dezelfde eerder goedgekeurde envelop en is nooit een nieuwe GO: een afwijkend contract of een ontbrekende snapshot houdt het pakket tegen.
        const ander = kandidaten(root, s => s.id !== st.id && ['EXECUTING', 'NEEDS_HUMAN'].includes(s.status));
        requireThat(!ander.length, 'Werkpakket ' + ander[0]?.id + ' is nog actief; er is één bouwer per werkmap.');
        try { assertApproval(st); if (st.approved.snapshot_required) writeSnapshot(root, st, st.approved.source); }
        catch (err) { saveWork(root, st); eventLog(root, 'verder_geweigerd', {id: st.id}); return context('UserPromptSubmit', 'AAE: VERDER hervat alleen de eerder goedgekeurde envelop en dat lukt nog niet: ' + String(err.message).slice(0, 300) + ' Een gewijzigd voorstel vraagt cli present en AAE GO <id> <korte hash>.'); }
        transition(st, 'EXECUTING', 'AAE VERDER'); st.activity = 'BUILDING'; st.blockers = []; st.result = null;
      } else if (st.status === 'NEEDS_HUMAN') { st.preflight = null; st.blockers = ['Preflight opnieuw uitvoeren (cli preflight).']; transition(st, 'PLANNING', 'AAE VERDER'); }
      else transition(st, st.status === 'BLOCKED' ? 'PLANNING' : 'WAITING_FOR_APPROVAL', 'AAE VERDER');
      saveWork(root, st); eventLog(root, 'verder', {id: st.id});
      return context('UserPromptSubmit', 'AAE: ' + st.id + ' hervat binnen dezelfde envelop (' + st.status + ').');
    }
    // GO: alleen exact "AAE GO <werkpakket-ID> <korte hash>"; een kale GO, een ander ID of een andere hash telt niet en keurt niets goed.
    const korteHash = m[3] || null;
    if (!id || !korteHash) {
      eventLog(root, 'go_geweigerd', {reden: 'ID of hash ontbreekt'});
      return context('UserPromptSubmit', 'AAE: GO geweigerd: een GO heeft de vorm AAE GO <werkpakket-ID> <korte hash> en alleen voor een voorstel dat is getoond. Voer cli present <id> uit, toon de gebruiker ID en korte hash met de volledige inhoud, en wacht op de exacte GO-opdracht. Er is niets goedgekeurd.');
    }
    if (korteHash.length !== SHORT_HASH_LENGTH) {
      eventLog(root, 'go_geweigerd', {id, reden: 'hashlengte ' + korteHash.length});
      return context('UserPromptSubmit', 'AAE: GO geweigerd voor ' + id + ': de korte hash heeft ' + korteHash.length + ' tekens, een GO gebruikt er precies ' + SHORT_HASH_LENGTH + ' (AAE GO <werkpakket-ID> <' + SHORT_HASH_LENGTH + ' tekens>). Voer cli present ' + id + ' uit en gebruik de exacte GO-opdracht uit de uitvoer. Er is niets goedgekeurd.');
    }
    const st = kies(root, id, s => s.status === 'WAITING_FOR_APPROVAL' || s.status === 'PAUSED' || s.status === 'EXECUTING' || (s.status === 'NEEDS_HUMAN' && s.needs_human?.kind === 'material_change'), 'GO');
    if (!st) {
      const wacht = kandidaten(root, s => s.status === 'NEEDS_HUMAN');
      return context('UserPromptSubmit', wacht.length ? 'AAE: ' + wacht[0].id + ' wacht op een andere beslissing dan een GO (' + (wacht[0].needs_human?.summary || 'zie status') + ').' : 'AAE: er is geen werkpakket dat op een GO wacht.');
    }
    const weiger = (reden, hint) => { eventLog(root, 'go_geweigerd', {id: st.id, reden}); return context('UserPromptSubmit', 'AAE: GO geweigerd voor ' + st.id + ': ' + reden + '. ' + hint + ' Er is niets goedgekeurd.'); };
    if (st.status === 'EXECUTING') {
      return korteHash === shortHash(st.approved.envelope_hash) ? context('UserPromptSubmit', 'AAE: de GO voor ' + st.id + ' (envelop ' + korteHash + ') is al geldig.') : weiger('de goedgekeurde envelop heeft hash ' + shortHash(st.approved.envelope_hash) + ', niet ' + korteHash, 'Een andere envelop vraagt eerst cli present en een nieuwe GO.');
    }
    const ander = kandidaten(root, s => s.id !== st.id && ['EXECUTING', 'NEEDS_HUMAN'].includes(s.status));
    requireThat(!ander.length, 'Werkpakket ' + ander[0]?.id + ' is nog actief. Rond het af of pauzeer het (AAE PAUZE ' + ander[0]?.id + ') voordat ' + st.id + ' start; er is één bouwer per werkmap.');
    if (st.status === 'PAUSED' && st.approved) {
      if (korteHash !== shortHash(st.approved.envelope_hash)) return weiger('de goedgekeurde envelop heeft hash ' + shortHash(st.approved.envelope_hash) + ', niet ' + korteHash, 'Gebruik AAE VERDER om dezelfde envelop te hervatten.');
      assertApproval(st); transition(st, 'EXECUTING', 'AAE GO na pauze'); st.activity = 'BUILDING';
    } else {
      const c = st.proposed || st.contract;
      requireThat(c, 'Geen contract om goed te keuren voor ' + st.id + '.');
      const hash = envelopeHash(c);
      // Een GO telt alleen voor het voorstel dat de gebruiker is getoond (ID + korte hash): de getypte hash moet gelijk zijn aan de hash van het huidige voorstel én aan wat cli present heeft getoond.
      if (korteHash !== shortHash(hash)) return weiger('de hash ' + korteHash + ' hoort niet bij het huidige voorstel (' + shortHash(hash) + ')', 'Voer cli present ' + st.id + ' uit, toon de gebruiker het actuele voorstel met ID en korte hash en wacht op een nieuwe exacte GO.');
      if (!st.presented || st.presented.hash !== hash) return weiger(st.presented ? 'het voorstel is gewijzigd sinds het is getoond' : 'het voorstel is nog niet getoond', 'Voer cli present ' + st.id + ' uit, toon de gebruiker ID en korte hash (' + shortHash(hash) + ') met de volledige inhoud en wacht op de exacte GO-opdracht.');
      if (st.status === 'PAUSED') transition(st, 'WAITING_FOR_APPROVAL', 'terug naar goedkeuring');
      requireThat(st.status === 'NEEDS_HUMAN' || !st.blockers.length, 'Plan is nog niet klaar: ' + st.blockers.join(' '));
      const bron = st.status === 'NEEDS_HUMAN' ? 'AAE GO (envelopewijziging)' : 'AAE GO';
      approve(st, c, bron);
      st.start_head = st.start_head || gitHead(root); // v3.4: de commit waarop het pakket startte (voor de administratie-push na close)
      // Als eerste schrijfactie na de GO legt de runtime de goedgekeurde envelop vast (gevolgde, append-only snapshot), met automatische herpogingen.
      // Een blijvende technische fout geeft BLOCKED (geen beslissing van Jurgen); AAE VERDER hervat dezelfde envelop.
      st.approved.snapshot_required = true;
      try { writeSnapshotRetry(root, st, bron); }
      catch (err) { blockSnapshot(root, st, err); }
      recordExtraFingerprints(root, st); bindProbe(root, st);
    }
    saveWork(root, st); eventLog(root, 'go', {id: st.id, hash: shortHash(st.approved.envelope_hash)});
    return context('UserPromptSubmit', st.status === 'BLOCKED' ? 'AAE: GO ontvangen voor ' + st.id + ', maar de snapshot kon technisch niet worden vastgelegd: ' + (st.blockers[0] || '') : 'AAE: GO geldt voor ' + st.id + ' (envelop ' + shortHash(st.approved.envelope_hash) + ') en blijft geldig tot het klaar, gepauzeerd of geannuleerd is, of de envelop materieel wijzigt. De goedgekeurde envelop is vastgelegd in ' + (st.snapshot?.path || 'de snapshot') + '; commit hem mee met je eerstvolgende commit (geen verplichte volgorde). Gewone berichten veranderen dit niet.');
  });
}
export const _internal = {stable};
