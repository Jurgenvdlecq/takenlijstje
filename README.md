# 🏡 Takenlijstje

**Live:** https://takenlijstje.vercel.app

Een eenvoudige, moderne webapp (PWA) om huishoudelijke taken te plannen, eerlijk te verdelen en af te vinken, gemaakt voor dagelijks gebruik op je telefoon.

Bij het openen zie je direct:
- wat jij vandaag moet doen;
- wat de rest moet doen;
- wat er al gedaan is;
- wat achterloopt.

Afvinken, toevoegen, wijzigen, verplaatsen en toewijzen kost maximaal twee tikken.

## Wat zit erin (MVP)

| Onderdeel | Wat je kunt |
|---|---|
| **Vandaag** (dashboard) | Begroeting, samenvatting (vandaag, voltooid, open, verlopen, eerstvolgende deadline), snelle invoerbalk, secties Verlopen · Vandaag · Binnenkort · Mijn taken · Iedereen |
| **Taken** | Zoeken en filteren op persoon, categorie, status, prioriteit, terugkerend en periode |
| **+ Taak** | Minimaal: *Naam · Wie? · Wanneer?*. Slimme invoer ("Badkamer zaterdag Jurgen"). Onder "Meer instellingen": categorie, deadline, tijd, duur, punten, herinnering, herhaling en verdeling |
| **Terugkerende taken** | Dagelijks, elke X dagen, vaste weekdagen, elke X weken, maandelijks (ook "eerste zaterdag"), jaarlijks. Wordt automatisch vooruit ingepland. Pauzeren (bijv. gras maaien 1 nov–1 mrt). Wijzigen van "alleen deze" of "deze en toekomstige" taken |
| **Verdeling** | Vaste persoon, om en om, willekeurig of eerlijk (op basis van taakbelasting: 5 min = 1 punt, 30 min = 3, 60 min = 6) |
| **Afvinken** | Eén tik met animatie. De historie legt vast wie, wanneer en of het op tijd of te laat was. "Ongedaan maken" blijft een paar seconden beschikbaar |
| **Ruilen** | "Ik kan deze taak niet doen": terugzetten, iemand anders kiezen of een ruilverzoek sturen. Een huisgenoot tikt dan op "Overnemen" |
| **Kalender** | Dag, week en maand. Taken verslepen naar een andere dag. Herhalingen zijn herkenbaar en worden ook verder vooruit getoond |
| **Boodschappen** | Snel toevoegen ("2 melk"), automatische categorie, afvinken, suggesties "vaak gekocht", lijst archiveren. Vanuit een notitie bij een taak direct op de lijst zetten |
| **Huishouden** | Per persoon: open, gedaan, verlopen, taakbelasting en voortgang. Weekstatistieken, meest gedane en meest vergeten taak. Optioneel een puntendoel ("100 punten → filmavond") |
| **Meldingen** | In-app en Web Push: toegewezen, herinnering, deadline nadert, verlopen, voltooid, ruilverzoek, dag- en avondoverzicht. Per persoon in te stellen |
| **Afwezigheid** | Vakantie invoeren; taken in die periode worden opnieuw verdeeld, doorgeschoven of op "niet toegewezen" gezet |
| **Onboarding** | In 5 stappen: naam huishouden, gezinsleden, standaardtaken, frequentie en verdeling |
| **Accounts** | E-mail + wachtwoord, magic link en uitnodigen via een link ("Jurgen nodigt je uit voor Huishouden Van der Lecq") |
| **Offline** | Eerder geladen gegevens blijven zichtbaar. Afvinken en boodschappen werken offline en worden daarna automatisch gesynchroniseerd, zonder dubbele registratie |
| **Realtime** | Vinkt Ellen iets af, dan ziet Jurgen enkele seconden later "“Boodschappen doen” gedaan door Ellen" |

## Techniek

- **Frontend:** Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS 4 en componenten in shadcn/ui-stijl (Radix)
- **Backend:** Next.js Server Actions en Supabase (PostgreSQL, Auth, Realtime)
- **Beveiliging:**
  - Row Level Security op iedere tabel.
  - Samengestelde foreign keys per huishouden, zodat een rij nooit naar een ander huishouden kan verwijzen.
  - Zod-validatie in iedere server action.
  - Afvinken loopt via een database-functie; daardoor klopt de historie altijd.
