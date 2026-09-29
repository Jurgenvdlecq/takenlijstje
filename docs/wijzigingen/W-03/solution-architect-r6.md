## Technisch ontwerp: W-03 afvalkalender, ronde 6 (alleen gewijzigde delen)

Ik heb niets in bestanden geschreven. Wat hieronder niet staat, blijft zoals in r4 + r5.

Gelezen: `product-analyst-r4.md` (punt 2) en `product-designer-r4.md` (T-90b, punten voor de architect en de U3-regels).

### Het belangrijkste
- **Alleen het volgende jaar ophalen lost het valse alarm eind november niet op.** Het P0-adres heeft papier tot 24 november. Daarna geeft de kalender voor 2027 `[]` tot de gemeente hem publiceert, meestal in december. Zou "J+1 is leeg" dan nog steeds als verdacht leeg tellen, dan komt er alsnog vals alarm.
- **Daarom heb ik ook een uitzondering voor het jaareinde toegevoegd.** Vanaf november geldt "geen komende datum dit jaar, en volgend jaar nog niet online" niet als storing. De beheerder ziet dan alleen de bestaande stille regel T-73.
- **Wie dit nog moet verwerken:**
  - de designer: de voorwaarde van G″ gaat ook in november gelden. De tekst T-73 zelf klopt al;
  - de analist: BR-52, AC-204 en AC-220.
- Geen vraag voor Jurgen; rechten, privacy en scope blijven gelijk.

---

# Wijzigingen ten opzichte van r5

| # | r5 | r6 | Reden |
| --- | --- | --- | --- |
| 1 | C(J+1) alleen in december | C(J+1) **in december, én zodra C(J) geen komende datum meer heeft**, in welke maand ook | analist-r4, punt 2 |
| 2 | geen komende datum = altijd `SUSPECT_EMPTY` | **uitzondering voor het jaareinde:** vanaf 1 november telt "C(J) heeft wel datums dit jaar, maar geen komende meer, en C(J+1) is leeg" niet als storing. Het is een geslaagde bijwerking met `notice = 'next_year_missing'` (T-73), zonder melding. Buiten november en december, en bij een C(J) die het hele jaar leeg is, blijft het `SUSPECT_EMPTY` | anders geeft een adres met een vroege laatste ophaaldag (P0: 24 november) nog steeds vals alarm, omdat J+1 pas in december online komt |
| 3 | `notice` alleen in december, als het venster tot in januari loopt | `notice` ook in november en december, als er geen enkele komende datum is en J+1 nog leeg is | gevolg van 2 |
| 4 | §18.11: `saved`, `mode: 'enabled'` → T-90 | `inserted > 0` → **T-90** (met Bekijken); `inserted = 0` → **T-90b** (zonder Bekijken) | designer-r4 |
| 5 | U3 zonder T-90b | U3 punt 25 krijgt T-90b; nieuw punt 5a: eerstvolgende dag over 3 weken → C, daarna T-90b | designer-r4 |

---

# Gewijzigde delen van §18

## 18.1.1 Endpoints, rij C, kolom "Gebruik"
"Jaar J altijd. **J+1 in december, en ook zodra C(J) voor rest, papier en PMD geen komende datum meer heeft (in elke maand)**; zolang J+1 niet gepubliceerd is, geeft het 200 `[]`. J−1 alleen bij het instellen in januari, als C(J) geen datum van rest, papier of PMD heeft."

## 18.1.3 Resultaattype, `fetchPickups`
```ts
fetchPickups(bagId, today, deps, opts?: { includePreviousYearIfEmpty?: boolean }):
  SourceResult<{ pickups: WastePickups; unknownStreams: number;
                 hadAnyDate: boolean;      // een datum van rest/papier/pmd in een opgehaald jaar, ook in het verleden
                 hadAnyDateInJ: boolean;   // idem, alleen in jaar J
                 fetchedNextYear: boolean }>
```
**Volgorde:** B en C(J) gaan parallel. C(J+1) wordt daarna opgehaald als het december is, of als C(J) geen komende datum van rest, papier of PMD heeft. In december gaan ze parallel. Daarbuiten gaat het sequentieel, maar alleen in dat ene geval. Alles valt binnen het totaalbudget van 12 s.

Een fout bij C(J+1) (`UNREACHABLE`/`FORMAT`) maakt de hele ophaling `UNREACHABLE`, zoals bij C(J).

## 18.8.1 Opzoeken bij het instellen, stap 2
"B + C(J); C(J+1) volgens §18.1.3; in januari eventueel C(J−1) (r5)."

