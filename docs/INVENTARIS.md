# Inventaris — Takenlijstje (bestaand project)

Datum: 2026-09-27 · Kwaliteitsniveau: 2 (vastgezet door Jurgen) · Werkwijze §15, stap 1.
Status: inventarisatie. Er is geen productiecode gewijzigd en er zijn geen functies gebouwd.

## 1. Uitgangspunt en bronnen

- **`PLAN.md` bestaat niet.** Het staat niet in de repository, niet in de git-geschiedenis en niet op de branch `claude/household-tasks-webapp-e7drrc`. Als uitgangspunt voor de bestaande besluiten gebruik ik daarom:
  - `README.md` (functies, MVP-tabel, veiligheid, tests);
  - `docs/ARCHITECTUUR.md` (uitgangspunten, datastroom, terugkerende taken, schema).

  Die besluiten neem ik over en vraag ik niet opnieuw (zie §2). Zie V-02 in `docs/PROGRESS.md`: bestaat `PLAN.md` ergens anders?
- **Bronnen voor deze inventaris:**
  - eigen leeswerk van de code;
  - twee verkenningsrapporten (frontend en backend);
  - zelf gedraaide controles (§4);
  - zelf bekeken screenshots (§5).

  De belangrijkste bevinding over beveiliging (B-01) heb ik zelf in de code nagelezen. Punten gemarkeerd met *(te bevestigen)* komen uit het verkenningsrapport en worden in de security- en code-review nog getoetst.

## 2. Overgenomen besluiten (uit README en ARCHITECTUUR)

Deze gelden als uitgangspunt voor het nieuwe ontwerp.

| Onderwerp | Besluit |
| --- | --- |
| Product | PWA voor huishoudtaken, bedoeld voor dagelijks gebruik **op de telefoon** |
| Openingsscherm | Direct zichtbaar: wat jij vandaag moet doen, wat de rest moet doen, wat al gedaan is en wat achterloopt |
| Snelheid | Afvinken, toevoegen, wijzigen, verplaatsen en toewijzen kost maximaal twee tikken |
| Nieuwe taak | Minimaal *Naam · Wie? · Wanneer?*, met slimme invoer ("Badkamer zaterdag Jurgen"). De rest staat onder "Meer instellingen" |
| Herhaling | Dagelijks, elke X dagen, weekdagen, elke X weken, maandelijks (ook "eerste zaterdag") en jaarlijks. Pauzeren is mogelijk. Wijzigen kan voor "alleen deze" of "deze en toekomstige" |
| Verdeling | Vast, om en om (deterministisch), willekeurig of eerlijk. "Eerlijk" rekent met taakbelasting (5 min = 1 punt, 30 = 3, 60 = 6) en kijkt 28 dagen terug |
| Afvinken | Eén tik. De historie (wie, wanneer, op tijd of te laat) blijft onveranderlijk bestaan. Ongedaan maken kan een paar seconden |
| Ruilen | "Ik kan deze taak niet doen": terugzetten, iemand anders kiezen of een ruilverzoek sturen |
| Overige functies | Kalender (dag/week/maand, slepen), boodschappen, overzicht van het huishouden met puntendoel, meldingen (in-app en Web Push), afwezigheid |
| Architectuur | Eenvoudig aan de voorkant en sterk aan de achterkant. De database is de laatste verdediging (RLS, constraints, triggers). De domeinlogica is puur en getest. Acties zijn idempotent. Offline wachtrij en optimistisch bijwerken |
| Techniek | Next.js 16, React 19, Supabase (PostgreSQL, Auth, Realtime), Tailwind 4, Radix, Vercel |

## 3. Wat er is

### Schermen (route → inhoud)

| Route | Inhoud |
| --- | --- |
| `/` Vandaag | Begroeting, samenvatting, snelle invoer. Secties Verlopen, Vandaag en Binnenkort, tabs Mijn taken en Iedereen, puntendoel (`src/features/dashboard/`) |
| `/taken` | Zoeken, snelfilters, filtervenster, groepen per dag (`src/features/task-list/`) |
| `/kalender` | Dag, week en maand. Slepen met dnd-kit. Toekomstige herhalingen als "spookjes" (`src/features/calendar/`) |
| `/boodschappen` | Snel toevoegen, categorieën, "Vaak gekocht", afronden (`src/features/shopping/`) |
| `/huishouden` | Statistieken per periode en per persoon, inzichten, afwezig (`src/features/household-overview/`) |
| `/meldingen` | Ruilverzoeken en meldingen (`src/features/notifications/`) |
| `/instellingen` | Eén lange pagina: profiel, meldingen en push, afwezigheid, huishouden, gezinsleden, terugkerend, standaardtaken, account |
| `/login` | Tabs: Inloggen (wachtwoord), Via e-mail (magic link), Nieuw (registreren) |
| `/onboarding` | Wizard van 5 stappen voor een nieuw huishouden |
| `/invite/[token]` | Uitnodiging accepteren |
| `/offline` | Fallbackpagina |

