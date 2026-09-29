## UX-ontwerp: W-03 afvalkalender, ronde 1
Documenten: niets geschreven. UX_SPEC.md is bevroren en de opdracht was geen bestanden aan te maken. Alle tekst hieronder kan letterlijk in UX_SPEC.
Wireframes: alleen als tekst/ASCII in dit rapport. Er zijn **geen HTML-wireframes en geen screenshots** gemaakt of bekeken. Het ontwerp is dus nog niet op beeld beoordeeld. Die controle gebeurt bij de rook-screenshots van WP3b en bij CP3/CP4.
Gelezen: PROGRESS (W-03, V-41…V-57), product-analyst-r1, solution-architect-r1, UX_SPEC (compleet), DESIGN_SYSTEM (compleet), de huidige code (`settings-page.tsx`, `household-section.tsx`, `task-detail-sheet.tsx`, `task-card.tsx`, `calendar-view.tsx`, `reminders.ts`) en de screenshots `docs/screenshots/wp2a/instellingen-390x844.png` en `vandaag-390x844.png`.
Apparaten/viewports: telefoon 390×844, zoals besloten (V-07).
Kernflow:
- **Aanzetten:** 4 tikken plus typen.
- **Afvaltaak afhandelen:** 1 tik (rondje op Vandaag), of 2 tikken vanuit de push van 21:00 (melding → Afvinken).

### Vragen voor Jurgen
- Geen. Alles volgt uit V-41…V-57. Een paar punten voor de hoofdsessie, analist en architect staan onderaan.

---

# TEKST VOOR UX_SPEC: nieuwe sectie "§13 Afvalkalender (W-03)"

## 13.1 Uitgangspunten
1. **Niets onthouden, niets instellen.** Na één keer het adres invullen staan de taken er vanzelf. Er zijn geen instellingen per bak en geen eigen tijden (BR-47).
2. **Een afvaltaak is een gewone taak, met drie verschillen:**
   - een rustig kenmerk "♻ Afvalkalender";
   - een eigen tijdregel ("vanaf 22:00", "uiterlijk 07:45");
   - minder acties: niet verplaatsen, wijzigen of verwijderen (V-54).

   Afvinken, terugdraaien, bezig, notitie en overslaan werken precies zoals bij andere taken.
3. **Verbergen, niet uitschakelen.** Verplaatsen, wijzigen en verwijderen kan bij een afvaltaak *nooit*. Die knoppen worden dus verborgen (§0.6). Eén uitlegregel in het detail zegt waarom.
4. **Het adres zien alleen beheerders** (V-53). In meldingen, pushberichten, historie en taakteksten staat nooit een adres en nooit een naam (BR-58).
5. **Eerlijk bij storingen.** Onder de 48 uur staat er alleen een stille regel. Daarboven komen een zichtbare waarschuwing en één melding aan de beheerders (V-50, BR-52).

## 13.2 Informatiearchitectuur (aanvulling op §2)
In de boom onder "Huishouden":
```
├── Afvalkalender (0 of 1; alleen beheerder: postcode, huisnummer, toevoeging; status bijwerken)
│     └── Afvaltaken (gewone taken met kenmerk "Afvalkalender", zonder reeks)
│           ├── "… buitenzetten"  (avond vóór de ophaaldag)
│           └── "…bak(ken) binnenzetten" (ophaaldag, vanaf 12:00)
```
Mentaal model: "De gemeente bepaalt de dag, de app zet de taak klaar, wij vinken af."

## 13.3 Taaknamen (exact)
De volgorde is altijd Restafval, papier, PMD. De eerste letter is een hoofdletter; "PMD" staat altijd in hoofdletters.

| Bakken op die dag | Buitenzetten (D−1) | Binnenzetten (D) |
| --- | --- | --- |
| rest | Restafval buitenzetten | Restafvalbak binnenzetten |
| papier | Papier buitenzetten | Papierbak binnenzetten |
| PMD | PMD buitenzetten | PMD-bak binnenzetten |
| rest + papier | Restafval en papier buitenzetten | Restafval- en papierbak binnenzetten |
| rest + PMD | Restafval en PMD buitenzetten | Restafval- en PMD-bak binnenzetten |
| papier + PMD | Papier en PMD buitenzetten | Papier- en PMD-bak binnenzetten |
| alle drie | Restafval, papier en PMD buitenzetten | Restafval-, papier- en PMD-bak binnenzetten |

- **Waarom "bak" bij binnenzetten:** "Restafval binnenzetten" betekent letterlijk het afval weer naar binnen halen. Het afval is dan juist opgehaald, dus je zet de (lege) bak binnen. Bij buitenzetten zet je het afval buiten; zo zeggen mensen het ook.
- **Enkelvoud bij meerdere bakken:** "Restafval- en papierbak" wordt gelezen als "de bak voor restafval en de bak voor papier". Zo blijft de naam kort (hooguit 47 tekens, past op twee regels).