- **PWA:** manifest, service worker (offline en push) en Web Push via VAPID
- **Tests:**
  - Vitest voor de domeinlogica.
  - SQL-tests voor RLS en database-functies.
  - Playwright voor end-to-end tests.

Een uitgebreidere beschrijving van architectuur en databaseschema staat in [`docs/ARCHITECTUUR.md`](docs/ARCHITECTUUR.md).

```
src/
  domain/          Pure logica, zonder framework en volledig getest:
                   herhalingen, deadlines, verdeling, snelle invoer, statistieken, herinneringen
  server/
    actions/       Server actions (validatie → rechten → database)
    services/      Planning, afwezigheid, cron ("tick")
    notifications/ Meldingen: voorkeuren, in-app en Web Push (kanalen uitbreidbaar)
  features/        Schermen per onderdeel (dashboard, taken, kalender, boodschappen …)
  components/      Gedeelde UI (knoppen, vensters, avatar, app-schil)
  lib/             Supabase-clients, validatie, offline-opslag, labels
  integrations/    Uitbreidingspunten voor agenda's, smart home, WhatsApp/e-mail en AI
supabase/
  migrations/      SQL-migraties (schema, RLS, functies, standaardtaken)
  tests/           Databasetests (RLS/isolatie, afvinken, ruilen, uitnodigingen)
  cron/            Optioneel: pg_cron-planning voor herinneringen
scripts/seed.ts    Voorbeelddata ("Familie" met Jurgen, Ellen, Lynn en Kai)
tests/e2e/         Playwright-tests + lokale testopstelling zonder Docker
```

## Lokaal draaien

