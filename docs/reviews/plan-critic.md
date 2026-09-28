# Plan-critic — ronde 2 — 2026-09-28

Gelezen:
- `docs/PROGRESS.md`: antwoorden V-01…V-39, de tabel Work packages en de uitrol volgens V-36.
- `docs/INVENTARIS.md` §2 en §8.
- `docs/PRODUCT_SPEC.md` (ronde 5): BR-12, BR-31, BR-40, BR-46, UC-12 en §11.
- `docs/UX_SPEC.md` (ronde 6): §0, §4.5, §4.9, §4.14–§4.16, §5.2, §5.8 en §7.
- `docs/TECHNICAL_DESIGN.md` (ronde 4): §3.1–§3.3, §4.5, §4.6, §5.2 (Reekskoppeling), §6.1, §6.2, §9.3, §9.3.1, §9.4, §12.3, §12.3.1, §12.4, §14, §15 en §17.
- `docs/ACCEPTANCE_CRITERIA.md` (182 AC's): onder meer AC-054…AC-062, AC-073, AC-138, AC-170…AC-182 en de dekking.
- `docs/DESIGN_SYSTEM.md` §3.
- Ter controle de bestaande code: `src/server/actions/tasks.ts` (de ontvangers van "taak gedaan") en `supabase/migrations/20260927000100_schema.sql` (het verwijdergedrag van de FK's op `task_comments`).
- Screenshots uit ronde 1. De nieuwe wireframes 22 en 23 heb ik niet opnieuw bekeken; hun inhoud heb ik aan de tekst van UX §4.16 en §5.2 getoetst.

Algemeen oordeel:
- Het herstel is grondig. Alle veertien MOET-punten uit ronde 1 zijn inhoudelijk opgelost, en ook de meeste aanbevelingen.
- Door het herstel zijn twee nieuwe punten ontstaan die vóór de freeze moeten worden rechtgezet:
  - een acceptatiecriterium dat nog het oude gedrag beschrijft;
  - een privacygat in de volgorde van de werkpakketten.
- Beide zijn in één of twee zinnen op te lossen.

## Bevindingen

1. [MOET VÓÓR BOUW WORDEN OPGELOST] ACCEPTANCE_CRITERIA AC-138, laatste punt, tegenover UX_SPEC §4.14/§4.16, AC-177 en TECHNICAL_DESIGN §4.6.
   - Het probleem: AC-138 zegt nog "komt Ellen bij haar volgende gebruik in de onboarding". Na het herstel van punt 12 moet zij eerst het scherm "Je hoort niet meer bij ‘Familie’" zien. Dat staat in UX §4.14 ("niet de onboarding") en in AC-177.
   - Gevolg: twee bevroren criteria spreken elkaar tegen. De test-writer toetst het ene, de bouwer bouwt het andere, en daarna is dit alleen nog via een wijzigingsverzoek recht te zetten.
   - Nodig: AC-138 aanpassen naar "ziet Ellen bij haar volgende gebruik eerst het scherm uit UX §4.16 (zie AC-177); daarna is haar lokale data gewist".

2. [MOET VÓÓR BOUW WORDEN OPGELOST] TECHNICAL_DESIGN §15 (WP2a, WP2b, WP3) en §12.4 M6, samen met AC-073.
   - Het probleem: de nieuwe ontvangersregel voor "taak gedaan" (V-38a: ook naar wie afvinkte) staat alleen in WP3 ("`recipientsFor` krijgt geen actor-parameter"). WP2a haalt alleen de naam uit de tekst. De huidige code sluit de afvinker als ontvanger uit (`src/server/actions/tasks.ts`, het blok bij regel 59–74). WP2b (M6) mag volgens §15 vóór WP3 gebeuren ("het wachten op Jurgen houdt WP3 niet tegen", en omgekeerd legt niets de volgorde vast).
   - Gevolg: komt M6 vóór WP3, dan maakt de live app tussen M6 en WP3 nieuwe `task_completed`-rijen waarvan de ontvangerslijst weer verraadt wie afvinkte. Die rijen blijven 90 dagen staan. De inhoudscontrole van M6 zoekt alleen naar tekst en ziet dit niet, en daarna ruimt niets ze op. Succescriterium 7 en V-21 worden zo stil gebroken.
   - Nodig, één van beide:
     - (a) de ontvangerswijziging van V-38a expliciet in WP2a opnemen (dezelfde deploy als de naamloze tekst), met AC-073 ook onder WP2a;
     - (b) in §12.4 als voorwaarde voor M6 opnemen: "WP3 staat live".

     Voorkeur (a): dan klopt het meteen vanaf de expand-stap.

3. [AANBEVELING] TECHNICAL_DESIGN §3.1: `guard_comment_changes` tegenover het FK-gedrag en `sync_comment_author`.
   - Het probleem: de guard "weigert elke wijziging van `author_name` en `member_id` door een gebruiker". Twee andere mechanismen wijzigen die velden wél binnen de sessie van een gebruiker:
     - de FK-actie `on delete set null (member_id)` op `task_comments` (`…0100_schema.sql:360`). Die loopt als update door de trigger bij lid verwijderen, account verwijderen en bij M6 (leden zonder account);
     - de trigger `sync_comment_author` bij een naamswijziging.
   - Hoe de guard die van een gebruikersupdate onderscheidt, staat er niet. Bij "Reekskoppeling" is dat wel expliciet geregeld (de FK-actie en de RPC-vlag).
   - Gevolg: zonder uitzondering mislukken lid verwijderen, account verwijderen, een naamswijziging en de contract-migratie. De DB-tests uit §3.1 en de sandbox-proef M0 vangen dit wel op, dus het is geen ontwerpfout, maar het kost een herstelronde.
   - Voorstel: in §3.1 vastleggen dat de guard alleen geldt op het bovenste niveau (`pg_trigger_depth() = 1`) of buiten de RPC-vlag.

4. [AANBEVELING] TECHNICAL_DESIGN §4.1 (`PUBLIC_PATHS` en "zonder sessie naar `/login?next=`") tegenover §9.3.1 en AC-172 ("zonder sessie 401").
   - Het probleem: `/api/outbox` staat niet bij de uitzonderingen van de proxy. Zonder sessie krijgt de wachtrij dan een doorverwijzing naar de HTML van het inlogscherm, geen 401.
   - Gevolg: dat is veilig (de entry blijft staan als "onbekend antwoord"), maar de melding "Log opnieuw in om N wijzigingen te versturen" verschijnt dan nooit, en de integratietest uit AC-172 faalt.
   - Voorstel: vastleggen dat de proxy voor `/api/*` zonder sessie 401 teruggeeft in plaats van door te sturen.

5. [AANBEVELING] ACCEPTANCE_CRITERIA AC-055 tegenover TECHNICAL_DESIGN §12.4 M1(d).
   - Het probleem: AC-055 laat het draaiboek stoppen bij "leden met een account en `is_active = false`", terwijl M1(d) bij die telling alleen "melden" zegt. De echte stop zit al in stap 0 van §12.3 (AC-170).
   - Voorstel: beide gelijktrekken. M1(d) als controle ("melden"), en AC-055 zonder dit punt of met dezelfde formulering.

6. [AANBEVELING] Documenthygiëne:
   - `docs/PROGRESS.md` "Fase" en "Volgende stap" zeggen nog dat V-36…V-39 verwerkt moeten worden en dat er nog [OPEN]-markeringen zijn.
   - `docs/DESIGN_SYSTEM.md` §3 noemt nog `next/font/google` als optie, terwijl V-31, TECHNICAL_DESIGN §1 en AC-091 `next/font/local` vastleggen. Dit document wordt bevroren, dus nu rechtzetten.
   - `docs/INVENTARIS.md` §8 zegt nog "Behouden: … offline-wachtrij, snelle invoer". De wachtrij wordt herwerkt (nieuw endpoint, §9.3.1), en van de snelle invoer blijft alleen de parser; de invoerbalk vervalt.

## Opgelost sinds vorige ronde

Ronde 1 (2026-09-28) gaf 14 × MOET, 8 × AANBEVELING en de vragen V-36…V-38. Stand:

1. Oude meldingen met "gedaan door <naam>" → BR-46.3 en TD §12.4 wissen alle bestaande `task_completed`-meldingen en dag- en avondoverzichten. Ze tellen mee bij M5, M6 krijgt een inhoudscontrole, en AC-058/AC-059 zijn aangevuld. **Opgelost.** (Het nieuwe gat na M6 staat bij punt 2.)
2. De ontvangers van "taak gedaan" verraden wie afvinkte → V-38 (a) van Jurgen, verwerkt in BR-31, TD §6.1/WP3, UX §4.9 en AC-073. **Opgelost in het ontwerp**; de volgorde van de WP's staat bij punt 2.
3. "Ook niet in logs" → BR-12, §8 en TD §9.4 beschrijven nu eerlijk de grens van de platformlogs, met de controle van de bewaartermijn in WP3 en een melding in het totaalvoorstel. **Opgelost.**
4. Guard tegenover "losse taak wordt terugkerend" → de regel "Reekskoppeling" in TD §5.2, met DB-tests. **Opgelost.**
5. `author_name` tegenover AC-143 → "laatst bekende naam", gezet door de database, niet te vervalsen (AC-178, AC-179). **Opgelost** (zie aanbeveling 3).
6. Volgorde van de voorcontroles → M1 (alleen lezen) staat nu vóór `…_200` (M2), en er is een controle op de tijdzone bijgekomen. **Opgelost.**
7. Ongemerkt toegang kwijt door `is_active` → stap 0 in §12.3 en AC-170. **Opgelost.**
8. Uitrolstrategie → V-36, TD §12.3.1 (`main` en `v2-ui`, geen previews, release R1–R5, rollback) en AC-180. **Opgelost.**
9. Wachtrij over deploys heen → een stabiel `/api/outbox`, een versie per entry, `migrateOutboxEntry` en "nooit stil weggooien" (TD §9.3.1, AC-172). Het restrisico bij de eerste deploy is benoemd en wordt aan Jurgen gemeld. **Opgelost** (zie aanbeveling 4).
10. Reeks wijzigen vanuit het reeksdetail → `updateSeriesAction`, UX §5.2 met wireframe 23, en AC-173. **Opgelost.**
11. Ontbrekende rechten-AC's → AC-175 (standaardtaken) en AC-176 (huishoudinstellingen). **Opgelost.**
12. Scherm na verwijdering → UX §4.16 met wireframe 22, TD §4.6 en AC-177. **Opgelost**, met de tegenstrijdigheid in AC-138 als restpunt (punt 1).
13. Offline in het taakdetail → UX §7 is gelijkgetrokken met TD §9.3. **Opgelost.**
14. De regel van twee tikken → V-37 van Jurgen, verwerkt in UX §0/§4.5 en AC-181. **Opgelost.**
- Aanbevelingen uit ronde 1:
  - 15 (WP2 splitsen, planner los van het wissen): opgelost met WP2a/WP2b en "WP3 hangt af van WP2a".
  - 16 (hertellen vlak vóór M5, M6 in dezelfde sessie): opgelost.
  - 17 (`delete_my_account` voor een uitgezet lid): opgelost in TD §4.5.
  - 18 (succescriterium 1 meetbaar): opgelost met een meting op dag 30 en dag 90.
  - 19 (tijdzone): opgelost met V-39 (vast, met een databasecheck, AC-182).
  - 20 (voorkeuren van gezinsleden): opgelost; BR-46.5 noemt het expliciet voor het totaalvoorstel.
  - 21 (hygiëne): grotendeels opgelost, de rest staat bij aanbeveling 6.
  - 22 (AC's voor "Wijzigingen weggooien?" en de teller): opgelost met AC-174 en AC-171.

## Onbevestigde aannames

Geen die rechten, gegevens of scope raken.

- Het eenmalige restrisico van de wachtrij bij de eerste deploy (TD §9.3.1 punt 5) is geen aanname. Het is een benoemd risico dat vooraf aan Jurgen wordt gemeld (AC-172, Proces).
- Dat "niet meer lid" alleen herkend wordt op een toestel met cache (TD §4.6, AC-177) is een bewust vastgelegde grens die UX volgt. Er worden daarvoor geen extra gegevens bewaard.

## Conclusie
DESIGN FREEZE MOGELIJK: NEE
