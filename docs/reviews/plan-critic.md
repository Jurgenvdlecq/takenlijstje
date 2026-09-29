# Plan-critic — W-03 afvalkalender — ronde 5 — 2026-09-29

> Deze beoordeling gaat alleen over wijzigingsverzoek **W-03 (afvalkalender, WP3b en de W-03-regels voor WP4–WP9)**. Het is een korte ronde: alleen de twee open moet-punten en de aanbevelingen 3–6 uit ronde 4 zijn nagekeken, plus een controle op nieuwe tegenspraak door de wijzigingen. De eerdere W-03-rondes 1 t/m 4 (alle NEE) en de rondes van het hoofdontwerp (laatste: ronde 4, JA) staan in de git-geschiedenis van dit bestand.

Gelezen:
- `docs/wijzigingen/W-03/samenvoegen.md` (wat wel en niet wordt ingevoegd);
- `samengevoegd/PRODUCT_SPEC-en-ACCEPTANCE_CRITERIA.md`: BR-50, BR-51, BR-52 volledig, §6 (storingsrijen), §8/BR-58 (adrescode), §12 en §14 (V-58-rijen), AC-204, AC-205, AC-Dekking, interpretaties en controlelijst;
- `samengevoegd/UX_SPEC.md`: §13.1, §13.4 (Verlopen-rijen), §13.7.5 volledig, §13.10 (M-03/M-04/M-05), §13.15, §13.17 en het rapportdeel;
- `samengevoegd/TECHNICAL_DESIGN.md`: kop en Basis, §18.3.1, §18.8.4–§18.8.6, §18.10, §18.12, §18.15 (rijen 183–237), §18.16 (U3 volledig), §18.17, de §15-regels, de aanvullingen per sectie en het rapportdeel onderaan;
- `samengevoegd/DESIGN_SYSTEM.md`: inleiding (aantal blokken), §7.13.3, §7.13.6, prototypetabel en rapportdeel;
- `docs/PROGRESS.md`: "Volgende stap", "Antwoorden van Jurgen" (V-58), "Open vragen", "Wijzigingsverzoeken";
- ter controle van de te-laat-tijden: `src/domain/status.ts` (`durationText`, `deadlineText`).

Geen nieuwe screenshots: er is niets aan het prototype veranderd sinds ronde 4.

## Bevindingen

Er zijn geen punten die BLOKKEREND zijn en geen punten die vóór de bouw moeten worden opgelost. Wat overblijft, zit alleen in rapporttekst die volgens `samenvoegen.md` niet in de bevroren documenten komt, of in PROGRESS.

1. [AANBEVELING] Verouderde rapporttekst over V-58, die niet wordt ingevoegd.
   - **PS/AC, interpretatie 6** (`samengevoegd/PRODUCT_SPEC-en-ACCEPTANCE_CRITERIA.md`, ± r. 1312): "**de vraag aan Jurgen loopt nog** … Zegt Jurgen nee, zie de controlelijst."
     - De interpretaties gaan volgens `samenvoegen.md` naar het totaalvoorstel.
     - Zo overgenomen, zou het totaalvoorstel een vraag als open noemen die al beantwoord is.
   - **PS/AC, rapportdeel** (± r. 1351, 1354, 1360): noemt "het antwoord over de adrescode" nog als voorwaarde.
   - **TD, rapportdeel onderaan:**
     - "Vragen voor Jurgen" beschrijft V-58 nog als open, met "De plek staat gemarkeerd met `[OPEN: V-58]` …";
     - "Status" zegt "op voorwaarde dat Jurgen V-58 beantwoordt";
     - de wijzigingstabel, rij 9, verwijst naar "§18.18". Dat moet §18.17 zijn.
   Gevolg: geen fout in het ontwerp, wel een kans op een verwarrend totaalvoorstel.
   Voorstel: interpretatie 6 herschrijven naar "Jurgen zei ja (V-58)". De rest kan zo blijven als geschiedenis, of er kort bij zetten: "beantwoord: ja".

