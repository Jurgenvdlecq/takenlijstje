# Architectuur

## Uitgangspunten

1. **Eenvoudig aan de voorkant, sterk aan de achterkant.** De schermen tonen weinig keuzes. De database en de domeinlogica regelen de rest.
2. **De database is de laatste verdediging.** RLS, check constraints, samengestelde foreign keys en triggers gelden ook als iemand de app omzeilt.
3. **Domeinlogica is puur.** `src/domain` bevat geen I/O, is volledig getest en is herbruikbaar in een latere native app of een AI-assistent.
4. **Iedere actie is idempotent.** Acties die offline in de wachtrij stonden, kunnen veilig opnieuw verstuurd worden:
   - afvinken via `client_mutation_id`;
   - nieuwe taken en boodschappen via id's die de client zelf genereert.

## Datastroom

```
Browser                          Server (Next.js)                 Supabase
───────                          ────────────────                 ────────
HouseholdProvider (snapshot) ──► Server Actions (zod + rechten) ─► PostgreSQL + RLS
  • optimistisch bijwerken         • services/scheduling            • RPC: complete_task,
  • offline-wachtrij (IndexedDB)   • notifications/dispatcher         undo, ruilen, uitnodigen
  • cache (IndexedDB)            ◄─ /api/cron/tick (15 min) ◄───── pg_cron / extern
  • Realtime-abonnement  ◄──────────────────────────────────────── Realtime (RLS)
```

- **Lezen:**
  - De server laadt bij de eerste weergave één *snapshot* per huishouden (`src/lib/data/snapshot.ts`): taken van ~6 weken terug tot ~10 weken vooruit, reeksen, historie, boodschappen en meldingen.
  - De browser ververst die snapshot bij realtime-wijzigingen, bij terugkeren naar de app en na acties.
- **Schrijven:**
  - Snelle acties (afvinken, verplaatsen, toewijzen, boodschappen) lopen via `mutate()` in `src/features/household/store.tsx`. Die voert de actie direct optimistisch uit, of zet hem offline in de wachtrij.
  - Overige acties lopen via `run()`: een server action met foutmelding en daarna verversen.

## Terugkerende taken

- Een **reeks** (`task_recurrences`) bevat:
  - de regel (JSON: `{freq, interval, weekdays | monthDay | nth+weekday | month}`);
  - het deadline-venster (`available_days_before`, `due_days_after`, `due_time`);
  - de verdeling (vast, om en om, willekeurig, eerlijk) en een eventuele pauze.
- De planner (`src/domain/scheduling/plan.ts`) maakt concrete **taken** (`tasks`) aan voor de komende 14 dagen. Valt er in die periode niets, dan alleen de eerstvolgende. De unieke sleutel `(recurrence_id, occurrence_date)` voorkomt dubbel inplannen.
- **Om en om** is deterministisch. Het volgnummer van de uitvoering bepaalt wie aan de beurt is, zodat opnieuw plannen de volgorde niet verstoort. Afwezigen worden overgeslagen.
- **Eerlijk verdelen** kijkt naar de afgeronde punten van de laatste 28 dagen plus de al ingeplande open taken.
- Wijzigen van **"alleen deze"** zet `is_exception = true`, zodat opnieuw plannen die taak niet overschrijft.
- Wijzigen van **"deze en toekomstige"** past de reeks aan en plant alles na deze taak opnieuw in.
- Een **verlopen** taak wordt automatisch *overgeslagen* zodra de volgende uitvoering van dezelfde reeks beschikbaar is. Zo stapelen verlopen taken zich niet op, bijvoorbeeld bij de dagelijkse vaatwasser.
- **Historie:** iedere uitvoering komt in `task_completions` (wie, wanneer, te laat of niet, punten, notitie). Die rij blijft bestaan als de taak of reeks later wordt verwijderd.

## Databaseschema

Alle tabellen hebben een UUID als sleutel en een `household_id`.

| Tabel | Inhoud |
|---|---|
| `users` | Profiel per inlogaccount (1-op-1 met `auth.users`) |
| `households` | Naam, tijdzone, rechten voor gezinsleden, puntendoel |
| `household_members` | Persoon in een huishouden (met of zonder account): naam, kleur, emoji, rol (beheerder/gezinslid), actief |
| `household_invitations` | Uitnodigingslinks (token, optioneel gekoppeld aan een bestaand gezinslid, verloopt na 14 dagen) |
| `task_templates` | Bibliotheek met standaardtaken (globaal of per huishouden) |
| `task_recurrences` | Terugkerende reeksen: regel, deadline-venster, verdeling, pauze, horizon |
| `tasks` | Concrete taken: status, prioriteit, toegewezen, geplande dag en tijd, beschikbaar vanaf, deadline, duur, punten, herinneringen |
| `task_assignments` | Historie van (her)toewijzingen en de reden (handmatig, rotatie, eerlijk, ruil, afwezigheid) |
| `task_swap_requests` | Ruilverzoeken ("Ik kan deze taak niet doen") |
| `task_completions` | Onveranderlijke historie van uitvoeringen |
| `task_comments` | Notities bij taken |
| `member_absences` | Afwezigheid, met strategie: opnieuw verdelen, doorschuiven of vrijgeven |
| `notifications` | In-app meldingen, met `dedupe_key` tegen dubbele herinneringen |
| `push_subscriptions` | Web Push-abonnementen per apparaat |
| `user_preferences` | Meldingsvoorkeuren per gezinslid |
| `shopping_lists` / `shopping_items` | Boodschappenlijsten (archiveerbaar) en producten |

### Rechten (RLS)

- Lezen mag alleen binnen je eigen huishouden (`private.is_member`).
- Een beheerder beheert gezinsleden, uitnodigingen en instellingen.
- Een gezinslid mag:
  - taken afvinken (alleen via `complete_task()`);
  - opmerkingen plaatsen;
  - taken toevoegen, als het huishouden dat toestaat;
  - aan anderen toewijzen, als het huishouden dat toestaat (`guard_task_changes`);
  - het eigen profiel aanpassen, maar niet de eigen rol (`guard_member_changes`).
- De laatste beheerder kan niet worden gedegradeerd of verwijderd.
- Meldingen, pushabonnementen en voorkeuren zijn per persoon afgeschermd.
- De service-role wordt alleen gebruikt voor systeemtaken: inplannen, cron en pushmeldingen versturen. Die filtert altijd expliciet op `household_id`.

## Meldingen

`src/server/notifications/dispatcher.ts`:
1. controleert de voorkeuren van de ontvanger;
2. slaat de melding op (in-app, via realtime direct zichtbaar);
3. stuurt hem via de ingeschakelde kanalen.

Een nieuw kanaal (FCM, e-mail, WhatsApp) implementeert `NotificationChannel`. De cron (`services/tick.ts`) berekent met `src/domain/reminders.ts` welke meldingen aan de beurt zijn: herinnering, deadline nadert, verlopen, dagoverzicht en avondoverzicht.
