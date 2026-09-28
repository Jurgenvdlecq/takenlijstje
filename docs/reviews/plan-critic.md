# Plan-critic — ronde 3 — 2026-09-28

Gelezen:
- `docs/PROGRESS.md`;
- `docs/PRODUCT_SPEC.md` BR-46 (ongewijzigd ten opzichte van ronde 2, gecontroleerd);
- `docs/TECHNICAL_DESIGN.md` §3.1 (`guard_comment_changes`), §4.1 (proxy), §12.3 stap 0 en §12.4 (wat verdwijnt, M1–M6);
- `docs/ACCEPTANCE_CRITERIA.md` AC-035, AC-055, AC-073, AC-138, AC-170 en AC-172;
- `docs/DESIGN_SYSTEM.md` §3 en `docs/INVENTARIS.md` §8.

Geen nieuwe screenshots. De rest van de documenten is ongewijzigd sinds ronde 2 en daar al beoordeeld.

Algemeen oordeel:
- Alle punten uit ronde 2 zijn verwerkt.
- Eén nieuwe tegenstrijdigheid is door het herstel ontstaan: de keuzes die Jurgen per uitgezet lid krijgt. Die raakt gegevens (een lid verwijderen) en staat straks in twee bevroren documenten, dus die moet vóór de freeze recht.

## Bevindingen

1. [MOET VÓÓR BOUW WORDEN OPGELOST] De keuzes die Jurgen per uitgezet lid krijgt, verschillen per document.
   - **Waar:**
     - ACCEPTANCE_CRITERIA AC-170 en AC-055 (punt "Uitgezette leden met een account") bieden drie keuzes: **weer aanzetten, uitgezet laten of verwijderen**;
     - TECHNICAL_DESIGN §12.3 stap 0 en §12.4 M1(d) bieden er twee: **weer aanzetten of zo laten**.
   - **Tweede probleem, vanaf WP1:** "uitgezet" is dan een gewone functie (V-29). M1(d) stopt het draaiboek bij elk uitgezet lid, ook bij iemand voor wie Jurgen bij stap 0 al "zo laten" koos, of die een beheerder na WP1 bewust via de app heeft uitgezet. Het draaiboek zegt niet of zo'n eerdere keuze telt.
   - **Gevolg:**
     - de bouwer weet niet welke vraag hij moet stellen;
     - de keuze "verwijderen" staat alleen in de AC's. Die haalt een lid onomkeerbaar uit het huishouden (profiel, voorkeuren, meldingen), terwijl het technisch draaiboek die handeling niet kent;
     - Jurgen kan bij M1 dezelfde vraag opnieuw krijgen over een keuze die hij al maakte.
   - **Nodig:**
     - één lijst met keuzes in alle vier de plekken. Mijn voorstel: alleen "weer aanzetten" of "uitgezet laten". Verwijderen kan Jurgen daarna zelf via Gezinsleden (UX §4.15, met bevestiging) en hoort niet in een voorcontrole;
     - bij M1(d) vastleggen dat alleen namen stoppen die Jurgen nog niet eerder heeft beoordeeld. Een eerdere keuze uit stap 0 en na WP1 in de app uitgezette leden worden gemeld, zonder te stoppen.

2. [AANBEVELING] De controle van "taak gedaan"-meldingen staat bij de verkeerde stap.
   - **Waar:** TECHNICAL_DESIGN §12.4, "Wat verdwijnt", punt `task_completed` ("De inhoudscontrole bij M6 kijkt ook naar de `task_completed`-meldingen van na de WP2a-deploy"), tegenover dezelfde paragraaf ("de hele soort vóór M6 gaat weg") en AC-035 ("geen melding van het type `task_completed` … met `created_at` vóór het moment van de contract-migratie").
   - **Probleem:** na M6 bestaan die meldingen niet meer, dus die controle kan bij M6 niet draaien.
   - **Gevolg:** de controle is niet uitvoerbaar zoals beschreven. Er gaat niets mis met de gegevens.
   - **Voorstel:** noem de controle van AC-073 ("controle op live na de WP2a-deploy") als stap vóór M5, en haal de verwijzing uit de M6-regel. Vergelijk daarbij de ontvangers per `dedupe_key` met de voorkeuren op het moment van controle. Voorkeuren kunnen intussen zijn gewijzigd; een verschil is dan eerst uit te zoeken, niet meteen een lek.

## Opgelost sinds vorige ronde

**Ronde 2:**
- **Punt 1 (AC-138 tegenover UX §4.14/§4.16):** opgelost. AC-138 toont nu eerst het scherm "Je hoort niet meer bij ‘Familie’", met de grens bij een toestel zonder cache.
- **Punt 2 (privacygat tussen M6 en WP3):** opgelost. Vanaf WP2a gaan de naamloze teksten en de ontvangersregel van V-38a live (TD §12.4, AC-073 onder WP2a, met een live-controle na de deploy).
- **Aanbeveling 3 (guard tegenover FK-actie en naamsynchronisatie):** opgelost. Het onderscheid loopt via `pg_trigger_depth() > 1`, beperkt tot precies twee toegestane wijzigingen (TD §3.1).
- **Aanbeveling 4 (`/api/outbox` zonder sessie):** opgelost. De proxy stuurt dit pad niet door, en de route geeft een 401 in JSON (TD §4.1, AC-172).
- **Aanbeveling 5 (AC-055 tegenover M1(d)):** stop tegenover melden is gelijkgetrokken, maar de keuzes verschillen nog. Dat staat nu bij punt 1.
- **Aanbeveling 6 (hygiëne):** opgelost. DESIGN_SYSTEM §3 noemt alleen `next/font/local`, INVENTARIS §8 en PROGRESS zijn bijgewerkt.

**Ronde 1:** alle 14 MOET-punten en de 8 aanbevelingen waren al in ronde 2 als opgelost bevestigd. Dat is niet teruggedraaid.

## Onbevestigde aannames
- "Verwijderen" als keuze in de voorcontrole voor uitgezette leden (AC-055, AC-170) staat niet in het technisch ontwerp, en Jurgen heeft er niet om gevraagd. Dit raakt gegevens (een lid onomkeerbaar verwijderen), zie punt 1.
- Verder geen.

## Conclusie
Reden: één open MOET-punt. De keuzes per uitgezet lid spreken elkaar tegen tussen de acceptatiecriteria en het technisch ontwerp, en de extra keuze "verwijderen" raakt gegevens. Na gelijktrekken is de freeze wat mij betreft mogelijk.
DESIGN FREEZE MOGELIJK: NEE