2. [AANBEVELING] `docs/PROGRESS.md`, regel "Volgende stap" (bovenaan).
   - Er staat nog: "vraag aan Jurgen over het bewaren van de adrescode … dan plan-critic r4".
   - De sectie "Wijzigingsverzoeken" is wel bijgewerkt (r4 NEE, beide punten verwerkt, dan ronde 5).
   Voorstel: bijwerken naar "totaalvoorstel W-03 → `/design-go`; daarna samenvoegen volgens `samenvoegen.md` en bouwen als WP3b. Open vóór de livegang: U0.1, U5."

## Opgelost sinds vorige ronde

- **1. Taken tijdens een storing (moet)** → opgelost, en in alle vier de documenten gelijk.
  - **PS:**
    - BR-50 zegt dat de 14 dagen vooruit "ook tijdens een hapering of storing" gelden, op basis van de laatst bekende ophaaldagen;
    - BR-52 (onbereikbaar, onbruikbaar, adres weg, en leeg antwoord) maakt nu onderscheid: bestaande afvaltaken worden niet verwijderd, verschoven of hernoemd; voor al bekende ophaaldagen binnen 14 dagen worden wél taken klaargezet; BR-54 loopt door;
    - "Opnieuw proberen" en "Lukt het weer" zeggen nu "worden de wijzigingen van de gemeente verwerkt (BR-51)";
    - de twee §6-rijen zeggen hetzelfde.
  - **AC:**
    - AC-204 DAN heeft de drie regels, met een controleerbaar voorbeeld. Bewaard is 20 oktober, de storing loopt van 4 t/m 7 oktober, en op 6 oktober staan de taken er. Dat klopt: 6 okt + 14 = 20 okt, en het venster telt vandaag t/m vandaag + 14 mee;
    - de toets van AC-204 noemt het geval "bewaarde ophaaldag schuift het venster in";
    - AC-205 slotalinea is aangepast;
    - interpretatie 21 geeft de zin voor het totaalvoorstel.
  - **UX:**
    - §13.1 punt 6 en §13.7.5 (bij hapering en storing) zeggen hetzelfde;
    - "Weer gelukt" heeft "wijzigingen van de gemeente worden verwerkt";
    - de teksten M-03 en M-05 ("nieuwe ophaaldagen komen er pas bij als het weer lukt") passen daarbij, omdat het over nieuwe datums van de gemeente gaat.
  - **TD:**
    - §18.8.4 (gevolgen van `SUSPECT_EMPTY`) en §18.8.6 (plannen) leggen één toetsbare voorwaarde vast. `remove`, `move` en `rename` worden alleen toegepast na een geslaagde ophaling in dezelfde ronde. Anders gaat alleen `insert`, ook bij `syncHousehold` via "Opnieuw proberen";
    - §18.10 heeft een eigen rij;
    - §18.15 rij 204 (Int) toetst `removed = moved = renamed = 0`, met D = vandaag + 15 en een tick de dag erna voor zowel "onbereikbaar" als "leeg" (`inserted = 2`), en BR-54 tijdens de storing;
    - §18.17 legt de keuze uit.
  - Nagelopen of dit iets anders raakt:
    - "alleen insert als er deze ronde niet is opgehaald" kan geen taken missen, want de bewaarde datums veranderen alleen bij een geslaagde ophaling, en dan volgt in dezelfde ronde het volledige plan;
    - de regel "een taak waarvan het moment voorbij is, wordt niet meer aangemaakt" (BR-50) geldt ook voor `insert`;
    - bij een storing met "adres weg" (c) gelden dezelfde regels, en dat staat zo in BR-52 en AC-204.
- **2. V-58, adrescode (moet)** → opgelost.
  - Het antwoord "Ja dat mag" staat letterlijk in PROGRESS onder "Antwoorden van Jurgen", met de vraag en het voorstel erbij.
  - **Invoegtekst TD:**
    - er staat geen `[OPEN: V-58]` meer (alleen in het rapportdeel, zie aanbeveling 1);
    - Basis, §18.3.1 (`bag_id`, "Jurgen besloot", zonder de nee-route), §18.12, §3.1-rij, §17-regel en §15 ("V-41…V-58") zijn in orde.
  - **PS:**
    - §14 "Besluiten van Jurgen" heeft rij V-58;
    - de kop van §12 loopt tot V-58, met de rij V-58 → BR-58, §8;
    - BR-58/§8 noemt de adrescode al als bewaard gegeven, alleen voor beheerders, weg bij uitzetten, en alleen naar de gemeente.
  - **AC-Dekking:** V-58 → AC-190, 212, 213, 216, 218. Die criteria noemen de adrescode (lezen, log, uitzetten, huishouden wissen, wat naar buiten gaat).
