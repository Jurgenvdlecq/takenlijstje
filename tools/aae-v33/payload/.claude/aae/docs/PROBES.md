# Bewezen en onbewezen hostgedrag

Wat v3.3 aanneemt over Claude Code staat hier met de status. Alleen *bewezen* gedrag wordt als zekerheid gebruikt.

## P3 — volledige agenttekst (bewezen op 2026-10-01, ongewijzigde hook)
Een echte voorgrondagent met een lang rapport (80 genummerde regels, ruim 16.000 tekens):
- `tool_response.content` van de Agent-aanroep bevat de volledige tekst (kop aantoonbaar aanwezig). Een agent komt synchroon terug.
- Het transcriptbestand van de agent is vindbaar (`<claude-map>/projects/<project>/<sessie>/subagents/agent-<id>.jsonl`), leesbaar en volledig, en is ~65 ms vóór het stop-event weggeschreven.
- `last_assistant_message` bij `SubagentStop` bevat het einde; of ook de kop erin zit, is niet bewezen.
- **Onbewezen** (v3.3 steunt er niet op): het hookveld `agent_transcript_path`; de kop van `last_assistant_message`; het einde van `tool_response.content` los van het transcript.
Gevolg: een run is pas `COMPLETED` als twee bronnen overeenkomen. Bewijs: `tools/aae-v33/evidence/p3-result.json` in de bouwbranch.

## Incident: achtergrondagent met achterblijvend slot (tweede echte reproductie, 2026-10-01)
Tijdens AAE-V33-001 startte de host twee reviewagents als **achtergrondagent** (de melding "Async agent launched"), terwijl de aanroep expliciet `run_in_background: false` had. De hoofdbeurt moest eindigen om het resultaat te ontvangen en het registratieslot bleef in v3.2 gereserveerd; de gebruiker moest daarna `AAE PAUZE`, `AAE HERSTEL` en `AAE GO` sturen om verder te kunnen. Dit is de tweede echte reproductie van het probleem (de eerste is eerder door de gebruiker gemeld); in dit pakket gebeurde het bij beide reviews.
- Waarneming: de agents die ~45 s duurden (P3) kwamen synchroon terug; de reviews van ~300-550 s kwamen als achtergrondmelding. Een automatische omschakeling na een looptijddrempel is een **onbewezen** verklaring.
- Maatregel in v3.3 (bewezen met test T23): een vervolgbericht wordt nooit geblokkeerd; een stille agent wordt vanzelf `unverified` en bij stilstaand transcript plus onderbrekingshint `presumed_dead` (zonder transcript alleen bij een hostbevestiging); het slot komt vrij, het verbruik blijft, de GO blijft geldig en een laat resultaat wordt alsnog verwerkt. De gebruiker hoeft niets te herstellen.
- Werkafspraak: dependency-kritische agents en reviews krijgen kleine, snelle vragen (korte rapporten, beperkte omvang) en altijd `run_in_background: false`; de hoofdsessie plant geen werk dat van een lopende agent afhangt.

## Nog open (gepland in werkpakket AAE-V33-002, niet nodig voor het bouwen)
- **P2** — gedrag van een agent die lang stil is, zonder instrumentatie van de hook.
- **P5** — gedrag bij onderbreken met Esc terwijl een agent loopt (hint voor `presumed_dead`; v3.3 werkt ook zonder).
- Optionele, afzonderlijk goed te keuren instrumentatieprobe voor `agent_transcript_path`.
Zolang ze open zijn, geldt de conservatieve route: tijd is geen bewijs, een stille agent blijft `unverified`, de gebruiker hoeft nooit iets te herstellen.
