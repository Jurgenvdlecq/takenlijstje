## Code-review: WP3b afvalkalender (W-03), commits e243197..b289758

**Beoordeeld:** alle bestanden uit de opdracht. Ik heb ze volledig gelezen, samen met de aanroepers: `summary.tsx`, `day-view.tsx`, de outbox-route, de guard-versie in `_210` en `complete_task`/`undo_complete_task`.

**Ontwerp gelezen:**
- TD §18.1–§18.14 en §18.15 kort;
- UX §13.4–§13.13 en §13.16;
- DECISIONS D-047.

PRODUCT_SPEC §14 en ACCEPTANCE_CRITERIA WP3b heb ik alleen via de verwijzingen in TD/UX gebruikt.

**Lint, typecheck en tests:**
- typecheck: groen;
- lint: 0 fouten; 5 waarschuwingen, allemaal buiten WP3b (`gate.mjs`, `seed.ts`, `visual-check.mjs`);
- `npm test`: 17 bestanden en 360 tests groen. Er is nog **geen enkele afvaltest**: alleen `src/server/waste/__tests__/fixtures/` bestaat.

**Algemeen beeld:** de kern volgt §18 nauwkeurig. Het gaat om:
- de volgorde van de planregels in §18.8.2;
- `classifyEmpty`, dat stap voor stap gelijk is aan §18.8.4;
- de volgorde van de gezondheidsregels (§18.8.5): empty → stale → held → retrying → ok;
- in de tickstap alleen insert na een mislukte ophaling of zonder ophaling (`sync.ts:130`);
- claim ≥ 60 s en `dueForFetch` > 60 min;
- de RPC-stappen van `waste_save` (1–5) en `waste_sync` (1 → 3, daarna 4 → 5 → 6 → 7), met statuscontrole bij elke stap;
- de guard, die gelijk is aan `_210` plus het afvalblok uit §18.5.2 (met diff gecontroleerd);
- de teksten T-01…T-99 en M-01…M-05: ik heb ze regel voor regel tegen §13.16 en §13.10 gelegd en vond geen tekstfouten.

De bevindingen zitten vooral in de randen van de UI, één gat in de versie-bescherming en de afhandeling van fouten.

### Bevindingen

1. **[GEMIDDELD]** `src/features/tasks/selectors.ts:72-74` en `src/features/dashboard/summary.tsx:48-53` — afvaltaken tellen mee in "Eerstvolgende deadline".
   - Probleem: `openWithDeadline` filtert afvaltaken niet uit. Het dashboard toont dan bijvoorbeeld "Eerstvolgende deadline: Restafval buitenzetten · verloopt over 2 dagen". Dat is in strijd met UX §13.4 ("Geen deadlinebadges 'verloopt over …' of 'uiterlijk morgen' bij afvaltaken", V-50).
   - Gevolg: met wekelijks restafval staat er bijna altijd een afvaltaak in deze regel, en de echte deadlines van gewone taken raken uit beeld.
   - Verbetering: filter `!t.waste_direction` in `openWithDeadline`.

2. **[GEMIDDELD]** `src/features/tasks/task-detail-sheet.tsx:329-340` — de infolijst in het detail mist de verlopen-weergave.
   - Probleem: UX §13.6 schrijft voor: "Uiterlijk" vet, en bij verlopen in `overdue` met daaronder "1 uur te laat". De waste-rijen tonen alleen de platte tekst, zonder `text-overdue` en zonder `deadline`.
   - Gevolg: een te late buitenzet- of binnenzettaak ziet er in het detail precies zo uit als een taak die op tijd is.
   - Verbetering: geef de rij "Uiterlijk" bij `status === "overdue"` dezelfde opmaak en `deadline`-subregel als de gewone rij Uiterlijk.

