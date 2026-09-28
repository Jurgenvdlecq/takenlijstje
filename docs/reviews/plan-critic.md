# Plan-critic — ronde 4 — 2026-09-28

Gelezen:
- `docs/TECHNICAL_DESIGN.md` §12.3 stap 0 en §12.4 (Wat verdwijnt, M1(d), M5 met `precheck_v2.sql` deel g, M6);
- `docs/ACCEPTANCE_CRITERIA.md` AC-055, AC-073 en AC-170;
- `supabase/migrations/20260927000100_schema.sql` (`user_preferences.updated_at` bestaat, nodig voor de ruisregel bij deel g).

De overige documenten zijn ongewijzigd sinds ronde 2/3 en daar beoordeeld.

## Bevindingen

1. [AANBEVELING] Vul AC-055 aan met de herkenregel voor een bewuste uitzetting.
   - **Waar:** ACCEPTANCE_CRITERIA AC-055, het punt "leden die na WP1 bewust via de app zijn uitgezet, worden alleen gemeld", tegenover TECHNICAL_DESIGN §12.4 M1(d).
   - **Wat ontbreekt:** alleen het TD zegt hoe de bouwer een bewuste uitzetting herkent: Jurgen of Ellen noemde die zelf; anders geldt de naam als "nog niet beoordeeld" en stopt het draaiboek.
   - **Beoordeling van de kanttekening van de architect:** klopt. De database bewaart geen gebeurtenislog van uitzettingen, en dat moet ook niet: het zou weer "wie deed wat" vastleggen. De gekozen terugval is veilig. Bij twijfel volgt hooguit één extra vraag aan Jurgen, en er verandert niets aan de gegevens zonder zijn antwoord.
   - **Gevolg van het ontbreken:** geen. De strengere regel in het TD gaat voor, en de code-reviewer toetst het draaiboek.
   - **Voorstel:** de zin uit M1(d) letterlijk in AC-055 overnemen. Beide documenten zeggen dan hetzelfde, en de test-writer heeft een toetsbare regel.

## Opgelost sinds vorige ronde
- **Ronde 3, punt 1 — keuzes per uitgezet lid:** opgelost.
  - Overal dezelfde twee keuzes, "weer aanzetten" of "uitgezet laten": TD §12.3 stap 0, TD §12.4 M1(d), AC-170 en AC-055.
  - "Verwijderen" staat niet meer in het draaiboek. Dat kan Jurgen later zelf via Gezinsleden.
  - De keuzes worden per naam met `household_members.id` vastgelegd in PROGRESS, en M1(d) stopt alleen voor namen die nog niet beoordeeld zijn. Jurgen krijgt dus geen dubbele vraag.
- **Ronde 3, aanbeveling 2 — de ontvangerscontrole stond bij M6:** opgelost. De controle draait nu vóór M5 (deel g). De methode staat per `dedupe_key` beschreven, met een ruisregel via `user_preferences.updated_at` (de kolom bestaat), en bij een afwijking eerst herstel en pas dan de vraag aan Jurgen.
- **Ronde 1 en 2:** alle punten bleven opgelost.
  - Ronde 1: 14 × MOET en 8 aanbevelingen, onder meer:
    - het wissen van meldingen met namen;
    - de ontvangers van "taak gedaan" (V-38a, vanaf WP2a);
    - de platformlogs;
    - de reekskoppeling in de guard;
    - `author_name`;
    - de volgorde van de voorcontroles;
    - de telling vóór WP1;
    - de uitrol (V-36);
    - de wachtrij over deploys;
    - `updateSeriesAction`;
    - de rechten-AC's;
    - het scherm "niet meer lid";
    - offline in het taakdetail;
    - de twee-tikkenregel (V-37).
  - Ronde 2: AC-138, het privacygat tussen M6 en WP3, de `pg_trigger_depth`-uitzondering, `/api/outbox` met 401, en de documenthygiëne.

## Onbevestigde aannames
- Geen die rechten, gegevens of scope raken.
- Punten die bij de overdracht aan Jurgen horen:
  - het restrisico van de wachtrij bij de eerste deploy (TD §9.3.1 punt 5);
  - de grens van de platformlogs (BR-12);
  - het uitzetten van de meldingen van bestaande gezinsleden (BR-46.5).

  Dit zijn geen aannames. Het zijn benoemde punten die de bouwer volgens de documenten in het totaalvoorstel en bij de eerste deploy aan Jurgen meldt.

## Conclusie
Reden: er staat geen BLOKKEREND en geen MOET VÓÓR BOUW meer open. Rechten, isolatie, het draaiboek voor het onomkeerbare wissen (back-up, restore-test, hertelling, controle van de ontvangers, letterlijk "ja, wissen" van Jurgen) en de uitrol zijn eenduidig vastgelegd en toetsbaar. De ene aanbeveling mag vóór of na de freeze worden verwerkt.
DESIGN FREEZE MOGELIJK: JA
