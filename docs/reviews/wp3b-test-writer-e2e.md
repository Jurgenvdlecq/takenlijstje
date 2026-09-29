## Tests: WP3b — Afvalkalender (W-03), E2E-laag
Framework: Playwright (chromium, iPhone 13 = 390×844, nl-NL, Europe/Amsterdam) | Suite gedraaid (alle specs): **84 geslaagd / 16 gefaald / 1 overgeslagen** (7,7 min). De overgeslagen test is de bestaande cron-test in `wp1-rechten.spec.ts` die `E2E_CRON_SECRET` nodig heeft; met `E2E_CRON_SECRET=test-cron-secret` slaagt die spec 21/21. | `tests/e2e/waste.spec.ts`: 43 tests, **27 geslaagd / 16 gefaald**. Alle 16 fouten zitten in de afvalspec en hebben drie oorzaken in productiecode (hieronder). Alle andere specs (onboarding, tasks, wp1-herreview, wp1-rechten, wp2a) zijn groen.

Belangrijk voor de duiding: met een tijdelijke diagnose-omweg (Enter in het huisnummerveld in plaats van de knop "Adres zoeken", zodat de blur-bug hieronder niet triggert) slaagden **37 van de 40** toenmalige tests; alleen de drie bug-tests faalden. Die omweg is weer verwijderd: de definitieve tests doen wat de gebruiker doet (knop tikken) en falen dus nu op de bug.