3. **[GEMIDDELD]** `src/features/settings/waste-section.tsx:316-318` en `:617` — bij `FORBIDDEN` wisselt de pagina niet naar J.
   - Probleem: TD §18.11 en UX §13.7.1 zeggen "melding onderin, pagina → J". Nu komt alleen toast T-66; formulier, statusweergave en knoppen blijven staan.
   - Gevolg: een beheerder die net is teruggezet naar gezinslid ziet nog steeds het formulier en alle knoppen, en krijgt bij elke tik opnieuw T-66.
   - Verbetering: roep na T-66 `reload()` aan (via een callback naar `WasteSection`), zodat `getWasteSettings` de member-weergave levert.

4. **[GEMIDDELD]** `supabase/migrations/…_330_afvalkalender.sql:363` (`version` start op 1) samen met `disable_waste_calendar` (verwijdert de rij) — de stale-bescherming lekt bij uitzetten en direct weer aanzetten.
   - Probleem:
     - na uitzetten en opnieuw aanzetten krijgt de nieuwe rij weer `version = 1`;
     - een tick of retry die de oude rij (v1) al had gelezen, komt in `waste_sync` door de versiecontrole heen;
     - bij `success` overschrijft hij `pickups` met de datums van het oude adres, en past hij remove/move/insert toe op de taken van het nieuwe adres;
     - zonder ophaling voegt hij taken van het oude adres in.
   - Gevolg:
     - er ontstaan taken van twee adressen, precies wat AC-214 en §18.10 ("Tick plant terwijl het adres wijzigt → stale") moeten voorkomen;
     - bij een verwijdering vallen ook de notities weg (cascade);
     - het herstelt pas bij de volgende geslaagde ophaling.
     
     Het venster is klein (een paar seconden), maar reëel met twee beheerders.
   - Verbetering: laat `version` nooit terugvallen, bijvoorbeeld met een sequence (`nextval`) als waarde bij insert, of laat `waste_sync` ook `bag_id` vergelijken. Het ontwerp zegt "default 1, +1 bij elk nieuw adres" en voorziet dit geval niet. Leg de keuze vast in DECISIONS, of maak er een vraag van (zie onder).

5. **[GEMIDDELD]** `src/server/services/waste-read.ts:214-219` — een verborgen fallback (categorie D).
   - Probleem: de count-query van open afvaltaken gaat niet door `check()`. Bij een fout wordt het `count ?? 0`.
   - Gevolg: de uitzet-sheet toont T-81c "Het adres wordt gewist." terwijl er wel open taken verdwijnen, dus een onjuiste bevestigingstekst vóór een onomkeerbare actie.
   - Verbetering: gebruik `check()` op het resultaat (dan volgt T-68), zoals elders in hetzelfde bestand.

6. **[LAAG]** `src/server/system/waste/sync.ts:371-378` — elke tick een alarm-update plus `notify()` zolang de storing duurt.
   - Probleem: `alertFailure` draait bij elke tick met `failed`. Dat kost één update (`markWasteAlarm`), twee selects en een upsert in `notify` per kwartier, dagenlang. Dat botst met §18.13 ("markWasteAlarm is hooguit één update per storing"). Daarnaast stijgt `report.alerted` elke tick, dus de tick-log telt meldingen die er niet zijn.
   - Gevolg: onnodige queries en een misleidende telling. Dubbele meldingen ontstaan niet (de dedupe werkt).
   - Verbetering:
     - sla `alertFailure` over als `after.alarm_since` al gezet is en de melding bestaat;
     - of tel `alerted` alleen als `markWasteAlarm` een rij raakte of `notify` iets invoegde.

7. **[LAAG]** `src/server/system/waste/sync.ts:326-330, 357-378` — geen afvang per huishouden.
   - Probleem: claim, vervallen, `readCalendar` en `alertFailure` staan buiten de try/catch. Alleen `applyWasteSync` is afgevangen.
   - Gevolg: één mislukte query stopt de hele afvalstap voor alle volgende huishoudens. Met één huishouden is het gevolg klein.
   - Verbetering: zet de hele body van de lus in een try/catch met een code-log, net als de bestaande catch.

