# UX-specificatie — Takenlijstje

Versie: ronde 3 (2026-09-28, V-28 en V-29 verwerkt; §4.13 gelijkgetrokken met TECHNICAL_DESIGN §4.5) · Kwaliteitsniveau 2 · Werkwijze §15 (bestaand project), fase 3.
Basis: `docs/PRODUCT_SPEC.md` (ronde 3), de besluiten en antwoorden in `docs/PROGRESS.md`, `docs/INVENTARIS.md` en de huidige schermen in `docs/screenshots/bestaand/`.
Dit document beschrijft **hoe de gebruiker zijn doel bereikt**: structuur, flows, schermen en states. Kleur, typografie en vorm zijn werk voor de visual-designer; de wireframes zijn bewust grijs.

Er zijn geen open plekken meer: V-28 en V-29 zijn beantwoord (zie §12).

---

## 0. Uitgangspunten voor het ontwerp

1. **Eén oogopslag.** Bij het openen zie je zonder te scrollen wat verlopen is en wat vandaag moet, elk met **vóór wanneer** (PRODUCT_SPEC §11.6).
2. **Eén tik om af te vinken**, overal hetzelfde rondje links in de rij. Ongedaan maken kan altijd: direct via de melding onderin, later door het gevulde rondje opnieuw aan te tikken of via het taakdetail.
3. **Geen personen bij taken.** Geen avatars, geen "Wie?", geen "Mijn taken / Iedereen", geen "gedaan door" (V-21, V-22, V-25). Namen verschijnen alleen bij notities ("Ellen: …"), in de ledenlijst en in het profiel.
4. **Maximaal twee tikken** voor afvinken, toevoegen, wijzigen en verplaatsen (overgenomen besluit, INVENTARIS §2; typen telt niet als tik, een keuze uit een datumkiezer wel). "Toewijzen" vervalt.
5. **Minder op het scherm.** Wat niet nodig is voor de taak van dat moment, zit achter één tik (progressive disclosure): gedane taken, meer instellingen, historie.
6. **Verbergen versus uitschakelen.** Wat een rol *nooit* mag, wordt verborgen. Wat *nu even* niet kan (offline, lege naam, laatste beheerder), wordt uitgeschakeld met een zin uitleg.

## 1. Apparaten en viewports

Primair en enig doelapparaat: **telefoon, 390×844** (V-07). Staand, één hand, kort en tussendoor; thuis en in de winkel.
Secundair: **geen**. Op de computer moet de app werken, maar zonder eigen indeling (PRODUCT_SPEC §10); de telefoonkolom staat dan gecentreerd.

Gevolgen voor het ontwerp:
- Belangrijkste bediening in de onderste helft (duim): onderbalk, zwevende +, afvinkrondjes links en groot (raakvlak minimaal 44×44).
- Invoer gebeurt met het schermtoetsenbord in beeld: formulieren zijn zo kort dat de knop **Toevoegen boven het toetsenbord** zichtbaar blijft (wireframe 08).
- Geen horizontaal scrollende chiprijen; chips lopen door op een tweede regel (lost D-04 op).
- PWA: op de iPhone werkt pushen alleen als de app op het beginscherm staat (iOS 16.4+). Daar is uitleg voor (§4.10).

## 2. Informatiearchitectuur

**Objecten en relaties**

```
Huishouden (naam, tijdzone, "gezinsleden mogen taken maken")
├── Leden (naam, kleur, emoji, rol: beheerder | gezinslid, actief)
├── Uitnodigingen (rol, optioneel e-mail, geldig 14 dagen)
├── Reeksen = terugkerende taken (ritme, deadline-venster, pauze, einddatum; maker onzichtbaar)
│     └── Taken (uitvoeringen) — open | bezig | gedaan | overgeslagen ; verlopen is afgeleid
├── Losse taken (dag, optioneel tijd/deadline/duur/prioriteit/herinnering/categorie)
│     ├── Notities (tekst + schrijver)
│     └── Historie (wanneer gedaan, op tijd of te laat — zonder persoon)
├── Standaardtaken (bibliotheek om reeksen uit te maken)
└── Boodschappenlijst → producten (aantal, categorie, notitie, gekocht) ; gearchiveerde lijsten
Per persoon: meldingen, meldingsvoorkeuren, pushapparaten
```

**Startpunt:** Vandaag. Na inloggen, na het openen van de app en na het accepteren van een uitnodiging kom je daar. Een account zonder huishouden start in de onboarding (§8).

**Mentale model voor de gebruiker:** "Er is één lijst van dingen die thuis moeten gebeuren. Sommige komen steeds terug. Wie het doet, vinkt het af."

## 3. Navigatie

### Structuur

| Plek | Bestemmingen | Waarom |
| --- | --- | --- |
| **Onderbalk** (altijd zichtbaar) | Vandaag · Taken · **+ Taak** (midden, rond) · Kalender · Boodschappen | De vier bestemmingen die wekelijks tot dagelijks gebruikt worden, plus de meest gebruikte handeling |
| **Kop, rechtsboven** | Meldingen (bel met aantal ongelezen) · Instellingen (tandwiel) | Meldingen open je via de badge of een pushmelding; instellingen zelden |
| **Kaart onderaan Vandaag** | Overzicht ("Deze week: 9 gedaan · 7 op tijd · 1 vergeten ›") | Reflectie, ongeveer wekelijks. Hoort bij de vraag "hoe gaat het", dus bij Vandaag |

**Besluit V-28 (Jurgen: "Volg voorstel"):** dit wijkt af van de huidige app: **Boodschappen gaat van het kopicoon naar de onderbalk, Huishouden(-overzicht) gaat uit de onderbalk** en wordt een kaart onderaan Vandaag.
- Onderbouwing: boodschappen wordt (bijna) dagelijks gebruikt, ook met één hand in de winkel; een klein icoon rechtsboven is dan het slechtst bereikbare punt van het scherm. Het overzicht wordt zonder punten en zonder statistieken per persoon veel kleiner (UC-06) en is een wekelijkse blik, geen dagelijkse bestemming.

### Regels
- Onderbalk op elk ingelogd scherm, ook op Meldingen, Instellingen en Overzicht. Het actieve tabblad is gemarkeerd; op Meldingen en Instellingen is geen tabblad actief.
- Pagina's een niveau dieper (bijv. Instellingen › Gezinsleden, Overzicht) hebben linksboven "‹ <vorige>". De systeem-terugknop/veeggebaar doet hetzelfde.
- Taakdetail, Nieuwe taak, Bewerken en keuzes zijn **vensters van onderen** (sheets). Sluiten: ✕, omlaag vegen of terug. Een sheet met ingevulde maar niet opgeslagen gegevens vraagt bij sluiten "Wijzigingen weggooien?" (alleen als er iets is veranderd).
- Elke sheet en pagina heeft een eigen URL (bijv. `/taken/<id>`), zodat terug werkt, een meldingslink direct naar de taak gaat en vernieuwen het venster niet sluit. Nu hebben dialogen geen URL (INVENTARIS §3) → herwerken.
- De **+** opent altijd Nieuwe taak (ook op Boodschappen; daar staat een eigen invoerveld met de knop "Toevoegen" als tekst, zodat er geen twee gelijke +-knoppen zijn).

## 4. Flows

Tikken geteld vanaf het scherm waar de flow begint. Typen telt niet als tik.

