# UX-specificatie — Takenlijstje

Versie: ronde 6 (2026-09-28, plan-critic ronde 1 punten 10, 12, 13 en 21 verwerkt; V-37, V-38 en V-39 beantwoord) · Kwaliteitsniveau 2 · Werkwijze §15 (bestaand project), fase 3.
Basis: `docs/PRODUCT_SPEC.md` (ronde 3), de besluiten en antwoorden in `docs/PROGRESS.md`, `docs/INVENTARIS.md` en de huidige schermen in `docs/screenshots/bestaand/`.
Dit document beschrijft **hoe de gebruiker zijn doel bereikt**: structuur, flows, schermen en states. Kleur, typografie en vorm zijn werk voor de visual-designer; de wireframes zijn bewust grijs.

Er zijn geen open plekken (zie §12).

---

## 0. Uitgangspunten voor het ontwerp

1. **Eén oogopslag.** Bij het openen zie je zonder te scrollen wat verlopen is en wat vandaag moet, elk met **vóór wanneer** (PRODUCT_SPEC §11.6).
2. **Eén tik om af te vinken**, overal hetzelfde rondje links in de rij. Ongedaan maken kan altijd: direct via de melding onderin, later door het gevulde rondje opnieuw aan te tikken of via het taakdetail.
3. **Geen personen bij taken.** Geen avatars, geen "Wie?", geen "Mijn taken / Iedereen", geen "gedaan door" (V-21, V-22, V-25). Namen verschijnen alleen bij notities ("Ellen: …"), in de ledenlijst en in het profiel.
4. **Maximaal twee tikken** voor afvinken, toevoegen, wijzigen en verplaatsen (overgenomen besluit, INVENTARIS §2; typen telt niet als tik, een keuze uit een datumkiezer wel). "Toewijzen" vervalt. Afvinken, toevoegen, verplaatsen ("Naar morgen") en bezig halen dit. Naam of details wijzigen kost 4 à 5 tikken (§4.5); die afwijking heeft Jurgen geaccepteerd (V-37).
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
Huishouden (naam, tijdzone vast Europe/Amsterdam, "gezinsleden mogen taken maken")
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

Wijzigen van naam of details kost hiermee 4 à 5 tikken; Jurgen heeft die afwijking van de twee-tikken-regel geaccepteerd (V-37). Het snelle wijzigen dat vaak voorkomt (verplaatsen, bezig, afvinken) staat daarom direct in het detail (4.6). Titel wijzigen = detail → Bewerken → typen → Opslaan.
- Foutpad: server weigert (rechten gewijzigd, reeks gestopt) → sheet blijft open met de invoer, melding "Dit mag je niet (meer) wijzigen. Er is niets veranderd."
- Wijziging aan een taak die intussen is afgevinkt: de wijziging wordt opgeslagen, de taak blijft gedaan (PRODUCT_SPEC §6).

### 4.6 Verplaatsen (UC-05)
- Taakdetail: **Naar morgen** (1 tik na het openen = **2 tikken**) of **Andere dag…** → datumkiezer met snelkeuzes (Vandaag, Morgen, Za, Zo) en een kalender (3 tikken).
- Kalender (week/dag): lang indrukken en slepen naar een andere dag (1 gebaar). Slepen is een extra, geen vereiste: dezelfde uitkomst kan altijd via het detail en met het toetsenbord (A-02).
- Verplaatsen van een taak uit een reeks geldt altijd **alleen voor deze keer** en vraagt dus niets (UC-05, BR-08). Melding: "Verplaatst naar dinsdag · Ongedaan maken".
- Iedereen mag verplaatsen (BR-23). "Mag al" en de deadline schuiven mee met hetzelfde aantal dagen (uitvoeringskeuze van de architect, TECHNICAL_DESIGN §6.1 `moveTaskAction`).

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
- Soorten en tekst zonder namen: "Deadline nadert — Tandartsafspraak Kai maken, vóór 12:00", "Vandaag staan er 5 taken", "Er staan nog 3 taken open", "Vaatwasser uitruimen is gedaan" (gaat naar iedereen die deze soort aan heeft, ook naar wie afvinkte, zodat de ontvangers niet verraden wie het deed; V-38), "Fietsband plakken is verlopen", "Herinnering: Boodschappen doen om 10:00". Ruilverzoeken en "Nieuwe taak voor jou" vervallen.
- Staat push op dit toestel uit: bovenaan een kaart "Meldingen op je telefoon staan uit · Aanzetten · Niet nu". "Niet nu" verbergt de kaart 14 dagen.

### 4.10 Meldingen instellen en push aanzetten
Instellingen › Meldingen (wireframe 21):
1. Kaart "Op deze telefoon": **Meldingen aanzetten** (1) → systeemvraag van de browser (2) → "Aan op deze telefoon".
2. iPhone zonder beginscherm-installatie: de knop is vervangen door een korte stappenuitleg met afbeeldingen: "Tik op Deel → Zet op beginscherm → open Takenlijstje vanaf je beginscherm." De app herkent daarna de installatie.
3. Browser weigerde eerder: uitleg "Meldingen zijn geblokkeerd in je instellingen" met waar je dat terugzet.
4. Per soort een schakelaar (herinneringen, deadline nadert met instelbare tijd, verlopen, dagoverzicht met tijd, avondoverzicht met tijd, taak gedaan, met de uitleg "Ook als je hem zelf afvinkt"). Standaardwaarden volgens BR-31 (beheerders aan, gezinsleden uit, "taak gedaan" voor iedereen uit). Opslaan direct per schakelaar, met een korte bevestiging "Opgeslagen".

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
1. Instellingen › Account verwijderen (2) → pagina met wat er gebeurt: "Je account en je profiel verdwijnen. Taken, reeksen en de historie van het huishouden blijven bestaan. Je notities blijven staan." Notities blijven met de naam van de schrijver staan (besluit V-34).
2. **Account definitief verwijderen** (3) → bevestiging door het **eigen wachtwoord** in te voeren (veld met "tonen") → uitgelogd, naar het inlogscherm met "Je account is verwijderd." (uitvoeringskeuze van de architect, TECHNICAL_DESIGN §4.5; AC-137)
- Wie alleen met een inloglink inlogt en geen wachtwoord heeft: in plaats van het wachtwoordveld staat "Stel eerst een wachtwoord in via Wachtwoord vergeten", met een link naar die flow (§4.12). De knop **Account definitief verwijderen** is dan uitgeschakeld. Na het instellen van een wachtwoord kom je hier terug en werkt het zoals hierboven.
- Verkeerd wachtwoord: "Dit wachtwoord klopt niet" onder het veld; er wordt niets verwijderd en je blijft op de pagina.
- Enige beheerder: de knop is uitgeschakeld met "Je bent de enige beheerder. Maak eerst iemand anders beheerder in Gezinsleden." en een link daarheen.

### 4.14 Huishouden verwijderen (UC-12, V-15) — beheerder
Instellingen › Huishouden › onderaan **Huishouden verwijderen…** → pagina met gevolgen ("Alle taken, reeksen, historie, boodschappen en leden verdwijnen voor iedereen. Dit kan niet ongedaan worden.") → typ de naam van het huishouden ("Familie") → knop wordt actief → **Alles verwijderen** → uitgelogd naar een scherm "Het huishouden is verwijderd." De sterkste bevestiging van de app, omdat dit onomkeerbaar is en iedereen raakt.
- De andere leden zien bij hun volgende bezoek het scherm **Geen huishouden meer** (§4.16), niet de onboarding.

### 4.15 Gezinsleden beheren (UC-12) — beheerder
Instellingen › Gezinsleden (wireframe 16) → tik een lid → sheet: naam, rol (Beheerder / Gezinslid), **Uitzetten** / **Weer aanzetten**, **Verwijderen uit huishouden** (bevestiging). Voor de enige beheerder zijn "Gezinslid maken" en "Verwijderen" uitgeschakeld met "Er moet altijd minstens één beheerder zijn." (BR-24). Jezelf verwijderen kan hier niet (dat is "Account verwijderen").
**Uitzetten (besluit V-29, Jurgen: "Volg voorstel"):** een uitgezet lid heeft **geen toegang tot het huishouden** en krijgt **geen meldingen**. Zijn account en zijn notities blijven bestaan. **Weer aanzetten herstelt alles.**
- Beheerder: tik een lid → **Uitzetten** → bevestiging "Kai uitzetten? Kai kan dan niet meer bij het huishouden en krijgt geen meldingen. Je kunt Kai later weer aanzetten." → **Uitzetten** / Annuleren. In de ledenlijst staat het lid grijs met het label "uitgezet" en de regel "Geen toegang, geen meldingen". **Weer aanzetten** heeft geen bevestiging nodig; melding "Kai heeft weer toegang".
- Uitzetten is niet mogelijk voor jezelf en niet voor de enige beheerder (anders kan niemand het huishouden nog beheren; volgt uit BR-24). Die knop is dan uitgeschakeld met "Er moet altijd minstens één beheerder met toegang zijn."
- Het uitgezette lid zelf: bij openen van de app (of bij de eerstvolgende verbinding) één scherm: "Je hebt op dit moment geen toegang tot ‘Familie’. Een beheerder kan je weer toegang geven." met **Uitloggen**. Geen taken, geen onderbalk. Account verwijderen blijft bereikbaar via een link op dat scherm. De offline opgeslagen stand op het toestel verdwijnt dan (technische uitwerking voor de architect).
- Notities van een uitgezet lid blijven met zijn naam zichtbaar bij de taak. Ook na verwijderen uit het huishouden blijft de naam bij zijn notities staan (V-34).


### 4.16 Niet meer in een huishouden (plan-critic punt 12) · wireframe 22
Voor wie uit het huishouden is **verwijderd**, of van wie het **huishouden is verwijderd** door een beheerder. Zonder dit scherm zou die persoon zonder uitleg in de onboarding ("Nieuw huishouden starten") belanden, en per ongeluk een eigen huishouden kunnen maken, waarna een nieuwe uitnodiging van het gezin niet meer werkt (BR-44).
- **Wanneer:** bij het openen van de app (of bij de eerstvolgende verbinding) heeft het account geen lidmaatschap meer, terwijl het toestel nog een huishouden kende. Hoe de app dat herkent (bijv. de laatst bekende huishoudnaam uit de lokale cache, vóór die gewist wordt), is een technische uitwerking voor de architect.
- **Scherm (analoog aan "Geen toegang" bij uitzetten, §4.15):** titel "Je hoort niet meer bij ‘Familie’". Uitleg: "Je bent uit dit huishouden gehaald, of het huishouden bestaat niet meer. Wil je er weer bij? Vraag iemand uit je gezin om een nieuwe uitnodiging en open de link." Is de naam niet bekend: "Je hoort niet meer bij een huishouden".
  - **Uitloggen** (hoofdknop).
  - Kleiner: "Een eigen huishouden starten" → bevestiging "Weet je het zeker? Je kunt maar bij één huishouden horen. Een uitnodiging van je gezin werkt dan pas weer als je dit huishouden verlaat." → **Toch starten** → onboarding (§8).
  - Kleiner: "Account verwijderen" (§4.13).
