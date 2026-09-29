## Tests: WP3b — Afvalkalender (W-03)
Framework: Vitest 5 (unit + integratie), psql-suite (DB), bash (races) | Suite gedraaid: unit **634 geslaagd / 1 gefaald** (de bekende bevinding "100000", zie Bevindingen), integratie **68 / 0** (30 bestaand + 38 nieuw), DB-suite **alle bestanden geslaagd** incl. `gelijktijdig.sh` (2 nieuwe races) en upgrade-tests | `tsc --noEmit -p .` schoon | `eslint src tests` 0 fouten, 0 waarschuwingen | E2E: niet door mij (tests/e2e is van een andere agent; niet aangeraakt)

Alle drie ronden zijn echt gedraaid; de integratie op een eigen lokale stack (E2E_DB=takenlijstje_int, poorten 9997/54323, gestopt na afloop) zodat de stack van de E2E-agent ongemoeid bleef.

### Dekking acceptatiecriteria
| Criterium | Test | Status |
| --- | --- | --- |
| AC-183 | tests/integration/waste.test.ts: "(a) zoeken → bevestigen …", "(b) eerstvolgende ophaaldag over drie weken …"; src/server/waste/__tests__/lookup.test.ts "gevonden" | geslaagd |
| AC-184 | src/domain/waste/__tests__/address.test.ts (bestond); waste.test.ts "AC-184: … geen verzoek naar de gemeente" | geslaagd, behalve 1 unittest "100000" (productiefout, zie onder) |
| AC-185 | lookup.test.ts "onbekend adres"; waste.test.ts "AC-185/186/188/237/214 …" | geslaagd |
| AC-186 | lookup.test.ts "geen bakken …" (oktober no_streams; januari altijd no_upcoming); schema.test.ts "2 januari … geen /kalender/2026" | geslaagd |
| AC-187 | address.test.ts (bestond); lookup.test.ts "meerdere adressen en toevoeging" | geslaagd |
| AC-188 | source.test.ts "antwoorden die geen 200-JSON zijn"; lookup.test.ts "bron onbereikbaar"; waste.test.ts (503, time-out; adres en version gelijk) | geslaagd |
| AC-189 | supabase/tests/70_afval.sql (bestond); waste.test.ts "alle vier de actions geven FORBIDDEN …" (Lynn én Kai, fetch-spy 0; D-048 hercontrole `syncHousehold`/`applyConfirmedSameAddress`), "beheerder die zijn rol verliest …" | geslaagd |
| AC-190 | 70_afval.sql (bestond); waste.test.ts (Lynn: alleen role/enabled/adminNames; Kai FORBIDDEN; Jurgen alles) | geslaagd |
| AC-191 | gelijktijdig.sh race 6 (waste_save 2× parallel); waste.test.ts "AC-191 … twee beheerders tegelijk" (3 parallelle confirms, 1 adres, geen dubbele) | geslaagd |
| AC-192 | plan.test.ts, messages.test.ts (bestonden); display.test.ts (T-16/T-17); selectors-waste.test.ts; 70_afval (te laat) | geslaagd |
| AC-193 | plan.test.ts, messages.test.ts (bestonden); display.test.ts (T-18); selectors-waste.test.ts | geslaagd |
| AC-194 | reminder.test.ts (a)(b)(c); waste.test.ts "AC-194 (a)/(b) …" en herinneringentest via echte `runTick` | geslaagd |
| AC-195 | messages.test.ts (bestond); reminder.test.ts meervoud; waste.test.ts "21:00 en 18:00 …" (rest+papier → 1 taak, 1 herinnering p.p.) | geslaagd |
| AC-196 | streams.test.ts (bestond); schema.test.ts (P0-soorten, unknownStreams) | geslaagd |
| AC-197 | plan.test.ts (bestond); 70_afval sleutel; waste.test.ts "twee keer na elkaar en twee keer tegelijk …" | geslaagd |
| AC-198 | plan.test.ts (bestond); 70_afval move; waste.test.ts "dezelfde taken schuiven mee …" (id's, notitie, bezig, geen historie, herinnering vr 21:00) | geslaagd |
| AC-199 | plan.test.ts; waste.test.ts "AC-199 …" (hard weg) | geslaagd |
| AC-200 | plan.test.ts; waste.test.ts "AC-200 …" | geslaagd |
| AC-201 | plan.test.ts; 70_afval; waste.test.ts "AC-201 … AC-202 …" | geslaagd |
| AC-202 | plan.test.ts; 70_afval; waste.test.ts (idem) | geslaagd |
| AC-203 | plan.test.ts; reminder.test.ts (b/d); waste.test.ts "(a) di 21:40 …, (c) …, (e) …" | geslaagd |
| AC-204 | schema.test.ts (parser B `{}`/`[]`/object, C(J+1), nooit C(J−1), fetch-spy 2027); plan.test.ts classifyEmpty; 70_afval; waste.test.ts 5 storingsvarianten + "adres weg (B {}) …" (BR-54, ≤ 75 min, log zonder adres) + 2 P0-regressies (5 okt, eind nov) | geslaagd |
| AC-205 | health.test.ts (a)–(h) + varianten; reminders-recipients.test.ts (bestond); 70_afval; waste.test.ts (a) stale/M-03/herstel/nieuwe storing, (b) leeg/M-04/held/H2-datums, (c) stil + budget → M-03; Lynn 0 | geslaagd |
| AC-206 | plan.test.ts (bestond); health.test.ts wintertijd-overgang dueForFetch | geslaagd |
| AC-207 | 70_afval; waste.test.ts "AC-207 …" | geslaagd |
| AC-208 | 70_afval; waste.test.ts "AC-208 …" (move/update/recurrence/delete → FORBIDDEN met T-33, geen weesreeks; status/notitie wel) | geslaagd |
| AC-209 | 70_afval; waste.test.ts "AC-209 …" (18:00 geen herinnering na overslaan) | geslaagd |
| AC-210 | expire.test.ts; waste.test.ts "di 07:46 …" en "lange pauze … D+7" | geslaagd |
| AC-211 | reminder.test.ts; waste.test.ts "21:00 en 18:00 … Lynn aan → wel" (geen deadline/overdue om 02:00/07:50/12:00) | geslaagd |
| AC-212 | messages.test.ts (bestond); waste.test.ts AC-205(a) (meldingen, push-payloads, titels, historie, console) | geslaagd |
| AC-213 | 70_afval; waste.test.ts "uitzetten wist adres …" (tick daarna: fetch 0) | geslaagd |
| AC-214 | 70_afval; waste.test.ts "AC-214: verhuizen …" + ongeldig nieuw adres | geslaagd |
| AC-215 | 70_afval; waste.test.ts (handmatige taak en reeks na aanzetten/tick/uitzetten) | geslaagd |
| AC-216 | 70_afval.sql (bestond) | geslaagd |
| AC-217 | E2E/CP-W03/rooktest — niet mijn deel | GEEN TEST (E2E-agent) |
| AC-218 | source.test.ts (host, pad, exact 2 headers, redirect error, override-regels, segmentvalidatie); lookup.test.ts (toevoeging nooit in pad); waste.test.ts AC-183(a) fetch-spy | geslaagd |
| AC-219 | 70_afval; waste.test.ts AC-183(a) (`members_can_create_tasks` uit, maker null) | geslaagd |
| AC-220 | health.test.ts "stille regel T-73" (a)(b)(c) + tegengevallen; waste.test.ts P0 eind november (notice) | geslaagd |
| AC-221 | health.test.ts dueForFetch; waste.test.ts "AC-221 …" | geslaagd |
| AC-222 | waste.test.ts "direct na een tick: 'unchanged' …" (geen claim, notitie/bezig blijven; version gewijzigd → stale) | geslaagd |
| AC-223 | waste.test.ts AC-205(a): url van de melding = `appUrl.wasteSettings()` = `/instellingen/afvalkalender` | geslaagd |
| AC-236 | health.test.ts (h) + wasteFailureVariant; 70_afval claim; gelijktijdig.sh race 7; waste.test.ts (a) ok/1 ophaling/limiet telt niet, (b) fout + alarm + 1 M-03, (c) too_soon zonder verzoek | geslaagd |
| AC-237 | lookup.test.ts (26 nov, 28 dec, 2 jan met/zonder vorig jaar, tegenvoorbeeld 25 dagen); waste.test.ts no_upcoming → niets bewaard | geslaagd |
| D-048 | 70_afval (bestond: version-sequence; nieuw: grants op reeks en tabel, `private.waste_insert_tasks` geweigerd); source.test.ts productie-override; lookup.test.ts 5-tekens-toevoeging → not_found zonder B/C; waste.test.ts hercontrole beheerder | geslaagd |
| D-049 | 70_afval (RLS, grants, 21e → false, venster schuift, per huishouden, cascade, authenticated/anon 42501); waste.test.ts `allowWasteLookup` 21e false / na 61 min true; action 21e → unreachable met fetch-spy 0, teller 22 | geslaagd |

### Toegevoegd / gewijzigd (alle paden absoluut)
Nieuw:
- /home/user/takenlijstje/src/domain/waste/__tests__/health.test.ts — AC-205 (a)–(h), varianten, T-73, isNewYearPeriod, lastFetchSlot/dueForFetch incl. wintertijd | Faalt zonder fix: ja, gecontroleerd (omgedraaide asserties (h) en dueForFetch → rood)
- /home/user/takenlijstje/src/domain/waste/__tests__/expire.test.ts — AC-210 | ja, gecontroleerd (D+6 → rood)
- /home/user/takenlijstje/src/domain/waste/__tests__/display.test.ts — T-16/T-17/T-18, nooit "21:00" | niet gecontroleerd (eenvoudige tekstmapping)
- /home/user/takenlijstje/src/domain/waste/__tests__/reminder.test.ts — AC-194/195/211 wasteReminder | niet gecontroleerd
- /home/user/takenlijstje/src/features/tasks/__tests__/selectors-waste.test.ts — D-048 nextDeadline, Vandaag/Binnenkort-regels | niet gecontroleerd
- /home/user/takenlijstje/src/server/waste/__tests__/source.test.ts — AC-218/188, security punt 3 | ja (productie-override → rood)
- /home/user/takenlijstje/src/server/waste/__tests__/schema.test.ts — parser AC-204/196/220/237 | ja (C(J−1) in januari → rood)
- /home/user/takenlijstje/src/server/waste/__tests__/lookup.test.ts — AC-185/186/187/188/237, security punt 4 | ja (5-tekens → rood)
- /home/user/takenlijstje/src/server/waste/__tests__/fixtures.test.ts — P0-fixture byte-gelijk aan de probe, zonder content/icon_data
- /home/user/takenlijstje/tests/integration/waste.test.ts — 38 integratietests (zie tabel) | gevoeligheid niet apart gecontroleerd; alle asserties zijn op databasestand, tellingen en fetch-spy
Gewijzigd (aanvullingen, niets verzwakt):
- /home/user/takenlijstje/supabase/tests/70_afval.sql — sectie D-048 (grants reeks/tabel, `private.*` 42501) en D-049 (venster, limiet, rechten, cascade)
- /home/user/takenlijstje/supabase/tests/gelijktijdig.sh — races 6 (waste_save 2× parallel, AC-191) en 7 (claim 2× binnen 60 s, AC-236)
- /home/user/takenlijstje/tests/integration/tick.test.ts — `alleenTellingenEnCodes` accepteert nu ook `waste` (alleen getallen) en code "afval"; dit was de enige oorzaak van 3 rode bestaande tests (TickReport heeft sinds WP3b `waste`)
Van eerdere test-writers overgenomen en ongewijzigd gelaten: address/messages/plan/streams.test.ts, bron.ts + fixtures, route.test.ts, reminders-recipients.test.ts, 40_wp2b.sql, 50_retentie.sql.
Niet aangeraakt: tests/e2e/**, playwright.config.ts, .claude/state (die wijzigingen in `git status` zijn van de E2E-agent).

Bewijs "faalt zonder fix": de poort blokkeerde het kopiëren van de oude broncode naar de scratchpad, dus gecontroleerd via een tijdelijk bestand met 6 omgedraaide asserties (productie-override, 5-tekens-toevoeging, drie lege antwoorden binnen een uur, D+6, C(J−1) in januari, opnieuw proberen binnen het uur): alle 6 rood; bestand daarna verwijderd.

### Bevindingen tijdens het testen
- [GEMIDDELD] /home/user/takenlijstje/src/domain/waste/address.ts:40-42 — AC-184 verwacht bij huisnummer "100000" (buiten 1…99999) de veldfout T-44. Werkelijk: de regex `(\d{1,5})…([A-Za-z0-9]*)` splitst "100000" in nummer 10000 met toevoeging "0", dus `ok: true` met `{houseNumber: 10000, suffix: "0"}`. Gevolg: een tikfout wordt stil een ander adres en gaat naar de gemeente. Test: address.test.ts "huisnummer "100000" → veldfout huisnummer (T-44)" (staat al rood sinds de vorige test-writer). Verbetering: eerst het cijferblok volledig lezen (`^(\d+)`) en dan pas op 1…99999 toetsen, of een toevoeging die alleen uit cijfers bestaat na een 5-cijferig nummer weigeren. Niet zelf gefixt.
- [LAAG] Na `waste_save` staat `last_attempt_at = p_now`, waardoor `dueForFetch` de eerstvolgende ophaling tot 60 min na het aanzetten overslaat (bijv. aanzetten om 05:50 → geen ophaling om 06:00). Functioneel onschuldig (de stand is net opgehaald), maar het wijkt af van de letterlijke lezing van §18.8.3; ter kennisgeving, geen test tegen geschreven.
- [LAAG] `unknownStreams` in `fetchPickups` telt ook GFT- en kerstboomdatums mee (elke datum zonder bak). Het veld wordt nergens gebruikt; test volgt het werkelijke gedrag en benoemt het.
- [INFO] `FORMAT` van C(J) wordt in `fetchPickups` als `UNREACHABLE` vastgelegd; alleen een kapotte B blijft `FORMAT`. Dat is conform D-047; de integratietest toetst beide.

### Nodig van de bouwer
- Herstel van address.ts (bevinding 1); daarna wordt de unitsuite volledig groen (nu 634/635).
- Niets anders.

### Conclusie
NO-GO — alle acceptatiecriteria van WP3b (AC-183…AC-223, AC-236, AC-237 behalve het E2E-deel AC-217) zijn gedekt en groen, en ook de regressies uit code- en security-review (D-048, D-049) zijn met unit-, DB- en integratietests vastgelegd; alleen de al bekende productiefout in AC-184 (huisnummer "100000") houdt één unittest rood, en die moet de bouwer eerst herstellen.