### 4.1 Kernflow — openen, zien, afvinken (UC-01, UC-02)
1. Open de app → Vandaag, direct met de laatst bekende stand (uit de cache), daarna ververst. **0 tikken.**
2. Tik op het rondje van de taak → rondje vult zich, de taak schuift naar "✓ n gedaan vandaag" (ingeklapt), de teller in de kop daalt, melding onderin: "Gedaan: <taak> · Ongedaan maken" (ca. 5 seconden). **1 tik.**
3. Klaar. Huisgenoten zien het binnen enkele seconden. Bij een reeks staat de volgende keer al gepland.

**Aantal stappen van openen tot resultaat: 1 tik.**
- Foutpad: offline → de taak gaat toch op gedaan, met "wacht op verbinding" in de rij en de offlinebalk bovenaan (wireframe 17). Server weigert (taak intussen verwijderd) → de rij verdwijnt met de melding "Deze taak bestaat niet meer." Andere fout → de taak springt terug naar open met "Afvinken lukte niet · Opnieuw".
- Twee tegelijk: beiden zien hem als gedaan; er is één registratie (BR-11). Geen melding nodig.
- Terugweg: "Ongedaan maken" in de melding (1 tik).

### 4.2 Afvinking later terugdraaien (BR-13, V-22)
- Vandaag: tik "✓ 2 gedaan vandaag · tonen" (1) → tik het gevulde rondje (2) → taak staat weer open, melding "Weer open: <taak> · Ongedaan maken". **2 tikken.**
- Elders (Taken › Gedaan, Kalender, taakdetail van een gedane taak): knop **"Terugzetten"** in het detail. Iedereen mag dit; er staat nergens wie afvinkte.
- Terugdraaien vraagt geen bevestiging: het is zelf met één tik te herstellen.

### 4.3 Taak toevoegen (UC-03)
1. Tik **+** (1) → sheet Nieuwe taak, cursor in "Wat moet er gebeuren?", toetsenbord open. "Wanneer?" staat op **Vandaag** (of op de dag waar je vandaan kwam: + bij een dag in de Kalender).
2. Typ "Badkamer zaterdag". Slimme invoer herkent "zaterdag" **terwijl je typt**: het woord wordt onderstreept, de chip "Za 3 okt" gaat aan, en onder het veld staat `"zaterdag" gebruikt als dag · toch in de naam`. Opgeslagen naam: "Badkamer".
3. Tik **Toevoegen** of Enter (2). Sheet sluit, melding "Toegevoegd voor zaterdag · Bekijken".

**2 tikken + typen.** De snelle invoerbalk bovenaan Vandaag vervalt; deze sheet is de snelle invoer (zelfde aantal tikken, één plek om te leren, en Vandaag wordt rustiger — D-02).
- Namen van personen worden niet herkend ("Badkamer zaterdag Jurgen" → naam "Badkamer Jurgen"); er komt geen waarschuwing (UC-03).
- Foutpad: lege naam → Toevoegen uitgeschakeld. Naam > 80 tekens → teller verschijnt vanaf 70, bij overschrijding rode regel "Maximaal 80 tekens" en Toevoegen uit. Serverfout → sheet blijft open met alles ingevuld, regel bovenaan "Opslaan lukte niet. Probeer het opnieuw." Dubbel tikken → één taak (BR-10); de knop toont "Bezig…" en is uitgeschakeld tijdens verzenden.
- Geen recht (BR-20, gezinslid met instelling uit): de + staat niet in de balk; lege staten verwijzen naar de beheerder.
- Terugweg: ✕ / omlaag vegen. Met ingevulde naam: "Wijzigingen weggooien?".

### 4.4 Terugkerende taak instellen (UC-04)
Vanuit Nieuwe taak (wireframe 09):
1. + (1) → naam typen → dag kiezen (de eerste keer) → schakelaar **Herhalen** (2) → ritme: segment Dagelijks / **Wekelijks** / Maandelijks / Anders… met, bij Wekelijks, de weekdagen voorgeselecteerd op de gekozen dag → Toevoegen (3).
2. Een samenvattende zin toont het resultaat in gewone taal: "Elke zaterdag, vanaf za 3 okt". Daaronder de link "elke 2 weken of einddatum" voor interval en einddatum. "Anders…" geeft: elke X dagen/weken, maandelijks op dag N of "n-de weekdag", jaarlijks (BR-01).
3. Deadline-venster onder "Meer instellingen": **Uiterlijk** (zelfde dag / 1 / 2 … dagen later, tijd) en **Mag al eerder** (nee / 1 / 2 … dagen vooraf). Validatie: "mag al" kan niet ná "uiterlijk" liggen (BR-18); dan de regel "Mag al kan niet later zijn dan uiterlijk" en Toevoegen uit.

**3 tikken + typen voor een wekelijkse taak.**
- Uit standaardtaken: Instellingen › Standaardtaken (beheerder) of de lege staat "Kies uit standaardtaken" → lijst met vinkjes, per taak het ritme als keuzelijst (standaard ingevuld) → "Toevoegen (n)". Idempotent (BR-10).

### 4.5 Taak wijzigen, "alleen deze" of "deze en volgende" (BR-08, BR-22, BR-23)
1. Tik op de rij (niet het rondje) (1) → taakdetail.
2. ⋯ → **Bewerken** (2, 3) → zelfde formulier als Nieuwe taak, gevuld → wijzig → **Opslaan** (4).
3. Bij een taak uit een reeks **en** je mag de reeks wijzigen (beheerder of maker): sheet **"Wat wil je wijzigen?"** met twee grote keuzes en een zin per keuze wat er gebeurt (wireframe 11): "Alleen deze keer" / "Deze en alle volgende keren". (5)
4. Gezinslid dat de reeks niet instelde: de keuze verschijnt niet; boven Opslaan staat "Dit verandert alleen deze keer. De hele reeks aanpassen kan een beheerder." Er wordt nooit iets aan de reeks gedaan (BR-22).

Wijzigen is hiermee meer dan twee tikken; het snelle wijzigen dat vaak voorkomt (verplaatsen, bezig, afvinken) staat daarom direct in het detail (4.6). Titel wijzigen = detail → Bewerken → typen → Opslaan.
- Foutpad: server weigert (rechten gewijzigd, reeks gestopt) → sheet blijft open met de invoer, melding "Dit mag je niet (meer) wijzigen. Er is niets veranderd."
- Wijziging aan een taak die intussen is afgevinkt: de wijziging wordt opgeslagen, de taak blijft gedaan (PRODUCT_SPEC §6).

### 4.6 Verplaatsen (UC-05)
- Taakdetail: **Naar morgen** (1 tik na het openen = **2 tikken**) of **Andere dag…** → datumkiezer met snelkeuzes (Vandaag, Morgen, Za, Zo) en een kalender (3 tikken).
- Kalender (week/dag): lang indrukken en slepen naar een andere dag (1 gebaar). Slepen is een extra, geen vereiste: dezelfde uitkomst kan altijd via het detail en met het toetsenbord (A-02).
- Verplaatsen van een taak uit een reeks geldt altijd **alleen voor deze keer** en vraagt dus niets (UC-05, BR-08). Melding: "Verplaatst naar dinsdag · Ongedaan maken".
- Iedereen mag verplaatsen (BR-23). De deadline schuift mee met dezelfde afstand tot de geplande dag (uitvoeringskeuze voor de architect om te bevestigen).