Taakdetail, nieuwe taak, bewerken, "kan niet", pauzeren en de keuze "alleen deze of ook toekomstige" zijn dialogen zonder eigen URL.

- **App-schil** (`src/components/app-shell.tsx`):
  - kopbalk met iconen voor boodschappen, meldingen en instellingen;
  - onderbalk met Vandaag, Taken, een zwevende +, Kalender en Huishouden;
  - offlinebalk.

### Techniek en gegevens

- **Database:**
  - 17 tabellen, met RLS op alle tabellen.
  - Samengestelde foreign keys `(id, household_id)` houden huishoudens gescheiden.
  - Unieke sleutels maken acties idempotent: afvinken, reeksen en meldingen.
  - Triggers bewaken wijzigingen aan rollen en status.
  - Migraties staan in `supabase/migrations/`.
- **Autorisatie:**
  - De proxy (`src/proxy.ts`) stuurt bezoekers zonder sessie naar `/login`.
  - `requireMember()` en `requireAdmin()` staan in `src/server/context.ts`.
  - Daarna controleert RLS nog eens.
- **Server actions:**
  - taken, huishouden, meldingen en boodschappen (`src/server/actions/`);
  - alle invoer wordt gevalideerd met zod.
- **Achtergrondtaak** `/api/cron/tick`:
  - vult reeksen aan;
  - slaat verlopen taken over;
  - verstuurt herinneringen en meldingen.

  De tick is beveiligd met `CRON_SECRET`.
- **Offline:** service worker (`public/sw.js`), een cache van de snapshot in IndexedDB en een wachtrij (`src/lib/offline/outbox.ts`).
- **Design system:**
  - Tailwind 4 met oklch-tokens en statuskleuren (verlopen, vandaag, klaar), in `src/app/globals.css`;
  - UI-kit in `src/components/ui/`;
  - systeemfonts, en dark mode alleen via de systeeminstelling.

## 4. Controles (zelf gedraaid op 2026-09-27)

| Controle | Resultaat |
| --- | --- |
| `npm ci` | Geslaagd (531 pakketten; waarschuwing: eslint 9 niet meer ondersteund) |
| Unit-tests `npx vitest run` | **7 bestanden, 110 tests geslaagd** |
| Typecheck `npm run typecheck` | **Geen fouten** |
| Lint `npm run lint` | **0 fouten, 4 waarschuwingen**, alle in `.claude/gate/gate.mjs` en `scripts/visual-check.mjs` (poortbestanden, niet in de app) |
| Databasetests `npm run test:db` (lokale PostgreSQL 16) | **Geslaagd**: alle migraties plus de RLS- en functietests |
| E2E-tests `npm run test:e2e` (9 tests) | **Niet gedraaid**, zie §5 |

- **Wat de tests afdekken:**
  - domeinlogica: toewijzing, herhaling, status, snelle invoer;
  - kalendermodel, boodschappen parsen en meldingstekst;
  - in de database: isolatie tussen huishoudens, rechten, idempotent afvinken, ongedaan maken, ruilen, laatste beheerder, uitnodigingen.
- **Wat niet is getest:**
  - `src/server/**` (actions, planning, tick, dispatcher), `snapshot.ts`, `reminders.ts` en `stats.ts`;
  - in de database: RLS voor uitnodigingen en afwezigheid, rechten bij pauzeren en stoppen, `members_can_create_tasks=false`;
  - in E2E: uitnodigingen, instellingen en leden, afwezigheid, push en cron.

## 5. Screenshots van de huidige schermen

In `docs/screenshots/bestaand/`, op 390×844 (telefoon) en 1440×900. Lokaal gedraaid met `next dev`, zonder backend. Alle screenshots zijn met Read bekeken.

| Screenshot | Wat ik zie |
| --- | --- |
| `login-390x844.png` | Blauw app-icoon met een huisje, de titel "Takenlijstje" en de ondertitel "Samen het huishouden op orde, zonder gedoe.". Daaronder een witte kaart met drie tabs (Inloggen, Via e-mail, Nieuw), velden voor e-mailadres en wachtwoord, en een brede blauwe knop "Inloggen". Rustig en netjes, wel vrij standaard |
| `login-1440x900.png` | Hetzelfde, gecentreerd in een smalle kolom. Veel lege ruimte, maar dat past bij een inlogscherm |
| `offline-390x844.png` | Icoon van een doorgestreepte wolk, "Je bent offline" en een korte uitleg. Correct en eenvoudig |
| `uitnodiging-ongeldig-390x844.png` | Rode waarschuwingsdriehoek met "Deze uitnodiging is ongeldig of verlopen", uitleg waar een nieuwe link te halen is, en de knop "Naar de app". Duidelijke foutstaat |

