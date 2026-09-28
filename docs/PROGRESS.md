# Voortgang — Takenlijstje

Kwaliteitsniveau: 2
Reden niveau: Door Jurgen bewust vastgezet op 2026-09-27 met `/niveau 2` ("bestaand project, meerdere gebruikers"). Eerder voorstel was niveau 3 (live, publiek bereikbaar, persoonsgegevens); Jurgen koos niveau 2. Security-review blijft verplicht vanwege login, meerdere gebruikers en persoonsgegevens.
Fase: Bestaand project onder het systeem brengen (werkwijze §15) — stap 3: productspecificatie ronde 1 geschreven, wacht op antwoorden V-05 t/m V-20
Volgende stap: product-analyst werkt `docs/PRODUCT_SPEC.md` bij met de antwoorden V-05 t/m V-22 (grote scopevereenvoudiging: geen toewijzing/verdeling/ruilen/punten); daarna product-designer (UX_SPEC + wireframes). V-04 en V-20 blijven open tot Jurgen Supabase nakijkt.

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
- V-04 (2026-09-28): Staat pg_cron aan in Supabase? → "Geen idee, hoe check ik dat?" (uitleg gegeven, antwoord nog open)
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
  - Nog open: V-04 (pg_cron) en V-20 (Supabase-regio): beide vragen dat Jurgen iets in Supabase nakijkt.

## Open vragen
- V-04 (uitleg gegeven op 2026-09-28, wacht op controle door Jurgen): Staat pg_cron (elke 15 minuten) aan in het Supabase-productieproject? Zo niet, dan draait de achtergrondtaak maar één keer per dag (INVENTARIS R-01). — gesteld op 2026-09-27 — blokkeert: niets direct; relevant voor het technisch ontwerp.
- V-20: Staat het Supabase-productieproject in een EU-regio? — Jurgen kijkt na in Project Settings — blokkeert: technisch ontwerp.

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