## 13.4 Tijden en plek in de lijsten
Voorbeeld: ophaaldag **di 6 okt** voor restafval en papier.

| Moment | Taak | Waar (Vandaag) | Rechterkolom | Kan afvinken? |
| --- | --- | --- | --- | --- |
| ma 5 okt, hele dag | Restafval en papier buitenzetten | Vandaag, gesorteerd op 21:00 | **vanaf 22:00** | ja (ook eerder; niet geblokkeerd) |
| ma 21:00 | push-herinnering | — | — | — |
| di 00:00–07:45, nog open | idem | Vandaag | **vóór 07:45** | ja |
| di na 07:45, nog open | idem | **Verlopen** | bestaand verlopen-patroon, bijv. "3 uur" / "te laat" | ja (telt als te laat) |
| einde di, nog open | idem | verdwijnt: automatisch overgeslagen, telt als vergeten (BR-54) | — | — |
| di vóór 12:00 | Restafval- en papierbak binnenzetten | **Binnenkort**, bovenaan | **vanaf 12:00** | ja (niet geblokkeerd) |
| di vanaf 12:00 | idem | Vandaag | leeg (gewoon vandaag) | ja |
| di 18:00, nog open | push-herinnering | — | — | — |
| wo en later, nog open | idem | Verlopen, "1 dag te laat", tot de volgende buitenzet-taak klaarstaat; dan overgeslagen (BR-54) | | ja |

- Er staat **nooit "om 21:00"** in de rij. 21:00 is alleen het herinneringsmoment; "om 21:00" zou suggereren dat de bak dan al buiten mag.
- Taken en Kalender volgen dezelfde regels op hun dag: buitenzetten staat op ma, binnenzetten op di, en de rechterkolom is gelijk.

## 13.5 Het kenmerk "Afvalkalender"
- **In de rij:** de meta (2e regel) toont `♻ Afvalkalender` in plaats van ritme en categorie. De stijl is `text-meta` in `text-3`, met het Lucide-icoon **recycle** van 14 px. Het is geen badge, kleur of vlak (DS §7.9: er blijven drie badges). "bezig" komt er gewoon achter: `♻ Afvalkalender · bezig`.
- **Waarom recycle en geen prullenbak:** een prullenbak betekent in deze app "verwijderen" (en dat kan hier juist niet).
- **Waarom niet de categorie "Buiten":** die is overbodig naast het kenmerk. De categorie blijft wel bestaan voor het filter.
- **In het taakdetail:** de bovenregel is `♻ Afvalkalender · ophaaldag di 6 okt`.

## 13.6 Taakdetail van een afvaltaak (aanvulling op §5.5)
- **Primaire actie:** **Afvinken**. Bij een gedane taak staat er "Gedaan om 22:14 · op tijd" met **Terugzetten**.
- **Secundair, direct zichtbaar:** **Ik ben ermee bezig** (of "Niet meer bezig") en **Deze keer overslaan**. Er is geen ⋯-menu, want er zijn geen andere acties. Het detail heeft zo één tik minder dan bij gewone taken.
- **Verborgen:** Naar morgen, Andere dag…, Bewerken, Verwijderen en reeksacties. Dat geldt voor iedereen, ook voor beheerders.
- **Infolijst voor buitenzetten:**
  - Buiten zetten: ma 5 okt vanaf 22:00
  - **Uiterlijk: di 6 okt 07:45**
  - Herinnering: ma 5 okt 21:00
- **Infolijst voor binnenzetten:**
  - Opgehaald: di 6 okt
  - Binnenzetten: vanaf 12:00
  - **Uiterlijk: di 6 okt, einde van de dag**
  - Herinnering: di 6 okt 18:00
- **Uitlegregel onder de infolijst** (text-meta, text-3): "De ophaaldag komt uit de afvalkalender van de gemeente. Daarom kun je deze taak niet verplaatsen, wijzigen of verwijderen. Verschuift de gemeente de dag, dan schuift de taak vanzelf mee."
- **Notities:** zoals bij andere taken.
- **Vorige keren:** vervalt, want er is geen reeks.
- **Deze keer overslaan bij buitenzetten:** geen bevestiging. Er komt een melding onderin: label "Overgeslagen, ook het binnenzetten", taaknaam, **Ongedaan maken**. Ongedaan maken zet beide taken terug (BR-53). Overslaan van binnenzetten raakt buitenzetten niet.
- **Directe link naar bewerken** (bijv. `/taken/<id>/bewerken`) bij een afvaltaak: open het taakdetail in plaats van het formulier.

## 13.7 Flows

### 13.7.1 Afvalkalender aanzetten (UC-13), beheerder
1. Tandwiel (1) → rij **Afvalkalender · Uit** (2). In de oude UI: de springlink "Afval" of scrollen.
2. Lege staat met uitleg en direct het formulier: Postcode, Huisnummer, Toevoeging (optioneel). Typen.
3. **Adres zoeken** (3). De knop toont "Zoeken…" en de velden zijn tijdelijk uitgeschakeld.
4. **Klopt dit?** Je ziet:
   - het adres zoals de gemeente het kent, bijv. "Laan van Meerdervoort 12A, Den Haag". Geeft de bron geen straat, dan "2517 AB 12A, Den Haag". Deze weergave wordt niet bewaard (BR-58);
   - de eerstvolgende ophaaldag per bak;
   - in één zin wat er gaat gebeuren.