### 4.7 Pauzeren, stoppen en verwijderen (BR-09, BR-22, BR-23)
Alleen zichtbaar voor wie het mag (beheerder, of maker van de reeks/taak). Anderen zien in het detail onder "Herhaalt" de regel "Reeks aanpassen kan een beheerder of wie hem instelde."
- **Reeks pauzeren…** (detail ⋯ of Taken › Terugkerend › reeks): sheet "Pauzeren tot en met" met snelkeuzes 1 week · 2 weken · 1 maand · Kies datum; startdatum standaard vandaag, aan te passen. Uitleg: "Open keren in deze periode vervallen. Daarna gaat de reeks vanzelf verder." → **Pauzeren**. Gepauzeerde reeks toont "gepauzeerd t/m <datum> · Hervatten". Geen extra bevestiging: hervatten is mogelijk.
- **Reeks stoppen…**: bevestiging "‘Badkamer schoonmaken’ stoppen? Er komen geen nieuwe keren meer en de open keren verdwijnen. Wat al gedaan is, blijft bewaard." → **Stoppen** / Annuleren. Onomkeerbaar → bevestigen.
- **Verwijderen…** bij een losse taak: bevestiging "‘Fietsband plakken’ verwijderen? Dit kan niet ongedaan worden." Bij een taak uit een reeks: keuze "Alleen deze keer" / "Deze en alle volgende keren (reeks stoppen)"; de tweede alleen voor wie de reeks mag wijzigen.
- **Deze keer overslaan** (bestaande functie, iedereen): geen bevestiging, melding met "Ongedaan maken".
- **Ik ben ermee bezig** (BR-14, iedereen): rij krijgt het label "bezig" zonder naam; in het detail wordt het "Niet meer bezig".

### 4.8 Boodschappen (UC-07)
1. Tab Boodschappen (1) → typ "2 melk" in het veld bovenaan → Enter of **Toevoegen** (2). Product komt in de juiste categorie met aantal "2". Veld blijft gefocust voor het volgende product.
2. Of tik een chip bij **Vaak gekocht** ("+ Kaas") (1 tik op de pagina). Chips lopen door op twee regels; "meer…" toont de rest.
3. In de winkel: tik het rondje → product gaat naar **Gekocht** (onderaan, inklapbaar). Nogmaals tikken zet het terug.
4. **Klaar met winkelen** (onder Gekocht, alleen zichtbaar als er iets gekocht is): gekochte producten verdwijnen naar het archief; wat niet gekocht is blijft staan. Geen bevestiging, wel melding "Lijst afgerond · Ongedaan maken". Dubbel tikken maakt geen extra lijst (R-03).
5. Tik op een product (niet het rondje) → sheet: naam, aantal, categorie, notitie, **Verwijderen**.
6. Vanuit een notitie bij een taak: in het taakdetail bij een notitie de actie "Op boodschappenlijst" → keuze welke woorden → toegevoegd, melding.
- "Toegevoegd door" en "gekocht door" verdwijnen uit de weergave (V-25).
- Offline: toevoegen en afvinken gaan via de wachtrij, zonder dubbele items (BR-10).

### 4.9 Meldingen bekijken (UC-08)
- Via het belletje (badge = aantal ongelezen) of een pushmelding. Een pushmelding opent direct de taak (detail-URL) of Vandaag (dag-/avondoverzicht).
- Lijst gegroepeerd: Vandaag / Eerder. Ongelezen vet met stip. Tik = gelezen + naar de taak. **Alles gelezen** rechtsboven. Na 30 meldingen **Oudere meldingen laden** (S-03).
- Soorten en tekst zonder namen: "Deadline nadert — Tandartsafspraak Kai maken, vóór 12:00", "Vandaag staan er 5 taken", "Er staan nog 3 taken open", "Vaatwasser uitruimen is gedaan", "Fietsband plakken is verlopen", "Herinnering: Boodschappen doen om 10:00". Ruilverzoeken en "Nieuwe taak voor jou" vervallen.
- Staat push op dit toestel uit: bovenaan een kaart "Meldingen op je telefoon staan uit · Aanzetten · Niet nu". "Niet nu" verbergt de kaart 14 dagen.

### 4.10 Meldingen instellen en push aanzetten
Instellingen › Meldingen (wireframe 21):
1. Kaart "Op deze telefoon": **Meldingen aanzetten** (1) → systeemvraag van de browser (2) → "Aan op deze telefoon".
2. iPhone zonder beginscherm-installatie: de knop is vervangen door een korte stappenuitleg met afbeeldingen: "Tik op Deel → Zet op beginscherm → open Takenlijstje vanaf je beginscherm." De app herkent daarna de installatie.
3. Browser weigerde eerder: uitleg "Meldingen zijn geblokkeerd in je instellingen" met waar je dat terugzet.
4. Per soort een schakelaar (herinneringen, deadline nadert met instelbare tijd, verlopen, dagoverzicht met tijd, avondoverzicht met tijd, taak gedaan). Standaardwaarden volgens BR-31 (beheerders aan, gezinsleden uit, "taak gedaan" voor iedereen uit). Opslaan direct per schakelaar, met een korte bevestiging "Opgeslagen".

### 4.11 Uitnodigen (UC-09) — beheerder
1. Instellingen › Gezinsleden (2) → **Iemand uitnodigen** (3) → sheet: Rol (**Gezinslid** standaard / Beheerder), E-mailadres (optioneel, met uitleg "Alleen dit adres kan de link dan gebruiken") → **Link maken** (4).
2. Resultaat: "Link klaar · geldig tot 12 okt" met **Delen** (systeemdeelmenu: WhatsApp, berichten…) en **Kopiëren**.
3. De uitnodiging staat onder "Open uitnodigingen" met **Intrekken** (bevestiging niet nodig; opnieuw maken kan).

Ontvanger:
1. Opent de link → pagina "Ellen nodigt je uit voor ‘Familie’ als gezinslid". Niet ingelogd: **Account maken** (naam, e-mail, wachtwoord) of **Ik heb al een account** (inloggen). Ingelogd: **Meedoen**.
2. Na accepteren: korte profielstap (naam en emoji, voorgevuld) → Vandaag, met eenmalig de kaart om meldingen aan te zetten (alleen als de standaard voor die rol "aan" is).
- Foutstates: verlopen of gebruikt (bestaande foutstaat blijft), ander e-mailadres ("Deze uitnodiging is voor een ander e-mailadres. Log in met dat adres of vraag een nieuwe link."), al lid van een ander huishouden ("Je hoort al bij een ander huishouden. Je kunt maar bij één huishouden horen." BR-44), al lid van dit huishouden → gewoon naar Vandaag.

