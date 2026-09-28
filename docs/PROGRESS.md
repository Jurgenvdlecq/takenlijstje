# Voortgang — Takenlijstje

Kwaliteitsniveau: 2
Reden niveau: Door Jurgen bewust vastgezet op 2026-09-27 met `/niveau 2` ("bestaand project, meerdere gebruikers"). Eerder voorstel was niveau 3 (live, publiek bereikbaar, persoonsgegevens); Jurgen koos niveau 2. Security-review blijft verplicht vanwege login, meerdere gebruikers en persoonsgegevens.
Fase: Bestaand project onder het systeem brengen (werkwijze §15) — technisch ontwerp ronde 1 klaar (9 work packages); acceptatiecriteria gestart
Volgende stap: antwoorden V-30 t/m V-35 vastleggen en laten verwerken; product-analyst schrijft ACCEPTANCE_CRITERIA.md; daarna plan-critic tot "DESIGN FREEZE MOGELIJK: JA"; dan totaalvoorstel aan Jurgen.

## Capabilities
- Poort: `node .claude/gate/test-gate.mjs` → 97 geslaagd, 0 mislukt (2026-09-27). `gate.mjs status`: productiecode geblokkeerd (nog geen Design Freeze), niveau-2-signalen gevonden: `supabase/**`, pakket `@supabase/`, pakket `pg`, `.env.example: SUPABASE_`.
- Screenshots: bewezen op 2026-09-27 met Playwright/Chromium 141.0.7390.37. Op `capability-390x844.png` zag ik zelf (via Read): een smal staand beeld, bovenste helft felblauw met in het midden de witte vetgedrukte tekst "CAPABILITY OK", onderste helft oranje-geel. Ook `capability-1440x900.png` bekeken: hetzelfde beeld in breed formaat, tekst gecentreerd. Screenshot-driven development geldt als bewezen.
- Lokale teststack (op toestemming van Jurgen, V-03): `tests/e2e/support/local-stack.sh` met zelf gebouwde Supabase Auth in de scratchpad, plus `scripts/seed.ts`. Werkt; realtime ontbreekt (bekend).
- Apparaten en viewports (uit discovery, V-07): telefoon, 390x844. Computer is geen doelapparaat.

## Besluiten van Jurgen
- 2026-09-28 — Scopewijziging (V-19/V-21/V-22): geen toewijzing van taken aan personen, geen automatische verdeling, geen ruilen, geen punten/spaardoel, geen registratie van wie afvinkte; iedereen mag afvinken en terugdraaien. Vervangt de overgenomen besluiten over Verdeling, Ruilen en punten in INVENTARIS §2.
- 2026-09-27T20:43 — Jurgen zet het kwaliteitsniveau op 2 (bestaand project, meerdere gebruikers)
<!-- De poort voegt hier automatisch /design-go, /niveau en /onderhoud-go toe. -->

## Antwoorden van Jurgen
- V-01 (2026-09-27): Klopt niveau 3, of wil je bewust niveau 2? → `/niveau 2 bestaand project, meerdere gebruikers`
- V-02 (2026-09-28): PLAN.md bestaat niet; mogen README.md en docs/ARCHITECTUUR.md als vastgelegde besluiten gelden? → "Dat is goed"
- V-03 (2026-09-28): Hoe komen we aan screenshots van de ingelogde schermen? (a) lokale teststack starten, (b) eigen screenshots, (c) toegang live site → "Eerste optie"
- V-04 (2026-09-28): Staat pg_cron aan in Supabase? → "Geen idee, hoe check ik dat?" (zie hieronder: nagekeken)
- V-05…V-20 (2026-09-28), letterlijk antwoord van Jurgen:
  > Eigen gezin.
  > Eigenlijk is het grotendeels voor Ellen en Jurgen, optioneel voor Lynn en Kai. Kai 13, Lynn 15
  > Telefoon.
  > V08 : Nee
  > V09: Volg je voorstel
  > V10 Iedereen mag afvinken
  > V11: Voorstel volgen
  > V12: Voorstel volgen
  > Volg alle voorstellen.
  > V19: Oneerlijke verdeling, vergeten taken (met name door Jurgen).
  > Ik wil alleen niet dat de tool het ook echt zo verdeeld, maar dat er gewoon staat wat er moet gebeuren en dat er dan afgevinkt kan worden wat er al gedaan is en voor wanneer het gedaan moet zijn.
  - Verwerking: V-05 alleen eigen gezin · V-06 hoofdgebruikers Ellen en Jurgen, Lynn (15) en Kai (13) optioneel · V-07 telefoon (390x844) · V-08 nee, één huishouden per persoon · V-09 voorstel (alleen beheerder en maker) · V-10 iedereen mag namens iedereen afvinken (afwijkend van voorstel) · V-11, V-12, V-13, V-14, V-15, V-16, V-17, V-18 voorstel · V-19 zie citaat; raakt het bestaande besluit over automatische verdeling → verduidelijking gevraagd als V-21.
- V-21 (2026-09-28), verduidelijking V-19, antwoorden van Jurgen (keuzevragen):
  - "Je wilt niet dat de app de taken echt verdeelt. Welke van deze drie past het best?" → **"Niemand toegewezen"** (taken zijn van het hele huishouden; je ziet wat er moet gebeuren en vóór wanneer; wie het doet vinkt het af; automatisch verdelen, 'om en om' en ruilen vervallen).
  - "Moet de app laten zien wie wat gedaan heeft?" → **"Nee"** (de app houdt niet bij wie iets deed).
  - "Wat doen we met de punten en het spaardoel?" → **"Weghalen"**.
