/** READY-bewijs en de gates voor merge en deployment. Eén logica voor sluiten en gate-commando's. */
import fs from 'node:fs';
import {requireThat, safePath, readJson, sourceDigest, envelopeHash, requiredChecks, areaWrite, SUPPORT_ROOTS} from './core.mjs';
import {gitHead, refCommit, dirtyPaths} from './gitops.mjs';
import {resultFile, assertApproval} from './state.mjs';
import {runCompleted} from './reports.mjs';
import {deployInfo} from './preflight.mjs';

const ONAFHANKELIJK = new Set(['code', 'security', 'tests', 'data']);
export function checkedEvidence(root, st, c, items, method, src) {
  requireThat(Array.isArray(items) && items.length > 0, 'Bewijsverwijzing ontbreekt.');
  for (const p of items) { const f = safePath(root, p, {allowMissing: false}); requireThat(fs.statSync(f).isFile(), 'Bewijs moet een bestand zijn.'); }
  if (method === 'command') {
    const eh = envelopeHash(c);
    requireThat(items.some(p => st.receipts.some(r => r.evidence_path === p && r.exit_code === 0 && r.source_before === r.source_after && r.source_after === src && r.envelope_hash === eh)), 'Geen succesvolle actuele commandoreceipt voor deze controle.');
  }
}
/** Onafhankelijk oordeel van een reviewer op de uiteindelijke bronversie en envelop (plan-wijzigingen maken een review niet ongeldig). */
export function independentReview(st, c, src) {
  const eh = envelopeHash(c);
  return Object.values(st.agents).some(r => r.role === 'aae-reviewer' && ONAFHANKELIJK.has(r.focus || 'code') && runCompleted(r) && r.reported_status === 'READY' && r.source_digest === src && r.envelope_hash === eh);
}
export function assertReady(root, st, c, prefix = '') {
  const rf = resultFile(c.id);
  requireThat(fs.existsSync(safePath(root, rf)), prefix + 'result.json ontbreekt; eerst alle criteria en controles aantoonbaar READY maken.');
  const r = readJson(root, rf), src = sourceDigest(root, c);
  requireThat(r.schema_version === 4 && r.id === c.id && r.envelope_hash === envelopeHash(c), prefix + 'Resultaat hoort niet bij dit werkpakket en deze envelop.');
  requireThat(r.source_digest === src, prefix + 'Broncode veranderd sinds bewijsrapport. Maak relevante controles opnieuw.');
  requireThat(r.status === 'READY', prefix + 'Resultaat is niet READY.');
  requireThat(Array.isArray(r.criteria) && Array.isArray(r.checks), prefix + 'Resultaat mist criteria of controles.');
  requireThat(new Set(r.criteria.map(a => a.id)).size === r.criteria.length, prefix + 'Dubbele criteria in rapport.');
  for (const a of c.envelope.acceptance) { const x = r.criteria.find(y => y.id === a.id); requireThat(x?.status === 'passed', prefix + 'Criterium niet bewezen: ' + a.id); checkedEvidence(root, st, c, x.evidence, 'inspection', src); requireThat(typeof x.note === 'string' && x.note.length >= 5, prefix + 'Criterium mist toelichting: ' + a.id); }
  for (const kind of [...new Set([...requiredChecks(c), ...c.plan.test_plan.map(t => t.kind)])]) {
    const x = r.checks.find(y => y.kind === kind), planned = c.plan.test_plan.find(y => y.kind === kind);
    requireThat(x?.status === 'passed', prefix + 'Verplichte controle niet geslaagd: ' + kind);
    requireThat(x.method === planned.method, prefix + 'Bewijsmethode wijkt af van plan: ' + kind);
    checkedEvidence(root, st, c, x.evidence, x.method, src);
    requireThat(typeof x.note === 'string' && x.note.length >= 5, prefix + 'Controle mist toelichting: ' + kind);
  }
  if (c.envelope.phase === 'implementation' && c.risk_class === 'HIGH') requireThat(independentReview(st, c, src), prefix + 'HIGH mist een actueel onafhankelijk READY-oordeel van een reviewer.');
}
/** Merge en deployment zijn aparte capabilities. Een merge naar een branch die (mogelijk) automatisch deployt valt vanzelf onder de deploy-capability. */
export function assertGate(root, st, c, kind, argv = null) {
  // Eerst de capabilities (goedkoop en duidelijk), daarna het bewijs; het bewijs blijft altijd verplicht (B5: de gate verdwijnt nooit).
  assertApproval(st);
  if (kind === 'merge') {
    requireThat(Boolean(c.envelope.git.merge), 'Merge is geen capability in deze envelop.');
    const d = deployInfo(root, c.envelope.git.merge.to);
    if (d.trigger !== 'manual') requireThat(c.envelope.git.deploy !== 'none', 'Merge naar ' + c.envelope.git.merge.to + ' raakt productie (deploy-trigger: ' + d.trigger + '). Neem een deploy-capability (verify of trigger) op in de envelop of leg vast dat deployen handmatig gaat.');
  }
  if (kind === 'deploy') requireThat(c.envelope.git.deploy === 'trigger', 'Deploy starten is geen capability in deze envelop.');
  assertReady(root, st, c, 'Gate ' + kind + ': ');
  if (kind === 'merge') {
    // Het bewijs moet bij precies de commit horen die wordt samengevoegd, niet alleen bij de werkmap.
    const r = readJson(root, resultFile(c.id)), head = gitHead(root);
    requireThat(head, 'Gate merge: geen git-HEAD te bepalen; samenvoegen vereist een git-werkmap.');
    requireThat(r.git_head === head, 'Gate merge: het READY-resultaat hoort bij commit ' + String(r.git_head || 'onbekend').slice(0, 10) + ', maar HEAD is ' + head.slice(0, 10) + '. Maak het rapport opnieuw na de laatste commit.');
    const paden = [...areaWrite(c), ...c.envelope.areas.flatMap(a => (a.support || []).flatMap(k => SUPPORT_ROOTS[k] || []))];
    const vuil = dirtyPaths(root, paden);
    requireThat(!vuil.length, 'Gate merge: niet-vastgelegde wijzigingen in de gebieden (' + vuil.slice(0, 3).join(', ') + '); leg ze vast en maak het rapport opnieuw.');
    if (argv) { const van = String(argv[3] || '').split(':')[0]; requireThat(refCommit(root, van) === head, 'Gate merge: branch ' + van + ' staat niet op dezelfde commit als HEAD waarvoor het resultaat geldt.'); }
  }
}
