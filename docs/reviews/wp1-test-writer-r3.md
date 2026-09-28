## Tests: WP1, overige criteria (Unit / Int / E2E) + herreview-regressies

**Stand:** unit, typecheck en lint zijn groen. E2E: 39 geslaagd, 3 gefaald, 1 overgeslagen. De 3 rode tests (N1, N2, N4) zijn regressietests voor c6ddff7, en de draaiende app op :3100 is daar nog niet mee gebouwd. Ze falen daar zoals je zonder de fix zou verwachten. Het bewijs dat ze na de fix slagen ontbreekt dus nog.

Framework: vitest + Playwright.
- **Vitest:** 183/183 geslaagd, 11 bestanden. Nieuw: 4 bestanden, 73 tests.
- **Typecheck en lint:** `tsc --noEmit` groen, ook de twee `household is possibly null`-fouten in `tests/e2e/support/db.ts`. `eslint` op de nieuwe tests groen.
- **E2E**, volledig gedraaid met `E2E_RESEED=1`: **39 geslaagd, 3 gefaald, 1 overgeslagen**.
  - De bestaande 9 E2E-tests zijn groen.
  - Overgeslagen: de positieve `/api/status`-test. Die draait alleen met `E2E_CRON_SECRET`; ik heb het geheim van de draaiende app bewust niet uitgelezen.

### Belangrijk: 3 rode tests door een oude build
De app op :3100 is gebouwd om 19:30:59, vóór commit c6ddff7 (20:41). Precies de drie regressietests voor c6ddff7 falen daarom:
- **N1:** de taak wordt stil aan de reeks van Ellen gekoppeld. Ik heb in de database gezien dat `recurrence_id` gevuld is. Daarna crasht de pagina ("This page couldn't load").
- **N2:** 9 herlaadacties (een lus) in plaats van 1.
- **N4:** de wachttijd blijft 2 s en loopt niet op.

Dat bewijst dat ze falen zonder de fix. Nodig: `next build` + herstart op :3100, en daarna `npx playwright test tests/e2e/wp1-herreview.spec.ts` opnieuw. Ik heb niet zelf herbouwd: dat verstoort jouw server en `.next` valt buiten mijn schrijfrechten.