5. **Ja, aanzetten** (4). Knop "Bezig…". Daarna de statusweergave en de melding "Afvalkalender staat aan · taken voor 2 weken klaargezet · **Bekijken**". Bekijken opent de Kalender (week).

**4 tikken plus typen.** Eenmalig staat in de statusweergave de tip: "Had je zelf al een terugkerende afvaltaak? Die blijft gewoon staan. Stop hem via Taken › Terugkerend als je hem niet meer nodig hebt." (V-56, BR-57; de app herkent die taken niet). De tip is weg te tikken met ✕.

**Foutpaden** (er wordt nooit iets bewaard, de ingevulde velden blijven staan, en een eerder adres blijft ongewijzigd):
- **Vorm klopt niet**, gecontroleerd bij het verlaten van het veld en bij Zoeken:
  - "Vul een postcode in zoals 2517 AB";
  - "Vul een huisnummer in, alleen cijfers".

  Zoeken is uitgeschakeld zolang postcode of huisnummer leeg is.
- **Onbekend of buiten Den Haag** (één melding voor beide, want de bron maakt geen onderscheid): "Dit adres staat niet in de huisvuilkalender van Den Haag. Controleer postcode en huisnummer. De afvalkalender werkt alleen voor adressen in Den Haag."
- **Meerdere adressen op dit nummer, geen toevoeging ingevuld:** "Op nummer 12 staan meerdere adressen. Welke is van jullie?", met keuzerondjes "12", "12A", "12B" (alleen nummer en toevoeging, zoals de bron ze geeft). Kiezen → Klopt dit?. Dat is één tik extra.
- **Geen rest, papier of PMD:** "Voor dit adres geeft de gemeente geen ophaaldagen voor restafval, papier of PMD. Gebruiken jullie een ondergrondse container? Dan hoeft er niets buiten te staan." met **Ander adres**.
- **Bron niet bereikbaar of traag** (> 8 s): "De huisvuilkalender van de gemeente is nu niet bereikbaar. Er is niets opgeslagen. Probeer het over een paar minuten opnieuw." met **Opnieuw proberen**.
- **Opslaan mislukt** bij "Ja, aanzetten": Klopt dit? blijft staan, met bovenaan "Opslaan lukte niet. Er is niets veranderd. Probeer het opnieuw."
- **Geen recht meer** (intussen geen beheerder meer): "Alleen een beheerder kan de afvalkalender aanpassen. Er is niets veranderd."
- **Offline:** Adres zoeken is uitgeschakeld met "Hiervoor heb je internet nodig".
- **Twee keer tikken:** er ontstaat één adres (BR-50, AC-190). Twee beheerders tegelijk: de laatste geldt, zonder melding.

**Terugweg:** op Klopt dit? staat **Ander adres** (tekstknop): terug naar het formulier, velden gevuld. Pagina verlaten = niets bewaard, en er komt geen "Wijzigingen weggooien?" (er is nog niets gebeurd).

### 13.7.2 Adres wijzigen (verhuizen), beheerder
1. Status → **Wijzigen** naast het adres (1) → hetzelfde formulier, gevuld met het huidige adres, titel "Ander adres". Regel erboven: "Het huidige adres blijft gebruikt tot je het nieuwe bevestigt."
2. **Adres zoeken** (2) → Klopt dit?. Extra regel: "Open afvaltaken van het oude adres worden vervangen. Wat al gedaan is, blijft in de historie."
3. **Ja, dit adres gebruiken** (3) → melding "Nieuw adres opgeslagen · afvaltaken bijgewerkt".

Fouten zoals bij 13.7.1: het oude adres en de oude taken blijven (AC-211). **Annuleren** → terug naar de status.

### 13.7.3 Afvalkalender uitzetten, beheerder
1. Status → onderaan **Afvalkalender uitzetten…** (danger-quiet) (1).
2. Bevestiging (sheet): "**Afvalkalender uitzetten?** Het adres wordt gewist en de afvaltaken die nog open staan verdwijnen (4 taken). Wat al gedaan is, blijft in de historie. Weer aanzetten kan altijd; dan vul je het adres opnieuw in." Knoppen: **Uitzetten** (danger) / Annuleren (2).
3. Terug naar de lege staat, met de melding "Afvalkalender staat uit". Er is geen Ongedaan maken, want het adres is gewist.

Bevestigen is hier nodig: het adres is weg en de taken verdwijnen voor iedereen. Annuleren verandert niets (AC-210).

