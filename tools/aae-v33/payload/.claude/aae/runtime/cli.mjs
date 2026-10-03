#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {requireThat, readJson, validateContract, now, atomicText, safePath, trackedUnder, STATE_DIR, WORK} from './core.mjs';
import {recoverWork} from './recover.mjs';
import {withLock, activeWork, guardApproval, listWork, loadWork, saveWork, registerContract, contractFile, needsHuman, log, TERMINAL} from './state.mjs';
import {liveRows, reconcile, finalizeRun, findTranscript, transcriptFinalText} from './reports.mjs';
import {runCommand, closeTask, reportTemplate, doctor, commitVrij, adminCommit, adminPush} from './runner.mjs';
import {diagnose} from './diagnose.mjs';
import {runPreflight, bundleActions, deployInfo} from './preflight.mjs';
import {plainSummary, bindProbe, presentProposal} from './commands.mjs';
import {importLegacy} from './legacy.mjs';

const root = fileURLToPath(new URL('../../../', import.meta.url));
const PROJ_START = '<!-- AAE-V33 START (gegenereerd; niet handmatig bewerken) -->', PROJ_END = '<!-- AAE-V33 END -->';

function projectie(root) {
  const s = plainSummary(root);
  const regels = ['## Actuele voortgang (gegenereerd uit de werkpakketstatus, geen tweede bron van waarheid)', '', ...s.plain.map(x => '- ' + x), ''];
  const f = path.join(fs.realpathSync(root), 'docs/aae/PROGRESS.md');
  const bestaand = fs.existsSync(f) ? fs.readFileSync(f, 'utf8') : '# Voortgang\n';
  const blok = PROJ_START + '\n' + regels.join('\n') + '\n' + PROJ_END;
  const esc = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const nieuw = bestaand.includes(PROJ_START) ? bestaand.replace(new RegExp(esc(PROJ_START) + '[\\s\\S]*?' + esc(PROJ_END)), () => blok) : bestaand.trimEnd() + '\n\n' + blok + '\n';
  atomicText(root, 'docs/aae/PROGRESS.md', nieuw);
  return {geschreven: 'docs/aae/PROGRESS.md', regels: s.plain.length};
}
/** Ruwe lagen verdwijnen 7 dagen na READY. Alleen ongevolgde bestanden: een gevolgd bestand wordt nooit zonder GO verwijderd (en bij twijfel of git faalt: overslaan). */
function prune(root) {
  const weg = [], overgeslagen = [];
  for (const id of listWork(root)) {
    const st = loadWork(root, id);
    if (st?.status === 'READY' && Date.now() - Date.parse(st.updated) > 7 * 86400000) {
      for (const rel of [STATE_DIR + '/raw/' + id, WORK + '/' + id + '/raw']) {
        const d = path.join(fs.realpathSync(root), ...rel.split('/'));
        if (!fs.existsSync(d)) continue;
        const t = trackedUnder(root, rel);
        if (t.fout || t.bestanden.length) { overgeslagen.push(rel + (t.fout ? ' (git niet te raadplegen)' : ' (' + t.bestanden.length + ' gevolgde bestanden)')); continue; }
        fs.rmSync(d, {recursive: true, force: true}); weg.push(rel);
      }
    }
  }
  return {verwijderd: weg, overgeslagen, regel: 'Ruwe lagen verdwijnen 7 dagen na READY; samenvattingen en bewijs blijven. Gevolgde bestanden worden nooit zonder GO verwijderd.'};
}