### 1. Vereisten
- Node.js 20.9 of nieuwer
- Een Supabase-project. Kies een van deze twee:
  - **Online:** maak een gratis project op [supabase.com](https://supabase.com). Kies bij voorkeur regio *EU (Frankfurt)*, omdat de app persoonsgegevens van je gezin bevat.
  - **Lokaal:** installeer de [Supabase CLI](https://supabase.com/docs/guides/cli) met Docker en voer `supabase init` en daarna `supabase start` uit. De bestaande `supabase/migrations` worden gebruikt.

### 2. Installeren
```bash
npm install
cp .env.example .env.local   # en vul de waarden in (zie hieronder)
```

### 3. Database inrichten
- **Supabase online:** migraties gaan alleen via de Supabase-koppeling (`apply_migration`), niet via `supabase db push`: de versienummers op live wijken af van de bestandsnamen (docs/DECISIONS.md, D-040).
  - Of plak de bestanden uit `supabase/migrations/` op volgorde in de SQL editor.
- **Supabase lokaal:** voer `supabase db reset` uit. Dit draait alle migraties.

Zet daarna in Supabase onder **Authentication → URL Configuration**:
- de *Site URL* op je app-URL (lokaal `http://localhost:3000`);
- `http://localhost:3000/auth/callback` bij de *Redirect URLs*.

### 4. Voorbeelddata (optioneel)
```bash
npm run seed           # maakt huishouden "Familie"
npm run seed -- --reset  # opnieuw beginnen
```
Log daarna in met `jurgen@example.com`, `ellen@example.com` of `lynn@example.com`. Het wachtwoord is **`Welkom123!`**. Kai is een kind zonder account; zijn taken worden namens hem afgevinkt.

### 5. Starten
```bash
npm run dev    # http://localhost:3000
```
Zonder voorbeelddata maak je een account aan via "Nieuw". De onboarding begeleidt je daarna.

## Omgevingsvariabelen

Zie [`.env.example`](.env.example).

| Variabele | Waarvoor |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Verbinding met Supabase (Project Settings → API) |
| `SUPABASE_SERVICE_ROLE_KEY` | **Alleen server-side.** Voor inplannen, herinneringen en pushmeldingen. Nooit in de browser gebruiken |
| `NEXT_PUBLIC_SITE_URL` | Publieke URL; gebruikt in magic links en uitnodigingen |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` / `VAPID_SUBJECT` | Web Push. Genereer met `npx web-push generate-vapid-keys` |
| `CRON_SECRET` | Beveiligt `/api/cron/tick` |

## Pushmeldingen en herinneringen

1. Vul de VAPID-sleutels in.
2. Zet in de app onder **Instellingen → Meldingen** "Pushmeldingen op dit apparaat" aan.
   - Op de **iPhone** moet je de app eerst via Delen → **Zet op beginscherm** installeren (iOS 16.4 of nieuwer).
3. Herinneringen, deadline-waarschuwingen en het dag- en avondoverzicht worden verstuurd door `/api/cron/tick`. Roep die endpoint iedere 15 minuten aan met de header `Authorization: Bearer $CRON_SECRET`. Dat kan op drie manieren:
   - **Supabase:** zet de extensies `pg_cron` en `pg_net` aan en voer [`supabase/cron/schedule-tick.sql`](supabase/cron/schedule-tick.sql) uit (vul URL en geheim in);
   - of **Vercel Cron** (let op: het gratis plan draait maar één keer per dag);
   - of een externe dienst zoals cron-job.org.

## Deployen (Vercel)

1. Push de repository naar GitHub en importeer hem in [Vercel](https://vercel.com).
2. Zet alle variabelen uit `.env.example` onder *Environment Variables*. Zet `NEXT_PUBLIC_SITE_URL` op je productie-URL.
3. Voeg in Supabase de productie-URL toe als *Site URL* en `https://<jouw-domein>/auth/callback` als *Redirect URL*.
4. Plan de cron (zie hierboven).
5. Tip: pas in Supabase de e-mailtemplates aan naar het Nederlands.

Elk ander platform dat Next.js 16 draait (Node.js 20.9 of nieuwer) werkt ook.

## Testen

```bash
npm run test         # unit tests domeinlogica (Vitest)
npm run typecheck    # TypeScript
npm run lint         # ESLint
npm run test:db      # migraties + RLS/functietests op een lokale PostgreSQL (psql nodig)
npm run test:e2e     # Playwright end-to-end (app + Supabase moeten draaien)
```

### End-to-end tests
De Playwright-tests (`tests/e2e/*.spec.ts`) lopen de belangrijkste stromen door. Ze gebruiken een mobiel scherm en de voorbeelddata.
- inloggen en het dashboard;
- afvinken en ongedaan maken;
- snelle invoer;
- een terugkerende taak aanmaken;
- ruilen;
- boodschappen;
- een notitie naar de boodschappenlijst;
- offline afvinken met synchronisatie;
- een nieuw account met onboarding, inclusief de controle dat je niets van een ander huishouden ziet.

```bash
npm run build && npx next start -p 3100 &
E2E_RESEED=1 npm run test:e2e     # E2E_RESEED=1 zet de voorbeelddata vooraf opnieuw neer
```

Zonder Docker kun je een mini-Supabase opzetten met `tests/e2e/support/local-stack.sh`. Die gebruikt:
- een lokale PostgreSQL;
- een gecompileerde [Supabase Auth](https://github.com/supabase/auth)-binary;
- een kleine REST-testgateway.

Realtime ontbreekt in die opstelling. Zie de toelichting boven in dat script.

## Veiligheid en privacy

- Gebruikers zien nooit gegevens van een ander huishouden. RLS en samengestelde foreign keys dwingen dat af in de database; `supabase/tests` test dit.
- Wachtwoorden worden alleen door Supabase Auth beheerd; de app slaat ze nooit zelf op.
- Alle invoer wordt server-side gevalideerd (zod), en de database controleert nog eens met check constraints.
- Rechten worden server-side gecontroleerd. Zo mag een gezinslid zichzelf geen beheerder maken, en een taak alleen aan een ander toewijzen als het huishouden dat toestaat.
- Logs bevatten alleen actienamen en foutcodes, geen invoer of persoonsgegevens.
- Na uitloggen worden de lokaal opgeslagen offline-gegevens gewist.

## Na de MVP

De architectuur is voorbereid op de volgende uitbreidingen; zie `src/integrations/types.ts`:
- **AI:** taakvoorstellen ("de badkamer wordt meestal iedere 7 dagen gedaan"), slimme planning en een huishoudassistent die acties uitvoert via de bestaande server actions.
- **Koppelingen:** Google, Apple en Outlook Calendar; Home Assistant, Homey, Alexa, Google Home en Siri; WhatsApp, e-mail en Firebase Cloud Messaging.
- **Inloggen met Google/Apple:** aanzetten in Supabase Auth; de callback-route bestaat al.
- **Native app:** de domeinlogica (`src/domain`) en de database zijn los van de UI te gebruiken vanuit een React Native- of Swift/Kotlin-app.