### 13.7.4 Dagelijks gebruik (UC-14), iedereen
- **Avond vóór de ophaaldag:** Vandaag toont de buitenzet-taak "vanaf 22:00". Om 21:00 komt de push. Tik op de push → taakdetail → **Afvinken** (2 tikken). Of op Vandaag het rondje (1 tik).
- **Ophaaldag:** vóór 12:00 staat binnenzetten bovenaan Binnenkort ("vanaf 12:00"), vanaf 12:00 bij Vandaag. Om 18:00 komt de push, alleen als de taak nog open staat.
- Afvinken, terugdraaien en de melding "Gedaan: … · Ongedaan maken" werken zoals in §4.1 en §4.2.
- Buitenzetten en binnenzetten worden los afgevinkt (BR-53).
- Offline gaan afvinken, bezig en overslaan via de wachtrij (TD §9.3). Bij overslaan offline toont de app het binnenzetten ook als overgeslagen; de server bevestigt dat bij verzenden.

### 13.7.5 Storing (BR-52)
- **Korter dan 48 uur:** in de status staat alleen de stille regel "Bijgewerkt op za 26 sep 06:15 · de laatste poging lukte niet; de app probeert het vanzelf opnieuw." Geen waarschuwing, geen melding.
- **Langer dan 48 uur, of 14 dagen zonder ophaaldagen terwijl die er eerder wel waren:**
  - de beheerders krijgen **één** melding (13.9);
  - de rij in Instellingen toont "Niet bijgewerkt" met ⓘ;
  - de statuspagina toont bovenaan de waarschuwingsbalk (13.8, toestand H). Die heeft een `sunken` vlak met het icoon circle-alert, zonder rood, want het is geen fout van de gebruiker (DS §8).
- **Weer gelukt:** de balk en "Niet bijgewerkt" verdwijnen vanzelf. Er komt geen melding "weer gelukt".
- **Gezinsleden** zien geen storing (AC-203).

## 13.8 Scherm: Instellingen › Afvalkalender

**Nieuwe UI (WP7):** een eigen subpagina `/instellingen/afvalkalender`, met "‹ Instellingen" linksboven. Aanvulling op de tabel in §5.8:

| Groep | Rij (rechts de huidige waarde) | Subpagina | Wie |
| --- | --- | --- | --- |
| Huishouden | Afvalkalender · Aan / Uit / ⓘ Niet bijgewerkt | aanzetten, status, adres wijzigen, uitzetten | beheerder: beheren · gezinslid: rij zonder pijl, alleen de waarde "Aan" of "Uit" |

De rij staat direct onder "Huishouden". Een gezinslid ziet onder de waarde de regel "Ophaaldagen van de gemeente komen vanzelf als taak in de lijst." Bij "Uit" staat daar: "Ellen en Jurgen kunnen de afvalkalender aanzetten." (namen van de beheerders, zoals in §5.8).

**Oude UI (WP3b):**
- een nieuwe `SettingsSection` "Afvalkalender" (icoon recycle), direct na "Huishouden";
- springlink **"Afval"** na "Huishouden";
- dezelfde inhoud en toestanden, maar inline in de sectie in plaats van op een subpagina. Klopt dit? vervangt het formulier binnen de sectie;
- de bevestiging bij uitzetten gebruikt de bestaande Dialog;
- de sectie is voor iedereen zichtbaar; een gezinslid ziet alleen toestand J.

**Doel en hoofdactie per toestand:**
- **Leeg:** Adres zoeken.
- **Klopt dit?:** Ja, aanzetten.
- **Aan:** geen hoofdactie. Het is een statusweergave; Wijzigen en Uitzetten zijn secundair.
- **Storing:** Opnieuw proberen (secundair). Deze knop doet één opvraging, hooguit één keer per minuut.

**Toestanden:**

| # | Toestand | Wat de gebruiker ziet | Wat hij kan doen |
| --- | --- | --- | --- |
| A | Leeg (uit), beheerder | Uitleg (3 regels) + formulier | Adres zoeken |
| — | Laden (pagina) | skelet: titel + 3 rijen | — |
| B | Zoeken (bezig) | knop "Zoeken…", velden uitgeschakeld | wachten |
| C | Klopt dit? | adres zoals de gemeente het kent, ophaaldag per bak, uitleg | Ja, aanzetten · Ander adres |
| C2 | Meerdere adressen | keuzerondjes per toevoeging | kiezen |
| D | Adres onbekend of buiten Den Haag | foutregel boven de velden, velden gevuld | aanpassen, opnieuw zoeken |
| E | Geen bakken | uitleg ondergrondse container | Ander adres |
| F | Bron onbereikbaar | uitleg, "er is niets opgeslagen" | Opnieuw proberen |
| — | Bezig (opslaan, uitzetten) | knop "Bezig…" | wachten |
| — | Fout bij opslaan | regel bovenaan, invoer blijft | opnieuw |
| G | Aan, in orde | adres, volgende ophaaldag per bak, "Bijgewerkt op …" | Wijzigen · Uitzetten… |
| — | Opgeslagen | melding onderin (13.7.1 / 13.7.2) | Bekijken |
| H | Aan, storing > 48 uur | waarschuwingsbalk + laatste stand | Opnieuw proberen · Wijzigen · Uitzetten… |
| — | Gedeeltelijk | een bak zonder ophaaldag in de komende weken: "geen ophaaldag in de komende weken" (bijv. papier rond de jaarwisseling) | — |
| I | Bevestiging uitzetten | sheet | Uitzetten · Annuleren |
| J | Gezinslid | "Afvalkalender staat aan/uit" + één regel | niets |
| — | Offline | laatst bekende stand; knoppen uitgeschakeld met "Hiervoor heb je internet nodig" | bekijken |
| — | Uitgeschakeld | Adres zoeken uit bij een leeg veld | invullen |