### Dekking acceptatiecriteria (E2E-kolom TD §18.15)
| Criterium | Test (tests/e2e/waste.spec.ts) | Status |
| --- | --- | --- |
| AC-183 (a) | "AC-183 (a): adres zoeken → Klopt dit? … → T-90 met Bekijken, taken op Vandaag en in de Kalender" | GEFAALD (bug 1) — slaagt met de omweg |
| AC-183 (b) | "AC-183 (b): eerstvolgende ophaaldag over 3 weken → C met T-45b, … T-90b zonder Bekijken, 0 afvaltaken" (stub `drie_weken`) | GEFAALD (bug 1) — slaagt met de omweg |
| AC-184 | "AC-184: lege velden → Adres zoeken uit; ongeldige postcode/huisnummer/toevoeging → T-43/T-44/T-44b; geen verzoek" | geslaagd |
| AC-184 | "AC-184: huisnummer 100000 (buiten 1 t/m 99999) → T-44, geen verzoek naar de gemeente" | GEFAALD (bevinding 4) |
| AC-183/184 (regressie bug 1) | "AC-183/184: huisnummer 87 zonder toevoeging blijft 87 na het verlaten van het veld" | GEFAALD (bug 1) |
| AC-185 | "AC-185: onbekend adres → T-60 boven de velden zonder rode rand, velden gevuld, niets bewaard" (stub `onbekend`) | geslaagd |
| AC-186 | "AC-186: adres met alleen GFT → T-62, niets bewaard, geen verzoek naar de kalender van vorig jaar" (stub `alleen_gft`, teller) | GEFAALD (bug 1) — slaagt met de omweg |
| AC-187 (a) | "AC-187 (a): '2591bb' met '12 a' wordt opgevraagd en bewaard als 2591BB, 12, toevoeging A" | geslaagd |
| AC-187 (c) | "AC-187 (c): meerdere adressen op nummer 12 → T-61 met een rij per adres, niets bewaard; rij tikken → Klopt dit?" (stub `meerdere`) | GEFAALD (bug 1) — slaagt met de omweg |
| AC-188 (a) | "AC-188 (a): bron geeft 503 → T-63 met Opnieuw proberen, velden gevuld, niets bewaard" (stub `onbereikbaar`) | GEFAALD (bug 1) — slaagt met de omweg |
| AC-188 (a) traag | "AC-188 (a), traag: 'Zoeken…' met velden uit; na de time-out T-63" (stub `traag`, 10 s) | geslaagd |
| AC-188 (b) / 185 / 237 (b) / 214 | "AC-214/185/188 (b)/237 (b): wijzigen naar onbekend, onbereikbaar of zonder komende dagen → T-60/T-63b/T-64b, oud adres en taken blijven; Annuleren → G" | GEFAALD (bug 1) — slaagt met de omweg |
| AC-189 | "AC-189/190: Lynn ziet geen formulier; uit → T-39b met de beheerders, aan → T-38b, ook tijdens een storing geen adres of balk" | geslaagd |
| AC-189 (degradatie) | "AC-189: beheerder verliest tijdens het instellen zijn rol → T-66, niets bewaard, geen verzoek, daarna gezinslid-weergave" | GEFAALD (bug 1) — slaagt met de omweg |
| AC-189 (degradatie, uitzetten) | "AC-189: beheerder verliest zijn rol terwijl de sectie open staat → Uitzetten geeft T-66, adres en taken blijven" | geslaagd |
| AC-190 | in de AC-189/190-test en de gezinslid-controles in AC-204/AC-205 H3 (geen adres, geen balk) | geslaagd |
| AC-192 | "AC-192/193: vandaag 19:30 → 'vanaf 22:00' (T-16), zonder '21:00' of deadlinebadge"; "AC-192/208: detail buitenzetten → T-20, T-21, T-22, T-25, T-27"; "AC-192: ophaaldag 07:00 → 'vóór 07:45'" | geslaagd |
| AC-192 / D-048 | "afvaltaken tellen niet mee in 'Eerstvolgende deadline'"; "dagweergave toont 'vanaf 22:00'…"; "detail van een verlopen buitenzet-taak → 'Uiterlijk' met '… te laat'" | geslaagd |
| AC-192 / D-048 | "dagweergave → 'Volgende dag' (binnen het scherm van 390 px) → binnenzetten 'vanaf 12:00'" | GEFAALD (bug 3) |
| AC-193 | "AC-193: morgen 09:10 → binnenzetten bovenaan Binnenkort met 'vanaf 12:00'; buitenzetten onder Verlopen met alleen '… te laat'"; "AC-193: detail binnenzetten → T-23 en T-24" | geslaagd |
| AC-204 | "AC-204: één mislukte poging → G′ met T-71 en bewaarde datums; ADDRESS_GONE → T-71b; gezinslid ziet niets" | geslaagd |
| AC-205 | "H1: 48 uur niet gelukt → T-72, T-75, T-76, T-37, stand <dag>"; "H1 zonder foutcode"; "H2: stub leeg → T-77 + T-77b, bewaarde datums onder 'stand <dag>'"; "H3: adres weg → T-77c, T-77d, twee knoppen; Adres controleren → A′ gevuld; gezinslid geen balk" | geslaagd |
| AC-207 | "AC-207: Lynn vinkt binnenzetten af terwijl buitenzetten open staat → alleen binnenzetten gedaan; Ongedaan maken" | geslaagd |
| AC-208 | in "AC-192/208: detail …": ⋯-menu alleen 'Ik ben ermee bezig' en 'Deze keer overslaan', geen bewerken/verplaatsen/verwijderen, T-27 | geslaagd |
| AC-209 | "AC-209: Lynn slaat buitenzetten over → T-31 met Ongedaan maken, beide overgeslagen; Ongedaan maken → beide weer open" | GEFAALD (bug 2) |
| AC-209 (variant) | "AC-209 (na sluiten van het detail): Ongedaan maken in de melding zet beide taken weer open" | geslaagd |
| AC-211 | "AC-211: Lynn (herinneringen uit) ziet geen rij 'Herinnering' en geen '(uit)'"; Jurgen ziet T-25 in de AC-192/208-test | geslaagd |
| AC-213 | "AC-213: uitzetten met 4 open taken → T-80 + T-81; Annuleren; Uitzetten → T-93 zonder Ongedaan maken; gedaan blijft" | GEFAALD (bug 1 via aanzetten) — slaagt met de omweg |
| AC-213 (n=0) | "AC-213: uitzetten zonder open afvaltaken → T-81c, zonder '(0 taken)'" | geslaagd |
| AC-214 | "AC-214: Wijzigen → Ander adres (T-47) → nieuw adres → T-48 → Ja, dit adres gebruiken → T-91; open taken vervangen, gedaan blijft" (stub `normaal_b`) | GEFAALD (bug 1) — slaagt met de omweg |
| AC-215 | "AC-215: tip T-54 na het aanzetten; wegtikken → komt niet terug" | geslaagd |
| AC-217 | UC-13/14/15 in de oude UI = de flows hierboven | zie boven |
| AC-220 | — | GEEN TEST: T-73 hangt aan de serverklok (november/december); de app heeft geen klokoverride. Alleen Unit/Int. |
| AC-222 | "AC-222: hetzelfde adres opnieuw bevestigen vlak na een bijwerking → T-92 (nooit T-79); notitie en 'bezig' blijven" | GEFAALD (bug 1 via aanzetten) — slaagt met de omweg |
| AC-222 botsing → T-65 | — | GEEN TEST: de action leest `version` zelf vlak vóór de RPC; de botsing is een race van milliseconden, E2E niet deterministisch. Int dekt het (`version` gewijzigd → UNKNOWN). |
| AC-223 | "AC-223: /instellingen/afvalkalender → sectie in beeld; storingsmelding (label T-39c) opent dezelfde plek" | geslaagd |
| AC-236 | "AC-236: H1 → Opnieuw proberen: T-77e en knop uit → (b) T-78 → (c) T-79 zonder toast en zonder verzoek → (a) balk weg, T-70, T-94"; "AC-236 offline: knoppen uit met T-67" | geslaagd |
| AC-237 (a) | "AC-237 (a): geen komende ophaaldag (jaareinde-vorm) → T-64, hoofdknop Adres zoeken, velden gevuld, niets bewaard" (stub `jaareinde`) | GEFAALD (bug 1) — slaagt met de omweg |
| D-049 | "D-049: na 20 opzoekingen in dit uur → T-63, geen verzoek naar de gemeente, niets bewaard; een uur later werkt het weer" | GEFAALD (bug 1) — slaagt met de omweg |