### 4.12 Inloggen en wachtwoord vergeten (UC-11)
- Inlogscherm (wireframe 19): e-mail, wachtwoord (met "tonen"), **Inloggen**; daaronder "Wachtwoord vergeten?" en als tweede weg **Stuur me een inloglink**. De tab "Nieuw" (registreren) verdwijnt uit het inlogscherm: aansluiten gaat via een uitnodiging (V-05). Tekst: "Nieuw? Je komt erbij via een uitnodiging van iemand uit je huishouden." Registreren blijft bereikbaar vanuit de uitnodiging en voor de onboarding.
- **Wachtwoord vergeten:** tik de link (1) → e-mail (voorgevuld als die al getypt was) → **Stuur herstellink** (2) → "Check je mail. De link is 1 uur geldig." (altijd dezelfde tekst, ook als het adres onbekend is) → link in mail → scherm **Nieuw wachtwoord** (één veld met "tonen", minimaal 8 tekens, eisen zichtbaar vóór het typen) → **Opslaan en inloggen** → Vandaag.
- Inloglink: e-mail → **Stuur inloglink** → "Check je mail" met "Opnieuw sturen" (na 60 seconden actief).
- Fouten: verkeerd wachtwoord → "E-mailadres of wachtwoord klopt niet" onder de knop, ingevulde e-mail blijft staan; verlopen herstellink → "Deze link is verlopen · Nieuwe link sturen".
- Uitloggen (Instellingen › Account): bevestiging "Uitloggen? De offline opgeslagen gegevens op deze telefoon worden gewist." (BR-43). Zijn er nog niet verstuurde offline wijzigingen, dan eerst: "Er staan nog 2 wijzigingen klaar die niet verstuurd zijn. Die gaan verloren." met **Toch uitloggen** / Annuleren.

### 4.13 Account verwijderen (UC-11, V-15, BR-24)
1. Instellingen › Account verwijderen (2) → pagina met wat er gebeurt: "Je account en je profiel verdwijnen. Taken, reeksen en de historie van het huishouden blijven bestaan. Je notities blijven staan." `[AANNAME: notities blijven met de naam van de schrijver; dit volgt uit V-25 en §8, en vraagt geen nieuwe beslissing]`
2. **Account definitief verwijderen** (3) → bevestiging door het **eigen wachtwoord** in te voeren (veld met "tonen") → uitgelogd, naar het inlogscherm met "Je account is verwijderd." (uitvoeringskeuze van de architect, TECHNICAL_DESIGN §4.5; AC-137)
- Wie alleen met een inloglink inlogt en geen wachtwoord heeft: in plaats van het wachtwoordveld staat "Stel eerst een wachtwoord in via Wachtwoord vergeten", met een link naar die flow (§4.12). De knop **Account definitief verwijderen** is dan uitgeschakeld. Na het instellen van een wachtwoord kom je hier terug en werkt het zoals hierboven.
- Verkeerd wachtwoord: "Dit wachtwoord klopt niet" onder het veld; er wordt niets verwijderd en je blijft op de pagina.
- Enige beheerder: de knop is uitgeschakeld met "Je bent de enige beheerder. Maak eerst iemand anders beheerder in Gezinsleden." en een link daarheen.

### 4.14 Huishouden verwijderen (UC-12, V-15) — beheerder
Instellingen › Huishouden › onderaan **Huishouden verwijderen…** → pagina met gevolgen ("Alle taken, reeksen, historie, boodschappen en leden verdwijnen voor iedereen. Dit kan niet ongedaan worden.") → typ de naam van het huishouden ("Familie") → knop wordt actief → **Alles verwijderen** → uitgelogd naar een scherm "Het huishouden is verwijderd." De sterkste bevestiging van de app, omdat dit onomkeerbaar is en iedereen raakt.

### 4.15 Gezinsleden beheren (UC-12) — beheerder
Instellingen › Gezinsleden (wireframe 16) → tik een lid → sheet: naam, rol (Beheerder / Gezinslid), **Uitzetten** / **Weer aanzetten**, **Verwijderen uit huishouden** (bevestiging). Voor de enige beheerder zijn "Gezinslid maken" en "Verwijderen" uitgeschakeld met "Er moet altijd minstens één beheerder zijn." (BR-24). Jezelf verwijderen kan hier niet (dat is "Account verwijderen").
**Uitzetten (besluit V-29, Jurgen: "Volg voorstel"):** een uitgezet lid heeft **geen toegang tot het huishouden** en krijgt **geen meldingen**. Zijn account en zijn notities blijven bestaan. **Weer aanzetten herstelt alles.**
- Beheerder: tik een lid → **Uitzetten** → bevestiging "Kai uitzetten? Kai kan dan niet meer bij het huishouden en krijgt geen meldingen. Je kunt Kai later weer aanzetten." → **Uitzetten** / Annuleren. In de ledenlijst staat het lid grijs met het label "uitgezet" en de regel "Geen toegang, geen meldingen". **Weer aanzetten** heeft geen bevestiging nodig; melding "Kai heeft weer toegang".
- Uitzetten is niet mogelijk voor jezelf en niet voor de enige beheerder (anders kan niemand het huishouden nog beheren; volgt uit BR-24). Die knop is dan uitgeschakeld met "Er moet altijd minstens één beheerder met toegang zijn."
- Het uitgezette lid zelf: bij openen van de app (of bij de eerstvolgende verbinding) één scherm: "Je hebt op dit moment geen toegang tot ‘Familie’. Een beheerder kan je weer toegang geven." met **Uitloggen**. Geen taken, geen onderbalk. Account verwijderen blijft bereikbaar via een link op dat scherm. De offline opgeslagen stand op het toestel verdwijnt dan (technische uitwerking voor de architect).
- Notities van een uitgezet lid blijven met zijn naam zichtbaar bij de taak.

## 5. Schermen

Per scherm: **Behouden / Herwerken / Vervallen** ten opzichte van de huidige app.

### 5.1 Vandaag — HERWERKEN (D-02) · wireframes 01–04, 17, 18
- **Doel:** zien wat er moet gebeuren en vóór wanneer; afvinken.
- **Primaire actie:** afvinken (rondje). **Secundair:** taak openen (rij), gedane taken tonen, naar Kalender, naar Overzicht, + Taak (balk).
- **Informatie in volgorde:**
  1. Kop: "Vandaag", datum en "nog N te doen" (open vandaag + verlopen). Rechts bel en tandwiel.
  2. **Verlopen** (alleen als er iets is): zwaarste nadruk; rechts "2 dagen te laat"; meta "was voor za 26 sep".
  3. **Vandaag**: open taken van vandaag, gesorteerd op deadline/tijd (vroegste eerst), taken zonder tijd onderaan. Rechts in de rij het moment: "vóór 12:00" (deadline) of "om 20:00" (geplande tijd); leeg als het gewoon "vandaag" is. Meta: herhaling (↻ wekelijks), categorie, label "bezig".
  4. "✓ N gedaan vandaag · tonen" (ingeklapt; uitklappen toont de gedane rijen met gevuld rondje).
  5. **Binnenkort**: maximaal 3 rijen — eerst taken die al "mogen" en vóór een latere deadline moeten ("mag al · gepland za 3 okt", rechts "vóór zondag"), dan de eerstvolgende dagen. Link "Kalender ›".
  6. Kaart "Deze week: 9 gedaan · 7 op tijd · 1 vergeten · Overzicht ›".
  7. Hooguit één tip-kaart tegelijk onderaan (bijv. meldingen aanzetten), weg te tikken.
- **Vervalt:** begroeting "Goedemorgen, Jurgen", vier tegels en voortgangsbalk, regel "Eerstvolgende deadline", snelle invoerbalk, "Samen sparen", "Mijn taken / Iedereen", avatars, dubbele vermelding van een verlopen taak.
- **Controle succescriterium 6:** op 390×844 zijn 1 verlopen + 4 taken van vandaag + de gedaan-regel zichtbaar zonder scrollen (wireframe 01). Bij 6 taken valt de gedaan-regel net onder de rand; dat is acceptabel.
- **Rollen:** geen verschil, behalve dat de + ontbreekt als een gezinslid geen taken mag maken.