## 13.9 Formulier adres (aanvulling op §6)

| Veld | Type | Standaard | Validatie (moment) |
| --- | --- | --- | --- |
| Postcode | tekst, `autocomplete="postal-code"`, `autocapitalize="characters"`, max 7, plaatshouder "2517 AB" | leeg (bij wijzigen: huidig) | bij verlaten en bij Zoeken: 4 cijfers + 2 letters. Wordt bij verlaten netjes gezet ("2517ab" → "2517 AB") |
| Huisnummer | `inputmode="numeric"`, max 5 | leeg | alleen cijfers, 1–99999. Typt iemand "12a" of "12 a", dan wordt dat stil 12 + toevoeging "A" (AC-187) |
| Toevoeging (optioneel) | tekst, max 4, plaatshouder "A of 2" | leeg | — |

- Postcode en huisnummer staan naast elkaar op één regel (60/40). De toevoeging staat eronder.
- Bij een fout blijven de velden gevuld en staat de foutregel bij het veld (vorm) of boven het formulier (antwoord van de bron).

## 13.10 Meldingsteksten (aanvulling op §4.9)
Geen adres, geen straat, geen namen (BR-58, AC-209). Het patroon "Herinnering: <taak>" blijft gelijk aan de gewone herinnering. Alleen de tweede regel is anders.

| Wanneer | Aan wie | Titel | Tekst | Tik opent |
| --- | --- | --- | --- | --- |
| D−1 21:00, taak open | iedereen met "Herinneringen" aan (V-50) | Herinnering: Restafval en papier buitenzetten | Morgen ophaaldag. Mag vanaf 22:00 buiten, uiterlijk morgen 07:45. | taakdetail |
| D 18:00, taak open | idem | Herinnering: Restafval- en papierbak binnenzetten | Vandaag was de ophaaldag. Zet de bakken vandaag nog binnen. (enkelvoud: "Zet de bak vandaag nog binnen.") | taakdetail |
| storing > 48 uur (één keer per storing) | alleen beheerders | De afvalkalender kon niet worden bijgewerkt | Laatst gelukt op za 26 sep. Nieuwe ophaaldagen komen er pas bij als het weer lukt. Kijk tot die tijd zelf op huisvuilkalender.denhaag.nl. | Instellingen › Afvalkalender |
| 14 dagen leeg (jaarwisseling) | alleen beheerders | De afvalkalender kon niet worden bijgewerkt | De gemeente geeft voor de komende twee weken geen ophaaldagen. Soms staat de nieuwe kalender nog niet online. Kijk zelf op huisvuilkalender.denhaag.nl. | Instellingen › Afvalkalender |

- Voor afvaltaken komen er geen meldingen "deadline nadert" of "verlopen" (V-50).
- De storingsmelding komt altijd in de lijst Meldingen. Push volgt als push op dat toestel aan staat. Er is geen eigen schakelaar: de melding komt zelden, is alleen voor beheerders, en stil missen is het risico (BR-52).
- In de lijst Meldingen staat dezelfde titel en tekst.
- Meldingen onderin (toasts):
  - "Gedaan: Restafval en papier buitenzetten · Ongedaan maken";
  - "Overgeslagen, ook het binnenzetten · Ongedaan maken";
  - "Afvalkalender staat aan · taken voor 2 weken klaargezet · Bekijken";
  - "Nieuw adres opgeslagen · afvaltaken bijgewerkt";
  - "Afvalkalender staat uit".

## 13.11 Taken, Kalender en Overzicht
- **Taken › Open:** afvaltaken in de gewone groepen, met kenmerk en rechterkolom zoals in 13.4. Zoeken op "afval", "papier" of "PMD" vindt ze via de naam. In het categoriefilter vallen ze onder Buiten.
- **Taken › Terugkerend** (nieuwe UI): bovenaan één informatierij "♻ Afvalkalender · volgt de ophaaldagen van de gemeente". Voor een beheerder staat er een pijl naar Instellingen › Afvalkalender, voor een gezinslid is er geen pijl. Wie "de afvaltaak" zoekt tussen de terugkerende taken, vindt zo de uitleg.
- **Kalender:**
  - afvaltaken staan op hun dag, met kenmerk;
  - **slepen staat uit** voor afvaltaken, in de oude en de nieuwe UI;
  - de knop "+ Taak" per dag blijft;
  - na 14 dagen zijn er geen stippellijn-voorbeelden van afvaltaken. Er staat een eenmalige regel onder de eerste lege week: "Ophaaldagen verschijnen 14 dagen vooraf."