- V-22 (2026-09-28), tegenstrijdigheid V-11 ↔ V-21: "Wat wordt het bij terugdraaien?" → **"Iedereen mag terug"** (de app onthoudt niet wie afvinkte; iedereen mag een afvinking terugdraaien). Vervangt het antwoord op V-11.
- V-23…V-27 (2026-09-28): "Volg je voorstellen maar." → V-23 meldingen naar iedereen met account volgens eigen instellingen, standaard aan voor Ellen en Jurgen, uit voor Lynn en Kai · V-24 afwezigheid vervalt (bij gezinsvakantie reeksen pauzeren) · V-25 maker bewaren maar niet tonen, schrijver van notitie tonen, "toegevoegd/gekocht door" bij boodschappen weg, duur blijft als informatie · V-26 overgang: eerst back-up, daarna wissen zoals voorgesteld (afvinkhistorie blijft zonder personen); **vlak vóór het wissen wordt Jurgen nogmaals om bevestiging gevraagd** · V-27 succescriteria PRODUCT_SPEC §11 akkoord.
- V-04 en V-20 (2026-09-28): "En kan je ook in supabase kijken" → door Claude nagekeken via de Supabase-koppeling, alleen lezen:
  - V-20: project "takenlijstje" (ref nmorjuafndteklvobrmt) staat in regio **eu-central-1 (Frankfurt)**. ✓ EU.
  - V-04: de extensies pg_cron en pg_net zijn **niet geïnstalleerd**. De planner van elk kwartier staat dus niet aan; de achtergrondtaak draait alleen via `vercel.json` één keer per dag (05:30 UTC). Bevestigt INVENTARIS R-01. Oplossing hoort in het technisch ontwerp.
- V-28 en V-29 (2026-09-28): "Volg voorstel" → V-28 Boodschappen in de onderbalk, Huishouden-overzicht als kaart onderaan Vandaag · V-29 uitgezet = geen toegang tot het huishouden en geen meldingen; account en notities blijven; weer aanzetten herstelt alles.

## Open vragen
- V-30: Accentkleur en app-icoon: rustig diep blauw #2B4C9B in plaats van het felle indigo, icoon in dezelfde tint? Voorstel: ja. Alternatief: huidig indigo en icoon houden — gesteld 2026-09-28 — blokkeert: niets (alleen tokenwaarden).
- V-31: Eigen lettertype Figtree (door de app zelf gehost, 20 KB, geen verbinding met Google)? Voorstel: ja. Alternatief: standaardletter van de telefoon — gesteld 2026-09-28 — blokkeert: niets (alleen tokenwaarden).
- V-32: Planner elke 15 minuten: (a) Supabase Cron in eigen project, gratis, geheim in Vault; (b) Vercel Pro ca. $20/mnd; (c) externe cron-dienst. Voorstel (a) — gesteld 2026-09-28 — blokkeert: WP3.
- V-33: Back-up vóór het wissen: (a) kopie binnen eigen Supabase-project (Frankfurt), 30 dagen bewaren; (b) daarnaast los exportbestand bij Jurgen. Voorstel (a), 30 dagen — gesteld 2026-09-28 — blokkeert: WP2.
- V-34: Naam van schrijver bij notities na verwijderen account/uit huishouden: (a) naam blijft; (b) "Oud-gezinslid". Voorstel (a) — gesteld 2026-09-28 — blokkeert: WP2/WP7.
- V-35: Supabase-inloginstellingen aanpassen (Nederlandse mail wachtwoord vergeten, min. 8 tekens): bouwer via koppeling, anders stappenlijst voor Jurgen. Voorstel: bouwer — gesteld 2026-09-28 — blokkeert: WP7.

## Aannames (expliciet, zonder invloed op rechten/gegevens/scope)
- De bestaande, geteste herhalingsregels (maandeinde, schrikkeljaar, n-de weekdag) zijn correct en blijven ongewijzigd (product-analyst, 2026-09-28).

## Work packages
| WP | Omschrijving | Acceptatiecriteria | Checkpoint | Status |
| --- | --- | --- | --- | --- |
| — | Nog te bepalen na inventarisatie en technisch ontwerp | — | — | — |

## Bevindingen per work package
- Inventarisatie (2026-09-27): zie `docs/INVENTARIS.md` §7. Open BLOKKEREND: B-01 (gezinslid kan open taken van andermans reeks laten verwijderen). GEMIDDELD: B-02, B-03, R-01, R-02, S-01, S-02, A-01, A-02, P-01. Worden na de Design Freeze als eerste work packages behandeld (werkwijze §15 stap 6); geen code gewijzigd.

## Wijzigingsverzoeken (op bevroren documenten)
- (geen)

## Bewust geaccepteerde open punten (alleen met besluit van Jurgen)
- (geen)

## Uitgestelde punten (LAAG/POLISH)
- (geen)

## Technische schuld
- Bestaande documentatie: `docs/ARCHITECTUUR.md` (van vóór dit systeem) wijkt op vier punten af van de code (INVENTARIS §7).
- eslint 9 wordt niet meer ondersteund.