- **Aanbeveling 3 (te-laat-tijden)** → overgenomen.
  - TD U3 punt 34: "wo 09:00 (D+1) … '9 uur te laat' … '1 dag te laat' verschijnt pas vanaf wo ± 23:30".
  - UX §13.4 en DS §7.13.3/§7.13.6 noemen wo 09:00 "9 uur" en do 09:00 "1 dag".
  - Dit klopt met `durationText`: 23,5 uur wordt afgerond op 24, en dat geeft "1 dag". Ook "hooguit 6 dagen" vóór D+7 00:00 klopt.
- **Aanbeveling 4 (metatekst)** → overgenomen.
  - UX §13.17 heeft de voorgestelde kop, zonder slotzin.
  - In TD §18 staat geen "vervangt de concepten r1 t/m r6" meer. De oude versiegeschiedenis is weg, de versimpeltoets is §18.17, en de verwijzingen in §18.3.1 en §14 kloppen daarmee.
  - De r6-tabel staat als "niet invoegen" onderaan.
  - DS: "zeven blokken (1a)–(4b)", gelijk aan `samenvoegen.md`; de open keuze over het pad is weg, en alle paden zijn `docs/prototype/w03/…`.
- **Aanbeveling 5 (UX §13.7.5 storingsdefinitie)** → overgenomen: "met minstens een uur tussen het eerste en het laatste en zonder andere uitkomst ertussen", en het jaareinde uitgezonderd. Dat is gelijk aan BR-52 en TD §18.8.5.
- **Aanbeveling 6 (PROGRESS)** → grotendeels overgenomen.
  - "Open vragen" bevat alleen nog V-40 en U0.1.
  - V-48…V-58 staan als beantwoord.
  - "Wijzigingsverzoeken" is bijgewerkt.
  - Rest: de regel "Volgende stap" (aanbeveling 2).

Geen nieuwe tegenspraak gevonden.
- In de vier invoegteksten staat nergens meer "verandert er niets aan de afvaltaken", "planning aangevuld" of "taken aangevuld".
- De enige overgebleven "taken gelijk" (TD rij 237) gaat over bevestigen bij `no_upcoming` tijdens het instellen, en dat is juist.

## Onbevestigde aannames
- **Adrescode bewaren:** bevestigd door Jurgen (V-58). Geen aanname meer.
- **Gemeentetijden 22:00/07:45:** Jurgens besluit (V-49). U0.1 is een controle vóór de livegang, met een vastgelegd stoppunt bij een afwijking (TD §18.1.7). Geen stille aanname.
- **Bereikbaarheid vanaf Vercel `fra1`** — raakt: scope. Aanvaardbaar, want het gedrag bij een blokkade ligt vast (TD §18.16 U5: functie uit, geen adres bewaard, wijzigingsverzoek met drie opties). Dit moet in het totaalvoorstel staan.
- **Interpretaties 1–21 van de analist** — raakt: UX. Ze gaan naar het totaalvoorstel. Interpretatie 6 moet daarvoor eerst worden bijgewerkt (aanbeveling 1).

Geen van deze aannames raakt rechten, gegevens of scope zonder vastgelegd besluit of vastgelegd gedrag.

## Conclusie
DESIGN FREEZE MOGELIJK: JA
Reden: beide moet-punten uit ronde 4 zijn volledig en consistent verwerkt in PS, AC, UX, DS en TD, en aanbevelingen 3–6 zijn overgenomen. Wat openstaat, zijn twee aanbevelingen in rapporttekst en PROGRESS, die niet in de bevroren documenten komen. Het totaalvoorstel moet wel de zin over taken tijdens een storing (interpretatie 21), de U5-route en de bijgewerkte interpretatie 6 bevatten.