Stap 3 blijft zoals in r5. Voor het instellen is er **geen** uitzondering voor het jaareinde. Een adres zonder komende datum in J én J+1 krijgt dus `no_upcoming` (F2, T-64). Dat klopt ook eind november: er valt nog niets te plannen, en T-64 zegt al "de kalender van het nieuwe jaar komt meestal eind december online".

## 18.8.4 Regel voor "geen komende ophaaldagen" (vervangt r5)

**Bij het bijwerken bepaalt `classifyEmpty(result, today)` (puur, `plan.ts`) de uitkomst, in deze volgorde:**
1. `hasNoUpcoming(pickups)` is onwaar → gewone uitkomst `success`.
2. `hadAnyDateInJ` is onwaar: het lopende jaar is voor rest, papier en PMD helemaal leeg (bijvoorbeeld op 1 januari zonder nieuwe kalender, of een bron die `[]` geeft) → `failure`, `SUSPECT_EMPTY`.
3. De maand van vandaag (Europe/Amsterdam) is november of december, en C(J+1) is opgehaald en leeg → **`success`, geen storing.** Dit is het jaareinde: de laatste ophaling van dit jaar is al geweest, en de kalender van volgend jaar staat nog niet online.
   - `pickups` wordt bewaard. Die bevat dan geen komende datums, dus er is niets te plannen. Bestaande open taken zijn al verleden tijd en vallen onder BR-54.
   - `notice = 'next_year_missing'` (§18.8.5) zorgt voor de stille regel T-73. Er komt geen melding.
4. In alle andere gevallen (bijvoorbeeld in juni: C(J) heeft alleen datums in het verleden en J+1 is leeg) → `failure`, `SUSPECT_EMPTY`.

**Bij het instellen:** `hasNoUpcoming` geeft `no_upcoming` (F2). Er wordt niets bewaard, en de uitzondering uit stap 3 geldt hier niet (zie §18.8.1).

**Waarom deze regel:**
- J+1 eerder ophalen helpt alleen als de gemeente het nieuwe jaar al gepubliceerd heeft. Dat gebeurt meestal pas in december. Het P0-adres heeft zijn laatste ophaling op 24 november, dus alleen J+1 ophalen zou tussen 24 november en de publicatie nog steeds vals alarm geven.
- November en december zijn de enige maanden waarin "geen komende datum dit jaar" normaal kan zijn.
- Het echte gevaar blijft gedekt: een lege of kapotte bron, en een nieuwe kalender die op 1 januari nog ontbreekt. Dan is C(J) helemaal leeg, en na een uur volgt H2 met T-77a.

**Bewuste grens:** stopt een adres in november of december echt met ophalen (bijvoorbeeld door een ondergrondse container), dan ziet de beheerder alleen T-73 tot 1 januari. Daarna volgt `SUSPECT_EMPTY` en H2. Dat is aanvaardbaar, want er zijn in die periode geen taken die verloren gaan.

**Versimpeltoets:** de eenvoudigste variant is "J+1 altijd ophalen". Die kost twee à drie extra GET's per dag het hele jaar, en lost het probleem toch niet op zolang J+1 leeg is. Gekozen is: J+1 alleen ophalen als het nodig is, plus één uitzondering op maand. Dat is één extra regel in een pure functie, en goed te testen.

## 18.8.5 Gezondheid, december-waarschuwing (vervangt de r4/r5-bullet)
`notice = 'next_year_missing'` als `last_error_code is null`, de bewaarde `pickups` geen datum in J+1 bevatten, en een van deze twee geldt:
- (a) het is december en vandaag + 14 ≥ 1 januari J+1 (zoals in r4);
- (b) het is november of december en er is geen enkele komende datum (het geval uit §18.8.4, stap 3).

Dit wordt alleen getoond bij `state = ok` (G″, T-73). Er komt geen melding.

## 18.11 Van uitkomst naar tekst-ID (vervangt één rij door twee)

| Uitkomst | Toestand | Tekst-ID's | Bewaard? |
| --- | --- | --- | --- |
| `saved`, `mode: 'enabled'`, `inserted > 0` | G + melding onderin | **T-90** (Bekijken → Kalender week); tip T-54 eenmalig | ja |
| `saved`, `mode: 'enabled'`, `inserted = 0` (eerstvolgende ophaaldag verder dan 14 dagen weg) | G + melding onderin | **T-90b** (zonder Bekijken); tip T-54 eenmalig; de datum staat onder Volgende ophaaldagen | ja |

De server geeft `inserted` al terug. De client kiest alleen tussen de twee ID's, en leidt verder niets af.

## 18.13 Performance, aanvulling
C(J+1) buiten december kost één extra GET per ophaling, alleen als C(J) geen komende datum meer heeft (in de praktijk alleen eind november). De budgetten blijven gelijk.