### Toegevoegd / afgemaakt
- `/home/user/takenlijstje/tests/e2e/support/waste-stub.mjs` (nieuw, aangetroffen en gecontroleerd): stub van de gemeentebron op 127.0.0.1:4599, endpoints A/B/C in de P0-vorm, scenario's `normaal`, `normaal_b`, `meerdere`, `onbekend` (A `[]`), `alleen_gft`, `onbereikbaar` (503), `leeg` (C(J) `[]`), `adres_weg` (B `{}`), `jaareinde`, `kerstbomen_j1`, `drie_weken`, `verschuiving`, `traag` (10 s of `delayMs`); teller per pad (`GET /__stub/counts`), wisselbaar per test (`POST /__stub/scenario`), datums relatief aan vandaag (Europe/Amsterdam).
- `/home/user/takenlijstje/tests/e2e/support/waste.ts` (nieuw): stub-besturing, datum/tijd-hulpjes, service-role-hulpjes (kalender in gekozen gezondheidsstand, afvaltaken, opzoekteller D-049, rol wisselen). Gewijzigd: `setLookupCount` upsert met `onConflict: "household_id"` (de tabel heeft geen `id`).
- `/home/user/takenlijstje/tests/e2e/waste.spec.ts` (nieuw, 43 tests): zie tabel. Door mij toegevoegd/gewijzigd t.o.v. wat er lag: regressietest "huisnummer 87 blijft 87 na blur" (bug 1); test "huisnummer 100000 → T-44" (bevinding 4); AC-184 hoofdtest gebruikt nu `0` als ondergrens en controleert het verdwijnen van T-43 pas ná Zoeken (bevinding 5); dagweergave-test gesplitst in "toont vanaf 22:00" en "Volgende dag binnen het scherm → vanaf 12:00" met `toBeInViewport` (bug 3); AC-209-variant "na sluiten van het detail" (bewijst dat het ongedaan maken zelf werkt, bug 2 zit in de bereikbaarheid van de toast).
- `/home/user/takenlijstje/tests/e2e/support/rest-gateway.mjs` (gewijzigd, testinfrastructuur): json/jsonb-parameters van RPC's worden nu als JSON-tekst doorgegeven. node-postgres stuurde JS-arrays als Postgres-arrayliteral, waardoor `waste_save`/`waste_sync` via de lokale gateway 22P02/22023 gaven ("cannot call jsonb_to_recordset on a non-array") en de app T-65 toonde. Dat was dus **geen** productiefout; de eerdere onderbroken pogingen zullen hierop zijn vastgelopen.
- `/home/user/takenlijstje/tests/e2e/support/start-app.sh` (nieuw, aangetroffen), `/home/user/takenlijstje/tests/e2e/support/local-stack.sh` en `/home/user/takenlijstje/playwright.config.ts` (gewijzigd, aangetroffen): stub als `webServer`, optioneel de app zelf starten; ongewijzigd gelaten, werken.
- Niet van mij en niet aangeraakt: `src/**/__tests__/**`, `supabase/tests/70_afval.sql`, `tests/integration/*`.

