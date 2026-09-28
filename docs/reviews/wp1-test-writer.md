## Tests: WP1 — Rechtenmodel en securityfixes (databaselaag)
Framework: SQL-tests op kale PostgreSQL 16 + stub (run.sh-opzet) | Suite gedraaid: 10_ groen; 20_ faalt op precies 1 assertie (AC-028, echte bug in de migratie, zie Bevindingen). Tegen een scratchkopie van de migraties waarin alleen die ene bug is verholpen: 10_ en 20_ allebei volledig groen | E2E: n.v.t. (opdracht was de DB-laag)

### Eerst: twee procespunten van de poort (belangrijk)
1. **Ik kon `supabase/tests/**` niet schrijven.** Het pad staat niet in de schrijfrechten van test-writer in `.claude/gate/gate.config.json`. Toegestaan zijn alleen `**/*.test.*`, `tests/**`, `**/fixtures/**` enz. TD §13 schrijft juist deze plek voor. Ik heb de poort niet omzeild. De bestanden staan klaar in mijn scratchpad en moeten door de hoofdsessie worden geplaatst:
   - `/tmp/claude-0/-home-user-takenlijstje/692a0963-bcf7-518f-8e91-2ea8d7ce7c8b/scratchpad/tests/10_rls_and_functions.sql` → overschrijft `supabase/tests/10_rls_and_functions.sql`
   - `/tmp/claude-0/-home-user-takenlijstje/692a0963-bcf7-518f-8e91-2ea8d7ce7c8b/scratchpad/tests/20_rechten_br.sql` → nieuw bestand `supabase/tests/20_rechten_br.sql`
   Voorstel: test-writer via `/onderhoud-go` (Jurgen) schrijfrecht geven op `supabase/tests/**`.
2. **Hoe ik de tests heb gedraaid.** Ik gebruikte een kopie van run.sh in de scratchpad (`run-scratch.sh`, zelfde stappen, eigen database `takenlijstje_scratch`, via `su postgres -c "bash /tmp/.../run-scratch.sh"`). De poort liet dat door. Bij de mutatiecontrole weigerde de poort daarna expliciet: "rol 'test-writer' mag geen scripts van buiten het project uitvoeren". Daarop ben ik gestopt. Eerlijk gezegd vallen mijn eerdere runs vermoedelijk onder dezelfde regel, maar herkende de poort ze niet omdat ze in `su -c` zaten. Dat is een gat in de poort. De projectbestanden en migraties heb ik niet aangeraakt.

### Gewijzigd in 10_rls_and_functions.sql (2 plekken, allebei door het nieuwe ontwerp)
- r.110–112: "Taak van een ander wijzigen raakt niets (RLS filtert)" is omgedraaid naar "actief lid wijzigt taak van een ander". **Reden:** BR-23 (V-13), AC-013 en TD §5.2: de update-policy is nu `is_member()`.
- Meldingenblok: een lid dat een melding invoegt, is nu een negatieve test. De twee testmeldingen worden als systeem ingevoegd (`reset role`). **Reden:** BR-25/B-03 en AC-016: er is geen insert-policy meer voor authenticated.
- Toewijzing, ruilen, "undo namens een kind zonder account", punten en laatste beheerder zijn ongewijzigd gebleven en slagen met de nieuwe migraties.