- **Overzicht** (nieuwe UI): in "Vaak te laat of vergeten" en "Vaak gedaan" tellen alle afvaltaken samen als "Afval buitenzetten" en "Bakken binnenzetten". Anders valt het over vijf gecombineerde namen uiteen en ziet niemand het patroon.

## 13.12 Rechten (aanvulling op §9)

| Element | Beheerder | Gezinslid | Hoe bij "nee" |
| --- | --- | --- | --- |
| Afvalkalender aanzetten, adres wijzigen, uitzetten | ja | nee | verborgen; gezinslid ziet "Afvalkalender staat aan/uit" |
| Adres en bijwerkstatus zien | ja | nee (V-53) | verborgen |
| Storingsmelding | ja | nee | — |
| Afvaltaak afvinken, terugzetten, bezig, notitie, overslaan | ja | ja | — |
| Afvaltaak verplaatsen, bewerken, verwijderen, slepen | nee | nee (V-54) | verborgen + uitlegregel in het detail |

## 13.13 Oude UI (WP3b) en nieuwe UI (WP4–WP8)

| Onderdeel | Oude UI, main (WP3b) | Nieuwe UI, v2-ui (WP) |
| --- | --- | --- |
| Instellingen | `SettingsSection id="afvalkalender"` na Huishouden + springlink "Afval"; toestanden A–J inline | subpagina, rij in groep Huishouden (WP7); patronen: subpagina §7.6, velden §7.2, danger-quiet en danger §7.1, balk §8 |
| Taakrij | `task-card`: klokje "21:00" vervangen door "vanaf 22:00" / "vóór 07:45" / "vanaf 12:00"; meta: recycle-icoon + "Afvalkalender" in plaats van categorie; geen ↻ | lijstrij §7.4: meta `♻ Afvalkalender`, rechterkolom volgens 13.4 (WP5) |
| Binnenzetten vóór 12:00 | onder "Binnenkort" met "Vandaag vanaf 12:00" (de selector moet `available_from` per uur respecteren) | Binnenkort, bovenaan (WP5) |
| Taakdetail | ⋯-menu: "Bewerken" en "Verwijderen" verborgen; "Wanneer (verplaatsen)" wordt gewone tekst zonder datumkiezer; omschrijving/uitlegregel volgens 13.6 | detail volgens 13.6: twee secundaire knoppen, geen ⋯ (WP5) |
| Kalender | `useDraggable` uit voor afvaltaken | slepen uit (WP8) |
| Meldingen | teksten 13.10; storing als nieuw soort in de lijst | idem (WP3b-teksten blijven, WP8 lijst) |
| Taken › Terugkerend, Overzicht-groepering | niet nodig in de oude UI | 13.11 (WP6, WP8) |

## 13.14 Wireframes (tekst)

**A — Leeg, beheerder (nieuwe UI, 390×844)**
```
‹ Instellingen
Afvalkalender
─────────────────────────────────────
De app leest de huisvuilkalender van
Den Haag en zet de taken zelf klaar:
• de avond ervoor: buitenzetten
  (herinnering om 21:00)
• op de ophaaldag: bak binnenzetten
Voor restafval, papier en PMD.

Postcode            Huisnummer
[ 2517 AB        ]  [ 12        ]
Toevoeging (optioneel)
[ A of 2         ]

[        Adres zoeken             ]   ← primair
Alleen postcode en huisnummer gaan naar
de gemeente. Alleen beheerders zien het adres.
─────────────────────────────────────
 Vandaag  Taken  (+)  Kalender  Boodschappen
```

**C — Klopt dit?**
```
‹ Instellingen
Klopt dit?
Laan van Meerdervoort 12A, Den Haag

Eerstvolgende ophaaldagen
  Restafval ................ di 6 okt
  Papier ................... wo 7 okt
  PMD ...................... vr 2 okt

De avond ervoor staat er een taak
"buitenzetten" met een herinnering om 21:00.
Op de ophaaldag vanaf 12:00 "binnenzetten".

[        Ja, aanzetten            ]   ← primair
          Ander adres                  ← tekstknop
```

**C2 — Meerdere adressen**
```
Op nummer 12 staan meerdere adressen.
Welke is van jullie?
 ( ) 12
 (•) 12A
 ( ) 12B
[        Verder                   ]
```

**D — Onbekend / F — Bron onbereikbaar**
```
ⓘ Dit adres staat niet in de huisvuilkalender
  van Den Haag. Controleer postcode en huisnummer.
  De afvalkalender werkt alleen voor adressen
  in Den Haag.
Postcode            Huisnummer
[ 2288 GH        ]  [ 5         ]   (gevuld)
[        Adres zoeken             ]
---
ⓘ De huisvuilkalender van de gemeente is nu
  niet bereikbaar. Er is niets opgeslagen.
[        Opnieuw proberen         ]
```