### 5.2 Taken — HERWERKEN · wireframes 05, 06
- **Doel:** een taak vinden, alle open/gedane taken zien, terugkerende taken beheren.
- **Primaire actie:** zoeken/vinden → openen. Afvinken kan ook hier.
- **Opbouw:** zoekveld (met label "Zoek een taak") + Filter-knop · segment **Open | Gedaan | Terugkerend** · actieve filters als chips met ✕ en "Filters wissen" (S-03) · lijst.
  - **Open:** groepen Verlopen, Vandaag, Morgen, Deze week, Volgende week, Later; rechts per rij de dag of "vóór …".
  - **Gedaan:** laatste 30 dagen, per dag, met "op tijd" / "te laat"; tik → detail met Terugzetten.
  - **Terugkerend:** één rij per reeks: naam, ritme in gewone taal, "volgende: …", label "gepauzeerd t/m …". Tik → reeksdetail (ritme, deadline-venster, volgende keren, historie; acties Wijzigen, Pauzeren/Hervatten, Stoppen voor wie het mag). Dit **vervangt** de sectie "Terugkerende taken" in Instellingen.
  - Filter-sheet: categorie, prioriteit, "met deadline". Geen filter per persoon.
- **Vervalt:** snelfilter "Mijn taken", filter per persoon, horizontale chiprij (D-04), knop "+ Taak" in de kop (de + staat in de balk).
- **Rollen:** gezinslid ziet bij Terugkerend de regel "Een reeks aanpassen, pauzeren of stoppen kan een beheerder of wie de reeks heeft ingesteld." en in het reeksdetail geen acties voor andermans reeks. Beheerder ziet die regel niet.

### 5.3 Kalender — BEHOUDEN met aanpassingen (S-02, A-02) · wireframe 07
- **Doel:** vooruit kijken en plannen per dag.
- **Primaire actie:** taak op een dag bekijken/verplaatsen; **+ Taak** per dag.
- **Opbouw:** kop "Week 40 · 28 sep – 4 okt"; segment Dag | **Week** | Maand; ‹ › en — alleen als je niet in de huidige periode bent — "Vandaag". Week = lijst van dagen; vandaag omkaderd; per dag een duidelijke knop "+ Taak" (opent Nieuwe taak met die dag). Gedane taken per dag ingeklapt ("✓ 2 gedaan").
- Maand: raster met per dag het aantal open taken en een markering voor verlopen; tik op een dag → Dagweergave.
- Toekomstige herhalingen die nog niet zijn ingepland ("spookjes") staan gestippeld zonder rondje; tik → "Deze keer staat nog niet klaar. Hij verschijnt 14 dagen vooraf." met link naar de reeks.
- Verlopen taken staan op hun eigen (voorbije) dag, niet op vandaag.
- **Vervalt:** filterchips per persoon, avatars, "Gedaan door …", "Ruilen gevraagd".
- **Bereik (S-02):** navigeren buiten de geladen periode laadt die periode (skeletrijen) in plaats van stil "Niets gepland". Lukt laden niet: "Deze week kon niet worden geladen · Opnieuw proberen". Een echt lege dag toont niets behalve "+ Taak"; een lege week toont "Niets gepland deze week".

### 5.4 Nieuwe taak — HERWERKEN (Wie? vervalt) · wireframes 08, 09
- **Doel:** zo snel mogelijk vastleggen wat er moet gebeuren en wanneer.
- **Primaire actie:** Toevoegen.
- **Velden, in deze volgorde:** Wat moet er gebeuren? · Wanneer? (chips Vandaag, Morgen, eerstvolgende za en zo, Andere dag…; lopen door op twee regels) · regel "Uiterlijk <dag>, einde van de dag · aanpassen" · Herhalen (schakelaar) · Meer instellingen ▾.
- **Meer instellingen (ingeklapt):** Uiterlijk, Mag al eerder, Tijd, Herinnering, Categorie, Duur (ca.), Prioriteit, Omschrijving; bij herhaling ook Einddatum. Punten vervallen.
- Met open toetsenbord passen naam, wanneer, herhalen en de knop Toevoegen boven het toetsenbord.
- Zie §6 voor het formulier.

### 5.5 Taakdetail — HERWERKEN · wireframes 10, 10b
- **Doel:** alles over één taak zien en de snelle acties doen.
- **Primaire actie:** **Afvinken** (grote knop; bij een gedane taak: "Gedaan om 08:12 · op tijd" met **Terugzetten**).
- **Secundair, direct zichtbaar:** Naar morgen · Andere dag… · ⋯
- **⋯-menu:** Ik ben ermee bezig / Niet meer bezig · Bewerken · Deze keer overslaan · (reeks, met recht) Reeks pauzeren… · Reeks stoppen… · (met recht) Verwijderen…
- **Informatie:** bovenregel herhaling en status ("↻ Elke zaterdag · mag al" / "verlopen · 2 dagen te laat"), titel, dan de lijst Gepland · **Uiterlijk** (nadruk) · Herhaalt ("elke zaterdag · daarna za 10 okt") · Duur en categorie · Prioriteit (alleen als niet normaal) · Herinnering (als ingesteld) · Omschrijving. Dan **Notities** ("Ellen: …", veld "Notitie toevoegen…") en **Vorige keren** (3 laatste, "alles ›").
- **Vervalt:** "Wie"/toewijzen, "Punten", "Gedaan … door …", ruilblok, "Ik kan deze taak niet doen".
- **Rollen:** Verwijderen alleen voor beheerder en maker (BR-23). Reeksacties alleen voor beheerder en maker (BR-22); anderen zien onder Herhaalt de uitlegregel. Een beheerder kan elke notitie verwijderen, een gezinslid alleen de eigen (lang indrukken of ⋯ bij de notitie).

### 5.6 Boodschappen — BEHOUDEN met aanpassingen · wireframe 12
- **Doel:** snel op de lijst zetten; in de winkel afvinken.
- **Primaire actie:** afvinken (in de winkel) / toevoegen (thuis). Het invoerveld staat bovenaan omdat thuis toevoegen het meest voorkomt; afvinken zit in de lijst eronder.
- **Opbouw:** kop "Boodschappen · 6 te halen · 2 gekocht" · invoerveld "Bijv. 2 melk" + **Toevoegen** · Vaak gekocht (chips, twee regels, "meer…") · categorieën met producten (aantal als label, notitie als tweede regel) · **Gekocht (n)** inklapbaar · **Klaar met winkelen**.
- **Vervalt:** avatars ("toegevoegd door"), het ⋯-menu per product (tik op de rij opent bewerken), de onduidelijke tussenstatus van het vakje (INVENTARIS §5, "Cola"), "In je mandje" wordt "Gekocht".
- Boodschappen staat in de onderbalk in plaats van als icoon in de kop (besluit V-28).
- **Rollen:** geen verschil (BR-42).

### 5.7 Meldingen — BEHOUDEN met aanpassingen · wireframe 13
- **Doel:** zien waarover je een seintje kreeg en er direct naartoe.
- **Primaire actie:** melding openen. **Secundair:** Alles gelezen, Oudere laden, Meldingen instellen.
- **Vervalt:** sectie Ruilverzoeken, "Overnemen", meldingen met namen.
- Nieuw: kaart "Meldingen op je telefoon staan uit", "Oudere meldingen laden".

