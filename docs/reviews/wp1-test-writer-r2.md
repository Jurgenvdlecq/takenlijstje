## Tests: WP1, databaselaag (na herstel review, commit e271b26)
Framework: SQL op PostgreSQL 16 + stub | Suite gedraaid: `su postgres -c "cd /home/user/takenlijstje && bash supabase/tests/run.sh"` → **alles groen**: 10_ (45 controles) en 20_ (231 controles) | Mutatiecontrole: **20/20 mutaties gevangen** | E2E: n.v.t. (alleen de databaselaag)

**Nog te doen voor de bouwer:** `supabase/tests/mutatie.sh` staat nog niet in git. De tussenstanden van 10_ en 20_ staan al in git (078cf25c/43548bb); nog een keer committen geeft de eindstand. De tekstcorrectie van AC-014 (Design Freeze opnieuw gegeven) verandert niets aan de tests: die volgden al TD §5.2.

### Gewijzigd in de bestanden
**`supabase/tests/10_rls_and_functions.sql`**
- Ellen wordt nu via een uitnodiging toegevoegd. Ervoor staat een negatieve test: "beheerder koppelt direct een account" moet falen (D-016, security punt 1).
- De twee eerdere aanpassingen blijven staan:
  - een actief lid mag een taak van een ander wijzigen (BR-23, V-13);
  - een lid mag geen melding invoegen (BR-25).

**`supabase/tests/20_rechten_br.sql`**
- **Testleden met account** komen er nu in via `household_invitations` + `accept_invitation`. Ellen wordt beheerder via de rol in de uitnodiging.
- **D-022, verwachtingen aangepast:**
  - Een buitenstaander, een uitgezet lid of iemand zonder huishouden krijgt bij de reeks-RPC's P0002 (vroeger 42501).
  - `delete_task` op een taak van een ander huishouden, een onbekende id of door een uitgezet lid geeft `true` en verandert niets. De controle "er verandert niets" (vingerafdruk van reeks, taken en historie) blijft steeds de kern.
  - Een lid van hetzelfde huishouden zonder recht krijgt nog steeds 42501. Een onbekende reeks geeft P0002.

### Nieuwe regressietests in 20_
- **Security punt 1 (D-016):**
  - Een beheerder die een vreemd account, dat account als beheerder, een onbekende uuid of zijn eigen account nog eens toevoegt, krijgt 42501.
  - Er wordt geen account gekoppeld. Een lid zonder account toevoegen mag wel.
  - Een account koppelen aan een bestaand lid geeft 42501.
  - Een gezinslid dat een lid toevoegt, of zichzelf nog eens, krijgt 42501.
- **Security punt 2 (D-017):**
  - Een gedane taak direct terugzetten naar todo, in_progress of skipped geeft 42501, ook voor een beheerder.
  - Een insert met `completed_at` of `completed_by_member_id` geeft 42501.
  - Daarna opnieuw `complete_task`: nog steeds precies 1 registratie.
- **Security punt 6 (D-021):**
  - Het wijzigen van `task_id`, `requested_by`, `household_id` of `accepted_by`, of het direct zetten van `accepted`, geeft 42501, ook voor een beheerder.
  - Het ruilverzoek blijft ongewijzigd; intrekken mag wel.
- **Code-review 7 (D-027/AC-122):**
  - Pauzeren zet `generated_until` terug naar de dag vóór de pauze.
  - Hervatten maakt `generated_until` leeg.
- **Guard laat FK-cascade door:** de enige beheerder verwijdert zijn huishouden zonder fout, en leden en taken gaan mee weg.
- **D-015 push:** een uitgezet lid dat een apparaat aanmeldt of bijwerkt, krijgt 42501; afmelden mag. Een abonnement op naam van een ander wordt geweigerd.
- **Status `in_progress`:**
  - Een uitvoering die "bezig" is, telt mee als open.
  - Bij stoppen verdwijnt ze ook.

### Mutatiecontrole ("faalt zonder de fix")
- **Nieuw hulpmiddel:** `/home/user/takenlijstje/supabase/tests/mutatie.sh`.
  - Het staat in het project, omdat de poort scripts van buiten het project verbiedt, en het wordt niet door `run.sh` opgepikt.
  - Per mutatie kopieert het de migraties naar een tijdelijke map in /tmp, haalt daar één regel uit en draait de volledige suite.
  - Draaien: `su postgres -c "cd /home/user/takenlijstje && bash supabase/tests/mutatie.sh"`.
- **Uitkomst: 20/20 gevangen.** Dit zijn de weggehaalde regels:
  - rechtencheck in de reeks-RPC's en in `delete_task`;
  - `is_active` in `is_member`;
  - leesbaarheid van de eigen lidrij;
  - verbod op wisselen van reeks;
  - onveranderlijke maker;
  - alleen actieve beheerders tellen;
  - verbod op jezelf uitzetten;
  - insert-policy voor meldingen;
  - oude url-check;
  - D-016, alleen de policy;
  - D-016, policy en guard samen;
  - D-017 op twee plekken;
  - de swap-guard;
  - D-027 bij pauzeren en bij hervatten;
  - FK-cascade in de guard;
  - push-policy;
  - de revoke in `private` (AC-028).
- **Let op:** alleen de INSERT-controle van de guard weghalen (met de policy intact) wordt niet gevangen. De policy weigert dan alsnog met 42501. Dat is verdediging in twee lagen, geen gat in de tests.

### Bevindingen tijdens het testen
- Geen afwijkingen van ontwerp of AC's in de huidige migraties gevonden.
- **[LAAG, ter info]** `delete_task` leest de taak eerst zonder lock en daarna opnieuw `for update`, maar controleert `deleted_at` na de lock niet opnieuw (`20260928000110_reeks_rpcs.sql`, rond de `select … for update` in `delete_task`).
  - **Gevolg:** twee gelijktijdige aanroepen kunnen beide `deleted_at` zetten. De eindtoestand is gelijk, alleen het tijdstip wordt overschreven. Geen dataverlies.
  - Niet getest: gelijktijdigheid is in deze SQL-opzet niet deterministisch te toetsen.

### Nodig van de bouwer
- `supabase/tests/mutatie.sh` committen.

### Conclusie
GO voor de databaselaag: alle WP1-criteria met toets DB zijn gedekt en groen, en de regressietests voor security 1, 2 en 6 en code-review 7 bewijzen dat ze falen zonder de fix. De criteria voor Int, E2E en Unit (AC-004, 009, 018, 023, 024, 029–033) vallen buiten deze opdracht en zijn nog niet gedekt.