### Dekking acceptatiecriteria (DB-laag)
| Criterium | Test (20_rechten_br.sql) | Status |
| --- | --- | --- |
| AC-001 | "AC-001: gezinslid stopt andermans reeks" (42501) + vingerafdruk van reeks, taken en historie ongewijzigd, 2 open, reeks actief | geslaagd |
| AC-002 | pause_series / resume_series door gezinslid → 42501, niets veranderd | geslaagd |
| AC-003 | delete_task 'future' door gezinslid → 42501, alle open uitvoeringen bestaan nog | geslaagd |
| AC-004 | GEEN TEST (Int/E2E: server action `updateTaskAction`; DB-deel is gedekt via AC-005 en de directe update op de reeks = 0 rijen) | — |
| AC-005 | clear_series_occurrences (ook met periode en uitzonderingen) → 42501, aantal open ongewijzigd | geslaagd |
| AC-006 | maker stopt eigen reeks: inactief, open weg, afvinking blijft; ook pauzeren, hervatten en delete 'future' eigen reeks | geslaagd |
| AC-007 | Ellen pauzeert, hervat, ruimt op en stopt Lynns reeks (+ BR-09: uitzondering blijft bij pauze) | geslaagd |
| AC-008 | maker uitgezet (Kai) en maker verwijderd (Noor, FK → null): Lynn 42501, beheerder slaagt; de reeks loopt door | geslaagd |
| AC-009 | GEEN TEST (Int: `expectRows`); DB-kant "stille weigering = 0 rijen" wel getoetst | — |
| AC-010 | instelling uit: losse taak en reeks → 42501, geen rij aangemaakt; koppelen aan eigen reeks geweigerd | geslaagd |
| AC-011 | instelling aan: taak en reeks aangemaakt, Lynn is de maker | geslaagd |
| AC-012 | Lynn: delete_task en directe delete op Ellens taak geweigerd; eigen taak weg; beheerder mag; met historie wordt het een zachte verwijdering | geslaagd |
| AC-013 | Lynn wijzigt de titel van Ellens taak en verplaatst een uitvoering van Jurgen (is_exception) → reeks ongewijzigd | geslaagd (ook in 10_) |
| AC-014 | maker (taak en reeks, ook door een beheerder), household_id, aanmaken op naam van een ander → 42501 | geslaagd |
| AC-015 | status done / completed_at direct → 42501 (ook beheerder); via complete_task wel | geslaagd |
| AC-016 | insert notifications als lid (zelf of huisgenoot) en als beheerder → 42501 | geslaagd (ook in 10_) |
| AC-017 | als systeem: `//x.nl`, `/\x.nl`, `https://x.nl`, `''` → 23514; `/?taak=<id>`, `/` en null wel; de check geldt ook bij een update | geslaagd |
| AC-019 | alleen **actieve** beheerders tellen: degraderen → 23514, zichzelf uitzetten of verwijderen → 42501; Solo-huishouden | geslaagd |
| AC-020 | eigen rol, status en user_id → 42501; eigen naam en kleur mag; een ander wijzigen of verwijderen = 0 rijen | geslaagd |
| AC-021 | beheerder zet zichzelf uit of verwijdert zichzelf (met tweede beheerder) → 42501 | geslaagd |
| AC-022 | Kai uitgezet: 0 rijen in elke tabel met household_id (dynamische lus) + households, users, leden = alleen de eigen rij; my_membership() is_active=false; complete, undo, stop, pause, clear → 42501; delete_task → P0002; insert taak of boodschap geweigerd | geslaagd |
| AC-025 | weer aanzetten → huishouden, taken, eigen melding en voorkeuren weer zichtbaar | geslaagd |
| AC-026 | Bas: 0 rijen van Familie in elke tabel (lus), geen leden of profielen | geslaagd |
| AC-027 | Bas: RPC's 42501/P0002, FK-fout bij verwijzen, update/delete = 0 rijen, vingerafdruk ongewijzigd | geslaagd |
| AC-028 | privileges van elke functie in `private` (alleen de 7 helpers voor authenticated, niets voor anon) + directe aanroep van de guards → 42501 | **GEFAALD op de echte migratie** (bug hieronder); geslaagd met de fix |
| AC-018, 023, 024, 029–033, 170 | GEEN TEST: Unit/Int/E2E/Lint/Proces, buiten deze opdracht | — |

Extra (TD §5.2): de Reekskoppeling-regel in 4 gevallen (a: zonder aanmaakrecht aan eigen reeks; b: aan andermans reeks, via update en via insert; c: beheerder en maker ontkoppelen of wisselen; d: reeks verwijderd → FK null) plus de toegestane route "losse taak wordt terugkerend", en occurrence_date alleen voor de beheerder van de reeks. Verder: notities (plaatsen namens een ander geweigerd, verwijderen eigen of beheerder), huishoudinstellingen alleen door een beheerder, deleted_at alleen via delete_task, idempotente delete_task, rechtencheck vóór invoercontrole, uitgezette maker kan de eigen reeks of taak niet meer beheren, anon kan de nieuwe RPC's niet aanroepen en authenticated wel.

