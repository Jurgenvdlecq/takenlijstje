# Voortgang — Takenlijstje

Kwaliteitsniveau: 3
Reden niveau: Bestaande app die live en publiek bereikbaar is (takenlijstje.vercel.app), met login, uitnodigingslinks, meerdere gebruikers per huishouden, een Supabase-database en persoonsgegevens van gezinsleden (namen, afwezigheid/vakanties, meldingen). Dat zit tussen niveau 2 (dagelijks gebruikt, meerdere gebruikers, database, login) en niveau 3 (publiek bereikbaar, persoonsgegevens, belangrijke authenticatie en isolatie tussen huishoudens). Bij twijfel het hogere niveau. Jurgen kan bewust verlagen met `/niveau 2`.
Fase: Inrichting afgerond — volgende fase: bestaand project onder het systeem brengen (werkwijze §15, stap 1: inventariseren)
Volgende stap: Jurgen bevestigt het niveau (of verlaagt met `/niveau 2`); daarna `docs/INVENTARIS.md` schrijven: huidige implementatie lezen, bestaande tests draaien en screenshots van de huidige schermen maken in `docs/screenshots/bestaand/`.

## Capabilities
- Poort: `node .claude/gate/test-gate.mjs` → 97 geslaagd, 0 mislukt (2026-09-27). `gate.mjs status`: productiecode geblokkeerd (nog geen Design Freeze), niveau-2-signalen gevonden: `supabase/**`, pakket `@supabase/`, pakket `pg`, `.env.example: SUPABASE_`.
- Screenshots: bewezen op 2026-09-27 met Playwright/Chromium 141.0.7390.37. Op `capability-390x844.png` zag ik zelf (via Read): een smal staand beeld, bovenste helft felblauw met in het midden de witte vetgedrukte tekst "CAPABILITY OK", onderste helft oranje-geel. Ook `capability-1440x900.png` bekeken: hetzelfde beeld in breed formaat, tekst gecentreerd. Screenshot-driven development geldt als bewezen.
- Apparaten en viewports (uit discovery): nog niet vastgesteld. README noemt "dagelijks gebruik op je telefoon" — te bevestigen in discovery.

## Besluiten van Jurgen
<!-- De poort voegt hier automatisch /design-go, /niveau en /onderhoud-go toe. -->

## Antwoorden van Jurgen
- (nog geen)

## Open vragen
- V-01: Klopt niveau 3, of wil je bewust niveau 2 (`/niveau 2`)? — gesteld op 2026-09-27 — blokkeert: omvang van de ontwerp- en reviewfase.

## Aannames (expliciet, zonder invloed op rechten/gegevens/scope)
- (geen)

## Work packages
| WP | Omschrijving | Acceptatiecriteria | Checkpoint | Status |
| --- | --- | --- | --- | --- |
| — | Nog te bepalen na inventarisatie en technisch ontwerp | — | — | — |

## Bevindingen per work package
- (nog geen)

## Wijzigingsverzoeken (op bevroren documenten)
- (geen)

## Bewust geaccepteerde open punten (alleen met besluit van Jurgen)
- (geen)

## Uitgestelde punten (LAAG/POLISH)
- (geen)

## Technische schuld
- Bestaande documentatie: `docs/ARCHITECTUUR.md` (van vóór dit systeem). Wordt meegenomen in de inventarisatie.
