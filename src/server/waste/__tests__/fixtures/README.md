# Fixtures van de huisvuilkalender (W-03)

## `p0-2591BB-87.json` — echte gegevens
- **Herkomst:** probe P0 en U0.2 van 2026-09-29, uitgevoerd met toestemming van Jurgen ("Ja, probeer maar") via `net.http_get` vanuit het live Supabase-project. Verslag: `docs/wijzigingen/W-03/probe/P0-uitkomst.md`.
- **Adres:** alleen het **openbare testadres 2591 BB 87** (uit open-source integraties; geen persoonsgegeven).
- **Ongewijzigde kopie** van `docs/wijzigingen/W-03/probe/fixtures-2591BB-87.json`. Pas dit bestand nooit aan; de tests controleren dat het byte-voor-byte gelijk blijft.
- **Weggelaten bij de probe:** de grote velden `content` (HTML) en `icon_data` (base64-SVG) uit `afvalstromen`. De rest is letterlijk.
- **Indeling per endpoint** (TD §18.1.1): `adres` = A (`/rest/adressen/2591BB-87`), `afvalstromen` = B, `kalender_2026` en `kalender_2027` = C, `adres_onbekend` = A voor een onbekend adres (Rijswijk, `[]`). De test-helper `../bron.ts` splitst het bestand per endpoint.
- Het testadres heeft alleen papier (elke 4 weken, niet tussen 24 november en 20 januari) en kerstbomen; rest en PMD komen niet voor.

## `synthetisch-*.json` — verzonnen gegevens in exact dezelfde vorm (TD §18.1.6)
Gemaakt met `genereer-synthetisch.mjs` (draai: `node src/server/waste/__tests__/fixtures/genereer-synthetisch.mjs src/server/waste/__tests__/fixtures`). Adressen, straten en adrescodes zijn verzonnen.

| Bestand | Scenario |
| --- | --- |
| `synthetisch-rest-papier-pmd.json` | rest wekelijks (di), papier 4-wekelijks (wo), PMD 2-wekelijks (vr), plus GFT en kerstbomen in de agenda (AC-196) |
| `synthetisch-b-groot.json` | zelfde, maar B **met** `content` en `icon_data` (± 20 KB): strippen en grootte |
| `synthetisch-alleen-gft.json` | alleen GFT en kerstbomen (AC-186, `no_streams`) |
| `synthetisch-meerdere-kandidaten.json` | nummer 12 zonder letter, 12A en 12B (AC-187, `choose`) |
| `synthetisch-december-zonder-j1.json` | rest tot en met 29 december, 2027 nog `[]` |
| `synthetisch-januari-leeg.json` | vorig jaar (2026) wel datums, C(2027) alleen kerstbomen: januari zonder rest/papier/PMD |
| `synthetisch-over-3-weken.json` | eerstvolgende dag op 26 oktober, gezien vanaf 5 oktober 2026 (AC-183 b) |
| `synthetisch-verschuiving.json` | `kalender_2026` met 25 december, `kalender_2026_verschoven` met 26 december (AC-198) |
| `synthetisch-leeg.json` | C(J) en C(J+1) `[]` (AC-204 b) |
| `synthetisch-adres-weg.json` | B = `{}` letterlijk zoals U0.2 (AC-204 c, `ADDRESS_GONE`) |
| `synthetisch-j1-alleen-kerstbomen.json` | P0-vorm, C(2027) alleen kerstbomen op 6 en 13 januari (§18.8.4 stap 3, AC-220 c) |

Alleen voor rest en PMD bestaan geen echte voorbeelddata; de parser is voor alle soorten gelijk.