### Toegevoegd
- `20_rechten_br.sql`: 772 regels, eigen accounts (`20000000-…-a1..a8`) en eigen huishoudens Familie, Buren en Solo, dus onafhankelijk van 10_. Hulpfuncties: `expect_sqlstate` (controleert de exacte SQLSTATE), `rows()` voor stille weigeringen, en `reeks_fp()` (security definer), een vingerafdruk van de reeks met haar taken en historie voor "er verandert niets".
- **Faalt zonder fix:** voor AC-028 aangetoond: de test faalt op de huidige migratie en slaagt met de fix. De overige tests heb ik **niet** met mutaties gecontroleerd, omdat de poort dat blokkeerde (zie hierboven). Het script staat klaar: `/tmp/claude-0/-home-user-takenlijstje/692a0963-bcf7-518f-8e91-2ea8d7ce7c8b/scratchpad/mutate.py`. Het draait de suite tegen 11 gemuteerde kopieën: rechtencheck weg uit clear, delete_task of stop; is_member zonder is_active; reekswissel toegestaan; oude url-check; uitgezette beheerders meetellen; maker wijzigbaar; insert-policy voor notificaties terug; zelf uitzetten toegestaan; eigen lidrij onleesbaar. Elke mutatie hoort een ERROR te geven. De hoofdsessie kan het draaien.

### Bevindingen tijdens het testen
- **[GEMIDDELD]** `supabase/migrations/20260928000100_rechten_actief_lid.sql:91` tegenover `:213`. De `revoke execute on all functions in schema private from public, anon, authenticated` staat vóór `create or replace function private.guard_recurrence_changes()`. Die functie is nieuw en krijgt dus de standaard EXECUTE voor PUBLIC. **Verwacht** (AC-028, TD §5.2 B-04): geen execute voor authenticated of anon. **Werkelijk:** `has_function_privilege('authenticated', 'private.guard_recurrence_changes()', 'EXECUTE') = true`. Een directe aanroep geeft daardoor 0A000 ("trigger functions can only be called as triggers") in plaats van 42501. Het praktische risico is klein, maar het criterium wordt niet gehaald en het patroon komt terug bij elke nieuwe functie. **Verbetering:** zet de revoke/grant aan het eind van de migratie, of voeg `revoke execute on function private.guard_recurrence_changes() from public, anon, authenticated;` toe. Overweeg ook `alter default privileges in schema private revoke execute on functions from public;`. Eén regel achteraan migratie 110 maakte in mijn kopie alles groen.
- **[LAAG]** TD §5.2 zegt voor een uitgezet lid "push: alleen verwijderen". De policy `"push: eigen abonnementen"` (for all, `user_id = auth.uid()`, uit `…000200_rls.sql`) is in WP1 niet aangepast, dus een uitgezet lid kan nog eigen push-abonnementen toevoegen of wijzigen. De dispatcher filtert op is_active, dus er gaat niets verstuurd worden. Ik heb dit alleen gelezen, niet met een test aangetoond (draaien was geblokkeerd). Testvoorstel voor na de fix: als Kai (uitgezet) `insert into push_subscriptions (user_id, endpoint, p256dh, auth) values (:'u_kai','https://p.example/x','k','a')` → geweigerd; `delete` → toegestaan.
- **[LAAG, spec]** AC-014 noemt `occurrence_date` onveranderlijk voor "iemand", maar TD §5.2 (Reekskoppeling) staat het toe voor wie de reeks beheert (nodig voor "deze en volgende"). Ik heb de TD gevolgd: gezinslid geweigerd, beheerder/maker toegestaan. Graag in DECISIONS.md vastleggen dat de TD hier voorgaat.
- **[LAAG]** `delete_task` geeft `true` voor een onbekende id maar `P0002` voor een bestaande taak van een ander huishouden. Hetzelfde geldt voor de reeks-RPC's: P0002 tegenover 42501. Zo valt het bestaan van een uuid af te leiden. Omdat uuid's niet te raden zijn, is de impact minimaal. Ter info voor security-review.

### Nodig van de bouwer
- Beide testbestanden uit de scratchpad plaatsen in `supabase/tests/` (de poort blokkeert mij).
- De AC-028-bug in migratie 100/110 herstellen (zie boven), daarna `su postgres -c "cd /home/user/takenlijstje && bash supabase/tests/run.sh"`: dan hoort alles groen te zijn.
- Optioneel: `mutate.py` draaien om te bevestigen dat de tests falen zonder de fixes.
- De schrijfrechten van test-writer en het `su -c`-gat voorleggen aan Jurgen (onderhoud van de poort).

### Conclusie
NO-GO — AC-028 faalt op de huidige migratie (`guard_recurrence_changes` is aanroepbaar voor authenticated/anon). Alle andere WP1-criteria op de DB-laag zijn gedekt en groen. Na die ene revoke-regel en het plaatsen van de bestanden verwacht ik GO voor de DB-laag. De Int/E2E/Unit-criteria van WP1 (AC-004, 009, 018, 023, 024, 029–033) zijn hiermee niet gedekt.