**G — Aan (status), beheerder**
```
‹ Instellingen
Afvalkalender
Aan · bijgewerkt vandaag 06:15

Adres       2517 AB 12A          Wijzigen
─────────────────────────────────────
Volgende ophaaldagen
  PMD ...................... vr 2 okt
  Restafval ................ di 6 okt
  Papier ................... wo 7 okt

┌ Had je zelf al een terugkerende      ✕ ┐  ← tip, eenmalig
│ afvaltaak? Die blijft staan. Stop hem  │
│ via Taken › Terugkerend.               │
└────────────────────────────────────────┘

  Afvalkalender uitzetten…            ← danger-quiet
```

**H — Storing > 48 uur**
```
Afvalkalender
┌ ⓘ Niet bijgewerkt sinds za 26 sep.     ┐  ← sunken, geen rood
│ De gemeente-site gaf geen antwoord.    │
│ De taken die er staan, blijven staan;  │
│ nieuwe ophaaldagen komen er pas bij    │
│ als het weer lukt.                     │
│ [ Opnieuw proberen ]                   │
└────────────────────────────────────────┘
Adres       2517 AB 12A          Wijzigen
Volgende ophaaldagen (stand za 26 sep)
  …
```

**I — Bevestiging uitzetten (sheet)**
```
Afvalkalender uitzetten?                ✕
Het adres wordt gewist en de afvaltaken die
nog open staan verdwijnen (4 taken). Wat al
gedaan is, blijft in de historie. Weer aanzetten
kan altijd; dan vul je het adres opnieuw in.
[        Uitzetten                ]   ← danger
          Annuleren
```

**J — Gezinslid (rij in Instellingen)**
```
Huishouden
  Gezinsleden                          ›
  Afvalkalender                      Aan
  Ophaaldagen van de gemeente komen
  vanzelf als taak in de lijst.
```

**Vandaag, maandag 5 okt 19:30**
```
Vandaag                          🔔  ⚙
ma 5 oktober · nog 3 te doen

Vandaag 3
( ) Vaatwasser uitruimen      vóór 20:00
    ↻ elke dag
( ) Planten water geven
    ↻ wekelijks
( ) Restafval en papier   vanaf 22:00
    buitenzetten
    ♻ Afvalkalender
✓ 2 gedaan vandaag            Tonen ⌄

Binnenkort
( ) Restafval- en papierbak   di 6 okt
    binnenzetten
    ♻ Afvalkalender
                         Kalender ›
```

**Vandaag, dinsdag 6 okt 09:10 (buiten vergeten)**
```
ⓘ Verlopen
┌ ( ) Restafval en papier       1 uur ┐   ← overdue-soft
│     buitenzetten            te laat │
│     ♻ Afvalkalender                 │
└─────────────────────────────────────┘
Vandaag …
Binnenkort
( ) Restafval- en papierbak  vanaf 12:00
    binnenzetten
    ♻ Afvalkalender
```

**Taakdetail, buitenzetten (sheet)**
```
━━
♻ Afvalkalender · ophaaldag di 6 okt   ✕
Restafval en papier buitenzetten
[ ✓        Afvinken                ]   ← primair 54px
[ Ik ben ermee bezig ][ Deze keer overslaan ]
Buiten zetten     ma 5 okt vanaf 22:00
Uiterlijk         di 6 okt 07:45     (vet)
Herinnering       ma 5 okt 21:00
De ophaaldag komt uit de afvalkalender van
de gemeente. Daarom kun je deze taak niet
verplaatsen, wijzigen of verwijderen.
Verschuift de gemeente de dag, dan schuift
de taak vanzelf mee.
Notities
[ Notitie toevoegen…                ]
```

**Oude UI — sectie in de lange Instellingen-pagina**
```
[Profiel][Meldingen][Huishouden][Afval][Gezinsleden]…
┌ ♻ Afvalkalender ──────────────────────┐
│ Ophaaldagen van Den Haag als taak.     │
│ Postcode [2517 AB] Huisnummer [12]     │
│ Toevoeging [A]                         │
│                       [Adres zoeken]   │
└────────────────────────────────────────┘
```

## 13.15 Toetsvragen
- **Kernflow zonder uitleg?** Ja. De lege staat legt in drie regels uit wat er gebeurt, "Klopt dit?" laat het resultaat zien vóór het bewaren, en afvinken werkt zoals altijd.
- **Hoofdactie in drie seconden?**
  - Leeg: Adres zoeken.
  - Controle: Ja, aanzetten.
  - Taakdetail: Afvinken.
  - Status: bewust geen hoofdactie.