8. **[LAAG]** `src/features/calendar/day-view.tsx:64` (aanroeper, niet gewijzigd) — de dagweergave toont de afvaltijd van nu, niet de geplande tijd.
   - Probleem: de dagweergave (`mode === "day"`, niet sleepbaar) rendert `TaskCard` zonder `planning`. Afvaltaken tonen daar dus de lijsttijd ten opzichte van nu. Op toekomstige dagen staat er dan niets, terwijl UX §13.4 in de Kalender "vanaf 22:00" / "vanaf 12:00" vraagt.
   - Verbetering: geef ook hier `planning` mee.

9. **[LAAG]** Tijdzone op drie manieren:
   - `waste-section.tsx:586` gebruikt `tz = "Europe/Amsterdam"` hard;
   - `waste-read.ts:208` gebruikt `household.timezone ?? …`;
   - `sync.ts` gebruikt `HOUSEHOLD_TIMEZONE`.
   
   Functioneel is het nu gelijk (het ontwerp vraagt Amsterdam), maar het zijn drie bronnen. Gebruik overal `HOUSEHOLD_TIMEZONE`.

10. **[LAAG]** `waste-section.tsx:279-284` — geen foutregel bij het verlaten van het huisnummerveld.
    - Probleem: `tidyHouseNumber` toont bij het verlaten van het veld geen T-44. UX §13.9 vraagt validatie "bij verlaten en bij Zoeken"; de postcode doet het wel.
    - Verbetering: zet bij een ongeldige, niet-lege waarde `errors.houseNumber`.

11. **[LAAG]** `src/server/actions/waste.ts:49` — altijd dezelfde veldfout bij kapotte invoer.
    - Probleem: een zod-fout op de ruwe invoer (bijvoorbeeld een te lange postcode) geeft altijd T-44 (huisnummer). De client valideert opnieuw, dus in de UI is het vrijwel onzichtbaar.

12. **[LAAG]** `src/features/tasks/task-detail-sheet.tsx` — veel opmaakruis in de diff.
    - Probleem: ongeveer 300 van de gewijzigde regels zijn alleen herafbreking (80 tekens), terwijl de rest van de codebase lange regels gebruikt.
    - Gevolg: de inhoudelijke wijziging is lastig te reviewen, en de volgende merge gaat onnodig conflicteren.
    - Het bestand is nu 466 regels, boven de grens van 400.

13. **[LAAG]** `src/features/settings/waste-section.tsx` is 821 regels, ruim boven de grens van 400. `AddressFlow` is ongeveer 310 regels en `StatusView` ongeveer 190, allebei ver boven de 80 per functie. Opsplitsen in `waste-address-flow.tsx` en `waste-status.tsx` maakt de volgende wijziging (WP7) veiliger.

14. **[ONZEKER]** `maxDuration` voor de server actions.
    - Probleem: TD §18.6 zegt "Staat Fluid compute uit, dan `maxDuration = 30` op het segment". Die staat nergens (alleen de tick-route heeft 60), en D-047 zegt niets over Fluid compute.
    - Risico: bevestigen doet A+B+C (tot 12 s) plus een RPC. Zonder Fluid compute kan de standaardlimiet de action afbreken.
    - Nodig: bevestiging dat Fluid compute aan staat, vastgelegd in DECISIONS, of `export const maxDuration = 30` op `/instellingen`.

**Per categorie**
- **A (ontwerp):** punten 1–4 en 14. Planning, leeg-regel, gezondheid, alleen-insert na een mislukte ophaling, claim, rate limit, RPC-volgorde en guard kloppen met §18.
- **B (randgevallen):**
  - zomer- en wintertijd zijn gedekt: alle momenten lopen via `zonedInstant`/`zonedDate`;
  - de jaarwisseling klopt: C(J+1) in december en bij een lege C(J), de uitzondering voor november/december in `classifyEmpty`, en T-73 met jaar+1;
  - verschuiving, gelijktijdigheid (slot en `on conflict`) en de statuscontroles kloppen;
  - stale version: punt 4.
