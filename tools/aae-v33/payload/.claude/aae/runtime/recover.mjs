/**
 * Herstel na verlies van sessie of container (lokale state weg of beschadigd). Uit de gevolgde snapshot-keten plus de repository-staat wordt
 * gereconstrueerd wat was goedgekeurd. Het pakket komt terug als PAUSED en hervat pas na AAE VERDER; dat hervat uitsluitend dezelfde eerder
 * goedgekeurde envelop en is geen nieuwe GO. Een beschadigde, handmatig gewijzigde of niet vastgelegde snapshot wordt geweigerd.
 */
import fs from 'node:fs';
import path from 'node:path';
import {WORK, requireThat, now, shortHash, safePath} from './core.mjs';
import {withLock, loadWork, saveWork, newState, log, eventLog} from './state.mjs';
import {verifyChain, contractFromSnapshot, snapshotDir, ruimTijdelijkeOp} from './snapshot.mjs';

export function recoverWork(root, id) {
  return withLock(root, () => {
    let bestaand = null, beschadigd = false;
    try { bestaand = loadWork(root, id); } catch { beschadigd = true; }
    requireThat(!bestaand, 'Werkpakket ' + id + ' heeft nog een geldige lokale status; herstel is alleen voor verloren of beschadigde status.');
    ruimTijdelijkeOp(root, id); // restjes van een onderbroken snapshot-schrijfactie (nooit een echte snapshot)
    const {chain} = verifyChain(root, id, {committed: true});
    requireThat(chain.length > 0, 'Geen snapshot gevonden voor ' + id + ' (' + snapshotDir(id) + '); er is niets om uit te herstellen.');
    const laatste = chain.at(-1), c = contractFromSnapshot(laatste);
    if (beschadigd) {
      const f = safePath(root, WORK + '/' + id + '/state.json');
      if (fs.existsSync(f)) fs.renameSync(f, f + '.beschadigd-' + Date.now());
    }
    const st = newState(id);
    st.status = 'PAUSED'; st.paused_from = 'EXECUTING';
    st.contract = c;
    st.approved = {envelope_hash: laatste.hash, contract: c, at: laatste.approved_at, source: 'hersteld uit snapshot ' + laatste.sequence + ' (' + laatste.source + ')', snapshot_required: true};
    st.snapshot = {sequence: laatste.sequence, hash: laatste.hash, path: snapshotDir(id) + '/' + String(laatste.sequence).padStart(3, '0') + '-' + laatste.hash.slice(0, 12) + '.json'};
    st.recovered = {at: now(), sequence: laatste.sequence, snapshots: chain.length};
    st.blockers = ['Hersteld uit de snapshot: het plan (agents, commando\'s) en het verbruik zijn niet in de snapshot bewaard. Registreer het voorstel opnieuw (cli plan) en stuur AAE VERDER.'];
    log(st, 'hersteld_uit_snapshot', {volgnr: laatste.sequence, hash: shortHash(laatste.hash)});
    saveWork(root, st); eventLog(root, 'recover', {id, volgnr: laatste.sequence});
    return {id, status: st.status, hash: shortHash(laatste.hash), volledige_hash: laatste.hash, snapshot: st.snapshot.path, snapshots_in_keten: chain.length, doel: laatste.contract.goal,
      volgende: 'Het pakket staat op PAUSED. Registreer het voorstel opnieuw (cli plan ' + id + '); binnen de goedgekeurde envelop blijft de goedkeuring gelden, daarbuiten wacht het op een nieuwe GO. Stuur AAE VERDER om dezelfde envelop te hervatten (dit is geen nieuwe GO).',
      let_op: 'Verbruik (agents, commando\'s) is niet in de snapshot vastgelegd en start bij 0; houd de budgetten uit de goedgekeurde envelop zelf in het oog.'};
  });
}