- **Niet vastgelegd:** alle schermen na het inloggen (Vandaag, Taken, Kalender, Boodschappen, Huishouden, Meldingen, Instellingen, Onboarding). Daarvoor is een werkende inlogserver met voorbeelddata nodig.
- **Waarom het niet lukte:**
  - De live site (`takenlijstje.vercel.app`) is vanuit deze omgeving niet bereikbaar: de verbinding werd geweigerd en er kwamen alleen witte pagina's terug. Die heb ik weggegooid.
  - De lokale mini-Supabase uit `tests/e2e/support/local-stack.sh` heeft een zelf gebouwde Supabase Auth-server nodig. Het starten daarvan is door de beveiliging van deze omgeving geweigerd, omdat het code van buitenaf is.
- **Gevolg:** de visuele beoordeling van de bestaande hoofdschermen ontbreekt nog. Oplossingen staan bij V-03 in `docs/PROGRESS.md`.

## 6. Wat werkt (aangetoond)

- Alle unit-tests, de typecheck, lint (de app zelf) en de databasetests zijn groen.
- De databaselaag is sterk:
  - RLS op alle tabellen;
  - isolatie tussen huishoudens is getest;
  - afvinken is idempotent;
  - de historie is onveranderlijk;
  - de laatste beheerder is beschermd.
- De functies uit de README zijn in de code vrijwel allemaal aanwezig (zie §7 voor wat gedeeltelijk is).
- Het inlogscherm, de offlinepagina en de foutstaat van een uitnodiging renderen zonder console-fouten.

## 7. Bekende gaten

### Beveiliging en autorisatie

- **B-01 — BLOKKEREND (zelf nagelezen)**: `stopSeriesAction` (`src/server/actions/tasks.ts:365-373`) verandert de reeks via de gewone databaseverbinding, zodat RLS geldt. Mag de gebruiker dat niet, dan raakt die update stil 0 rijen: `check()` in `src/server/errors.ts:63` kijkt alleen naar fouten, niet naar het aantal rijen. Daarna verwijdert `clearOpenOccurrences` met de systeemsleutel (`systemDb`, die RLS omzeilt) toch alle open taken van de reeks.
  - **Gevolg:** elk gezinslid kan open taken van andermans terugkerende reeks laten verdwijnen.
  - **Vermoedelijk hetzelfde patroon** *(te bevestigen)* in `deleteTaskAction` bij "deze en toekomstige" (r.330-334) en in `updateTaskAction` bij future (r.268-269, 298-307).
- **B-02 — GEMIDDELD** *(te bevestigen)*: `createTask` met automatische verdeling "eerlijk" of "willekeurig" (`src/server/services/tasks.ts:172`) schrijft de taak met de systeemsleutel. Daarmee omzeilt het de instelling "gezinsleden mogen taken maken" en de bewakingstrigger.
- **B-03 — GEMIDDELD**: het ene deel is nagelezen, het andere nog niet.
  - *Nagelezen:* elk lid mag meldingen met vrije titel en link bij huisgenoten plaatsen (`supabase/migrations/20260927000200_rls.sql:391`). De controle `url ~ '^/'` laat ook `//andere-site.nl` door. De service worker (`public/sw.js:92`) maakt daar met `new URL(url, origin)` een externe adres van.
  - *Te bevestigen:* of een zo'n melding ook via push of een klik in de app echt naar buiten leidt.
- **B-04 — LAAG** *(te bevestigen)*:
  - Een lid kan een niet-toegewezen taak aanpassen, inclusief de maker, en krijgt zo verwijderrecht.
  - Afvinken namens een ander lid is mogelijk, dus punten kunnen aan iemand anders worden toegeschreven.
  - Alle functies in schema `private` zijn uitvoerbaar door ingelogde gebruikers.
- **B-05 — LAAG**: `/api/status` is zonder login bereikbaar. Het toont geen geheimen, wel of de configuratie compleet is.
- **Ontbrekende accountfuncties:**
  - Er is geen "wachtwoord vergeten", terwijl inloggen met een wachtwoord wel kan.
  - De onboarding noemt Google en Apple, maar die manier van inloggen bestaat niet.

### Betrouwbaarheid en achtergrondtaken