- **C (foutafhandeling):** punten 5 en 7. `source.ts` gooit nooit bij netwerk- of formaatfouten, en de logs bevatten alleen codes.
- **D (halve implementaties):** gecontroleerd. Geen TODO/FIXME en geen mock- of demodata; de enige verborgen fallback is punt 5.
- **E (consistentie):** punt 9. `check()`, `runAction` en `requireAdmin` worden gebruikt volgens het bestaande patroon.
- **F (onderhoudbaarheid):** punten 12 en 13. Technische schuld voor PROGRESS: de omvang van `waste-section.tsx` en het opmaakverschil in `task-detail-sheet.tsx`.
- **G (performance):**
  - de tick doet normaal 1 + ⌈n/chunk⌉ selects en geen schrijfacties;
  - claim, RPC en `readCalendar` per huishouden gebeuren alleen bij een ophaling (2× per dag);
  - er zijn geen queries in een lus buiten die per-huishouden-stappen; alleen punt 6.
- **H (tests):** er zijn nog geen afvaltests, zie Doorgeven.

### Doorgeven
- **Security-reviewer:**
  - `disable_waste_calendar()` (`_330:525-529`) kiest het huishouden met `order by created_at limit 1` uit de beheerderslidmaatschappen. Als iemand in meer dan één huishouden kan zitten, is dat het verkeerde huishouden. Datzelfde geldt voor `waste_calendar_enabled()`.
  - Controleer daarnaast de platformlogs volgens §18.12. De eigen logs heb ik gezien: alleen codes, tellingen en `fetchMs`.
- **Test-writer (risico, nu nog 0 afvaltests):**
  - `planWasteTasks`: verschuiving ±3 dagen, gelijke afstand, uitzondering voor `in` na een gedane `out`, rename, `out` na 07:45;
  - `classifyEmpty`: alle vier de stappen, met november/december en "J+1 alleen kerstbomen";
  - `wasteSyncHealth`: volgorde, `held` na een wisselende foutcode, notice (a)/(b);
  - `dueForFetch` rond 06:00/17:00 en de wisseling van zomer- naar wintertijd;
  - `findExpiredWasteTasks` (D+7, volgende `out` gestart);
  - `fetchPickups` (B `{}` → NOT_FOUND, december parallel, C(J+1) mislukt → UNREACHABLE);
  - DB: guard, `skip_cascade` inclusief terugdraaien, stale version (ook bij uitzetten en direct weer aanzetten, punt 4), `last_failure_at` alleen via `waste_sync`;
  - regressietests voor de punten 1, 2 en 5.
- **Performance-reviewer:** punt 6 (alarm en `notify` elke tick tijdens een storing). De tickduur zonder ophaling is nog niet gemeten (§18.13: p95 < 5 s).

### Vragen voor de hoofdsessie
- Punt 4: mag `version` uit een sequence komen, of `waste_sync` ook `bag_id` vergelijken? Dat is een uitvoeringskeuze binnen §18.10 (nooit taken van twee adressen), maar wijkt af van de letterlijke tekst "default 1" in §18.3.1. Leg de keuze vast in DECISIONS, of maak er een wijzigingsverzoek van.
- Punt 14: staat Fluid compute aan op het Vercel-project?

### Conclusie
**NO-GO: eerst punt 1, 2, 3, 4 en 5 herstellen (en 14 bevestigen).** De serverlogica en de database volgen §18 zorgvuldig en ik vond geen blokkerende fouten. Wel wijken vier zichtbare of gegevenspunten af van het goedgekeurde ontwerp of verbergen ze een fout, en op niveau 2 mogen GEMIDDELD-punten niet openblijven.