Faalt zonder fix: de vijf bug-/bevindingstests falen nu aantoonbaar op de huidige code (zie lijst). De overige tests heb ik niet tegen een versie zonder D-047/D-048/D-049 kunnen draaien (productiecode mag ik niet aanraken, ook niet via stash); wel heb ik bevestigd dat ze op de echte tekst-ID's uit UX §13.16 en op de databasestand asserten.

### Bevindingen tijdens het testen
- **[BLOKKEREND]** `src/features/settings/waste-address-flow.tsx:57-66` (`tidyHouseNumber`, D-048) — de regex `/^\s*(\d{1,5})\s*[-\s]?\s*([A-Za-z0-9]+)\s*$/` met `+` dwingt bij een leeg toevoegingsveld een splitsing af: bij het verlaten van het veld wordt "87" → huisnummer **8**, toevoeging **7** (idem "12" → 1 + 2; bevestigd met node: `['8','7']`). Elke beheerder die een huisnummer van 2+ cijfers zonder toevoeging intikt en dan de knop "Adres zoeken" tikt (blur), zoekt op het verkeerde adres en krijgt T-60 "Dit adres staat niet in de huisvuilkalender" — de kernflow aanzetten werkt niet. Verbetering: zelfde regex als het domein gebruiken (`([A-Za-z0-9]*)`, `src/domain/waste/address.ts:42`) en alleen splitsen als er een niet-lege rest is, of alleen als de rest met een letter begint of door spatie/streepje gescheiden is. 13 tests slagen daarna naar verwachting (met de omweg 37/40 groen).
- **[GEMIDDELD]** `src/features/tasks/task-detail-sheet.tsx:189` + `src/features/tasks/use-task-actions.ts:34-41` — na "Deze keer overslaan" in het taakdetail blijft het detail open en ligt de melding T-31 "Overgeslagen, ook het binnenzetten · Ongedaan maken" **onder** de dialoog-overlay (Playwright: `div[data-state=open].fixed.inset-0.z-50 intercepts pointer events`). "Ongedaan maken" is 6 s lang niet aantikbaar; daarna is de melding weg. Na sluiten van het detail (Escape) werkt het ongedaan maken wél (variant-test slaagt). Verbetering: het detail sluiten bij overslaan (zoals de gebruiker het bij afvinken ervaart) of de Toaster boven de overlay renderen.
- **[GEMIDDELD]** `src/features/calendar/calendar-toolbar.tsx:36-55` — dagweergave van de Kalender op 390×844: de werkbalk loopt horizontaal uit het scherm. De titel "Dinsdag 29 september" wordt niet afgekapt (`grid gap-4` zonder `min-w-0`/`grid-cols-1`, dus de kolom groeit naar max-content), "Vandaag" is half zichtbaar, "Vorige dag"/"Volgende dag" staan op x = 460–504 px (buiten de 390 px) en het tabblad "Maand" valt weg. Bladeren per dag is op de telefoon niet mogelijk. Screenshot: `/tmp/claude-0/-home-user-takenlijstje/692a0963-bcf7-518f-8e91-2ea8d7ce7c8b/scratchpad/kalender-dag.png`. Bestaande component, maar de dagweergave is onderdeel van D-048 en CP-W03.
- **[LAAG]** `src/domain/waste/address.ts:42-44` en `waste-address-flow.tsx` — "100000" wordt gelezen als huisnummer 10000 met toevoeging "0" (greedy `\d{1,5}` + rest) en levert T-60 in plaats van T-44; AC-184 zegt letterlijk: buiten 1 t/m 99999 → T-44. Test "AC-184: huisnummer 100000 → T-44" faalt hierop.
- **[LAAG]** `waste-address-flow.tsx:51-55` (`tidyPostcode`) — een eerder getoonde T-43 blijft staan nadat de postcode is gecorrigeerd, tot de volgende keer Zoeken; blur zet fouten alleen, wist ze nooit. Test hierop versoepeld naar wat het AC eist (controle ná Zoeken).