### 5.8 Instellingen — HERWERKEN (D-03) · wireframes 14, 15, 16, 21
Van één pagina van ~8700 px naar **een korte lijst met subpagina's**, elk met eigen URL:

| Groep | Rij (rechts de huidige waarde) | Subpagina | Wie |
| --- | --- | --- | --- |
| Jij | Profiel | naam, kleur, emoji | iedereen |
| Jij | Meldingen | push op dit toestel + soorten (§4.10) | iedereen |
| Huishouden | Gezinsleden | leden, uitnodigen, open uitnodigingen, "gezinsleden mogen taken toevoegen" | beheerder: beheren · gezinslid: alleen de lijst bekijken |
| Huishouden | Standaardtaken | bibliotheek, activeren, eigen standaardtaken beheren | beheerder |
| Huishouden | Huishouden | naam, tijdzone, Huishouden verwijderen… | beheerder |
| Account | Ingelogd als <e-mail> | — (alleen informatie) | iedereen |
| Account | Uitloggen | bevestiging (§4.12) | iedereen |
| Account | Account verwijderen | §4.13 | iedereen |

- **Vervalt:** Afwezigheid (V-24), "Gezinsleden mogen aan anderen toewijzen", verdeling, punten/spaardoel, leden zonder account ("lid toevoegen" zonder uitnodiging), Terugkerende taken (verhuisd naar Taken › Terugkerend, met een verwijzing).
- **Rollen:** gezinslid ziet geen Standaardtaken en Huishouden; bij Gezinsleden een alleen-lezen lijst, met de regel "Ellen en Jurgen beheren het huishouden." (namen van de beheerders).

### 5.9 Overzicht (was Huishouden) — HERWERKEN (UC-06) · wireframe 20
- **Doel:** de vraag "wat vergeten we, moet er iets aan de planning veranderen?".
- **Opbouw:** periode (Deze week | Vorige week | 30 dagen) · vier getallen in gewone taal: gedaan · op tijd ("7 van 9") · vergeten (verlopen of overgeslagen) · staan nog open · **Vaak te laat of vergeten** (per taak, tik → taakdetail/reeks om herinnering of deadline aan te passen) · **Vaak gedaan**.
- **Vervalt:** per persoon, taakbelasting, puntendoel, "gemiddelde voltooiing", "gemiddeld per persoon", afwezig.
- **Leeg (S-03):** "Nog niets om te laten zien. Na een week afvinken zie je hier wat goed gaat en wat vaak vergeten wordt."

### 5.10 Inloggen — HERWERKEN · wireframe 19
Zie §4.12. Vervalt: tab "Nieuw". Nieuw: Wachtwoord vergeten, Nieuw wachtwoord.

### 5.11 Onboarding — HERWERKEN · geen wireframe (zelden gebruikt, UC-10)
Zie §8.

### 5.12 Uitnodiging accepteren — BEHOUDEN met aanpassingen
Zie §4.11. Foutstaat "ongeldig of verlopen" blijft zoals hij is.

### 5.13 Offline-pagina — BEHOUDEN
Alleen voor een nooit bezochte pagina zonder verbinding. Moet ook echt getoond worden in plaats van het dashboard onder een andere URL (S-04).

### 5.14 Algemene pagina's — NIEUW (S-01)
Niet gevonden ("Deze pagina bestaat niet · Naar Vandaag"), taak niet gevonden ("Deze taak bestaat niet meer. Misschien is hij verwijderd. · Naar Vandaag"), algemene fout (§7).

## 6. Formulieren

### Nieuwe taak / Bewerken
| Veld | Type | Standaard | Validatie (moment) |
| --- | --- | --- | --- |
| Wat moet er gebeuren? | tekst, autofocus, Enter = Toevoegen | leeg | verplicht (knop uit zolang leeg); max 80, teller vanaf 70 (tijdens typen) |
| Wanneer? | chips + datumkiezer | Vandaag, of de dag van waaruit je kwam, of wat slimme invoer herkent | — |
| Uiterlijk | regel met "aanpassen" → dag-offset + tijd | einde van de geplande dag | niet vóór "mag al" (bij wijzigen) |
| Herhalen | schakelaar → ritme | uit; bij aan: wekelijks op de gekozen dag | interval ≥ 1; einddatum niet vóór start |
| Mag al eerder | keuze | nee | niet ná "uiterlijk" (BR-18) |
| Tijd | tijdkiezer | geen | — |
| Herinnering | keuze (geen, op tijdstip, 15 min, 1 uur, 3 uur, 1 dag; tot 5 stuks) | geen | max 5 |
| Categorie | keuze (8 categorieën) | geraden uit de naam, anders Overig | — |
| Duur | keuze (5, 10, 15, 30, 45, 60, 90 min) | leeg | — |
| Prioriteit | segment (laag, normaal, hoog, dringend) | normaal | — |
| Omschrijving | meerregelig | leeg | max 1000 |

- Bij een fout blijft alles ingevuld; de foutregel staat bij het veld of bovenaan (serverfout).
- Validatie bij verlaten van het veld of bij Opslaan, niet bij elke toetsaanslag (behalve de tekenteller).
- Bewerken toont hetzelfde formulier met "Meer instellingen" open als daar iets is ingevuld.

### Boodschap
Eén veld met slimme invoer ("2 melk", "1,5 liter cola"); bewerken: naam, aantal (tekst), categorie (keuze), notitie.

### Uitnodiging
Rol (segment, standaard Gezinslid), E-mailadres (type email, optioneel, gevalideerd bij Link maken).

### Profiel
Naam (verplicht, max 40), kleur (8 keuzes), emoji (keuze). Opslaan direct per wijziging.

### Inloggen / wachtwoord
Type email met autocomplete `username`, wachtwoord met `current-password` / `new-password`, "tonen"-knop, eisen vooraf zichtbaar.

## 7. States per scherm

Algemene afspraken (gelden voor alle schermen, lossen S-01 op):
- **Laden, eerste keer (geen cache):** skeletrijen in de vorm van de echte inhoud (wireframe 18, onderste deel). Nooit een wit scherm.
- **Laden met cache:** direct de bewaarde stand; op de achtergrond verversen zonder zichtbare laadindicator. Duurt verversen > 5 s: kleine regel onder de kop "Bijwerken…".
- **Fout bij laden zonder cache:** wireframe 18: uitleg in gewone taal, **Opnieuw proberen**, onderbalk blijft bruikbaar.
- **Fout bij laden met cache:** bewaarde stand tonen met balk "Kon niet bijwerken · stand van 08:12 · Opnieuw".
- **Offline:** balk bovenaan "Offline · stand van 08:12. Afvinken kan gewoon; n wijzigingen worden verstuurd zodra je weer verbinding hebt." (wireframe 17). Acties in de wachtrij tonen "wacht op verbinding". Acties die online moeten: uitgeschakeld, met "Hiervoor heb je internet nodig" bij aantikken. Welke acties precies offline kunnen, bepaalt het technisch ontwerp; minimaal afvinken, terugzetten, bezig en boodschappen (zoals nu).
- **Weer online:** balk verdwijnt; bij mislukte wachtrij-actie: melding "1 offline wijziging kon niet worden verwerkt: <taak>" met uitleg.
- **Bezig (actie):** knop toont "Bezig…" en is uitgeschakeld; snelle acties (afvinken) zijn optimistisch en tonen geen spinner.
- **Succes:** korte melding onderin (≈5 s) met, waar mogelijk, "Ongedaan maken". Geen succesmeldingen voor instellingen-schakelaars behalve een kort "Opgeslagen".
- **Uitgeschakeld:** altijd met reden in één zin (tooltip of regel eronder).