- Geen onderbalk, geen taken. De offline opgeslagen stand op het toestel wordt gewist (BR-43, zoals bij uitloggen).
- Opent de persoon later een geldige uitnodiging, dan gaat alles zoals in §4.11.
- Verschil met uitzetten (§4.15): een uitgezet lid is nog lid en kan door een beheerder met één tik terug; iemand die verwijderd is, heeft een nieuwe uitnodiging nodig.

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
  - **Terugkerend:** één rij per reeks: naam, ritme in gewone taal, "volgende: …", label "gepauzeerd t/m …". Tik → **reeksdetail** (wireframe 23): kop met naam en ritme in gewone taal; **Volgende keren** (de eerstvolgende 3 geplande keren, tik → taakdetail); gegevens (Uiterlijk, Mag al eerder, Herinnering, Duur/categorie); **Vorige keren**. Acties voor wie het mag: **Reeks wijzigen** (zelfde formulier als Nieuwe taak met Herhalen aan; geldt altijd voor alle toekomstige keren en vraagt dus niet "alleen deze"), **Pauzeren**/**Hervatten**, **Stoppen…**. Dit werkt ook voor een gepauzeerde reeks of een reeks zonder open keer (de wijziging gaat over de reeks, niet over een losse keer; technische route: plan-critic punt 10, architect). Dit **vervangt** de sectie "Terugkerende taken" in Instellingen.
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
| Huishouden | Huishouden | naam; tijdzone alleen zichtbaar ("Europe/Amsterdam", niet te wijzigen, V-39); Huishouden verwijderen… | beheerder |
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
- **Offline:** balk bovenaan "Offline · stand van 08:12. Afvinken kan gewoon; n wijzigingen worden verstuurd zodra je weer verbinding hebt." (wireframe 17). Acties in de wachtrij tonen "wacht op verbinding". Acties die online moeten: uitgeschakeld, met "Hiervoor heb je internet nodig" bij aantikken. **Offline via de wachtrij (TECHNICAL_DESIGN §9.3):** afvinken, terugzetten, bezig/niet bezig, overslaan, verplaatsen, een nieuwe **losse** taak, boodschappen (toevoegen, afvinken, wijzigen, verwijderen) en meldingen als gelezen markeren. Al het andere is online-only (o.a. bewerken, reeksen maken of wijzigen, notities, instellingen, uitnodigen, account).
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
| Kalender | lege week: "Niets gepland deze week"; lege dag: alleen "+ Taak" | skelet per dag bij navigeren (S-02) | "Deze week kon niet worden geladen · Opnieuw" | "Verplaatst naar … · Ongedaan maken" | — | — | spookjes na 14 dagen | cache voor geladen weken, andere weken: "Niet beschikbaar zonder verbinding"; afvinken en verplaatsen (ook slepen) via de wachtrij (TD §9.3) |
| Nieuwe taak | — | — | serverfout bovenaan, invoer blijft | "Toegevoegd voor zaterdag · Bekijken" | Toevoegen uit bij lege of te lange naam, of bij ongeldig venster | "Bezig…" | — | **losse** taak toevoegen kan via de wachtrij (TD §9.3), melding "Toegevoegd · wordt verstuurd zodra je verbinding hebt"; met Herhalen aan is Toevoegen uitgeschakeld met "Een terugkerende taak maken kan alleen met internet" |
| Taakdetail | — | skelet binnen de sheet | "Deze taak bestaat niet meer" + Naar Vandaag; notities laden mislukt: "Notities konden niet worden geladen · Opnieuw" (S-03) | meldingen per actie | reeksacties/verwijderen verborgen zonder recht | knoppen "Bezig…" | notities laden apart | afvinken, terugzetten, bezig/niet bezig, deze keer overslaan, Naar morgen en Andere dag… gaan via de wachtrij (TECHNICAL_DESIGN §9.3); Bewerken, notitie plaatsen, reeksacties en Verwijderen uitgeschakeld met "Hiervoor heb je internet nodig" |
| Wijzigen-keuze | — | — | weigering: "Er is niets veranderd" | "Alleen deze keer aangepast" / "Reeks aangepast vanaf za 3 okt" | "deze en volgende" niet getoond zonder recht | "Bezig…" | — | uitgeschakeld |
| Boodschappen | "De lijst is leeg. Wat moet er gehaald worden?" + Vaak gekocht | skelet | algemeen | "Lijst afgerond · Ongedaan maken" | Klaar met winkelen verborgen als niets gekocht is | — | — | toevoegen, afvinken, wijzigen en verwijderen via de wachtrij (TD §9.3); Klaar met winkelen uitgeschakeld met reden |
| Meldingen | "Nog geen meldingen. Hier komt een seintje als iets bijna moet of verlopen is." | skelet | algemeen | — | Alles gelezen uit als alles gelezen is | "Laden…" bij Oudere | meer dan 30: "Oudere meldingen laden" | cache; openen markeert als gelezen via de wachtrij (TD §9.3); Oudere laden uitgeschakeld |
| Meldingen instellen | — | skelet | "Opslaan lukte niet" per schakelaar, schakelaar springt terug | "Opgeslagen" | aanzetten uit als de browser push niet kent, met uitleg (§4.10) | schakelaar toont bezig | — | uitgeschakeld |
| Instellingen + subpagina's | Gezinsleden met alleen jou: "Nodig iemand uit om samen te werken" | skelet | algemeen | "Opgeslagen" / "Link gekopieerd" / "Kai heeft weer toegang" | enige beheerder (BR-24): degraderen, verwijderen en uitzetten uit; jezelf uitzetten uit; account verwijderen uit zonder wachtwoord (§4.13); gezinslid: beheer verborgen | "Bezig…" | — | alleen bekijken, knoppen uit |
| Overzicht | S-03: zie §5.9 | skelet | algemeen | — | — | — | periode met weinig gegevens: getallen tonen, lijsten weglaten | cache |
| Inloggen | — | knop "Bezig…" | zie §4.12 | door naar Vandaag / "Check je mail" | Inloggen uit bij leeg veld | "Bezig…" | — | "Je bent offline. Inloggen kan alleen met verbinding." |
| Geen toegang (uitgezet, §4.15) / Niet meer in een huishouden (§4.16) | — | — | uitloggen mislukt: "Probeer het opnieuw" | — | — | "Bezig…" | naam huishouden onbekend: tekst zonder naam | scherm blijft gewoon staan; Uitloggen werkt ook offline (wist lokaal) |
| Uitnodiging | — | "Uitnodiging controleren…" | zie §4.11 | "Welkom bij Familie" | — | "Bezig…" | — | offline-melding |

## 8. Onboarding en eerste gebruik

In de praktijk zelden gebruikt (het gezin bestaat al, UC-10), maar moet kloppen.

**Account zonder huishouden** (nieuw account dat niet via een uitnodiging kwam). Was het account eerder lid van een huishouden op dit toestel, dan eerst het scherm "Je hoort niet meer bij …" (§4.16):
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
| Account verwijderen | ja, niet als enige beheerder | ja | uitgeschakeld met reden (enige beheerder; of nog geen wachtwoord: "Stel eerst een wachtwoord in via Wachtwoord vergeten", §4.13) |
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
| 22 | `22-niet-meer-in-huishouden.html` | `wf-22-niet-meer-in-huishouden-390x844.png` | Verwijderd uit huishouden / huishouden verwijderd (§4.16) |
| 23 | `23-reeksdetail.html` | `wf-23-reeksdetail-390x844.png` | Reeksdetail vanuit Taken › Terugkerend |

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
- **V-37** — "Volg voorstellen": naam of details wijzigen mag 4 à 5 tikken; afvinken, verplaatsen en bezig blijven 2 tikken. Verwerkt in §0 en §4.5.
- **V-38** — (a): de melding "taak gedaan" gaat ook naar wie afvinkte. Verwerkt in §4.9 en §4.10 (en wireframe 21).
- **V-39** — tijdzone vast op Europe/Amsterdam, alleen zichtbaar, niet te wijzigen. Verwerkt in §2 en §5.8.
- **V-28** — "Volg voorstel": Boodschappen in de onderbalk, Huishouden-overzicht als kaart onderaan Vandaag. Verwerkt in §3, §5.1, §5.6.
- **V-34** — besluit van Jurgen: de naam van de schrijver blijft bij notities staan, ook na account verwijderen of verwijderen uit het huishouden. Verwerkt in §4.13 en §4.15.
- **V-29** — "Volg voorstel": uitgezet = geen toegang tot het huishouden en geen meldingen; account en notities blijven; weer aanzetten herstelt alles. Verwerkt in §4.15, §7, §9 en wireframe 16.

**Aannames (raken geen rechten, gegevens, privacy of scope)**
- Geen. (De eerdere aanname "de deadline schuift mee bij verplaatsen" is een uitvoeringskeuze van de architect geworden: TECHNICAL_DESIGN §6.1, `moveTaskAction`.)

**Voor de solution-architect (geen vraag voor Jurgen)**
- Eigen URL per sheet (taakdetail, reeks, bewerken) voor terugnavigatie en meldingslinks.
- Offline-acties: vastgelegd in TECHNICAL_DESIGN §9.3; §7 volgt dat.
- Herkennen dat een account eerder lid was, voor het scherm "Niet meer in een huishouden" (§4.16), in plaats van door te sturen naar `/onboarding` (TD §4.6).
- Reeks wijzigen vanuit het reeksdetail zonder open keer (§5.2, plan-critic punt 10).
- Laden per periode in de kalender (S-02); "meer laden" bij meldingen (S-03).
- Taakrij: rondje en rij als twee losse knoppen naast elkaar, niet genest (A-01).

## 13. Afvalkalender (W-03)

### 13.1 Uitgangspunten
1. **Niets onthouden, niets instellen.** Je vult één keer het adres in en daarna staan de taken er vanzelf. Er zijn geen instellingen per bak en geen eigen tijden (BR-47).
2. **Een afvaltaak is een gewone taak, met drie verschillen:**
   - het rustige kenmerk "♻ Afvalkalender";
   - een eigen tijd in de rechterkolom ("vanaf 22:00", "vóór 07:45", "vanaf 12:00");
   - minder acties (V-54).

   Afvinken, terugdraaien, bezig, notitie en overslaan werken zoals bij elke taak.
3. **Verbergen, niet uitschakelen.** Verplaatsen, wijzigen en verwijderen kan bij een afvaltaak nooit, dus die knoppen zijn verborgen (§0.6). Eén uitlegregel in het detail zegt waarom.
4. **Het adres zien alleen beheerders** (V-53). In meldingen, pushberichten, historie en taakteksten staat nooit een adres en nooit een naam (BR-58, AC-212).
5. **Eén bron per tijd.** Tijden staan in de rechterkolom (lijst) en in de infolijst (detail), altijd met absolute datums. Afvaltaken hebben geen omschrijving, dus er staat geen vaste tekst die op een andere dag niet meer klopt.
6. **Eerlijk bij storingen, per oorzaak.**
   - Onder de 48 uur staat er alleen een stille regel.
   - Daarboven komen een waarschuwing en één melding aan de beheerders, met een tekst die bij de oorzaak past (V-50, BR-52).
   - Een eenmaal getoonde waarschuwing blijft staan tot het echt weer gelukt is.
   - De laatst bekende ophaaldagen blijven zichtbaar, en voor die datums blijven taken verschijnen; een storing wist niets.
7. **"♻" is een afkorting** in dit document. In de app staat altijd het Lucide-icoon `Recycle`, nooit het teken of een emoji (DS §7.10).

### 13.2 Informatiearchitectuur (aanvulling op §2)
```
Huishouden
├── Afvalkalender (0 of 1; alleen beheerder: postcode, huisnummer, toevoeging, stand van bijwerken)
│     └── Afvaltaken (gewone taken met kenmerk "Afvalkalender", zonder reeks, zonder omschrijving)
│           ├── "… buitenzetten"          (dag vóór de ophaaldag)
│           └── "…bak(ken) binnenzetten"   (ophaaldag, vanaf 12:00)
```
Mentaal model: "De gemeente bepaalt de dag, de app zet de taak klaar, wij vinken af."

### 13.3 Taaknamen (exact; tekst-ID's T-01…T-14 in §13.16)
- Vaste volgorde: restafval, papier, PMD.
- Hoofdletter aan het begin; "PMD" altijd in hoofdletters.

| Bakken op D | Buitenzetten (D−1) | Binnenzetten (D) |
| --- | --- | --- |
| rest | Restafval buitenzetten | Restafvalbak binnenzetten |
| papier | Papier buitenzetten | Papierbak binnenzetten |
| PMD | PMD buitenzetten | PMD-bak binnenzetten |
| rest + papier | Restafval en papier buitenzetten | Restafval- en papierbak binnenzetten |
| rest + PMD | Restafval en PMD buitenzetten | Restafval- en PMD-bak binnenzetten |
| papier + PMD | Papier en PMD buitenzetten | Papier- en PMD-bak binnenzetten |
| alle drie | Restafval, papier en PMD buitenzetten | Restafval-, papier- en PMD-bak binnenzetten |

- **"bak" bij binnenzetten:** de lege bak gaat naar binnen, niet het afval.
- **Enkelvoud bij meerdere bakken:** "Restafval- en papierbak" lees je als "de restafvalbak en de papierbak". De naam is hooguit 47 tekens.
- **Een bak erbij of eraf op D:** de naam van de open taak past zich aan (AC-201).

### 13.4 Tijden en plek in de lijsten (rechterkolom)
Voorbeeld: ophaaldag **di 6 okt** voor restafval en papier. Dit geldt voor Vandaag en Taken › Open.

**Buitenzetten** (gepland op D−1, deadline D 07:45; AC-192):

| Moment | Groep | Rechterkolom | Afvinken |
| --- | --- | --- | --- |
| vóór ma 5 okt | Binnenkort | dagnotatie van D−1: **morgen** (op zo 4 okt) of **ma 5 okt** | ja |
| ma 5 okt, hele dag | Vandaag (gesorteerd op 21:00) | **vanaf 22:00** | ja, niet geblokkeerd |
| di 00:00–07:45, open | Vandaag | **vóór 07:45** | ja |
| di na 07:45, open | Verlopen | bestaand verlopen-patroon, bijv. "1 uur" / "te laat" | ja, telt als te laat |
| einde di, nog open | verdwijnt: vanzelf overgeslagen, telt als vergeten (BR-54, AC-210) | — | — |

**Binnenzetten** (gepland op D, beschikbaar vanaf D 12:00, deadline einde van D; AC-193):

| Moment | Groep | Rechterkolom | Afvinken |
| --- | --- | --- | --- |
| vóór ma 5 okt | Binnenkort | **di 6 okt** | ja |
| ma 5 okt | Binnenkort | **morgen** | ja |
| di vóór 12:00 | Binnenkort, **bovenaan** | **vanaf 12:00** | ja, niet geblokkeerd |
| di vanaf 12:00 | Vandaag | leeg (gewoon vandaag) | ja |
| vanaf wo, open, tot hij vervalt (volgende rij) | Verlopen, bestaand patroon, gerekend vanaf het einde van di: wo 09:00 "9 uur" / "te laat"; vanaf wo ca. 23:30 "1 dag" / "te laat" (dus do 09:00 "1 dag" / "te laat"); daarna "2 dagen" / "te laat", enzovoort | — | ja, telt als te laat |
| begin van de dag van de volgende buitenzet-taak, **en uiterlijk begin van D+7 (di 13 okt, 00:00)**, wat het eerst komt, nog open | verdwijnt: vanzelf overgeslagen, telt als vergeten (BR-54, AC-210) | — | — |

- **Bovengrens voor binnenzetten (D+7):**
  - Een binnenzet-taak staat hooguit tot het begin van de zevende dag na de ophaaldag bij Verlopen. In het voorbeeld is dat tot en met ma 12 okt; op di 13 okt 00:00 vervalt hij.
  - Meestal komt de volgende buitenzet-taak eerder, bij wekelijks restafval al op D+6.
  - De grens is er voor een lange ophaalpauze (papier eens per 4 weken, de jaarwisseling) of een storing zonder nieuwe datums. Een rij die wekenlang rood blijft staan, helpt niemand.
  - Er komt geen melding bij het vervallen.
  - Gelijk aan BR-54, AC-210 en TD §18.8.6 (`WASTE_IN_EXPIRE_DAYS = 7`).
- **"morgen" en niet "di 6 okt" op D−1:** dat is de bestaande dagnotatie van Binnenkort (DS §7.4). Samen met "vanaf 22:00" leest het als "vanavond buiten, morgen binnen". De ophaaldag zelf staat in het detail.
- Er staat **nooit "21:00"** in een rij, kaart of kalendervak. 21:00 is alleen het moment van de herinnering.
- **Kalender** (planning, los van het huidige tijdstip): buitenzetten op D−1 met "vanaf 22:00", binnenzetten op D met "vanaf 12:00". Verlopen volgt het bestaande patroon.
- **Geen deadlinebadges** "verloopt over …" of "uiterlijk morgen" bij afvaltaken (V-50: geen deadline-nadert). Alleen "… te laat" bij Verlopen.
- **Gedaan en overgeslagen:** zoals elke rij. Het kenmerk blijft staan.

### 13.5 Het kenmerk "Afvalkalender"
- **In de rij (2e regel):** `♻ Afvalkalender` in plaats van ritme en categorie. Het is geen badge, geen kleur en geen vlak (DS §7.13.1).
- **Met bezig:** `♻ Afvalkalender bezig`, volgens het patroon van vis-01.
- **Recycle, geen prullenbak:** een prullenbak betekent in deze app "verwijderen", en dat kan hier juist niet.
- **Geen categorie "Buiten" in de rij.** In het categoriefilter valt een afvaltaak wel onder Buiten.
- **In het detail:** de bovenregel `♻ Afvalkalender · ophaaldag di 6 okt`.

### 13.6 Taakdetail van een afvaltaak (aanvulling op §5.5)
**Hoofdactie:** **Afvinken**. Bij een gedane taak staat er "Gedaan om 22:14 · op tijd" met **Terugzetten** (in de oude UI heet die knop "Afvinken ongedaan maken").

**Secundair, direct zichtbaar (nieuwe UI):**
- **Ik ben ermee bezig**, of **Niet meer bezig**;
- **Deze keer overslaan**;
- er is geen ⋯-menu.

**Verborgen voor iedereen, ook voor beheerders (AC-208):** Naar morgen, Andere dag…, Bewerken, Verwijderen, reeksacties en Vorige keren.

**Geen omschrijving.** Afvaltaken hebben een lege omschrijving. Alle tijden staan in de infolijst.

**Infolijst voor buitenzetten:**

| Label | Waarde |
| --- | --- |
| Mag buiten | ma 5 okt vanaf 22:00 |
| **Uiterlijk** | **di 6 okt 07:45** (verlopen: in `overdue`, met daaronder "1 uur te laat") |
| Herinnering* | ma 5 okt 21:00 |

**Infolijst voor binnenzetten:**

| Label | Waarde |
| --- | --- |
| Binnenzetten | di 6 okt vanaf 12:00 |
| **Uiterlijk** | **di 6 okt, einde van de dag** |
| Herinnering* | di 6 okt 18:00 |

\* **Herinnering:** deze rij staat er alleen als aan alle drie de voorwaarden is voldaan:
1. de eigen instelling "Herinneringen" van de kijker staat aan (V-50, AC-211; standaard uit voor gezinsleden);
2. de taak is open;
3. het herinneringsmoment ligt nog in de toekomst.

Anders ontbreekt de rij. Er komt dan niet "(uit)" of iets anders voor in de plaats.

**Gedaan:** er komt de bestaande rij "Gedaan" bij.

**Uitlegregel** onder de infolijst (`text-meta`, `text-3`): T-27.

**Notities:** zoals bij elke taak.

**Deze keer overslaan:**
- **Bij buitenzetten:** zonder bevestiging. De melding onderin is T-31 met **Ongedaan maken**, en dat zet beide taken terug (BR-53, AC-209).
- **Bij binnenzetten:** de bestaande overslaan-melding. Buitenzetten blijft ongemoeid.

**"Toch nog doen"** (bij een overgeslagen afvaltaak) staat er alleen zolang de ophaaldag D nog niet voorbij is. Daarna zou de taak bij de volgende ronde meteen weer vervallen.

**Directe link naar bewerken** (`/taken/<id>/bewerken`, `?bewerk=<id>`): die opent het taakdetail. Lukt een verplaatsing toch (bijvoorbeeld uit een oude offline wachtrij), dan komt melding T-33.

### 13.7 Flows

#### 13.7.1 Afvalkalender aanzetten (UC-13, AC-183), beheerder
1. Tandwiel (1) → rij **Afvalkalender · Uit** (2). In de oude UI: de springlink "Afval", of scrollen.
2. Toestand A: korte uitleg (T-40) en het formulier. Typen.
3. **Adres zoeken** (3). De knop toont "Zoeken…" en de velden zijn tijdelijk uitgeschakeld.
4. Toestand C, **Klopt dit?**:
   - het adres zoals de gemeente het kent, met als plaats altijd "Den Haag" (T-45a). Geeft de bron geen straat, dan de vorm "2517 AB 12A, Den Haag". Dit wordt niet bewaard (BR-58);
   - de eerstvolgende ophaaldag per bak;
   - de uitleg T-46.
5. **Ja, aanzetten** (4). De knop toont "Bezig…". Daarna volgt toestand G:
   - zijn er taken klaargezet: melding T-90 "… · **Bekijken**", en Bekijken opent de Kalender (week);
   - ligt de eerstvolgende ophaaldag verder dan 14 dagen weg, dan zijn er nog geen taken. Dan komt melding T-90b, zonder Bekijken (AC-183 (b)). De datum staat al onder Volgende ophaaldagen in G.

**4 tikken plus typen.** Eenmalig staat in G de tip T-53 of T-54 (V-56, BR-57), weg te tikken met ✕.

**Foutpaden.** Er wordt nooit iets bewaard, de velden blijven gevuld, en een eerder adres blijft ongewijzigd (AC-188, AC-214).

| Situatie | Toestand | Tekst | Wat kan de beheerder doen |
| --- | --- | --- | --- |
| Vorm klopt niet (bij het verlaten van een veld en bij Zoeken; AC-184) | A met veldfout | T-43, T-44, T-44b | aanpassen. Zoeken is uitgeschakeld zolang postcode of huisnummer leeg is |
| Onbekend of buiten Den Haag (AC-185) | D | T-60 | aanpassen, opnieuw zoeken |
| Meerdere adressen, geen toevoeging (AC-187) | C2 | T-61 en een rij per adres | op een rij tikken (1 tik) → C |
| Buiten januari: de gemeente kent voor dit adres **vaststaand** geen rest, papier of PMD (AC-186) | E | T-62 | Ander adres |
| Bron onbereikbaar of onbruikbaar (> 8 s, fout, formaat; AC-188) | F | T-63 of T-63b | **Opnieuw proberen** (primair) |
| De gemeente geeft voor restafval, papier en PMD samen geen enkele komende ophaaldag (vandaag of later), terwijl het adres wel bakken heeft. Dat geldt ook eind november of december na de laatste ophaaldag van het jaar: de jaareinde-uitzondering van het bijwerken geldt bij het instellen niet. Óf het is januari en de kalender van het lopende jaar is nog helemaal leeg (AC-237). Een eerstvolgende dag verder dan 14 dagen weg is géén F2: dan gewoon C, en na aanzetten T-90b (AC-183 (b)) | F2 | T-64 of T-64b | **Adres zoeken** (primair), later opnieuw |
| Opslaan mislukt | C blijft staan | T-65 | Ja, aanzetten opnieuw |
| Intussen geen beheerder meer (AC-189) | → J | T-66 (melding onderin) | — |
| Offline | A en C: knoppen uit | T-67 | — |

- **E of F2 bij twijfel:**
  - E toont de app alleen buiten januari, en alleen als vaststaat dat de gemeente voor dit adres geen rest, papier of PMD noemt (AC-186).
  - In januari is dat niet vast te stellen. Een voorbeeld is 2 januari, als de kalender van het nieuwe jaar nog niet online staat en de app dus geen enkele datum ziet. Dan toont hij F2, ook als de kalender van het vorige jaar geen datums had.
  - Liever één keer te veel "probeer het over een paar dagen" dan ten onrechte "gebruiken jullie een ondergrondse container?".
- **Twee keer tikken:** er ontstaat één adres (AC-191). Twee beheerders tegelijk: de laatste bevestiging geldt, zonder melding.
- **Terugweg:** op C staat **Ander adres** (tekstknop), terug naar A met gevulde velden. De pagina verlaten = niets bewaard, zonder vraag "Wijzigingen weggooien?".

#### 13.7.2 Adres wijzigen (verhuizen), beheerder (AC-214)
1. G → **Wijzigen** naast het adres (1). Het formulier opent gevuld met het huidige adres:
   - titel "Ander adres";
   - regel T-47;
   - knoppen **Adres zoeken** en **Annuleren**.
2. **Adres zoeken** (2) → C, met de extra regel T-48.
3. **Ja, dit adres gebruiken** (3) → G + melding T-91.

- **Hetzelfde adres als het bewaarde:** melding T-92. De taken, notities en "bezig" blijven. Er komt nooit "te snel" (AC-222).
- **Fouten:** zoals in 13.7.1, met de "huidige adres"-varianten T-63b en T-64b. Het oude adres en de oude taken blijven. Zit het bewaarde adres zelf in dezelfde jaareindesituatie, dan toont G daar alleen T-73 (AC-237, AC-220).
- **Annuleren:** terug naar G (of naar H als er een storing is).

#### 13.7.3 Afvalkalender uitzetten, beheerder (AC-213)
1. G → onderaan **Afvalkalender uitzetten…** (danger-quiet) (1).
2. Sheet I, met de titel T-80 en de tekst T-81, T-81b of T-81c, afhankelijk van het aantal open afvaltaken. Knoppen: **Uitzetten** (danger) en **Annuleren** (2).
3. Terug naar A, met melding T-93. Er is geen Ongedaan maken, want het adres is gewist.

- **Waarom bevestigen:** het adres is weg en de taken verdwijnen voor iedereen.
- **Annuleren:** er verandert niets.
- **Offline:** de knop is uitgeschakeld (T-67).

#### 13.7.4 Dagelijks gebruik (UC-14), iedereen
- **Avond vóór de ophaaldag:** Vandaag toont buitenzetten met "vanaf 22:00", en Binnenkort toont binnenzetten met "morgen".
  - Om 21:00 komt de push (M-01) naar wie Herinneringen aan heeft.
  - Tik op de push → detail → **Afvinken** (2 tikken). Of op Vandaag het rondje (1 tik).
- **Ophaaldag:**
  - tot 07:45 staat buitenzetten er nog met "vóór 07:45";
  - binnenzetten staat vóór 12:00 bovenaan Binnenkort ("vanaf 12:00"), en vanaf 12:00 onder Vandaag;
  - om 18:00 komt de push (M-02), alleen als de taak nog open is (AC-194).
- **Na de ophaaldag:** een open binnenzet-taak staat vanaf de dag erna bij Verlopen. Hij blijft daar tot de dag van de volgende buitenzet-taak begint, en uiterlijk tot het begin van de zevende dag na de ophaaldag (D+7). Daarna vervalt hij vanzelf en telt hij als vergeten (§13.4, AC-210).
- **Afvinken en terugdraaien:** de melding "Gedaan: … · Ongedaan maken" werkt zoals in §4.1 en §4.2. Buiten en binnen worden los afgevinkt (AC-207).
- **Offline:** afvinken, bezig en overslaan gaan via de wachtrij (TD §9.3). Bij offline overslaan van buitenzetten toont de app binnenzetten meteen ook als overgeslagen. De server bevestigt dat bij verzenden.

#### 13.7.5 Storing (BR-52, AC-204, AC-205), alleen beheerders
- **Minder dan 48 uur, of één enkele hapering** (er is een foutcode, maar nog geen storing):
  - onder de kop van G staat alleen de stille regel T-71 (bij `ADDRESS_GONE`: T-71b);
  - er is geen balk, geen melding en geen knop;
  - de app probeert het elk uur opnieuw;
  - de taken lopen door op de bewaarde datums, net als bij een storing (hieronder).
- **Minder dan 48 uur zonder foutcode** (de achtergrondtaak heeft het ophalen een tijd niet gedaan): gewoon G. De kop toont eerlijk het laatste tijdstip, bijvoorbeeld "bijgewerkt gisteren 06:15". Er komt geen stille regel.
- **Storing** (`health = failed`, BR-52): langer dan 48 uur zonder succes, om welke reden ook; of minstens twee vastgelegde lege antwoorden achter elkaar (geen enkele komende ophaaldag), met minstens een uur tussen het eerste en het laatste en zonder andere uitkomst ertussen. Het jaareinde telt niet: in november en december, na de laatste ophaaldag van het jaar en zolang de kalender van volgend jaar nog niet online staat, is er geen storing, alleen de stille regel T-73 (zie "Kalender van volgend jaar ontbreekt" hieronder). Bij een storing:
  - de beheerders krijgen één melding, volgens de oorzaak: M-03 (onbereikbaar, onbruikbaar, of **geen foutcode**), M-04 (leeg) of M-05 (adres niet gevonden);
  - de rij in Instellingen toont "Niet bijgewerkt" (T-37);
  - de pagina toont toestand H: de balk bovenaan, met tekst per oorzaak (§13.8.2);
  - onder de balk blijven de Volgende ophaaldagen de laatst bekende stand tonen, ook bij een leeg antwoord (H2). Een storing wist geen datums (BR-52, §13.8.2);
  - de afvaltaken lopen door op de bewaarde datums. Bestaande taken worden niet verwijderd, verschoven of hernoemd. Voor al bekende ophaaldagen die binnen de 14 dagen komen, worden wel taken klaargezet (BR-50), en het vanzelf vervallen (§13.4) loopt ook door. Alleen wijzigingen van de gemeente komen er pas bij als het weer lukt;
  - **geen foutcode** (de achtergrondtaak lag stil of sloeg het ophalen steeds over) geeft H1 met M-03. T-76 is zo geformuleerd dat hij dan ook klopt.
- **Een storing blijft een storing tot het echt weer lukt:**
  - is de storing eenmaal vastgesteld, dan blijven balk H en "Niet bijgewerkt" staan tot het bijwerken weer gelukt is;
  - verandert intussen de oorzaak (bijvoorbeeld eerst leeg, dan onbereikbaar), dan verandert alleen de tekst in de balk (H2 wordt H1). Er komt geen tweede melding;
  - de balk maakt nooit tussendoor plaats voor de stille regel T-71;
  - reden: de beheerder heeft net een storingsmelding gekregen, en er is niets hersteld.
- **Kalender van volgend jaar ontbreekt:** dit geldt in december als het venster al tot in januari loopt, of in november en december als de laatste ophaaldag van dit jaar al geweest is. De gemeente heeft dan nog geen kalender voor volgend jaar.
  - Stille regel T-73 onder de kop, geen balk en geen melding.
  - Is de kalender van het lopende jaar helemaal leeg (bijvoorbeeld op 1 januari), dan volgt H2.
  - Een lege periode van een paar weken, bijvoorbeeld papier eens per 4 weken, is geen storing.
- **Weer gelukt:** de balk en "Niet bijgewerkt" verdwijnen vanzelf, en wijzigingen van de gemeente worden verwerkt. Er komt geen melding "weer gelukt". Na een handmatige poging komt wel melding T-94. Een latere, nieuwe storing geeft opnieuw één melding.
- **Gezinsleden** zien niets van een storing (AC-205).

#### 13.7.6 "Opnieuw proberen" (alleen in balk H, en als opnieuw zoeken in toestand F)
- **Waar de knop staat:** alleen in balk H.
- **G′ heeft bewust geen knop.** Bij een enkele hapering herstelt de app zich elk uur zelf (T-71 zegt dat), en een knop nodigt alleen uit tot nerveus tikken.
- **Gevolg:** vóór er een storing is, kan niemand handmatig proberen. Een storing kan dus ook nooit door vaker tikken eerder ontstaan. De regel "vaker proberen maakt een storing niet eerder" is een regeltest op de gezondheidsregel, geen scenario in het scherm (AC-236).

**In balk H:**

| Stap | Wat de beheerder ziet | Wat hij kan doen |
| --- | --- | --- |
| Tikken | de knop wordt "Bezig…" (`text-3`, uitgeschakeld), hooguit 12 s. De rest van de pagina blijft bruikbaar | wachten |
| Gelukt | de balk verdwijnt. De kop wordt "Aan · bijgewerkt vandaag 14:32" en Volgende ophaaldagen zijn bijgewerkt. Melding onderin T-94 | niets nodig |
| Nog steeds fout | de balk **blijft**, met eventueel een andere oorzaaktekst als de oorzaak veranderd is. Onder de uitleg staat de regel T-78 met de tijd van de poging. De knop is weer actief. Volgende ophaaldagen blijven de laatst bekende stand | later opnieuw, of bij H3 "Adres controleren" |
| Te snel (`too_soon`: iemand anders of de achtergrond probeerde het binnen de minuut) | regel T-79 op dezelfde plek als T-78. Er is **geen** melding onderin | na een minuut opnieuw |
| Geen beheerder meer | melding T-66; de pagina toont J | — |
| Offline | de knop is uitgeschakeld, met T-67 eronder | — |

- De regels T-78 en T-79 staan in de balk, die `role="status"` heeft. Ze blijven staan tot de volgende poging of tot de pagina opnieuw geladen wordt.
- **Route om T-79 in het scherm te zien:** twee beheerders hebben tegelijk balk H open en tikken binnen een minuut allebei op "Opnieuw proberen". Of één beheerder tikt vlak nadat de achtergrondtaak het ophalen probeerde.

**In toestand F:** "Opnieuw proberen" is gewoon opnieuw zoeken. Je ziet "Zoeken…" en daarna C, C2, D, E, F of F2.

### 13.8 Scherm: Instellingen › Afvalkalender

**Nieuwe UI (WP7):**
- een subpagina `/instellingen/afvalkalender`, met "‹ Instellingen";
- `/instellingen#afvalkalender` stuurt door naar die subpagina (oude meldingen).

Rij in §5.8:

| Groep | Rij (rechts de waarde) | Subpagina | Wie |
| --- | --- | --- | --- |
| Huishouden | Afvalkalender · Aan / Uit / ⓘ Niet bijgewerkt (T-35…T-37) | aanzetten, status, wijzigen, uitzetten | **Beheerder:** beheren. **Gezinslid:** rij zonder pijl, waarde Aan of Uit, met de regel T-38 of T-39 eronder |

**Oude UI (WP3b):**
- `SettingsSection` "Afvalkalender" (icoon recycle, beschrijving T-34), direct na Huishouden, plus de springlink "Afval";
- dezelfde toestanden, maar inline. C vervangt het formulier in de sectie;
- de uitzet-sheet is de bestaande Dialog;
- een gezinslid ziet alleen J (T-38b of T-39b).

**Hoofdactie per toestand:**

| Toestand | Hoofdactie |
| --- | --- |
| A | Adres zoeken |
| C | Ja, aanzetten (of Ja, dit adres gebruiken) |
| F | Opnieuw proberen |
| F2 | Adres zoeken |
| G | geen hoofdactie: dit is een statusweergave |
| H | Opnieuw proberen, secundair (bij H3 ook Adres controleren) |

#### 13.8.1 Toestanden

| # | Toestand | Wat de gebruiker ziet | Wat hij kan doen |
| --- | --- | --- | --- |
| — | Laden | skelet: titel + 3 rijen | — |
| — | Laden mislukt | T-68 + **Opnieuw** | opnieuw |
| A | Uit, beheerder | uitleg T-40, velden T-41, privacyregel T-42 | Adres zoeken (uitgeschakeld zolang postcode of huisnummer leeg is) |
| A′ | Wijzigen | titel "Ander adres", T-47, velden gevuld | Adres zoeken · Annuleren |
| B | Zoeken | knop "Zoeken…", velden uitgeschakeld | wachten |
| C | Klopt dit? | T-45…T-46 (bij wijzigen + T-48) | Ja, aanzetten / Ja, dit adres gebruiken · Ander adres |
| C2 | Meerdere adressen | T-61 + een aantikbare rij per adres ("12", "12A", "12B"), met Ander adres eronder | een rij kiezen (1 tik) |
| D | Onbekend of buiten Den Haag | regel T-60 in `overdue` boven de velden, velden gevuld, **zonder** rode rand | aanpassen, opnieuw zoeken |
| E | Geen bakken (vaststaand, niet in januari) | T-62 | Ander adres |
| F | Bron onbereikbaar | `sunken`-balk T-63/T-63b boven het formulier, velden gevuld | Opnieuw proberen |
| F2 | Nog geen komende ophaaldagen (ook in januari zonder kalender, en bij het instellen na de laatste ophaaldag van het jaar) | `sunken`-balk T-64/T-64b boven het formulier, velden gevuld | Adres zoeken |
| — | Bezig (opslaan, uitzetten) | knop "Bezig…" | wachten |
| — | Opslaan mislukt | T-65 bovenaan C, invoer blijft | opnieuw |
| G | Aan, in orde | kop T-70, adresrij, Volgende ophaaldagen (op datum), uitleg T-52, eenmalige tip, Uitzetten… | Wijzigen · Uitzetten… |
| G′ | Aan, hapering (foutcode, nog geen storing) | G + stille regel T-71/T-71b onder de kop; **geen** knop | idem als G |
| G″ | Aan, kalender volgend jaar ontbreekt: in december als het venster tot in januari loopt, **of** in november en december zonder komende ophaaldag terwijl de kalender van volgend jaar nog niet online staat | G + stille regel T-73 | idem als G |
| — | Gedeeltelijk | een bak zonder datum: "nog geen ophaaldag bekend" (T-45b). In G en H alleen als er voor die bak in de bewaarde stand echt geen datum vanaf vandaag is | — |
| H | Aan, storing | kop T-72, balk per oorzaak (§13.8.2), sectiekop met "· stand za 26 sep" en daaronder de laatst bekende ophaaldagen. Blijft staan tot het bijwerken weer gelukt is | Opnieuw proberen · (H3: Adres controleren) · Wijzigen · Uitzetten… |
| — | Opnieuw proberen | §13.7.6 | — |
| I | Bevestiging uitzetten | sheet T-80 + T-81/T-81b/T-81c | Uitzetten · Annuleren |
| J | Gezinslid | Aan/Uit + regel T-38/T-39 | niets |
| — | Offline | laatst bekende stand; knoppen uit met T-67 | bekijken |

**Voorrang (hooguit één regel of balk onder de kop):**
- H gaat voor alles. T-71, T-71b en T-73 staan er dan niet.
- G′ en G″ sluiten elkaar uit, want G″ vraagt een geslaagde laatste bijwerking.
- Zonder foutcode en zonder storing: G, zonder stille regel.

**Volgende ophaaldagen (G, G′, G″ en H):** per bak de eerstvolgende bewaarde datum vanaf vandaag, gesorteerd op datum. Datums in het verleden staan er niet. Heeft een bak in de bewaarde stand geen datum vanaf vandaag, dan staat daar T-45b.

#### 13.8.2 Storingsbalk H per oorzaak
- De tekst hangt af van `last_error_code`, dus van de laatst bekende oorzaak, en niet van de reden van het alarm.
- Opmaak volgens DS §7.13.4: `sunken`, geen rood.
- De balk blijft staan tot het bijwerken weer gelukt is. Alleen de variant (H1/H2/H3) volgt de laatste oorzaak.
- **De ophaaldagen blijven zichtbaar, ook bij H2.**
  - Onder de balk staat altijd "Volgende ophaaldagen · stand <dag van de laatste geslaagde bijwerking>", met de laatst bekende datums (§13.8.1).
  - Een leeg antwoord van de gemeente wist die datums niet (BR-52: de bekende ophaaldagen blijven ongewijzigd). H2 toont dus gewoon de bewaarde datums, en **niet** drie keer "nog geen ophaaldag bekend".
  - T-45b staat er alleen bij een bak waarvoor in de bewaarde stand echt geen datum vanaf vandaag meer is. Bijvoorbeeld op 1 januari, als de laatst bekende datums allemaal in het vorige jaar lagen.
  - Hetzelfde geldt voor H1 en H3.

| # | Oorzaak (`last_error_code`) | Titel | Uitleg | Knoppen |
| --- | --- | --- | --- | --- |
| H1 | `UNREACHABLE`, `FORMAT` of **geen foutcode** (achtergrondtaak lag stil) | T-75 | T-76 | Opnieuw proberen |
| H2 | `SUSPECT_EMPTY` | T-77 | T-77a (december en januari) of T-77b (andere maanden) | Opnieuw proberen |
| H3 | `ADDRESS_GONE` | T-77c | T-77d | **Adres controleren** (opent A′, gevuld) · Opnieuw proberen |

### 13.9 Formulier adres (aanvulling op §6)

| Veld | Type | Standaard | Validatie (moment) |
| --- | --- | --- | --- |
| Postcode | tekst, `autocomplete="postal-code"`, `autocapitalize="characters"`, max 7, plaatshouder "2517 AB" | leeg (bij wijzigen: het huidige) | bij verlaten en bij Zoeken: 4 cijfers (niet beginnend met 0) + 2 letters. Bij verlaten wordt de postcode netjes gezet: "2517ab" → "2517 AB". Fout: T-43 |
| Huisnummer | `inputmode="text"`, max 8 | leeg | 1–99999. "12a" of "12 a" wordt bij verlaten stil 12 + toevoeging "A" (AC-187). Fout: T-44 |
| Toevoeging (optioneel) | tekst, max 4, plaatshouder "A of 2", `autocapitalize="characters"` | leeg | letters en cijfers, hooguit 4. Fout: T-44b |

- **Indeling:** postcode en huisnummer naast elkaar (60/40), de toevoeging eronder in de linkerkolom.
- **Waarom tekst voor huisnummer:** een numeriek toetsenbord maakt "12a" onmogelijk. De gebruiker typt zoals hij het adres kent, en de app splitst het.
- **Vormfout:** foutregel bij het veld. **Antwoord van de bron:** regel of balk boven het formulier (D, F, F2). De velden blijven altijd gevuld.
- **Dubbel tikken:** voorkomen doordat de knop tijdens het zoeken uitgeschakeld is. Een eventuele korte wachttijd tussen twee pogingen is voor de gebruiker onzichtbaar; de knop toont dan gewoon "Zoeken…".

### 13.10 Meldingen (aanvulling op §4.9)
Geen adres, geen straat, geen namen (BR-58, AC-212). Titel en tekst in de lijst Meldingen zijn gelijk aan de push. Het label in de lijst is T-39c.

| ID | Wanneer | Aan wie | Titel | Tekst | Tik opent |
| --- | --- | --- | --- | --- | --- |
| M-01 | D−1 21:00, buitenzetten open (AC-194) | wie "Herinneringen" aan heeft (V-50, AC-211) | Herinnering: <taaknaam> | Morgen ophaaldag. Mag vanaf 22:00 buiten, uiterlijk morgen 07:45. | taakdetail |
| M-02 | D 18:00, binnenzetten open | idem | Herinnering: <taaknaam> | één bak: "Vandaag was de ophaaldag. Zet de bak vandaag nog binnen." · meer bakken: "Vandaag was de ophaaldag. Zet de bakken vandaag nog binnen." | taakdetail |
| M-03 | storing, oorzaak `UNREACHABLE`/`FORMAT`, of **geen foutcode** (de achtergrondtaak lag stil) | alleen actieve beheerders, één keer per storing (AC-205) | De afvalkalender kon niet worden bijgewerkt | Laatst gelukt op <za 26 sep>. Nieuwe ophaaldagen komen er pas bij als het weer lukt. Kijk tot die tijd zelf op huisvuilkalender.denhaag.nl. | Instellingen › Afvalkalender (AC-223) |
| M-04 | storing, oorzaak `SUSPECT_EMPTY` | idem | De afvalkalender kon niet worden bijgewerkt | De gemeente geeft geen komende ophaaldagen meer. Soms staat de nieuwe kalender nog niet online. Kijk zelf op huisvuilkalender.denhaag.nl. | idem |
| M-05 | storing, oorzaak `ADDRESS_GONE` | idem | De afvalkalender vindt het adres niet meer | De gemeente kent het adres niet meer. Controleer het in Instellingen › Afvalkalender. Tot die tijd komen er geen nieuwe ophaaldagen bij. | idem |

- De oorzaak bij het versturen bepaalt de variant. Er komt één melding per storing, ook als de oorzaak tijdens de storing verandert. Een storing loopt tot het bijwerken weer gelukt is (§13.7.5).
- Geen "deadline nadert" en geen "verlopen" voor afvaltaken (V-50, AC-211). Ook geen melding bij het vanzelf vervallen van een taak.
- De storingsmelding komt altijd in de lijst, plus push als die op het toestel aan staat. Er is geen eigen schakelaar.

### 13.11 Taken, Kalender en Overzicht
- **Taken › Open:** afvaltaken in de gewone groepen, met kenmerk en rechterkolom volgens §13.4.
  - Zoeken op "afval", "papier" of "PMD" vindt ze via de naam.
  - In het filter vallen ze onder Buiten.
- **Taken › Terugkerend** (nieuwe UI, WP6): bovenaan één informatierij T-96.
  - Beheerder: met een pijl naar Instellingen › Afvalkalender.
  - Gezinslid: zonder pijl.
  - Alleen zichtbaar als de afvalkalender aan staat.
- **Kalender:**
  - afvaltaken op hun dag, met kenmerk en tijd volgens §13.4;
  - **slepen staat uit**, in de oude en de nieuwe UI;
  - "+ Taak" per dag blijft;
  - verder dan 14 dagen vooruit staan er geen stippellijnvoorbeelden. Onder de eerste week zonder afvaltaken staat eenmalig T-95.
- **Overzicht** (nieuwe UI, WP8): in "Vaak te laat of vergeten" en "Vaak gedaan" tellen alle afvaltaken samen als T-97 en T-98 (AC-234).

### 13.12 Rechten (aanvulling op §9)

| Element | Beheerder | Gezinslid | Hoe bij "nee" |
| --- | --- | --- | --- |
| Aanzetten, adres wijzigen, uitzetten (AC-189) | ja | nee | verborgen; J |
| Adres en bijwerkstatus zien (AC-190) | ja | nee (V-53) | verborgen |
| Storingsbalk, stille regels, storingsmelding, "Opnieuw proberen" (AC-205, AC-236) | ja | nee | — |
| Afvinken, terugzetten, bezig, notitie, overslaan (AC-207, AC-209) | ja | ja | — |
| Verplaatsen, bewerken, verwijderen, slepen, omzetten (AC-208) | nee | nee | verborgen + uitlegregel T-27 |
| Herinneringsrij in het detail | als de eigen "Herinneringen" aan staat | idem | rij ontbreekt |

### 13.13 Oude UI (WP3b) en nieuwe UI (WP4–WP8)

#### 13.13.1 Oude UI (live op `main`, AC-217)

| Onderdeel | Wat er verandert (alleen voor afvaltaken) |
| --- | --- |
| Instellingen | `SettingsSection id="afvalkalender"` na Huishouden, springlink "Afval", toestanden A–J inline. D gebruikt de tekststijl van de veldfout als één regel boven de velden, zonder rode rand. F, F2 en H zijn `bg-muted`-balken, niet rood |
| Taakkaart | meta: recycle-icoon + "Afvalkalender" in plaats van categorie en ↻. Klokje: "vanaf 22:00" / "vóór 07:45" / "vanaf 12:00" in plaats van "21:00". **Geen** deadlinebadge behalve "… te laat"; bij Verlopen alleen de badge, zonder klokje |
| Binnenkort | binnenzetten op D vóór 12:00: "Vandaag" + "vanaf 12:00". Op D−1: "Morgen" (bestaande `relativeDayLabel`) |
| Taakdetail | kopregel: statusbadge + meta-tekst "♻ Afvalkalender · ophaaldag di 6 okt" (geen nieuwe badge). **Geen** omschrijving. ⋯-menu alleen met Ik ben ermee bezig / Niet meer bezig / Deze keer overslaan / Toch nog doen (volgens 13.6). Bewerken, Verwijderen en de scheidingslijn zijn weg. De rijen Wanneer (met datumkiezer), Beschikbaar, Uiterlijk en Categorie worden vervangen door de afval-infolijst uit 13.6; de rij Gedaan blijft. Daaronder uitlegregel T-27 (`text-sm text-muted-foreground`) |
| Kalender | "21:00" wordt "vanaf 22:00"; binnenzetten "vanaf 12:00"; `useDraggable` uit |
| Meldingen | teksten M-01…M-05; label T-39c voor `waste_sync_failed` |
| Tip | T-54 (verwijst naar Terugkerend op dezelfde pagina) |

#### 13.13.2 Nieuwe UI (`v2-ui`): per werkpakket, zodat analist en reviewers ertegen kunnen toetsen

| WP | Onderdeel | Toetspunt |
| --- | --- | --- |
| WP4 | snapshot bevat de afvalvelden | een afvaltaak toont kenmerk en rechterkolom (anders onzichtbaar) |
| WP5 | rij en detail | §13.4, §13.5, §13.6: geen ⋯, twee secundaire knoppen, herinneringsrij volgens de instelling, geen omschrijving |
| WP6 | Taken › Terugkerend, bewerk-URL | informatierij T-96; `?bewerk=<id>` van een afvaltaak opent `?taak=<id>` |
| WP7 | subpagina | toestanden §13.8.1 en §13.8.2; doorsturen vanaf `/instellingen#afvalkalender` |
| WP8 | Kalender, Meldingen, Overzicht | slepen uit; T-95; meldingslijst M-03…M-05 met label T-39c; groepering T-97/T-98 |

#### 13.13.3 Checkpoint CP-W03: rook-screenshots WP3b
De lijst met rook-screenshots voor WP3b staat in TD §18.16 U3 (CP-W03). Dat is de enige lijst.

### 13.14 Wireframes (tekst, 390×844, nieuwe UI tenzij anders vermeld)

**A — Uit, beheerder**
```
‹ Instellingen
Afvalkalender
De app leest de huisvuilkalender van Den Haag
en zet voor restafval, papier en PMD zelf de
taken klaar: de avond ervoor buitenzetten, op
de ophaaldag binnenzetten.

Postcode            Huisnummer
[ 2517 AB        ]  [ 12        ]
Toevoeging (optioneel)
[ A of 2         ]

[        Adres zoeken             ]   ← primair
Alleen postcode en huisnummer gaan naar de
gemeente. Alleen beheerders zien het adres.
```

**C — Klopt dit?**
```
‹ Instellingen
Klopt dit?
Zo kent de gemeente jullie adres.
Laan van Meerdervoort 12A, Den Haag

Eerstvolgende ophaaldagen
  Restafval ................ di 6 okt
  Papier ................... wo 7 okt
  PMD ...................... vr 2 okt

De avond vóór elke ophaaldag staat er een taak
buitenzetten, met een herinnering om 21:00. Op
de ophaaldag vanaf 12:00 een taak binnenzetten,
met een herinnering om 18:00. Iedereen in het
huishouden ziet de taken. Het adres zien alleen
beheerders.

[        Ja, aanzetten            ]   ← primair
          Ander adres
```

**C2 — Meerdere adressen** (elke rij is een knop, 1 tik)
```
Op nummer 12 staan meerdere adressen.
Welke is van jullie?
  12                                   ›
  12A                                  ›
  12B                                  ›
          Ander adres
```

**D — Onbekend**
```
⊘ Dit adres staat niet in de huisvuilkalender    ← overdue, geen rand om velden
  van Den Haag. Controleer postcode en
  huisnummer. De afvalkalender werkt alleen
  voor adressen in Den Haag.
Postcode [ 2288 GH ]  Huisnummer [ 5 ]
[        Adres zoeken             ]
```

**F — Bron onbereikbaar / F2 — Nog geen komende ophaaldagen (ook in januari, en bij het instellen na de laatste ophaaldag van het jaar)**
```
┌ ⓘ De huisvuilkalender van de gemeente is ┐   ← sunken
│   nu niet bereikbaar. Er is niets         │
│   opgeslagen.                             │
└───────────────────────────────────────────┘
Postcode [ 2517 AB ]  Huisnummer [ 12 ]
[        Opnieuw proberen         ]
---
┌ ⓘ De gemeente geeft voor dit adres nog   ┐
│   geen komende ophaaldagen. De kalender   │
│   van het nieuwe jaar komt meestal rond   │
│   de jaarwisseling online. Er is niets    │
│   opgeslagen. Probeer het over een paar   │
│   dagen opnieuw.                          │
└───────────────────────────────────────────┘
Postcode [ 2517 AB ]  Huisnummer [ 12 ]
[        Adres zoeken             ]
```

**G — Aan (met G′-regel als voorbeeld)**
```
‹ Instellingen
Afvalkalender
Aan · bijgewerkt vandaag 06:15
De laatste poging lukte niet. De app probeert   ← alleen G′, text-3, geen knop
het elk uur opnieuw.

Adres       2517 AB 12A          Wijzigen
Volgende ophaaldagen
  PMD ...................... vr 2 okt
  Restafval ................ di 6 okt
  Papier ........ nog geen ophaaldag bekend
Taken staan 14 dagen vooraf klaar. De app kijkt
twee keer per dag, 's ochtends en aan het eind
van de middag, of de gemeente iets veranderd
heeft.
┌ Had je zelf al een terugkerende      ✕ ┐
│ afvaltaak? Die blijft gewoon staan.    │
│ Stop hem via Taken › Terugkerend als   │
│ je hem niet meer nodig hebt.           │
└────────────────────────────────────────┘
  Afvalkalender uitzetten…
```

**H1 — Storing (onbereikbaar, onbruikbaar of zonder foutcode), na "nog steeds fout"** (vandaag ma 28 sep)
```
Afvalkalender
Aan · laatst bijgewerkt za 26 sep 06:15
┌ ⓘ Niet bijgewerkt sinds za 26 sep        ┐
│ Het lukt de app al een tijd niet om de    │
│ ophaaldagen bij de gemeente op te halen.  │
│ De taken die er staan, blijven staan;     │
│ nieuwe ophaaldagen komen er pas bij als   │
│ het weer lukt. Kijk tot die tijd zelf op  │
│ huisvuilkalender.denhaag.nl.              │
│ Opnieuw geprobeerd om 14:32. Het lukt     │  ← T-78, text-2
│ nog steeds niet.                          │
│ Opnieuw proberen                          │
└───────────────────────────────────────────┘
Adres       2517 AB 12A          Wijzigen
Volgende ophaaldagen · stand za 26 sep
  PMD ...................... vr 2 okt           ← laatst bekende stand, niet gewist
  Restafval ................ di 6 okt
  Papier ................... wo 7 okt
```

**H2 — Storing, leeg antwoord (andere maand dan december/januari)** (vandaag di 13 okt)
```
Afvalkalender
Aan · laatst bijgewerkt ma 12 okt 06:15
┌ ⓘ Geen komende ophaaldagen meer bekend   ┐
│ De gemeente geeft geen enkele komende     │
│ ophaaldag meer. Dat is ongebruikelijk.    │
│ De taken die er staan, blijven staan.     │
│ Kijk tot die tijd zelf op                 │
│ huisvuilkalender.denhaag.nl.              │
│ Opnieuw proberen                          │
└───────────────────────────────────────────┘
Adres       2517 AB 12A          Wijzigen
Volgende ophaaldagen · stand ma 12 okt
  PMD ...................... vr 16 okt          ← bewaarde datums blijven staan (BR-52);
  Restafval ................ di 20 okt            T-45b alleen als er voor die bak
  Papier ................... di 27 okt            echt geen datum vanaf vandaag is
```

**H3 — Adres niet meer gevonden**
```
┌ ⓘ Adres niet meer gevonden               ┐
│ De huisvuilkalender van de gemeente kent  │
│ 2517 AB 12A niet meer. Controleer het     │
│ adres. Tot die tijd komen er geen nieuwe  │
│ ophaaldagen bij; de taken die er staan,   │
│ blijven staan.                            │
│ Adres controleren    Opnieuw proberen     │
└───────────────────────────────────────────┘
```

**I — Uitzetten, met 4 en met 0 open taken**
```
Afvalkalender uitzetten?                    ✕
Het adres wordt gewist en de 4 afvaltaken die
nog open staan, verdwijnen. Wat al gedaan is,
blijft in de historie. Weer aanzetten kan
altijd; dan vul je het adres opnieuw in.
[          Uitzetten              ]   ← danger
            Annuleren
---
Het adres wordt gewist. Wat al gedaan is, blijft
in de historie. Weer aanzetten kan altijd; dan
vul je het adres opnieuw in.
```

**J — Gezinslid**
```
Huishouden
  Gezinsleden                          ›
  Afvalkalender                      Aan
  Ophaaldagen van de gemeente komen
  vanzelf als taak in de lijst.
```

**Vandaag, maandag 5 okt 19:30**
```
Vandaag 3
( ) Vaatwasser uitruimen      vóór 20:00
    ↻ elke dag
( ) Restafval en papier      vanaf 22:00
    buitenzetten
    ♻ Afvalkalender
Binnenkort
( ) Restafval- en papierbak       morgen
    binnenzetten
    ♻ Afvalkalender
```

**Vandaag, dinsdag 6 okt 09:10**
```
Verlopen
┌ ( ) Restafval en papier       1 uur ┐   ← overdue-soft
│     buitenzetten            te laat │
│     ♻ Afvalkalender                 │
└─────────────────────────────────────┘
Binnenkort
( ) Restafval- en papierbak  vanaf 12:00
    binnenzetten
    ♻ Afvalkalender
```

**Taakdetail buitenzetten** (kijker met Herinneringen aan)
```
♻ Afvalkalender · ophaaldag di 6 okt   ✕
Restafval en papier buitenzetten
[ ✓        Afvinken                ]
[ Ik ben ermee bezig ][ Deze keer overslaan ]
Mag buiten       ma 5 okt vanaf 22:00
Uiterlijk        di 6 okt 07:45       (vet)
Herinnering      ma 5 okt 21:00       ← alleen als eigen Herinneringen aan
De ophaaldag komt uit de afvalkalender van de
gemeente. Daarom kun je deze taak niet
verplaatsen, wijzigen of verwijderen. Verschuift
de gemeente de dag, dan schuift de taak vanzelf mee.
Notities
[ Notitie toevoegen…                ]
```

**Taakdetail binnenzetten** (kijker met Herinneringen uit)
```
♻ Afvalkalender · ophaaldag di 6 okt   ✕
Restafval- en papierbak binnenzetten
[ ✓        Afvinken                ]
[ Ik ben ermee bezig ][ Deze keer overslaan ]
Binnenzetten     di 6 okt vanaf 12:00
Uiterlijk        di 6 okt, einde van de dag
(uitlegregel) · Notities
```

**Oude UI: taakdetail**
```
[Open]  ♻ Afvalkalender · ophaaldag di 6 okt
Restafval en papier buitenzetten
[ ✓ Afvinken                   ][ ⋯ ]  ⋯ = Ik ben ermee bezig · Deze keer overslaan
┌ Mag buiten     ma 5 okt vanaf 22:00 ┐
│ Uiterlijk      di 6 okt 07:45       │
│ Herinnering    ma 5 okt 21:00       │
└─────────────────────────────────────┘
(uitlegregel, text-sm muted) · Notities
```

### 13.15 Toetsvragen
- **Kernflow zonder uitleg?** Ja. A legt in één zin uit wat er gebeurt, C toont het resultaat vóór het bewaren, en afvinken werkt zoals altijd. Ook als er nog geen taken zijn (T-90b), zegt de melding waarom.
- **Hoofdactie in drie seconden?**
  - A: Adres zoeken.
  - C: Ja, aanzetten.
  - F: Opnieuw proberen.
  - F2: Adres zoeken.
  - Detail: Afvinken.
  - G en H hebben bewust geen primaire knop.
- **Onomkeerbaar zonder bevestiging?** Nee, uitzetten wordt bevestigd. Het vanzelf vervallen van een taak is geen handeling van de gebruiker en telt eerlijk als vergeten.
- **Nutteloze bevestiging?** Nee. Aanzetten gaat via C, dat zelf de controle is, en overslaan en afvinken zijn met Ongedaan maken te herstellen.
- **Overbodige informatie?**
  - Geen categorie of ↻ in de rij.
  - Nooit "21:00" of "verloopt over …" in de rij.
  - Geen omschrijving naast de infolijst.
  - Geen herinneringsrij voor wie geen herinneringen krijgt.
  - Geen "(0 taken)", en geen knop Bekijken als er niets te bekijken is (T-90b).
  - Geen knop bij een hapering die zichzelf herstelt.
  - Geen binnenzet-taak die wekenlang bij Verlopen blijft staan: uiterlijk op D+7 vervalt hij.
  - Een gezinslid ziet geen adres of status.
- **Eerlijk?**
  - T-76 klopt ook als de app zelf niet heeft geprobeerd.
  - T-52 noemt de twee vaste momenten.
  - De balk verdwijnt pas als het echt weer gelukt is.
  - Bij een storing blijven de laatst bekende ophaaldagen zichtbaar, met "stand <dag>", en voor die datums komen gewoon taken. H2 suggereert niet dat de datums weg zijn.
  - In januari zegt de app niet ten onrechte "ondergrondse container".
  - Eind november en in december, na de laatste ophaaldag, geeft de app geen vals alarm, alleen T-73.
- **Alle states?** Zie §13.8.1, §13.8.2, §13.7.6, §13.4 en §13.6:
  - leeg, laden en laden mislukt;
  - fout per oorzaak (ook zonder foutcode);
  - bezig en gelukt;
  - uitgeschakeld (offline, leeg veld);
  - gedeeltelijk (bak zonder datum, kalender volgend jaar ontbreekt);
  - storing met bewaarde datums.

### 13.16 Definitieve gebruikersteksten (enige bron; analist, architect en visual-designer nemen deze letterlijk over)

**Notatie:**
- `<dag>` = korte weekdag, dag en korte maand in kleine letters zonder punt: "di 6 okt".
- Tijden: "06:15".
- `<tijdstip>` = "vandaag 06:15", "gisteren 06:15" of "<dag> 06:15".
- `<taaknaam>` = T-01…T-14.
- `<adres>` = "2517 AB 12A".
- **Vet** = nadruk (600).

| ID | Waar | Wanneer | Tekst (exact) |
| --- | --- | --- | --- |
| T-01…T-07 | taaknaam buiten | per bakcombinatie | Restafval buitenzetten · Papier buitenzetten · PMD buitenzetten · Restafval en papier buitenzetten · Restafval en PMD buitenzetten · Papier en PMD buitenzetten · Restafval, papier en PMD buitenzetten |
| T-08…T-14 | taaknaam binnen | per bakcombinatie | Restafvalbak binnenzetten · Papierbak binnenzetten · PMD-bak binnenzetten · Restafval- en papierbak binnenzetten · Restafval- en PMD-bak binnenzetten · Papier- en PMD-bak binnenzetten · Restafval-, papier- en PMD-bak binnenzetten |
| T-15 | kenmerk rij en detail | altijd | Afvalkalender |
| T-16 | rechterkolom | buiten op D−1 | vanaf 22:00 |
| T-17 | rechterkolom | buiten op D, vóór 07:45 | vóór 07:45 |
| T-18 | rechterkolom | binnen op D, vóór 12:00; Kalender binnen | vanaf 12:00 |
| T-19 | rechterkolom Binnenkort | taak morgen | morgen (oude UI: Morgen) |
| T-20 | detail, bovenregel | altijd | Afvalkalender · ophaaldag <dag D> |
| T-21 | infolijst buiten | — | Mag buiten · <dag D−1> vanaf 22:00 |
| T-22 | infolijst buiten | — | Uiterlijk · <dag D> 07:45 |
| T-23 | infolijst binnen | — | Binnenzetten · <dag D> vanaf 12:00 |
| T-24 | infolijst binnen | — | Uiterlijk · <dag D>, einde van de dag |
| T-25 | infolijst | eigen Herinneringen aan, taak open, moment in de toekomst | Herinnering · <dag D−1> 21:00 (buiten) / <dag D> 18:00 (binnen) |
| T-27 | detail, uitlegregel | altijd | De ophaaldag komt uit de afvalkalender van de gemeente. Daarom kun je deze taak niet verplaatsen, wijzigen of verwijderen. Verschuift de gemeente de dag, dan schuift de taak vanzelf mee. |
| T-28 | detail, knoppen | — | Afvinken · Ik ben ermee bezig · Niet meer bezig · Deze keer overslaan · Toch nog doen · Terugzetten |
| T-30 | melding onderin | afvinken | Gedaan: <taaknaam> · Ongedaan maken |
| T-31 | melding onderin | buitenzetten overgeslagen | Overgeslagen, ook het binnenzetten · Ongedaan maken |
| T-33 | melding onderin | een verplaats- of wijzigactie op een afvaltaak geweigerd | Een afvaltaak kun je niet wijzigen, verplaatsen of verwijderen. |
| T-34 | oude UI, sectiebeschrijving | — | Ophaaldagen van Den Haag als taak. |
| T-34b | oude UI, springlink | — | Afval |
| T-35 / T-36 / T-37 | rij Instellingen, waarde | aan / uit / storing (alleen beheerder; blijft tot het weer gelukt is) | Aan · Uit · Niet bijgewerkt |
| T-38 | J, regel onder de rij | aan | Ophaaldagen van de gemeente komen vanzelf als taak in de lijst. |
| T-38b | J, oude UI | aan | Afvalkalender staat aan + T-38 |
| T-39 | J, regel onder de rij | uit | <Namen van de beheerders> kan de afvalkalender aanzetten. / … kunnen … (bijv. "Jurgen kan …", "Ellen en Jurgen kunnen …") |
| T-39b | J, oude UI | uit | Afvalkalender staat uit + T-39 |
| T-39c | label in de lijst Meldingen | `waste_sync_failed` | Afvalkalender |
| T-40 | A, uitleg | uit | De app leest de huisvuilkalender van Den Haag en zet voor restafval, papier en PMD zelf de taken klaar: de avond ervoor **buitenzetten**, op de ophaaldag **binnenzetten**. |
| T-41 | A, labels en plaatshouders | — | Postcode ("2517 AB") · Huisnummer · Toevoeging (optioneel) ("A of 2") |
| T-41b | A, knop | — / bezig | Adres zoeken / Zoeken… |
| T-42 | A, privacyregel | — | Alleen postcode en huisnummer gaan naar de gemeente. Alleen beheerders zien het adres. |
| T-43 | veldfout postcode | ongeldig of leeg bij Zoeken | Vul een postcode in zoals 2517 AB |
| T-44 | veldfout huisnummer | ongeldig of leeg bij Zoeken | Vul een huisnummer in, zoals 12 of 12A |
| T-44b | veldfout toevoeging | ongeldig | Een toevoeging heeft hooguit 4 letters of cijfers |
| T-45 | C, kop | — | Klopt dit? · ondertitel: Zo kent de gemeente jullie adres. · sectiekop: Eerstvolgende ophaaldagen · bakken: Restafval, Papier, PMD |
| T-45a | C, adresweergave | met of zonder straat | <straat> <nr><toev>, Den Haag · anders: <adres>, Den Haag (de plaats is altijd "Den Haag", ook als de bron "'s-Gravenhage" geeft; alleen weergave, niets bewaard) |
| T-45b | C, G en H, bak zonder datum | in C: de bron geeft voor die bak geen komende datum; in G en H: de bewaarde stand heeft voor die bak geen datum vanaf vandaag | nog geen ophaaldag bekend |
| T-46 | C, uitleg | — | De avond vóór elke ophaaldag staat er een taak **buitenzetten**, met een herinnering om 21:00. Op de ophaaldag vanaf 12:00 een taak **binnenzetten**, met een herinnering om 18:00. Iedereen in het huishouden ziet de taken. Het adres zien alleen beheerders. |
| T-46b | C, knoppen | aanzetten / wijzigen / bezig | Ja, aanzetten · Ja, dit adres gebruiken · Bezig… · Ander adres |
| T-47 | A′, titel en regel | wijzigen | Ander adres · Het huidige adres blijft gebruikt tot je het nieuwe bevestigt. · knop Annuleren |
| T-48 | C, extra regel | wijzigen | Open afvaltaken van het oude adres worden vervangen. Wat al gedaan is, blijft in de historie. |
| T-60 | D | onbekend of buiten Den Haag | Dit adres staat niet in de huisvuilkalender van Den Haag. Controleer postcode en huisnummer. De afvalkalender werkt alleen voor adressen in Den Haag. |
| T-61 | C2 | meerdere adressen | Op nummer <nr> staan meerdere adressen. Welke is van jullie? |
| T-62 | E | vaststaand geen rest, papier of PMD (niet in januari) | Voor dit adres geeft de gemeente geen ophaaldagen voor restafval, papier of PMD. Gebruiken jullie een ondergrondse container? Dan hoeft er niets buiten te staan. |
| T-63 | F | aanzetten | De huisvuilkalender van de gemeente is nu niet bereikbaar. Er is niets opgeslagen. · knop Opnieuw proberen |
| T-63b | F | wijzigen | De huisvuilkalender van de gemeente is nu niet bereikbaar. Er is niets opgeslagen; het huidige adres blijft gebruikt. |
| T-64 | F2 | aanzetten | De gemeente geeft voor dit adres nog geen komende ophaaldagen. De kalender van het nieuwe jaar komt meestal rond de jaarwisseling online. Er is niets opgeslagen. Probeer het over een paar dagen opnieuw. |
| T-64b | F2 | wijzigen | De gemeente geeft voor dit adres nog geen komende ophaaldagen. De kalender van het nieuwe jaar komt meestal rond de jaarwisseling online. Er is niets opgeslagen; het huidige adres blijft gebruikt. Probeer het over een paar dagen opnieuw. |
| T-65 | C, fout | opslaan mislukt | Opslaan lukte niet. Er is niets veranderd. Probeer het opnieuw. |
| T-66 | melding onderin | `FORBIDDEN` | Alleen een beheerder kan de afvalkalender aanpassen. Er is niets veranderd. |
| T-67 | onder een uitgeschakelde knop | offline | Hiervoor heb je internet nodig |
| T-68 | pagina | laden mislukt | De afvalkalender kon niet worden geladen. · Opnieuw |
| T-70 | G, kop | in orde (ook zonder foutcode en zonder storing) | **Aan** · bijgewerkt <tijdstip> |
| T-52 | G, uitleg | — | Taken staan 14 dagen vooraf klaar. De app kijkt twee keer per dag, 's ochtends en aan het eind van de middag, of de gemeente iets veranderd heeft. |
| T-50 | G, adresrij | — | Adres · <adres> · Wijzigen (aria-label "Adres wijzigen") · sectiekop: Volgende ophaaldagen |
| T-53 | G, tip (nieuwe UI) | eenmalig | Had je zelf al een terugkerende afvaltaak? Die blijft gewoon staan. Stop hem via Taken › Terugkerend als je hem niet meer nodig hebt. (✕: aria-label "Tip sluiten") |
| T-54 | G, tip (oude UI) | eenmalig | Had je zelf al een terugkerende afvaltaak? Die blijft gewoon staan. Stop hem hieronder bij Terugkerend als je hem niet meer nodig hebt. |
| T-55 | G, knop | — | Afvalkalender uitzetten… |
| T-71 | G′, stille regel | poging mislukt, nog geen storing | De laatste poging lukte niet. De app probeert het elk uur opnieuw. |
| T-71b | G′, stille regel | idem, `ADDRESS_GONE` | Bij de laatste poging vond de gemeente het adres niet. De app probeert het elk uur opnieuw. |
| T-72 | H, kop en sectiekop | storing | **Aan** · laatst bijgewerkt <tijdstip> · sectiekop: Volgende ophaaldagen · stand <dag> (daaronder de laatst bekende datums) |
| T-73 | G″, stille regel | december als het venster tot in januari loopt; of november en december zonder komende ophaaldag; in beide gevallen staat de kalender J+1 nog niet online | De kalender voor <jaar> staat nog niet online. Ophaaldagen vanaf 1 januari komen erbij zodra hij er is. |
| T-75 | H1, titel | `UNREACHABLE`/`FORMAT`/geen foutcode | Niet bijgewerkt sinds <dag van last_success_at> |
| T-76 | H1, uitleg | idem | Het lukt de app al een tijd niet om de ophaaldagen bij de gemeente op te halen. De taken die er staan, blijven staan; nieuwe ophaaldagen komen er pas bij als het weer lukt. Kijk tot die tijd zelf op huisvuilkalender.denhaag.nl. |
| T-77 | H2, titel | `SUSPECT_EMPTY` | Geen komende ophaaldagen meer bekend |
| T-77a | H2, uitleg | december of januari | De gemeente geeft geen enkele komende ophaaldag meer. Waarschijnlijk staat de kalender van het nieuwe jaar nog niet online. De taken die er staan, blijven staan. Kijk tot die tijd zelf op huisvuilkalender.denhaag.nl. |
| T-77b | H2, uitleg | andere maanden | De gemeente geeft geen enkele komende ophaaldag meer. Dat is ongebruikelijk. De taken die er staan, blijven staan. Kijk tot die tijd zelf op huisvuilkalender.denhaag.nl. |
| T-77c | H3, titel | `ADDRESS_GONE` | Adres niet meer gevonden |
| T-77d | H3, uitleg | idem | De huisvuilkalender van de gemeente kent <adres> niet meer. Controleer het adres. Tot die tijd komen er geen nieuwe ophaaldagen bij; de taken die er staan, blijven staan. · knoppen Adres controleren · Opnieuw proberen |
| T-77e | balk H, knop bezig | tijdens de poging | Bezig… |
| T-78 | balk H, resultaatregel | handmatige poging mislukt | Opnieuw geprobeerd om <hh:mm>. Het lukt nog steeds niet. |
| T-79 | balk H, resultaatregel | `too_soon` | Net geprobeerd. Probeer het over een minuut opnieuw. |
| T-80 | I, titel | — | Afvalkalender uitzetten? |
| T-81 | I, tekst | n ≥ 2 open | Het adres wordt gewist en de <n> afvaltaken die nog open staan, verdwijnen. Wat al gedaan is, blijft in de historie. Weer aanzetten kan altijd; dan vul je het adres opnieuw in. |
| T-81b | I, tekst | n = 1 | Het adres wordt gewist en de afvaltaak die nog open staat, verdwijnt. Wat al gedaan is, blijft in de historie. Weer aanzetten kan altijd; dan vul je het adres opnieuw in. |
| T-81c | I, tekst | n = 0 | Het adres wordt gewist. Wat al gedaan is, blijft in de historie. Weer aanzetten kan altijd; dan vul je het adres opnieuw in. |
| T-82 | I, knoppen | — / bezig | Uitzetten · Annuleren / Bezig… |
| T-90 | melding onderin | aangezet, er zijn taken klaargezet (`inserted` > 0) | Afvalkalender staat aan · taken voor 2 weken klaargezet · Bekijken |
| T-90b | melding onderin | aangezet, 0 taken klaargezet (`inserted` = 0: de eerstvolgende ophaaldag ligt verder dan 14 dagen weg; AC-183 (b)) | Afvalkalender staat aan · taken verschijnen 14 dagen vooraf |
| T-91 | melding onderin | nieuw adres | Nieuw adres opgeslagen · afvaltaken bijgewerkt |
| T-92 | melding onderin | hetzelfde adres bevestigd | Adres opgeslagen · er verandert niets |
| T-93 | melding onderin | uitgezet | Afvalkalender staat uit |
| T-94 | melding onderin | handmatige poging gelukt | Afvalkalender bijgewerkt |
| T-95 | Kalender, eenmalig | eerste week zonder afvaltaken | Ophaaldagen verschijnen 14 dagen vooraf. |
| T-96 | Taken › Terugkerend | aan | Afvalkalender · volgt de ophaaldagen van de gemeente |
| T-97 / T-98 | Overzicht, groepnaam | — | Afval buitenzetten · Bakken binnenzetten |
| T-99 | aria-label rondje | — | <taaknaam> afvinken |
| M-01…M-05 | meldingen en push | zie §13.10 | letterlijk zoals in de tabel van §13.10 |

**Vervallen teksten (niet meer gebruiken):**
- "Binnenzetten vanaf 12:00, uiterlijk vandaag." en "Mag vanaf 22:00 buiten, uiterlijk 07:45." als omschrijving;
- "De huisvuilkalender is nu niet bereikbaar. Probeer het later opnieuw.";
- "Afvalkalender niet bijgewerkt sinds <datum>";
- "De gemeente-site gaf geen antwoord.";
- "… Kijk voor de zekerheid zelf op de site van de gemeente.";
- "(4 taken)";
- "geen ophaaldag in de komende weken";
- "Vul een huisnummer in, alleen cijfers";
- de toast "Net geprobeerd…" (wordt T-79 in de balk);
- de toast "Opgeslagen" (wordt T-90, T-90b, T-91 of T-92);
- "Restafval binnenzetten" en "Restafval en papier binnenzetten";
- T-52 oud: "… De app kijkt elke ochtend of de gemeente iets veranderd heeft.";
- T-64 oud: "Meestal komt de kalender van het nieuwe jaar eind december online.";
- T-64/T-64b oud: "De gemeente heeft nog geen ophaaldagen voor de komende weken online gezet.";
- T-76 oud: "De huisvuilkalender van de gemeente geeft geen bruikbaar antwoord. …";
- T-77 oud: "Geen ophaaldagen voor de komende twee weken";
- T-77a/T-77b/M-04 oud: "De gemeente geeft voor de komende twee weken geen (enkele) ophaaldag(en).";
- T-45a oud: "<straat> <nr><toev>, <plaats>". Nooit "'s-Gravenhage" tonen.

### 13.17 Verwijzingen naar acceptatiecriteria (ACCEPTANCE_CRITERIA WP3b en WP4–WP9)
**WP3b:**
- AC-183: aanzetten. (b) Eerstvolgende ophaaldag verder dan 14 dagen weg geeft C, dan T-90b en 0 taken.
- AC-184: vorm.
- AC-185: D.
- AC-186: E; in januari altijd F2.
- AC-187: schrijfwijze, C2.
- AC-188: F.
- AC-189: gezinslid.
- AC-190: wie ziet het adres.
- AC-191: dubbel tikken.
- AC-192: buitenzetten.
- AC-193: binnenzetten.
- AC-194: herinnering alleen bij een open taak.
- AC-195: twee bakken op één dag, namenlijst §13.3.
- AC-197: 14 dagen vooruit, T-52/T-90b/T-95.
- AC-201: naam past zich aan.
- AC-204: hapering en leeg antwoord. Jaareinde en "alleen datums na 14 dagen" zijn geen storing.
- AC-205: storing per oorzaak, ook zonder foutcode (c). De balk blijft tot herstel.
- AC-207: los afvinken.
- AC-208: wel/niet.
- AC-209: overslaan werkt door.
- AC-210: verlopen/vervallen, met bovengrens D+7 voor binnenzetten.
- AC-211: wie de herinnering krijgt.
- AC-212: geen adres.
- AC-213: uitzetten.
- AC-214: wijzigen.
- AC-217: oude UI, CP-W03-lijst TD §18.16 U3.
- AC-220: kalender volgend jaar ontbreekt, G″/T-73; ook eind november zonder komende ophaaldag.
- AC-222: hetzelfde adres.
- AC-223: storingsmelding opent Instellingen › Afvalkalender.
- AC-236: "Opnieuw proberen", alleen in balk H.
- AC-237: F2, ook eind november/december bij het instellen en in januari. Tegenvoorbeeld: AC-183 (b).

**Nieuwe UI:**
- AC-224: gegevenslaag, WP4.
- AC-225: rij, WP5.
- AC-226: detail, WP5.
- AC-227: overslaan offline, WP5.
- AC-228: T-96, WP6.
- AC-229: geen bewerkformulier, WP6.
- AC-230: subpagina, WP7.
- AC-231: rij en oude links, WP7.
- AC-232: Kalender zonder slepen, WP8.
- AC-233: storingsmelding in de lijst, WP8.
- AC-234: Overzicht T-97/T-98, WP8.
- AC-235: kernflow, WP9.
