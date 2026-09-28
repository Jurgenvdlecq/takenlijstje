# Voortgang — Takenlijstje

Kwaliteitsniveau: 2
Reden niveau: Door Jurgen bewust vastgezet op 2026-09-27 met `/niveau 2` ("bestaand project, meerdere gebruikers"). Eerder voorstel was niveau 3 (live, publiek bereikbaar, persoonsgegevens); Jurgen koos niveau 2. Security-review blijft verplicht vanwege login, meerdere gebruikers en persoonsgegevens.
Fase: Bestaand project onder het systeem brengen (werkwijze §15) — stap 3: productspecificatie ronde 1 geschreven, wacht op antwoorden V-05 t/m V-20
Volgende stap: Antwoorden van Jurgen op V-04 t/m V-20 letterlijk vastleggen, product-analyst opnieuw aanroepen om `docs/PRODUCT_SPEC.md` bij te werken; daarna product-designer (UX_SPEC + wireframes).

## Capabilities
- Poort: `node .claude/gate/test-gate.mjs` → 97 geslaagd, 0 mislukt (2026-09-27). `gate.mjs status`: productiecode geblokkeerd (nog geen Design Freeze), niveau-2-signalen gevonden: `supabase/**`, pakket `@supabase/`, pakket `pg`, `.env.example: SUPABASE_`.
- Screenshots: bewezen op 2026-09-27 met Playwright/Chromium 141.0.7390.37. Op `capability-390x844.png` zag ik zelf (via Read): een smal staand beeld, bovenste helft felblauw met in het midden de witte vetgedrukte tekst "CAPABILITY OK", onderste helft oranje-geel. Ook `capability-1440x900.png` bekeken: hetzelfde beeld in breed formaat, tekst gecentreerd. Screenshot-driven development geldt als bewezen.
- Lokale teststack (op toestemming van Jurgen, V-03): `tests/e2e/support/local-stack.sh` met zelf gebouwde Supabase Auth in de scratchpad, plus `scripts/seed.ts`. Werkt; realtime ontbreekt (bekend).
- Apparaten en viewports (uit discovery): nog niet vastgesteld. README noemt "dagelijks gebruik op je telefoon" — te bevestigen in discovery.

## Besluiten van Jurgen
- 2026-09-27T20:43 — Jurgen zet het kwaliteitsniveau op 2 (bestaand project, meerdere gebruikers)
<!-- De poort voegt hier automatisch /design-go, /niveau en /onderhoud-go toe. -->

## Antwoorden van Jurgen
- V-01 (2026-09-27): Klopt niveau 3, of wil je bewust niveau 2? → `/niveau 2 bestaand project, meerdere gebruikers`
- V-02 (2026-09-28): PLAN.md bestaat niet; mogen README.md en docs/ARCHITECTUUR.md als vastgelegde besluiten gelden? → "Dat is goed"
- V-03 (2026-09-28): Hoe komen we aan screenshots van de ingelogde schermen? (a) lokale teststack starten, (b) eigen screenshots, (c) toegang live site → "Eerste optie"
- V-04 (2026-09-28): Staat pg_cron aan in Supabase? → "Geen idee, hoe check ik dat?" (uitleg gegeven, antwoord nog open)

## Open vragen
- V-04 (uitleg gegeven op 2026-09-28, wacht op controle door Jurgen): Staat pg_cron (elke 15 minuten) aan in het Supabase-productieproject? Zo niet, dan draait de achtergrondtaak maar één keer per dag (INVENTARIS R-01). — gesteld op 2026-09-27 — blokkeert: niets direct; relevant voor het technisch ontwerp.
- V-05 … V-20 (gesteld 2026-09-28, uit `docs/PRODUCT_SPEC.md` ronde 1; details en voorstellen daar bij de `[OPEN: V-nr]`-markeringen):
  - Doelgroep en gebruik: V-05 alleen eigen gezin of open registratie · V-06 gezinssamenstelling en leeftijden · V-07 apparaten/viewports · V-08 meerdere huishoudens per persoon
  - Rechten: V-09 wie mag reeksen wijzigen/stoppen · V-10 afvinken namens een ander · V-11 afvinking later terugdraaien · V-12 automatische verdeling door gezinslid · V-13 losse taak wijzigen/verwijderen
  - Accounts en privacy: V-14 wachtwoord vergeten / Google-Apple-tekst · V-15 account/huishouden verwijderen · V-18 bewaartermijnen · V-20 Supabase-regio (EU?)
  - Meldingen en planning: V-16 meldingen voor taken van een kind zonder account · V-17 afwezigheid verwijderen na verwerking
  - Succes: V-19 belangrijkste probleem en succescriteria
  — blokkeert: UX-ontwerp (kern: V-05, V-06, V-07, V-09, V-12, V-13) en technisch ontwerp (V-15, V-18, V-20, V-04).

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