| Scherm | Leeg | Laden | Fout | Succes | Uitgeschakeld | Bezig | Gedeeltelijk | Offline |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Vandaag | (a) geen taken in huishouden: "Nog geen taken" + Kies uit standaardtaken / Zelf een taak toevoegen (wireframe 03); gezinslid zonder recht: verwijzing naar beheerder. (b) niets meer open vandaag: "Alles gedaan voor vandaag" + gedaan-regel + Binnenkort (wireframe 02) | skelet: kop + 4 rijen | zie algemeen | melding "Gedaan: … · Ongedaan maken" (wireframe 04) | + ontbreekt zonder recht | — (optimistisch) | alleen verlopen, niets vandaag: sectie Vandaag toont "Voor vandaag staat niets meer gepland" | balk, rij "wacht op verbinding" |
| Taken › Open | "Geen open taken" ; met filter/zoekterm: "Niets gevonden voor ‘oven’ · Filters wissen" | skeletrijen | algemeen | — | — | — | — | cache, zoeken werkt lokaal |
| Taken › Gedaan | "Nog niets afgevinkt in de afgelopen 30 dagen" | skelet | algemeen | "Weer open: …" | — | — | — | cache |
| Taken › Terugkerend | "Nog geen terugkerende taken" + "Nieuwe terugkerende taak" (met recht) | skelet | algemeen | "Gepauzeerd t/m …" | acties verborgen zonder recht | knoppen "Bezig…" | — | alleen bekijken |
| Kalender | lege week: "Niets gepland deze week"; lege dag: alleen "+ Taak" | skelet per dag bij navigeren (S-02) | "Deze week kon niet worden geladen · Opnieuw" | "Verplaatst naar … · Ongedaan maken" | verplaatsen offline: via de wachtrij als het technisch ontwerp dat toestaat, anders uitgeschakeld met reden | — | spookjes na 14 dagen | cache voor geladen weken, andere weken: "Niet beschikbaar zonder verbinding" |
| Nieuwe taak | — | — | serverfout bovenaan, invoer blijft | "Toegevoegd voor zaterdag · Bekijken" | Toevoegen uit bij lege of te lange naam, of bij ongeldig venster | "Bezig…" | — | Toevoegen uitgeschakeld tenzij het technisch ontwerp aanmaken in de wachtrij toestaat |
| Taakdetail | — | skelet binnen de sheet | "Deze taak bestaat niet meer" + Naar Vandaag; notities laden mislukt: "Notities konden niet worden geladen · Opnieuw" (S-03) | meldingen per actie | reeksacties/verwijderen verborgen zonder recht | knoppen "Bezig…" | notities laden apart | afvinken/terugzetten/bezig werken; overige acties uitgeschakeld |
| Wijzigen-keuze | — | — | weigering: "Er is niets veranderd" | "Alleen deze keer aangepast" / "Reeks aangepast vanaf za 3 okt" | "deze en volgende" niet getoond zonder recht | "Bezig…" | — | uitgeschakeld |
| Boodschappen | "De lijst is leeg. Wat moet er gehaald worden?" + Vaak gekocht | skelet | algemeen | "Lijst afgerond · Ongedaan maken" | Klaar met winkelen verborgen als niets gekocht is | — | — | toevoegen en afvinken via wachtrij |
| Meldingen | "Nog geen meldingen. Hier komt een seintje als iets bijna moet of verlopen is." | skelet | algemeen | — | Alles gelezen uit als alles gelezen is | "Laden…" bij Oudere | meer dan 30: "Oudere meldingen laden" | cache, alleen lezen |
| Meldingen instellen | — | skelet | "Opslaan lukte niet" per schakelaar, schakelaar springt terug | "Opgeslagen" | aanzetten uit als de browser push niet kent, met uitleg (§4.10) | schakelaar toont bezig | — | uitgeschakeld |
| Instellingen + subpagina's | Gezinsleden met alleen jou: "Nodig iemand uit om samen te werken" | skelet | algemeen | "Opgeslagen" / "Link gekopieerd" / "Kai heeft weer toegang" | enige beheerder (BR-24): degraderen, verwijderen en uitzetten uit; jezelf uitzetten uit; gezinslid: beheer verborgen | "Bezig…" | — | alleen bekijken, knoppen uit |
| Overzicht | S-03: zie §5.9 | skelet | algemeen | — | — | — | periode met weinig gegevens: getallen tonen, lijsten weglaten | cache |
| Inloggen | — | knop "Bezig…" | zie §4.12 | door naar Vandaag / "Check je mail" | Inloggen uit bij leeg veld | "Bezig…" | — | "Je bent offline. Inloggen kan alleen met verbinding." |
| Uitnodiging | — | "Uitnodiging controleren…" | zie §4.11 | "Welkom bij Familie" | — | "Bezig…" | — | offline-melding |

## 8. Onboarding en eerste gebruik

In de praktijk zelden gebruikt (het gezin bestaat al, UC-10), maar moet kloppen.

**Account zonder huishouden** (nieuw account dat niet via een uitnodiging kwam):
1. Keuzescherm: **Nieuw huishouden starten** · "Heb je een uitnodiging? Open de link uit het bericht dat je kreeg."
2. **Naam van het huishouden** (voorbeeld "Familie Jansen") → Volgende.
3. **Kies je taken:** lijst standaardtaken met vinkjes; per aangevinkte taak direct het ritme als keuzelijst met een zinnige standaard (Vaatwasser uitruimen: elke dag; Afval: elke week op <dag>; Badkamer: elke week). Deze stap voegt stap 3 en 4 uit UC-10 samen: kiezen en frequentie zie je in één lijst. → **Taken toevoegen (6)**. "Overslaan" mag.
4. **Nodig je gezin uit** (optioneel): zelfde als §4.11, met **Later**.
5. → Vandaag, met de ingeplande eerste week en eenmalig de kaart om meldingen aan te zetten.
- De stap "verdeling" en de tekst over Google/Apple vervallen.
- Halverwege gestopt: bij terugkomst ga je verder bij de stap waar je was; op elke stap staat "Opnieuw beginnen" klein onderaan.
- Volgorde: taken vóór uitnodigen (UC-10 noemt het andersom). Reden: wie uitnodigt, wil dat de ander iets ziet; en uitnodigen is optioneel en kan later. Dit raakt geen rechten of gegevens.

**Eerste keer als nieuw lid (via uitnodiging):** profielstap → Vandaag. Geen rondleiding: Vandaag moet zonder uitleg te begrijpen zijn (toetsvraag). Eenmalig de meldingenkaart.

**Eerste zinvolle handeling:** een taak afvinken (lid) of standaardtaken kiezen (nieuw huishouden).

## 9. Rechten in de interface (samenvatting)