- **R-01 — GEMIDDELD**: `vercel.json` draait de tick **één keer per dag** (05:30 UTC). ARCHITECTUUR.md gaat uit van elke 15 minuten. Zonder pg_cron (`supabase/cron/schedule-tick.sql`) komen herinneringen en waarschuwingen voor deadlines dus hooguit één keer per dag. Of pg_cron in productie aan staat, is niet bekend (V-04).
- **R-02 — GEMIDDELD** *(te bevestigen)*: de tick loopt één voor één over alle huishoudens, met veel losse queries per taak en per melding (N+1) en zonder tijdslimiet. Bij groei kan de functie een time-out krijgen.
- **R-03 — LAAG**: niet idempotent zijn:
  - ruilverzoek (sleutel met `Date.now()`);
  - afwezigheid;
  - boodschappenlijst archiveren;
  - uitnodiging maken;
  - standaardtaken activeren.

  Dat wijkt af van het uitgangspunt "iedere actie is idempotent".

### States en foutafhandeling

- **S-01 — GEMIDDELD**: er is geen `loading.tsx`, `error.tsx`, `not-found.tsx` of `global-error.tsx`. Bij een databasefout verschijnt de standaardfoutpagina van Next.js, en bij een trage verbinding een wit scherm. De `Skeleton`-component wordt nergens gebruikt.
- **S-02 — GEMIDDELD**: in de kalender buiten het geladen bereik (−42 tot +70 dagen) staat stil "Niets gepland", zonder uitleg.
- **S-03 — LAAG**:
  - Een fout bij het laden van notities wordt stil genegeerd.
  - Meldingen zijn begrensd op 60, zonder "meer laden".
  - Het huishoudoverzicht heeft geen lege staat.
  - Actieve filters bij Taken zijn niet zichtbaar en er is geen knop om ze te wissen.
- **S-04 — LAAG**: offline naar een nooit bezochte pagina gaan toont het dashboard onder een andere URL, in plaats van `/offline` (`public/sw.js:67`).

### Toegankelijkheid

- **A-01 — GEMIDDELD**: in de taakkaart zit een knop in een ander klikbaar element (`task-card.tsx:87-104`).
- **A-02 — GEMIDDELD**: de kalender is alleen met slepen te bedienen, niet met het toetsenbord (`calendar-view.tsx:86-89`).
- **A-03 — LAAG**:
  - Het zoekveld bij Taken heeft geen label.
  - Het ongelezen-stipje heeft geen rol voor schermlezers.

### Visueel en design system

- **D-01 — LAAG**:
  - `theme_color` in het manifest (#4f46e5) wijkt af van de themakleur in de layout (#faf9f6).
  - De dark-modetokens staan dubbel in `globals.css`.
  - Er is een hardgecodeerde kleur in `app-shell.tsx:51`.
  - Veel losse chipknoppen, zonder gedeelde component.
- **D-02**: de visuele kwaliteit van de hoofdschermen is **nog niet beoordeeld**, omdat daar geen screenshots van zijn (§5). Het inlogscherm is netjes maar generiek.

### Prestaties

- **P-01 — GEMIDDELD** *(te bevestigen)*: bij elke realtime-wijziging, in 8 tabellen, laadt elk verbonden apparaat na 400 ms de complete snapshot opnieuw. Die bestaat uit 11 queries en tot 3000 taken plus 3000 afvinkingen.

### Documentatie tegenover code

- "Alle tabellen hebben een `household_id`": niet waar voor `users` en `push_subscriptions`, en bij `task_templates` is het optioneel.
- "Iedere actie is idempotent": zie R-03.
- "Elke 15 minuten": zie R-01.
- "Service role alleen voor systeemtaken": zie B-01 en B-02.

### Overig

- Dode code: `src/integrations/registry.ts` en `types.ts` (bewust leeg gelaten voor later), en `Skeleton`.
- eslint 9 wordt niet meer ondersteund.

## 8. Behouden / Herwerken / Vervangen

Volgt in **stap 4** van §15, nadat het nieuwe product-, UX-, visuele en technische ontwerp er is. Voorlopige indruk, **nog geen besluit**:

- **Waarschijnlijk behouden:**
  - datamodel en RLS-basis;
  - domeinlogica (`src/domain`, goed getest);
  - offline-wachtrij en idempotent afvinken;
  - schermindeling op hoofdlijnen.
- **Waarschijnlijk herwerken:**
  - autorisatie rond de systeemsleutel (B-01, B-02, B-03);
  - schema van de tick (R-01);
  - globale laad- en foutstates (S-01);
  - toegankelijkheid van de taakkaart en de kalender.
- **Nog onbekend:** de visuele laag. Daarvoor zijn eerst screenshots van de ingelogde schermen nodig.