### Dekking per AC
| AC | Test | Status |
| --- | --- | --- |
| AC-004 / AC-009 | `wp1-rechten.spec.ts`: Lynn → Bewerken → "Deze en toekomstige taken" op Jurgens reeks Dweilen; foutmelding, en reeks + alle uitvoeringen byte-gelijk (service-role-snapshot). Unit: `expectRows` met 0 rijen → FORBIDDEN/NOT_FOUND | geslaagd (tekstafwijking, zie bevindingen) |
| AC-018 | `src/lib/__tests__/sw-internal-url.test.ts`: `public/sw.js` ongewijzigd geladen in `node:vm`. `internalUrl` + `notificationclick`: `//x`, `/\x`, `https://x`, `javascript:` → startpagina; open venster navigeert alleen intern. Mutatie in het geheugen (filter weg) → faalt | geslaagd |
| AC-022 | uitgezette Lynn: complete via `/api/outbox` → FORBIDDEN, 0 registraties | geslaagd |
| AC-023 | Lynn met gevulde IDB-cache uitgezet: `/` en `/taken` → `/geen-toegang`, 'Familie', Uitloggen, geen navigatie, cache en wachtrij leeg | geslaagd (link "Account verwijderen" hoort bij WP7, zie D-029) |
| AC-024 | Lynn uitgezet en Ellen actief, beiden met "taak gedaan" aan; Jurgen vinkt af → Ellen 1 melding, Lynn 0 | geslaagd |
| AC-029 | `/api/status` en `/api/cron/tick`: zonder of met verkeerde Bearer → 401, geen sleutels in het antwoord | geslaagd; positief pad niet gedraaid (geheim niet meegegeven) |
| AC-030 | GEEN TEST: ESLint-regel. Security-r2 heeft hem al getest via `eslint --stdin` | — |
| AC-031 | uitloggen → IDB-cache en wachtrij leeg; pagina's met gegevens (`/`, `/taken`, `/instellingen`) weg uit `pages-v2`, alleen `/login` staat er weer in (gegevensloos); daarna logt Ellen in | geslaagd. Pushabonnement niet getoetst: geen push in de headless browser |
| AC-032 | offline afvinken → beheerder verwijdert de taak → online: melding "1 offline wijziging kon niet worden verwerkt: <titel>", wachtrij leeg, 0 registraties | geslaagd |
| AC-033 | unit `errors.test.ts`: `toFailure` zonder policy-, constraint- of functienaam; `runAction` logt alleen `[action:naam] Type code`, geen e-mail, titel of uuid | geslaagd |
| AC-172 | unit `migrate.test.ts` (v0/v1, future, obsolete, `__proto__`/`constructor`, v0 `shoppingAdd` zonder id, invalid); unit `send.test.ts` (401→auth, 5xx/408/425/429→retry, HTML/kapotte JSON→retry, 503 UNSUPPORTED_VERSION→retry, REJECT-codes, netwerk). E2E: v0-entry via de API twee keer → 1 registratie; **twee v0-entries in IDB geïnjecteerd, pagina herladen → precies 1 registratie en wachtrij leeg**; obsolete → DISCARDED_OBSOLETE; v99 → 503 en niets uitgevoerd | geslaagd |
| POST /api/outbox | text/plain → 415; zonder of met vreemde Origin → 403; zonder sessie → 401 JSON zonder `location`; dubbele complete (parallel + derde keer) → 1 registratie | geslaagd |
| D-018 headers | `wp1-herreview.spec.ts`: 9 paden (pagina's, API, sw.js, icoon, 404) + ingelogde pagina + POST: `X-Frame-Options: DENY`, `frame-ancestors 'none'`, `nosniff` | geslaagd |
| Security N1 | UI: losse taak → Herhalen → Opslaan, terwijl een reeks met dezelfde id van Ellen bestaat → toast CONFLICT, `recurrence_id` blijft null, reeks van Ellen ongewijzigd | **gefaald op de oude build**; faalt aantoonbaar zonder de fix |
| Code-review N2 | E2E (store-logica is niet unit-testbaar, zie hieronder): REST `households` onderschept met PGRST116 terwijl de server de pagina blijft tonen → precies 1 herlaadactie, vlag `tl-reload-geen-huishouden` = "1", en gewist na een geslaagde verversing | **gefaald op de oude build** (9 herlaadacties) |
| Code-review N4 | E2E: `/api/outbox` afgebroken terwijl de browser online is → wachttijden groeien (elke ≥ 1,5× de vorige), wijziging blijft wachten, 0 registraties | **gefaald op de oude build** (constant 2 s) |

N2 en N4 zijn niet als unit-test geschreven. De logica zit in closures binnen `HouseholdProvider`, en het project heeft geen `jsdom`/`@testing-library`. Een nieuw testframework introduceren mag ik niet.

### Toegevoegde bestanden
- Unit:
  - `/home/user/takenlijstje/src/domain/outbox/__tests__/migrate.test.ts`
  - `/home/user/takenlijstje/src/lib/offline/__tests__/send.test.ts`
  - `/home/user/takenlijstje/src/server/__tests__/errors.test.ts`
  - `/home/user/takenlijstje/src/lib/__tests__/sw-internal-url.test.ts`
- E2E:
  - `/home/user/takenlijstje/tests/e2e/wp1-rechten.spec.ts`
  - `/home/user/takenlijstje/tests/e2e/wp1-herreview.spec.ts`
  - `/home/user/takenlijstje/tests/e2e/support/db.ts` (service role, weigert alles behalve localhost/127.0.0.1)

**Controle dat de tests echt falen zonder de fix:**
- Aangetoond voor AC-018 (mutatie in het geheugen) en voor N1, N2 en N4 (oude build).
- Voor de overige E2E-tests niet: ik kan productiecode niet muteren. De onderliggende database-regels zijn al met mutaties gecontroleerd (20/20).

### Bevindingen
- **[GEMIDDELD] AC-004-tekst.** In `src/server/actions/tasks.ts`, bij de `expectRows` op `task_recurrences` in `updateTaskAction`, toont de interface "Alleen een beheerder of wie de reeks maakte, mag de reeks aanpassen." AC-004 schrijft voor: "Dit mag je niet (meer) wijzigen. Er is niets veranderd." Het gedrag klopt (FORBIDDEN, niets veranderd); alleen de tekst wijkt af, en de geruststelling "er is niets veranderd" ontbreekt. Herstel de tekst, of leg in DECISIONS vast dat dit met de nieuwe UI (WP6) komt.
- **[LAAG] AC-172-label.** In `src/domain/outbox/migrate.ts` is `OBSOLETE_LABELS` leeg. Een vervallen soort toont daardoor de technische naam (bijv. "(swapRequest)") in plaats van "(toewijzen)". Invullen wanneer soorten vervallen (WP2a). Mijn E2E-test toetst alleen de vaste tekst.
- **[ter info] AC-031.** Na het uitloggen maakt de service worker `pages-v2` opnieuw aan voor `/login`. Er staan geen gegevens in, dus geen bug. De test staat alleen `/login` toe.
- **[ter info] N1 op de oude build.** Na het stille koppelen crashte de pagina ("This page couldn't load"). Of dat na de fix nog kan gebeuren, blijkt pas bij de herhaalrun.

### Nodig van de bouwer
- App herbouwen met c6ddff7 en herstarten op :3100, daarna `wp1-herreview.spec.ts` opnieuw draaien.
- Optioneel: `E2E_CRON_SECRET` meegeven voor de positieve AC-029-test.

### Conclusie
NO-GO tot de herhaalrun na het herbouwen: N1, N2 en N4 zijn nog niet groen bewezen. Alle andere WP1-criteria zijn gedekt en groen, behalve AC-030 (lint, al elders getest) en de tekstafwijking bij AC-004.
