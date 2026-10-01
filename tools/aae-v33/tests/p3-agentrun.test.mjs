// P3: analyse van een echte agentrun zonder wijziging van de actieve AAE-runtime.
// Bronnen: (1) wat de ongewijzigde hook zelf heeft vastgelegd (state), (2) het transcriptbestand van de agent.
// Het resultaat gaat naar tools/aae-v33/evidence/p3-result.json. Alleen lengtes, tijden en slagen/falen; geen transcriptinhoud.
// Het bestand wordt alleen herschreven als de inhoud verandert, zodat herhaalde runs de bronversie niet wijzigen.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const evidenceFile = path.join(root, 'tools/aae-v33/evidence/p3-result.json');
const stateFile = path.join(root, '.claude/aae/state/local.json');
const MEETRUN = 'P3 hostmeting lang rapport';
const EERDERE_AGENT = 'ae18836d4f99da3cc'; // eerste probe (30 regels), alleen transcriptcontrole

const git = (...args) => {
  const r = spawnSync('git', args, {cwd: root, encoding: 'utf8', shell: false});
  return {code: r.status, out: (r.stdout || '').trim()};
};

function vindTranscript(agentId) {
  const bases = [process.env.CLAUDE_CONFIG_DIR, path.join(os.homedir(), '.claude')].filter(Boolean);
  const gevonden = [];
  const loop = (dir, diepte) => {
    if (diepte > 6) return;
    let items;
    try { items = fs.readdirSync(dir, {withFileTypes: true}); } catch { return; }
    for (const d of items) {
      const p = path.join(dir, d.name);
      if (d.isDirectory()) loop(p, diepte + 1);
      else if (d.name === 'agent-' + agentId + '.jsonl' || d.name === 'subagent-' + agentId + '.jsonl') gevonden.push(p);
    }
  };
  for (const b of bases) loop(path.join(b, 'projects'), 0);
  return [...new Set(gevonden)];
}

function teksten(o, uit = []) {
  if (!o || typeof o !== 'object') return uit;
  if (typeof o.text === 'string') uit.push(o.text);
  for (const v of Object.values(o)) if (v && typeof v === 'object') teksten(v, uit);
  return uit;
}

// Volledigheid = alle genummerde regels in volgorde (de regelbreedte van de agent is niet het onderwerp van de meting).
// Optioneel: de tekst eindigt exact op de staart die de hook zelf heeft vastgelegd.
function analyseer(file, {cijfers, aantal, kop, eind, hookStaart = null}) {
  const raw = fs.readFileSync(file, 'utf8');
  const regels = raw.split('\n').filter(Boolean);
  const alle = [];
  for (const r of regels) { try { teksten(JSON.parse(r), alle); } catch { /* geen JSON-regel */ } }
  const lijn = new RegExp('^PROBE-(\\d{' + cijfers + '}) (?:abcdefghij)+$');
  let beste = {tekens: 0, genummerd: 0, juisteVolgorde: false, kop: false, eind: false, staart: null};
  for (const t of alle) {
    const nummers = [];
    for (const l of t.split('\n')) { const m = lijn.exec(l.trim()); if (m) nummers.push(Number(m[1])); }
    const volgorde = nummers.length === aantal && nummers.every((n, i) => n === i + 1);
    const kandidaat = {
      tekens: t.length, genummerd: nummers.length, juisteVolgorde: volgorde,
      kop: t.trimStart().startsWith(kop), eind: t.trimEnd().endsWith(eind),
      staart: hookStaart === null ? null : t.trimEnd().endsWith(hookStaart.trimEnd())
    };
    if (kandidaat.genummerd > beste.genummerd || (kandidaat.genummerd === beste.genummerd && kandidaat.tekens > beste.tekens)) beste = kandidaat;
  }
  const st = fs.statSync(file);
  return {
    bestandsgrootte_bytes: st.size,
    mtime: st.mtime.toISOString(),
    regels_in_bestand: regels.length,
    tekstblokken: alle.length,
    langste_probetekst_tekens: beste.tekens,
    genummerde_regels: beste.genummerd,
    alle_regels_in_juiste_volgorde: beste.juisteVolgorde,
    begint_met_kop: beste.kop,
    eindigt_met_eindmarkering: beste.eind,
    eindigt_op_de_staart_van_de_hook: beste.staart
  };
}

function patroon(file) {
  const delen = file.split(path.sep);
  const i = delen.lastIndexOf('projects');
  return i >= 0 ? ['<claude-map>', 'projects', '<project>', ...delen.slice(i + 2, -1).map((d, k, a) => (k === 0 ? '<sessie>' : d)), delen.at(-1).replace(/agent-.*\.jsonl$/, 'agent-<id>.jsonl')].join('/') : '<onbekend>';
}