### Niet te toetsen in E2E
- AC-220 (T-73, jaareinde) en AC-205 T-77a (december/januari) en de stub-scenario's "december zonder J+1", "januari met lege C(J)", "kerstbomen_j1": afhankelijk van de serverklok; alleen Unit/Int.
- AC-222 botsing → T-65: race binnen de action, niet deterministisch; Int.
- AC-190 "Bas (ander huishouden)": DB-laag (E2E-kolom "—").

### Nodig van de bouwer
- Fix van de BLOKKEREND (`tidyHouseNumber`); daarna `tests/e2e/waste.spec.ts` opnieuw draaien. Verwacht: alleen de tests voor de twee GEMIDDELD-punten en de LAAG "100000" blijven rood totdat die zijn hersteld of bewust geaccepteerd.
- Beslissing over de twee GEMIDDELD-punten (niveau 2: niet stil open laten).

### Omgeving en commando's
- GoTrue-binary opnieuw gebouwd uit github.com/supabase/auth (main, vandaag): `GOTRUE_BIN=/tmp/claude-0/-home-user-takenlijstje/692a0963-bcf7-518f-8e91-2ea8d7ce7c8b/scratchpad/gotrue`, `GOTRUE_MIGRATIONS=/tmp/claude-0/-home-user-takenlijstje/692a0963-bcf7-518f-8e91-2ea8d7ce7c8b/scratchpad/supabase-auth/migrations`. Stack gestart met `bash tests/e2e/support/local-stack.sh start` (alle migraties t/m `_340` erin), gateway daarna herstart met de jsonb-fix, `npx tsx scripts/seed.ts --reset` gedraaid. De app draait nu nog op http://localhost:3100 (gestart via `start-app.sh`, met `WASTE_SOURCE_BASE_URL=http://127.0.0.1:4599`).
- Sleutels: `node tests/e2e/support/keys.mjs` (anon + service role). Let op: `eval` wordt door de poort geblokkeerd voor subagents; gebruik `KEY=$(node tests/e2e/support/keys.mjs | grep SERVICE_ROLE | cut -d= -f2)`.
- Spec draaien: `SUPABASE_SERVICE_ROLE_KEY=$KEY NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321 npx playwright test tests/e2e/waste.spec.ts` (Playwright start de stub zelf; de app moet al draaien, of geef `E2E_START_APP=1`).
- **App met stub voor de schermafbeeldingen van CP-W03** (stack draait al):
  1. `node tests/e2e/support/waste-stub.mjs &` (poort 4599; Playwright zet hem na een run weer uit)
  2. `E2E_SKIP_BUILD=1 bash tests/e2e/support/start-app.sh` (of zonder `E2E_SKIP_BUILD` om eerst te bouwen) → http://localhost:3100, inloggen jurgen@example.com / Welkom123!
  3. scenario wisselen: `curl -X POST http://127.0.0.1:4599/__stub/scenario -H 'content-type: application/json' -d '{"scenario":"onbereikbaar"}'` (namen: normaal, normaal_b, meerdere, onbekend, alleen_gft, onbereikbaar, leeg, adres_weg, jaareinde, kerstbomen_j1, drie_weken, verschuiving, traag; `{"scenario":"traag","delayMs":3000}` voor een kortere vertraging). Storingsstanden (H1/H2/H3, T-71) zet je in de database met de hulpjes uit `tests/e2e/support/waste.ts` (`insertCalendar`, `updateCalendar`) of direct met psql op `takenlijstje_e2e`.
  4. Let op bug 1: gebruik voorlopig een adres met toevoeging, of druk Enter in het huisnummerveld in plaats van de knop, om voorbij "Klopt dit?" te komen voor de schermafbeeldingen.

### Conclusie
**NO-GO** — AC-183, 186, 187 (c), 188 (a), 189 (degradatie), 213, 214, 222, 237 (a) en D-049 zijn niet groen door één BLOKKEREND in `tidyHouseNumber` (huisnummer "87" wordt 8 + toevoeging 7 bij het verlaten van het veld), AC-209 faalt op een niet-aantikbare "Ongedaan maken", en de dagweergave op 390 px loopt uit het scherm; de tests zelf zijn compleet en aantoonbaar werkend (37/40 groen met de omweg) en de rest van de E2E-suite is groen.
