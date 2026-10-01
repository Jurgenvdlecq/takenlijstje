#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {requireThat, readJson, validateContract, now, atomicText, safePath, STATE_DIR, WORK} from './core.mjs';
import {withLock, activeWork, listWork, loadWork, saveWork, registerContract, contractFile, needsHuman, log, TERMINAL} from './state.mjs';
import {liveRows, reconcile, finalizeRun, findTranscript, transcriptFinalText} from './reports.mjs';
import {runCommand, closeTask, reportTemplate, doctor} from './runner.mjs';
import {runPreflight, bundleActions, recordDeploy} from './preflight.mjs';
import {plainSummary, bindProbe} from './commands.mjs';
import {importLegacy} from './legacy.mjs';

const root = fileURLToPath(new URL('../../../', import.meta.url));
const PROJ_START = '<!-- AAE-V33 START (gegenereerd; niet handmatig bewerken) -->', PROJ_END = '<!-- AAE-V33 END -->';

function projectie(root) {
  const s = plainSummary(root);
  const regels = ['## Actuele voortgang (gegenereerd uit de werkpakketstatus, geen tweede bron van waarheid)', '', ...s.plain.map(x => '- ' + x), ''];
  const f = path.join(fs.realpathSync(root), 'docs/aae/PROGRESS.md');
  const bestaand = fs.existsSync(f) ? fs.readFileSync(f, 'utf8') : '# Voortgang\n';
  const blok = PROJ_START + '\n' + regels.join('\n') + '\n' + PROJ_END;
  const nieuw = bestaand.includes(PROJ_START) ? bestaand.replace(new RegExp(PROJ_START.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '[\\s\\S]*?' + PROJ_END.replace(/[.*+?^${}()|[\\]\\\\]/g, '\\$&')), blok) : bestaand.trimEnd() + '\n\n' + blok + '\n';
  atomicText(root, 'docs/aae/PROGRESS.md', nieuw);
  return {geschreven: 'docs/aae/PROGRESS.md', regels: s.plain.length};
}
function prune(root) {
  const weg = [];
  for (const id of listWork(root)) {
    const st = loadWork(root, id);
    if (st?.status === 'READY' && Date.now() - Date.parse(st.updated) > 7 * 86400000) {
      const d = path.join(fs.realpathSync(root), STATE_DIR, 'raw', id);
      if (fs.existsSync(d)) { fs.rmSync(d, {recursive: true, force: true}); weg.push('raw/' + id); }
      const k = path.join(fs.realpathSync(root), WORK, id, 'raw');
      if (fs.existsSync(k)) { fs.rmSync(k, {recursive: true, force: true}); weg.push(WORK + '/' + id + '/raw'); }
    }
  }
  return {verwijderd: weg, regel: 'Ruwe lagen verdwijnen 7 dagen na READY; samenvattingen en bewijs blijven.'};
}

try {
  const [verb, arg, ...extra] = process.argv.slice(2);
  requireThat(extra.length === 0, 'Te veel argumenten.');
  importLegacy(root);
  let result;
  switch (verb) {
    case 'status': result = plainSummary(root); break;
    case 'plan': {
      requireThat(arg, 'Werkpakket-ID ontbreekt.');
      const c = validateContract(readJson(root, contractFile(arg)));
      requireThat(c.id === arg, 'ID in het contract wijkt af van de mapnaam.');
      result = registerContract(root, c); break;
    }
    case 'preflight': {
      requireThat(arg, 'Werkpakket-ID ontbreekt.');
      const st0 = loadWork(root, arg); requireThat(st0 && st0.contract, 'Onbekend werkpakket of nog geen contract.');
      const checks = await runPreflight(root, st0.contract);
      let deploy = null;
      if (st0.contract.envelope.git.merge || st0.contract.envelope.git.deploy !== 'none') deploy = recordDeploy(root, st0.contract.envelope.git.merge?.to || 'main');
      result = withLock(root, () => {
        const st = loadWork(root, arg); st.preflight = {at: now(), checks};
        const acties = bundleActions(checks);
        if (acties.length && ['PLANNING', 'WAITING_FOR_APPROVAL', 'EXECUTING'].includes(st.status)) needsHuman(st, 'extern', 'Voordat ik verder bouw is er één handeling van jou nodig: ' + acties.join(' '), {acties});
        else log(st, 'preflight', {fouten: checks.filter(x => x.status === 'fail').length});
        saveWork(root, st);
        return {id: arg, status: st.status, checks, acties, deploy};
      });
      if (result.status === 'PLANNING' || result.status === 'WAITING_FOR_APPROVAL') { const c = validateContract(readJson(root, contractFile(arg))); result.registratie = registerContract(root, c); }
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
    case 'project': result = projectie(root); break;
    case 'prune': result = prune(root); break;
    case 'report-template': result = reportTemplate(root); break;
    default: throw new Error('Gebruik status | plan <id> | preflight <id> | reconcile | observe-alive <agent> | observe-absent <agent> | scope-change | report <run> | keep-raw <run> | close | run <id> | doctor | project | prune | report-template.');
  }
  console.log(JSON.stringify(result, null, 2));
} catch (e) { console.error('AAE: ' + e.message); process.exitCode = 2; }