test('P3: analyse van de echte agentrun en het transcript', () => {
  let bestaand = null;
  try { bestaand = JSON.parse(fs.readFileSync(evidenceFile, 'utf8')); } catch { /* nog geen resultaat */ }

  let staat = null;
  try { staat = JSON.parse(fs.readFileSync(stateFile, 'utf8')); } catch { /* geen state */ }
  const call = staat?.task ? Object.values(staat.task.calls || {}).find(c => c.updated_input?.description === MEETRUN) : null;

  if (!call) {
    assert.ok(bestaand && bestaand.schema === 1, 'geen meetrun in de state en nog geen vastgelegd P3-resultaat');
    return; // later herhaald: het vastgelegde resultaat blijft het bewijs
  }

  // (1) wat de ongewijzigde hook zelf zag
  const stopEvent = [...(staat.events || [])].reverse().find(e => e.type === 'agent_stopped' && e.at >= call.at);
  const staart = String(call.report_summary || '');
  const hook = {
    agent_id: call.agent_id,
    model_gemeld: call.observed_model,
    duur_ms: call.observed_duration_ms,
    toolaanroepen: call.observed_tool_calls,
    subagent_stop_last_assistant_message: {
      staartlengte_tekens: staart.length,
      eindigt_met_eindmarkering: staart.trimEnd().endsWith('END-PROBE'),
      kop_zichtbaar: staart.includes('STATUS: PARTIAL'),
      opmerking: 'v3.2 bewaart alleen de laatste 2500 tekens; de kop kan hier niet bewezen worden.'
    },
    posttooluse_tool_response_content: {
      bevat_kop_van_volledige_tekst: call.reported_status === 'PARTIAL',
      afleiding: 'De STATUS-regel staat alleen in de kop. De staart bevat geen STATUS, dus een eindstatus PARTIAL kan alleen uit tool_response.content komen.',
      einde_apart_bewezen: false
    },
    agent_transcript_path_veld: 'niet bewezen: de ongewijzigde hook registreert dit veld niet'
  };

  // (2) het transcript
  const paden = vindTranscript(call.agent_id);
  const transcript = {gevonden: paden.length > 0, aantal_bestanden: paden.length};
  if (paden.length) {
    const a = analyseer(paden[0], {cijfers: 3, aantal: 80, kop: 'STATUS: PARTIAL', eind: 'END-PROBE', hookStaart: staart});
    transcript.pad_patroon = patroon(paden[0]);
    Object.assign(transcript, a);
    transcript.hook_eindtijd = stopEvent?.at || null;
    transcript.hook_finished = call.finished;
    transcript.weggeschreven_voor_hook_eindtijd = stopEvent ? Date.parse(a.mtime) <= Date.parse(stopEvent.at) : null;
    transcript.verschil_ms_mtime_min_hook_eindtijd = stopEvent ? Date.parse(a.mtime) - Date.parse(stopEvent.at) : null;
  }
  const eerder = vindTranscript(EERDERE_AGENT);
  const eerdere = {gevonden: eerder.length > 0};
  if (eerder.length) Object.assign(eerdere, analyseer(eerder[0], {cijfers: 2, aantal: 30, kop: 'BEGIN-PROBE', eind: 'STATUS: READY'}));

  // (3) integriteit van de actieve runtime
  const integriteit = {
    hook_mjs_gelijk_aan_commit: git('hash-object', '.claude/aae/runtime/hook.mjs').out === git('rev-parse', 'HEAD:.claude/aae/runtime/hook.mjs').out,
    settings_json_gelijk_aan_commit: git('hash-object', '.claude/settings.json').out === git('rev-parse', 'HEAD:.claude/settings.json').out,
    claude_en_claude_md_schoon: git('status', '--porcelain', '--', '.claude', 'CLAUDE.md').out === ''
  };
  assert.ok(integriteit.hook_mjs_gelijk_aan_commit && integriteit.settings_json_gelijk_aan_commit && integriteit.claude_en_claude_md_schoon, 'de actieve runtime is gewijzigd');

  const volledigTranscript = Boolean(transcript.gevonden && transcript.alle_regels_in_juiste_volgorde && transcript.begint_met_kop && transcript.eindigt_met_eindmarkering && transcript.eindigt_op_de_staart_van_de_hook);
  const resultaat = {
    schema: 1,
    agentrun: hook,
    transcript,
    eerdere_probe_transcript: eerdere,
    integriteit,
    antwoorden: {
      a_volledige_tekst_in_hookvelden: {
        tool_response_content: hook.posttooluse_tool_response_content.bevat_kop_van_volledige_tekst ? 'bewezen (kop van de volledige tekst aanwezig)' : 'niet bewezen',
        last_assistant_message: 'einde bewezen; kop niet bewijsbaar (v3.2 bewaart alleen de staart)'
      },
      b_transcript: volledigTranscript
        ? 'vindbaar op agent-id, leesbaar, volledig; weggeschreven ' + (transcript.weggeschreven_voor_hook_eindtijd ? 'vóór' : 'na') + ' het stop-event van de hook'
        : 'niet bewezen',
      c_bron_voor_v33: volledigTranscript && hook.posttooluse_tool_response_content.bevat_kop_van_volledige_tekst
        ? 'primair tool_response.content (PostToolUse van de Agent-aanroep), onafhankelijke controle via het transcript (zoeken op agent-id onder de Claude-map) en via de staart van last_assistant_message; COMPLETED alleen bij overeenstemming van twee bronnen'
        : 'nog te bepalen',
      onbewezen: ['agent_transcript_path als hookveld', 'volledige kop in last_assistant_message', 'einde van tool_response.content apart van het transcript']
    }
  };

  const nieuw = JSON.stringify(resultaat, null, 2) + '\n';
  fs.mkdirSync(path.dirname(evidenceFile), {recursive: true});
  const oud = fs.existsSync(evidenceFile) ? fs.readFileSync(evidenceFile, 'utf8') : null;
  if (oud !== nieuw) fs.writeFileSync(evidenceFile, nieuw);

  assert.ok(hook.posttooluse_tool_response_content.bevat_kop_van_volledige_tekst, 'tool_response.content bevat de kop niet');
  assert.ok(hook.subagent_stop_last_assistant_message.eindigt_met_eindmarkering, 'last_assistant_message eindigt niet op END-PROBE');
});
