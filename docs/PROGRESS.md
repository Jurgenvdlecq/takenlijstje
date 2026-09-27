# Voortgang — Takenlijstje

Kwaliteitsniveau: 2
Reden niveau: Door Jurgen bewust vastgezet op 2026-09-27 met `/niveau 2` ("bestaand project, meerdere gebruikers"). Eerder voorstel was niveau 3 (live, publiek bereikbaar, persoonsgegevens); Jurgen koos niveau 2. Security-review blijft verplicht vanwege login, meerdere gebruikers en persoonsgegevens.
Fase: Bestaand project onder het systeem brengen (werkwijze §15) — stap 1 inventarisatie grotendeels afgerond; screenshots van ingelogde schermen ontbreken nog
Volgende stap: Antwoorden van Jurgen op V-02 t/m V-04 verwerken; zodra V-03 is opgelost de ingelogde schermen vastleggen in `docs/screenshots/bestaand/`; daarna §15 stap 3: product-analyst start met `docs/PRODUCT_SPEC.md` op basis van `docs/INVENTARIS.md` §2 (overgenomen besluiten).

## Capabilities
- Poort: `node .claude/gate/test-gate.mjs` → 97 geslaagd, 0 mislukt (2026-09-27). `gate.mjs status`: productiecode geblokkeerd (nog geen Design Freeze), niveau-2-signalen gevonden: `supabase/**`, pakket `@supabase/`, pakket `pg`, `.env.example: SUPABASE_`.
- Screenshots: bewezen op 2026-09-27 met Playwright/Chromium 141.0.7390.37. Op `capability-390x844.png` zag ik zelf (via Read): een smal staand beeld, bovenste helft felblauw met in het midden de witte vetgedrukte tekst "CAPABILITY OK", onderste helft oranje-geel. Ook `capability-1440x900.png` bekeken: hetzelfde beeld in breed formaat, tekst gecentreerd. Screenshot-driven development geldt als bewezen.
- Apparaten en viewports (uit discovery): nog niet vastgesteld. README noemt "dagelijks gebruik op je telefoon" — te bevestigen in discovery.

## Besluiten van Jurgen
- 2026-09-27T20:43 — Jurgen zet het kwaliteitsniveau op 2 (bestaand project, meerdere gebruikers)
<!-- De poort voegt hier automatisch /design-go, /niveau en /onderhoud-go toe. -->

## Antwoorden van Jurgen
- V-01 (2026-09-27): Klopt niveau 3, of wil je bewust niveau 2? → `/niveau 2 bestaand project, meerdere gebruikers`

## Open vragen
- V-02: `PLAN.md` bestaat niet in de repository of de git-geschiedenis. Staat het ergens anders, of mogen README.md en docs/ARCHITECTUUR.md als vastgelegde besluiten gelden? — gesteld op 2026-09-27 — blokkeert: niets direct; bepaalt het uitgangspunt van de productspecificatie.
- V-03: Screenshots van de ingelogde schermen zijn niet gelukt (live site niet bereikbaar vanuit deze omgeving; lokale inlogserver starten geweigerd door de omgevingsbeveiliging). Opties: (a) Jurgen staat het starten van de lokale teststack toe, (b) Jurgen levert zelf screenshots van zijn telefoon aan, (c) de omgeving krijgt toegang tot takenlijstje.vercel.app plus een testaccount. — gesteld op 2026-09-27 — blokkeert: visuele beoordeling van het bestaande ontwerp.
- V-04: Staat pg_cron (elke 15 minuten) aan in het Supabase-productieproject? Zo niet, dan draait de achtergrondtaak maar één keer per dag (INVENTARIS R-01). — gesteld op 2026-09-27 — blokkeert: niets direct; relevant voor het technisch ontwerp.

## Aannames (expliciet, zonder invloed op rechten/gegevens/scope)
- (geen)

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
