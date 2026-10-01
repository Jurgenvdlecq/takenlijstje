/**
 * Gebruikersopdrachten. Alleen exacte AAE-commando's veranderen een goedkeuring; elk ander bericht is een voortzetting
 * (continuation_event) en laat status en GO ongemoeid. Interne hook-meldingen raken dit pad nooit.
 */
import {requireThat, digest, now, classifyCommand, commandFingerprint, commandRefs, stable} from './core.mjs';
import {
  withLock, listWork, loadWork, saveWork, log, transition, approve, TERMINAL, loadGlobal, saveGlobal, eventLog, needsHuman
} from './state.mjs';
import {liveRows, reconcile} from './reports.mjs';
import {importLegacy} from './legacy.mjs';

const CMD = /^AAE (GO|PAUZE|VERDER|STATUS|ANNULEER|BEVESTIG)(?: ([A-Za-z0-9_-]+))?$/; // exacte tekst, hoofdletters; geen afgeleide of vermomde varianten
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
    tech.push({id, status: st.status, activity: st.activity, agents: st.usage.agents, commando_runs: st.usage.commands, live_agents: liveRows(st).length, soft_overschreden: st.soft_exceeded});
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
function pauzeer(st, why) { st.paused_from = st.status; transition(st, 'PAUSED', why); st.activity = null; }

export function handlePrompt(root, e) {
  const prompt = String(e.prompt || '').trim();
  requireThat(String(e.session_id || ''), 'Sessie-ID ontbreekt.');
  importLegacy(root);
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
      return context('UserPromptSubmit', 'AAE: ' + st.id + ' is gepauzeerd. Stop lopend werk; er wordt geen proces geannuleerd. AAE VERDER of AAE GO hervat dezelfde envelop.');
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
      const st = kies(root, id, s => ['PAUSED', 'BLOCKED'].includes(s.status), 'VERDER');
      if (!st) return context('UserPromptSubmit', 'AAE: er is geen gepauzeerd of vastgelopen werkpakket om te hervatten.');
      if (st.approved) { transition(st, 'EXECUTING', 'AAE VERDER'); st.activity = 'BUILDING'; st.blockers = []; st.result = null; }
      else transition(st, st.status === 'BLOCKED' ? 'PLANNING' : 'WAITING_FOR_APPROVAL', 'AAE VERDER');
      saveWork(root, st); eventLog(root, 'verder', {id: st.id});
      return context('UserPromptSubmit', 'AAE: ' + st.id + ' hervat binnen dezelfde envelop (' + st.status + ').');
    }
    // GO
    const st = kies(root, id, s => s.status === 'WAITING_FOR_APPROVAL' || s.status === 'PAUSED' || s.status === 'EXECUTING' || (s.status === 'NEEDS_HUMAN' && s.needs_human?.kind === 'material_change'), 'GO');
    if (!st) {
      const wacht = kandidaten(root, s => s.status === 'NEEDS_HUMAN');
      return context('UserPromptSubmit', wacht.length ? 'AAE: ' + wacht[0].id + ' wacht op een andere beslissing dan een GO (' + (wacht[0].needs_human?.summary || 'zie status') + ').' : 'AAE: er is geen werkpakket dat op een GO wacht.');
    }
    if (st.status === 'EXECUTING') return context('UserPromptSubmit', 'AAE: de GO voor ' + st.id + ' is al geldig.');
    const ander = kandidaten(root, s => s.id !== st.id && ['EXECUTING', 'NEEDS_HUMAN'].includes(s.status));
    requireThat(!ander.length, 'Werkpakket ' + ander[0]?.id + ' is nog actief. Rond het af of pauzeer het (AAE PAUZE ' + ander[0]?.id + ') voordat ' + st.id + ' start; er is één bouwer per werkmap.');
    if (st.status === 'PAUSED' && st.approved) { transition(st, 'EXECUTING', 'AAE GO na pauze'); st.activity = 'BUILDING'; }
    else {
      const c = st.proposed || st.contract;
      requireThat(c, 'Geen contract om goed te keuren voor ' + st.id + '.');
      if (st.status === 'PAUSED') transition(st, 'WAITING_FOR_APPROVAL', 'terug naar goedkeuring');
      requireThat(st.status === 'NEEDS_HUMAN' || !st.blockers.length, 'Plan is nog niet klaar: ' + st.blockers.join(' '));
      approve(st, c, st.status === 'NEEDS_HUMAN' ? 'AAE GO (envelopewijziging)' : 'AAE GO');
      recordExtraFingerprints(root, st); bindProbe(root, st);
    }
    saveWork(root, st); eventLog(root, 'go', {id: st.id});
    return context('UserPromptSubmit', 'AAE: GO geldt voor ' + st.id + ' en blijft geldig tot het klaar, gepauzeerd of geannuleerd is, of de envelop materieel wijzigt. Gewone berichten veranderen dit niet.');
  });
}
export const _internal = {stable};