| Element | Beheerder | Gezinslid | Hoe bij "nee" |
| --- | --- | --- | --- |
| + Taak, "Zelf een taak toevoegen", "Nieuwe terugkerende taak" | ja | alleen als "gezinsleden mogen taken toevoegen" aan staat | verborgen; lege staat verwijst naar beheerder |
| Afvinken, terugzetten, bezig, overslaan, verplaatsen, losse keer bewerken | ja | ja | — |
| "Deze en alle volgende keren", Reeks pauzeren/stoppen, reeks wijzigen | ja | alleen eigen reeks | verborgen + uitlegregel onder "Herhaalt" |
| Verwijderen (taak) | ja | alleen zelf gemaakt | verborgen |
| Notitie verwijderen | alle | eigen | verborgen |
| Boodschappen | alles | alles | — |
| Instellingen › Standaardtaken, Huishouden | ja | nee | rij verborgen |
| Gezinsleden beheren, uitnodigen | ja | nee (alleen bekijken) | knoppen verborgen, uitlegregel |
| Account verwijderen | ja, niet als enige beheerder | ja | uitgeschakeld met reden |
| Lid uitzetten / weer aanzetten (V-29) | ja, niet zichzelf en niet de enige beheerder | nee | verborgen (gezinslid) / uitgeschakeld met reden |
| Toegang tot het huishouden als je uitgezet bent | — | — | alleen het scherm "Geen toegang" met Uitloggen (§4.15) |

De maker van een taak of reeks wordt nooit getoond (V-25); uitlegregels noemen hem niet ("wie de reeks heeft ingesteld").

## 10. Wireframes

HTML in `docs/prototype/wireframes/` (gedeelde stijl `wf.css`), screenshots op 390×844 in `docs/screenshots/prototype/`. Alle screenshots zijn bekeken en na beoordeling bijgewerkt.

| # | Wireframe | Screenshot | Toont |
| --- | --- | --- | --- |
| 01 | `01-vandaag.html` | `wf-01-vandaag-390x844.png` | Vandaag, gewone dag |
| 02 | `02-vandaag-alles-gedaan.html` | `wf-02-vandaag-alles-gedaan-390x844.png` | lege staat b |
| 03 | `03-vandaag-eerste-gebruik.html` | `wf-03-vandaag-eerste-gebruik-390x844.png` | lege staat a, met notitie voor gezinslid |
| 04 | `04-vandaag-afgevinkt.html` | `wf-04-vandaag-afgevinkt-390x844.png` | succes + Ongedaan maken |
| 05 | `05-taken.html` | `wf-05-taken-390x844.png` | Taken › Open met actief filter |
| 06 | `06-taken-terugkerend.html` | `wf-06-taken-terugkerend-390x844.png` | Taken › Terugkerend |
| 07 | `07-kalender-week.html` | `wf-07-kalender-week-390x844.png` | Kalender, week |
| 08 | `08-nieuwe-taak.html` | `wf-08-nieuwe-taak-390x844.png` | Nieuwe taak met toetsenbord en slimme invoer |
| 09 | `09-nieuwe-taak-herhalen.html` | `wf-09-nieuwe-taak-herhalen-390x844.png` | Herhalen + Meer instellingen |
| 10 | `10-taakdetail.html` | `wf-10-taakdetail-390x844.png` | Taakdetail (reeks) |
| 10b | `10b-taakdetail-menu.html` | `wf-10b-taakdetail-menu-390x844.png` | ⋯-menu voor beheerder/maker |
| 11 | `11-wijzigen-keuze.html` | `wf-11-wijzigen-keuze-390x844.png` | Alleen deze / deze en volgende |
| 12 | `12-boodschappen.html` | `wf-12-boodschappen-390x844.png` | Boodschappen |
| 13 | `13-meldingen.html` | `wf-13-meldingen-390x844.png` | Meldingen met push-kaart |
| 14 | `14-instellingen.html` | `wf-14-instellingen-390x844.png` | Instellingen, beheerder |
| 15 | `15-instellingen-gezinslid.html` | `wf-15-instellingen-gezinslid-390x844.png` | Instellingen, gezinslid |
| 16 | `16-gezinsleden.html` | `wf-16-gezinsleden-390x844.png` | Gezinsleden en uitnodigen |
| 17 | `17-offline.html` | `wf-17-offline-390x844.png` | Offline met wachtende afvinking |
| 18 | `18-laden-en-fout.html` | `wf-18-laden-en-fout-390x844.png` | Laadfout + skelet |
| 19 | `19-inloggen.html` | `wf-19-inloggen-390x844.png` | Inloggen |
| 20 | `20-overzicht.html` | `wf-20-overzicht-390x844.png` | Overzicht huishouden |
| 21 | `21-meldingen-instellen.html` | `wf-21-meldingen-instellen-390x844.png` | Meldingen instellen |

`wf-01-vandaag-volledig-390x844.png` is een mislukte opname (onderbalk midden in de pagina) en hoort niet bij de set.

## 11. Toetsvragen (zelfcontrole op de screenshots)

- **Kernflow zonder uitleg?** Ja: het enige nadrukkelijke element per rij is het rondje; verlopen springt eruit; de melding na afvinken zegt wat er gebeurde en hoe terug.
- **Hoofdactie in drie seconden?** Vandaag/Taken/Kalender: afvinken. Nieuwe taak: Toevoegen (enige donkere knop). Taakdetail: Afvinken (grote donkere knop). Boodschappen: invoerveld bovenaan, rondjes. Instellingen: geen hoofdactie (lijst). Gezinsleden: Iemand uitnodigen.
- **Onomkeerbaar zonder bevestiging?** Nee: reeks stoppen, taak verwijderen, lid verwijderen, account en huishouden verwijderen vragen bevestiging. **Nutteloze bevestiging?** Nee: afvinken, terugzetten, overslaan, verplaatsen, pauzeren, "klaar met winkelen" en intrekken zijn herstelbaar en krijgen een melding met Ongedaan maken in plaats van een vraag.
- **Overbodige informatie?** Vandaag verloor tegels, begroeting, deadlineregel, spaardoel en dubbelingen; taakdetail verloor Wie/Punten.
- **Alle states?** Zie §7.

## 12. Open vragen en aannames

**Vragen voor Jurgen:** geen open vragen.

**Beantwoord (2026-09-28, letterlijk in `docs/PROGRESS.md`):**
- **V-28** — "Volg voorstel": Boodschappen in de onderbalk, Huishouden-overzicht als kaart onderaan Vandaag. Verwerkt in §3, §5.1, §5.6.
- **V-29** — "Volg voorstel": uitgezet = geen toegang tot het huishouden en geen meldingen; account en notities blijven; weer aanzetten herstelt alles. Verwerkt in §4.15, §7, §9 en wireframe 16.

**Aannames (raken geen rechten, gegevens, privacy of scope)**
- `[AANNAME]` Bij account verwijderen blijven notities met de naam van de schrijver staan (volgt uit V-25 en PRODUCT_SPEC §8: "tot de taak verwijderd wordt").
- `[AANNAME]` De deadline van een verplaatste taak schuift mee met dezelfde afstand; te bevestigen door de architect als uitvoeringskeuze.

**Voor de solution-architect (geen vraag voor Jurgen)**
- Eigen URL per sheet (taakdetail, reeks, bewerken) voor terugnavigatie en meldingslinks.
- Welke acties offline in de wachtrij kunnen (minimaal: afvinken, terugzetten, bezig, boodschappen; wenselijk: nieuwe taak, verplaatsen).
- Laden per periode in de kalender (S-02); "meer laden" bij meldingen (S-03).
- Taakrij: rondje en rij als twee losse knoppen naast elkaar, niet genest (A-01).