try {
  const [verb, arg, ...extra] = process.argv.slice(2);
  const MEER = ['diagnose', 'commit', 'admin-commit']; // v3.4: opdrachten met meer argumenten
  requireThat(extra.length === 0 || MEER.includes(verb), 'Te veel argumenten.');
  if (verb !== 'doctor' && verb !== 'diagnose') importLegacy(root); // doctor en diagnose zijn strikt alleen-lezen
  let result;
  switch (verb) {
    case 'diagnose': { // v3.4: één testbestand in een wegwerpkopie, zonder GO
      requireThat(arg && extra.length <= 1, 'Gebruik: cli diagnose <testbestand.test.mjs> [revisie]');
      result = await diagnose(root, arg, extra[0] || 'HEAD');
      if (!result.ok) process.exitCode = 1;
      break;
    }
    case 'commit': requireThat(arg && extra.length, 'Gebruik: cli commit <werkpakket-ID> <bericht>'); result = await commitVrij(root, arg, extra.join(' ')); if (result.exit_code !== 0) process.exitCode = 1; break;
    case 'admin-commit': requireThat(arg && extra.length, 'Gebruik: cli admin-commit <werkpakket-ID> <bericht>'); result = adminCommit(root, arg, extra.join(' ')); break;
    case 'admin-push': requireThat(arg, 'Gebruik: cli admin-push <werkpakket-ID>'); result = adminPush(root, arg); break;
    case 'status': result = plainSummary(root); break;
    case 'plan': {
      requireThat(arg, 'Werkpakket-ID ontbreekt.');
      const c = validateContract(readJson(root, contractFile(arg)));
      requireThat(c.id === arg, 'ID in het voorstel wijkt af van de mapnaam.');
      result = registerContract(root, c); break;
    }
    case 'recover': requireThat(arg, 'Werkpakket-ID ontbreekt.'); result = recoverWork(root, arg); break;
    case 'present': requireThat(arg, 'Werkpakket-ID ontbreekt.'); result = presentProposal(root, arg); break;
    case 'preflight': {
      requireThat(arg, 'Werkpakket-ID ontbreekt.');
      const st0 = loadWork(root, arg); requireThat(st0 && st0.contract, 'Onbekend werkpakket of nog geen contract.');
      const checks = await runPreflight(root, st0.contract);
      let deploy = null;
      // Alleen bepalen en in de lokale state bewaren: docs/aae/project.json is een gevolgd bestand en wordt niet vóór een GO geschreven.
      if (st0.contract.envelope.git.merge || st0.contract.envelope.git.deploy !== 'none') deploy = deployInfo(root, st0.contract.envelope.git.merge?.to || 'main');
      result = withLock(root, () => {
        const st = loadWork(root, arg); st.preflight = {at: now(), checks, deploy};
        const acties = bundleActions(checks);
        if (acties.length && ['PLANNING', 'WAITING_FOR_APPROVAL', 'EXECUTING'].includes(st.status)) needsHuman(st, 'extern', 'Voordat ik verder bouw is er één handeling van jou nodig: ' + acties.join(' '), {acties});
        else log(st, 'preflight', {fouten: checks.filter(x => x.status === 'fail').length});
        saveWork(root, st);
        return {id: arg, status: st.status, checks, acties, deploy};
      });
      if (result.status === 'PLANNING' || result.status === 'WAITING_FOR_APPROVAL') { const c = validateContract(readJson(root, contractFile(arg))); result.registratie = registerContract(root, c); result.status = result.registratie.status; }
      break;
    }
    case 'reconcile': result = withLock(root, () => {
      const st = activeWork(root); if (!st) return {wijzigingen: [], opmerking: 'geen actief werkpakket'};
      const w = reconcile(root, st); saveWork(root, st); return {id: st.id, wijzigingen: w, live: liveRows(st).map(r => ({run: r.run_key, status: r.status}))};
    }); break;
    case 'observe-alive': case 'observe-absent': result = withLock(root, () => {
      requireThat(arg, 'Agent-ID ontbreekt.');
      const st = activeWork(root); requireThat(st, 'Geen actief werkpakket.');
      const row = Object.values(st.agents).find(r => r.agent_id === arg); requireThat(row, 'Onbekende agent: ' + arg);
      row.host_observed = {state: verb === 'observe-alive' ? 'alive' : 'absent', at: Date.now()}; if (verb === 'observe-alive') row.last_seen = now();
      const w = reconcile(root, st); saveWork(root, st); return {run: row.run_key, waarneming: row.host_observed.state, wijzigingen: w};
    }); break;
    case 'scope-change': result = withLock(root, () => {
      const st = activeWork(root); requireThat(st, 'Geen actief werkpakket.');
      let toelichting = ''; try { toelichting = fs.readFileSync(safePath(root, 'docs/aae/notes/scope-change.md'), 'utf8').slice(0, 600); } catch { /* geen notitie */ }
      const wat = st.last_denial ? st.last_denial.reden : 'De wijziging valt buiten de goedgekeurde gebieden of het risico.';
      needsHuman(st, 'scope_change', 'Voor dit werk moet ik buiten de afgesproken onderdelen of boven het afgesproken risico. ' + wat + (toelichting ? ' ' + toelichting : '') + ' Vraag aan de gebruiker of dit erbij mag.', {});
      saveWork(root, st); return {id: st.id, status: st.status};
    }); break;
    case 'report': result = withLock(root, () => {
      requireThat(arg, 'Run-sleutel ontbreekt.');
      for (const id of listWork(root)) { const st = loadWork(root, id); const row = st && Object.values(st.agents).find(r => r.run_key === arg); if (row) return {id, run: arg, status: row.status, report: row.report || null, lees_de_ruwe_tekst_met_Read_op: row.report?.raw_path || null, samenvatting: row.report?.digest_path || null}; }
      throw new Error('Onbekende run: ' + arg);
    }); break;
    case 'keep-raw': result = withLock(root, () => {
      const st = activeWork(root); requireThat(st, 'Geen actief werkpakket.');
      const row = Object.values(st.agents).find(r => r.run_key === arg); requireThat(row && row.report, 'Onbekende of nog niet afgeronde run.');
      row.keep_raw = true; const rep = finalizeRun(root, st, row, {}, {keepRaw: true}); saveWork(root, st); return {run: arg, keep_raw: rep.keep_raw_path || 'overgeslagen: limiet'};
    }); break;
    case 'close': result = closeTask(root); break;
    case 'run': requireThat(arg, 'Commando-ID ontbreekt.'); result = await runCommand(root, arg); if (result.exit_code !== 0) process.exitCode = 1; break;
    case 'doctor': result = doctor(root); break;
    case 'project': result = withLock(root, () => {
      // docs/aae/PROGRESS.md is gevolgd: ook de opdrachtregel schrijft het alleen onder een werkpakket in uitvoering met een geldige GO.
      const st = activeWork(root);
      requireThat(st && st.status === 'EXECUTING' && st.contract.envelope.phase === 'implementation', 'cli project schrijft een gevolgd bestand: alleen onder een werkpakket in uitvoering met GO.');
      guardApproval(root, st);
      return projectie(root);
    }); break;
    case 'prune': result = prune(root); break;
    case 'report-template': result = reportTemplate(root); break;
    default: throw new Error('Gebruik status | plan <id> | present <id> | recover <id> | preflight <id> | reconcile | observe-alive <agent> | observe-absent <agent> | scope-change | report <run> | keep-raw <run> | close | run <id> | doctor | project | prune | report-template | diagnose <testbestand> [revisie] | commit <id> <bericht> | admin-commit <id> <bericht> | admin-push <id>.');
  }
  console.log(JSON.stringify(result, null, 2));
} catch (e) { console.error('AAE: ' + e.message); process.exitCode = 2; }