## 18.15 Tests (gewijzigde of nieuwe rijen)

| AC | Unit | DB | Int | E2E |
| --- | --- | --- | --- | --- |
| 183 | — | — | als r4, plus: adres met eerstvolgende dag over 21 dagen → `saved`, `inserted = 0` | invullen → C → aanzetten → **T-90** (met Bekijken); variant "eerstvolgende dag over 3 weken" → C → **T-90b** (zonder Bekijken), 0 afvaltaken |
| 204 | `classifyEmpty`: (a) **P0-fixture op 2026-11-26**: C(2026) alleen datums in het verleden, C(2027) `[]` → `success`, geen `SUSPECT_EMPTY`; (b) dezelfde vorm op 2026-06-15 → `SUSPECT_EMPTY`; (c) 2027-01-01 met C(2027) `[]` → `SUSPECT_EMPTY`; (d) 2026-11-26 met C(2027) met datums → `success` + planning; (e) alle eerdere r5-gevallen | als r4 | fetch-spy: op 2026-11-26 wordt `/kalender/2027` opgehaald; in oktober met komende datums **niet**; tick eind november (P0-vorm) → geen melding, T-73 | als r4 |
| 220 | `notice`: (a) 20 december zonder J+1 = ja; (b) **26 november zonder komende datum en zonder J+1 = ja**; 10 december met een komende datum en een venster vóór januari = nee; met J+1-datums = nee | — | — | G″ met T-73 (december en november) |
| 237 | als r5, plus: instellen op 26 november, P0-vorm, J+1 `[]` → `no_upcoming` (F2, T-64) | — | als r5 | als r5 |

## 18.16 U3: CP-W03, de enige lijst (alleen de gewijzigde punten)
- **Nieuw 5a:** "C bij een adres waarvan de eerstvolgende ophaaldag over 3 weken ligt: C (geen F2), met de datum onder Eerstvolgende ophaaldagen. Daarna 'Ja, aanzetten' → G met melding **T-90b** (zonder Bekijken) en 0 afvaltaken."
- **Punt 25 (meldingen onderin) wordt:** "T-90 (met Bekijken), **T-90b** (zonder Bekijken), T-91, T-92, T-93, T-94".
- **Punt 16 (G″) wordt:** "G″: december (T-73), en eind november zonder komende ophaaldag (T-73)".

## 18.17 r5 → r6
Gelijk aan de wijzigingstabel hierboven.

---

# §15, rij WP3b (aanvulling)
In "Doel en inhoud": "… december-notice, januari-C(J−1) …" wordt "… **J+1 bij december of als C(J) geen komende datum meer heeft; uitzondering voor het jaareinde (november en december) met notice T-73**; januari-C(J−1); `saved.enabled` → T-90/T-90b …". CP-W03 blijft verwijzen naar §18.16 U3.

---

# Punten voor designer en analist
1. **Designer, UX §13.8.1, rij G″ en §13.7.5:**
   - De voorwaarde wordt: "december, als het venster tot in januari loopt; **of** november en december zonder komende ophaaldag terwijl de kalender van volgend jaar nog niet online staat".
   - De tekst T-73 zelf klopt al.
   - In §13.7.5 moet de zin "wordt het venster helemaal leeg, dan volgt H2" worden: "is de kalender van het lopende jaar helemaal leeg (bijvoorbeeld op 1 januari), dan volgt H2".
2. **Analist:**
   - **BR-52 en AC-204 (b):** de uitzondering voor het jaareinde toevoegen: "In november en december is 'de laatste ophaaldag van dit jaar is geweest, en de kalender van volgend jaar staat nog niet online' geen storing. De beheerder ziet dan alleen T-73."
   - **AC-204:** onder "Geen storing zijn" het voorbeeld "het adres met papier tot 24 november, op 26 november" opnemen.
   - **AC-220:** het geval "26 november, geen komende ophaaldag → T-73" toevoegen.
   - **AC-183:** de variant "eerstvolgende dag over 3 weken → aangezet, T-90b, 0 taken" toevoegen (zoals designer-r4 al voorstelt).

### Vragen voor Jurgen
Geen.

### Status
**KLAAR VOOR PLANREVIEW** voor de architect (r4 + r5 + r6), zodra designer en analist de punten hierboven hebben verwerkt.

Bestanden:
- /home/user/takenlijstje/docs/wijzigingen/W-03/product-analyst-r4.md
- /home/user/takenlijstje/docs/wijzigingen/W-03/product-designer-r4.md
- /home/user/takenlijstje/docs/wijzigingen/W-03/solution-architect-r5.md
- /home/user/takenlijstje/docs/wijzigingen/W-03/probe/fixtures-2591BB-87.json
