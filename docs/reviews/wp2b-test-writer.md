## Tests: WP2b (contract-migratie …_210)
Framework: SQL-tests op PostgreSQL (run.sh) + vitest 5 | Suite gedraaid: DB-suite volledig geslaagd (10_, 20_, 30_wp2a, 40_wp2b, gelijktijdig, upgrade _200 en _210) · vitest 202 van 202 geslaagd · `tsc --noEmit` 0 fouten · `eslint tests src/domain/__tests__` 0 meldingen · M0-proef geslaagd (opnieuw gedraaid, ongewijzigd) | E2E: niet door mij gedraaid (afspraak; drie E2E-asserties aangescherpt, zie onder)

**In het kort:** de DB-suite was rood en is nu weer groen. Er kwam één nieuw testbestand bij, de upgrade-test loopt nu ook door …_210, en ik vond geen blokkerende fouten in de productiecode.

**Stand in git:** je hebt tussendoor al gecommit (8eeb4ef, d066522, a98ec10). Alleen de laatste wijziging aan `supabase/tests/mutatie.sh` is nog niet gecommit.

### Dekking acceptatiecriteria en opdrachtpunten
| Criterium | Test | Status |
| --- | --- | --- |
| AC-059 (wat verdwijnt en wat blijft) | upgrade/na_210.sql, op oude, live-achtige gegevens (volgorde: voor_200 → _200 → na_200 → _210) | geslaagd |
| AC-045 (oude RPC's bestaan niet meer) | 40_wp2b.sql "AC-045: …" + 30_wp2a.sql (aanroepen met `p_completed_by` geven 42883, er wordt niets afgevinkt) | geslaagd |
| AC-036/BR-11 (dubbel afvinken = één registratie) | 40_wp2b.sql "BR-11: …" + gelijktijdig.sh race 4 | geslaagd |
| AC-055, 056, 057, 058, 060, 061 | Proces/Live; AC-057/060 via de M0-proef | GEEN DB-TEST (procescontrole), M0 groen |
| Geen leden zonder account | 40_wp2b.sql "WP2b: household_members.user_id is verplicht / lid zonder account toevoegen (ook als systeem)" | geslaagd |
| Eén huishouden per gebruiker | 40_wp2b.sql "BR-44: … (constraint)" | geslaagd |
| Cascade bij verwijderen van een gebruiker | 40_wp2b.sql "cascade: …" (lid, voorkeuren en meldingen weg; notitie houdt de naam; taak, reeks en historie blijven) | geslaagd |
| Eén actieve boodschappenlijst | 40_wp2b.sql (index, systeem, gezinslid, terugzetten, archive/unarchive met de index) | geslaagd |
| Tijdzone vast op Europe/Amsterdam | 40_wp2b.sql "V-39: …" | geslaagd |
| notification_type zonder task_assigned/swap_* | 40_wp2b.sql (precies 6 soorten, 22P02 op de oude soorten) | geslaagd |
| Policy "beheerder voegt toe" weg | 40_wp2b.sql + 20_rechten_br.sql (gezinslid en beheerder krijgen 42501, er blijft geen insert-policy over) | geslaagd |
| undo zonder completed_by | 40_wp2b.sql "undo: …" | geslaagd |
| guard zonder toewijzingsregel | 40_wp2b.sql "guard: …" + een scan: geen enkele functie verwijst nog naar een vervallen kolom, tabel of enumwaarde | geslaagd |
| Privacy-invariant (TD §3.1) | 40_wp2b.sql + na_210.sql | geslaagd |

### Gewijzigd
- **`supabase/tests/10_rls_and_functions.sql`:** de controles op `member_id`, `points` en `completed_by_member_id` zijn eruit. Die kolommen bestaan niet meer; dat ze weg zijn, toetst 40_.
- **`supabase/tests/20_rechten_br.sql`:**
  - "Baby toevoegen" is nu een negatieve test (42501). Daarbij: "beheerder hangt een ander account aan Kai" wordt geweigerd.
  - De update/insert met `completed_by_member_id` is vervangen door "nieuwe taak met status done" (42501).
  - "Kind" in huishouden "Weg" komt er nu via een uitnodiging in, en er is een controle dat de accounts blijven bestaan.
  - **Geschrapt:** het blok "D-021 ruilverzoeken" (7 asserties). Reden: de tabel `task_swap_requests` bestaat niet meer, dus die guard-tests kunnen niets meer toetsen. Dat de tabel weg is, toetst 40_.
- **`supabase/tests/30_wp2a.sql`:**
  - De AC-034-asserties op `member_id`/`points`/`completed_by` zijn eruit; de inhoudscontrole "geen veld verwijst naar Ellen" blijft.
  - Het blok "oude signatuur schrijft geen persoon" (5 asserties) is vervangen door: de oude signatuur, benoemd en positioneel, geeft 42883 en vinkt niets af. De oude asserties vielen weg omdat de functie niet meer bestaat.
  - N2 voor de oude signatuur: vreemd en onbekend geven nu allebei 42883, dus nog steeds geen orakel.
  - De oude bevinding "huishouden direct verwijderen" is verplaatst naar het blok `delete_household`. Die was al opgelost in _200. `supabase/tests/bevindingen/` is daarmee leeg en verwijderd; run.sh gaat daar goed mee om.
- **Upgrade-test:**
  - `upgrade/voor_200.sql`: gegevens erbij met alle vervallen velden gevuld (toewijzing, ruilen, afwezigheid, punten, meldingen van alle soorten, uitnodigingen, boodschappen met "wie", een reeks en taak van Kai) plus een momentopname.
  - `upgrade/na_200.sql`: toetst nu expliciet het tussenstadium (alleen _200): Kai en "wie afvinkte" bestaan nog, de oude RPC's ook.
  - `run.sh`: de upgrade loopt nu _200 → na_200 → _210 → na_210.
- **`supabase/tests/gelijktijdig.sh`:** race 4 erbij: twee leden vinken tegelijk dezelfde taak af, elk met een eigen mutationId → precies één registratie.
- **`supabase/tests/mutatie.sh`:**
  - Mutaties op onderdelen die _210 vervangt (guard, undo, de revoke in private) gelden nu ook voor _210.
  - 4 zinloos geworden mutaties zijn vervangen, met commentaar waarom (ruilverzoek, afvinken met persoon, oude signatuur, insert-policy).
  - De lock-mutaties uit D-037 gaan nu samen met het weghalen van `unique (user_id)`.
  - 17 WP2b-mutaties erbij (16 op _210, plus één op _200 voor de verplaatste huishoudentest). De upgrade-stap volgt dezelfde volgorde als run.sh.
- **E2E en vitest:**
  - `tests/e2e/tasks.spec.ts` en `tests/e2e/wp2a.spec.ts`: `?? null` vervangen door "de sleutel bestaat niet". Dat is strenger na _210. Ik heb deze tests niet gedraaid.
  - `src/domain/__tests__/reminders-recipients.test.ts`: alleen het commentaar aangepast.

### Toegevoegd
- **`supabase/tests/40_wp2b.sql`** (nieuw, ±75 asserties): alle punten uit de opdracht, plus de privacy-invariant, de vervallen kolommen/tabellen/enums en de realtime-publicatie. Dekt ook: historie zonder taak (task_id null) mag meerdere keren bestaan (BR-12). | Faalt zonder fix: ja, gecontroleerd met mutatie.sh (zie onder).
- **`supabase/tests/upgrade/na_210.sql`** (nieuw): AC-059 op oude gegevens.
  - Weg: toewijzingen, ruilverzoeken, afwezigheden, Kai, oude meldingen, de uitnodiging aan Kai.
  - Blijft: aantal historie-rijen, taken, reeksen, notities, boodschappen, leden met account, makers, en de schrijversnaam "Kai".
  - Ook: `updated_at` van taken en reeksen verandert niet door het wissen.
  - Faalt zonder fix: ja, gecontroleerd met mutatie.sh.
- **gelijktijdig.sh race 4.** Faalt zonder fix: ja, gecontroleerd. Op een database zonder `unique (task_id)` en zonder `for update` in `complete_task` gaf hij "2 registraties" en exit 3.

**Mutatiecontrole:** 61 van 62 gevangen, waarvan 16 op _210.
- De ene die niet gevangen werd ("uitnodiging aan lid zonder account blijft") verandert in de praktijk niets: de FK `household_invitations.member_id` is `on delete cascade`, dus het wissen van de leden neemt die uitnodigingen al mee. Ik heb die mutatie daarna uit de lijst gehaald, met uitleg in het commentaar.
- De volledige mutatie-run heb ik daarna niet opnieuw gedraaid. Het weghalen raakt de andere mutaties niet.
- Let op: de twee lock-mutaties uit D-037 worden nu eerst gevangen door de controle "unique (user_id) bestaat", niet meer door de gelijktijdigheidstest. Beide beveiligingen zijn dus getoetst, maar op verschillende plekken.

### Bevindingen tijdens het testen (niet zelf gefixt)
- **[LAAG]** `docs/TECHNICAL_DESIGN.md` §3.1 noemt ✚ `tasks_open_sched_idx (scheduled_date) where status in ('todo','in_progress') and deleted_at is null`.
  - Probleem: die index staat nog in geen enkele migratie (_210 heeft hem niet, en §3.2 noemt hem daar ook niet).
  - Gevolg: de tick zou zonder index over alle taken scannen.
  - Verbetering: meenemen in WP3 (`…_300`), of in DECISIONS vastleggen waar hij komt.
- **[LAAG / info]** `supabase/migrations/20260928000210_scope_contract.sql:24`.
  - Probleem: `delete … where member_id is not null and accepted_at is null` doet in de praktijk niets extra's: de FK-cascade doet dit al. Wel wist hij ook open uitnodigingen die aan een lid **met** account gekoppeld waren. Dat is iets breder dan BR-46.3.
  - Gevolg: onschadelijk; op live was het aantal 0 (M1).
  - Verbetering: geen actie nodig. Eventueel in DECISIONS noteren.
- Verder niets in de productiecode gevonden. De scan op functiebronnen vond geen verwijzing meer naar een vervallen kolom, tabel of enumwaarde. Dat is belangrijk, omdat PL/pgSQL zo'n fout pas bij het uitvoeren meldt.

### Nodig van de bouwer
- Niets. Wel graag: de E2E draaien met de drie aangescherpte asserties (tasks.spec.ts en wp2a.spec.ts), en `supabase/tests/mutatie.sh` committen.

### Conclusie
GO — elk punt uit de opdracht heeft een DB-test, alles is groen (DB-suite, vitest, typecheck, lint, M0), en alle nieuwe tests vallen aantoonbaar om als de bijbehorende regel uit _210 verdwijnt. Voorbehoud: de E2E heb ik niet gedraaid.

Relevante bestanden:
- /home/user/takenlijstje/supabase/tests/40_wp2b.sql
- /home/user/takenlijstje/supabase/tests/upgrade/na_210.sql
- /home/user/takenlijstje/supabase/tests/upgrade/voor_200.sql
- /home/user/takenlijstje/supabase/tests/upgrade/na_200.sql
- /home/user/takenlijstje/supabase/tests/10_rls_and_functions.sql
- /home/user/takenlijstje/supabase/tests/20_rechten_br.sql
- /home/user/takenlijstje/supabase/tests/30_wp2a.sql
- /home/user/takenlijstje/supabase/tests/gelijktijdig.sh
- /home/user/takenlijstje/supabase/tests/mutatie.sh
- /home/user/takenlijstje/supabase/tests/run.sh
- /home/user/takenlijstje/tests/e2e/tasks.spec.ts
- /home/user/takenlijstje/tests/e2e/wp2a.spec.ts