- **Onomkeerbaar zonder bevestiging?** Nee: uitzetten wordt bevestigd. **Nutteloze bevestiging?** Nee: aanzetten gaat via "Klopt dit?", dat zelf de controle is; overslaan en afvinken zijn met Ongedaan maken te herstellen.
- **Overbodige informatie?** De categorie "Buiten" en "↻" vallen weg in de rij, "om 21:00" wordt nooit getoond, en een gezinslid ziet geen adres of status.
- **Alle states?** Zie 13.8, de tabel in 13.4 en de bestaande §7 voor rijen en detail.

---

### Punten voor de hoofdsessie (geen vraag voor Jurgen)
1. **Tegenstrijdigheid architect ↔ analist over een onbereikbare bron bij het opslaan.** De architect (§3.5) bewaart het adres dan toch, met `bag_id = null`. De analist (BR-48) bewaart niets. Ik volg BR-48: zonder "Klopt dit?" kan de beheerder niet controleren, en een stil fout adres is precies het risico. De architect moet zijn §3.5 daarop aanpassen.
2. **Taaknamen voor binnenzetten** ("Restafvalbak binnenzetten", "Restafval- en papierbak binnenzetten"): de conceptcriteria AC-192, AC-193 en AC-199 van de analist gelijktrekken.
3. **Herinneringstekst:** `reminders.ts` stuurt nu "Deze taak staat nu gepland.". Voor afvaltaken moet de tweede regel uit 13.10 komen (architect).
4. **Oude UI, binnenzetten vóór 12:00:** onder Binnenkort betekent dat de selector `available_from` op uur- in plaats van dagniveau moet respecteren (AC-192). De architect moet dit meenemen in de omvang van WP3b.
5. **Nieuw meldingssoort "storing afvalkalender"** (alleen beheerders, één keer per storing, geen schakelaar) en een beperkte actie "Opnieuw proberen" (hooguit één per minuut): voor de architect en de security-review.
6. **Design system:** het Lucide-icoon **recycle** moet in de iconentabel (DS §7.10) als "afvaltaak / Afvalkalender" (visual-designer, bij de W-03-aanvulling).
7. **Nieuwe UI:** een directe URL naar bewerken van een afvaltaak moet naar het detail leiden. In het Overzicht de afvaltaken samen tellen (13.11).

### Keuzes die ik zelf maakte (binnen de productspecificatie)
- In de rij staat "vanaf 22:00" en nooit "om 21:00". Vóór 07:45 staat er "vóór 07:45", en binnenzetten staat vóór 12:00 onder Binnenkort.
- Afvinken wordt niet geblokkeerd vóór 22:00 of vóór 12:00.
- Het kenmerk is de meta "♻ Afvalkalender" met het recycle-icoon, zonder badge of kleur.
- In het taakdetail staan twee directe secundaire knoppen (bezig, overslaan) zonder ⋯. "Vorige keren" is verborgen en er staat één uitlegregel.
- Bij overslaan van buitenzetten zegt de melding onderin ook dat binnenzetten is overgeslagen; Ongedaan maken herstelt beide.
- Onbekend adres en buiten Den Haag krijgen één gezamenlijke foutmelding. Bij meerdere adressen op één nummer kiest de beheerder uit een lijst.
- "Klopt dit?" toont straat en plaats uit de bron, zonder die te bewaren (BR-58). Zonder straat toont het postcode en huisnummer.
- Een eenmalige tip over bestaande handmatige afvalreeksen, zonder dat de app ze herkent (BR-57).
- De storingsmelding komt altijd in de lijst Meldingen, plus push als die op het toestel aan staat, zonder eigen schakelaar. Onder 48 uur staat er alleen een stille regel.
- Een gezinslid ziet in Instellingen een rij zonder pijl, met "Aan" of "Uit".
- Nieuwe UI: een informatierij in Taken › Terugkerend, en in het Overzicht worden afvaltaken samen geteld.

### Status
KLAAR VOOR VISUEEL ONTWERP. De visual-designer hoeft alleen het icoon recycle op te nemen en de waarschuwingsbalk te bevestigen; verder gebruikt dit ontwerp alleen bestaande componenten. Eerst moeten de punten 1 tot 5 met de architect en analist worden gelijkgetrokken. Er zijn nog geen wireframe-screenshots gemaakt of bekeken; de eerste visuele controle gebeurt bij de rook-screenshots van WP3b.

Relevante bestanden:
- /home/user/takenlijstje/docs/UX_SPEC.md (§2, §5.5, §5.8, §6, §7, §9: aanvullingen hierboven)
- /home/user/takenlijstje/docs/DESIGN_SYSTEM.md (§7.4, §7.7, §7.10, §8)
- /home/user/takenlijstje/docs/wijzigingen/W-03/product-analyst-r1.md
- /home/user/takenlijstje/docs/wijzigingen/W-03/solution-architect-r1.md
- /home/user/takenlijstje/src/features/settings/settings-page.tsx en household-section.tsx
- /home/user/takenlijstje/src/features/tasks/task-detail-sheet.tsx en task-card.tsx
- /home/user/takenlijstje/src/features/calendar/calendar-view.tsx en calendar-items.tsx
- /home/user/takenlijstje/src/domain/reminders.ts
