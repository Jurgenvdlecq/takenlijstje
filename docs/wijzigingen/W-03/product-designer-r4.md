## UX-ontwerp: W-03 afvalkalender, ronde 4 (kort, alleen tekst)
Ik heb niets in bestanden geschreven. Gelezen: `docs/wijzigingen/W-03/solution-architect-r5.md` (§18.8.1, §18.8.4, §18.8.5 en "Punten voor designer en analist" 1–3) en `docs/wijzigingen/W-03/product-designer-r3.md` (§13 volledig).
Wireframes en screenshots: niet gewijzigd. Alleen de F2-tekst in het tekstwireframe van §13.14 verandert, omdat daar T-64 letterlijk in staat.
Kernflow: ongewijzigd (4 tikken plus typen).

---

# A. Gewijzigde regels in §13.16 (vervangen de regels van r3 met dezelfde ID)

| ID | Waar | Wanneer | Tekst (exact) |
| --- | --- | --- | --- |
| T-45a | C, adresweergave | met of zonder straat | <straat> <nr><toev>, Den Haag · anders: <adres>, Den Haag (de plaats is altijd "Den Haag", ook als de bron "'s-Gravenhage" geeft; alleen weergave, niets bewaard) |
| T-64 | F2 | aanzetten | De gemeente geeft voor dit adres nog geen komende ophaaldagen. De kalender van het nieuwe jaar komt meestal rond de jaarwisseling online. Er is niets opgeslagen. Probeer het over een paar dagen opnieuw. |
| T-64b | F2 | wijzigen | De gemeente geeft voor dit adres nog geen komende ophaaldagen. De kalender van het nieuwe jaar komt meestal rond de jaarwisseling online. Er is niets opgeslagen; het huidige adres blijft gebruikt. Probeer het over een paar dagen opnieuw. |
| T-77 | H2, titel | `SUSPECT_EMPTY` | Geen komende ophaaldagen meer bekend |
| T-77a | H2, uitleg | december of januari | De gemeente geeft geen enkele komende ophaaldag meer. Waarschijnlijk staat de kalender van het nieuwe jaar nog niet online. De taken die er staan, blijven staan. Kijk tot die tijd zelf op huisvuilkalender.denhaag.nl. |
| T-77b | H2, uitleg | andere maanden | De gemeente geeft geen enkele komende ophaaldag meer. Dat is ongebruikelijk. De taken die er staan, blijven staan. Kijk tot die tijd zelf op huisvuilkalender.denhaag.nl. |
| T-90 | melding onderin | aangezet, er zijn taken klaargezet (`inserted` > 0) | Afvalkalender staat aan · taken voor 2 weken klaargezet · Bekijken |
| T-90b (nieuw) | melding onderin | aangezet, 0 taken klaargezet (`inserted` = 0: de eerstvolgende ophaaldag ligt verder dan 14 dagen weg) | Afvalkalender staat aan · taken verschijnen 14 dagen vooraf |

T-64b is meegenomen omdat hij dezelfde zin "voor de komende weken" had als T-64. Anders zouden ze uit elkaar lopen.

**M-04 in §13.10 (tabelrij; M-01…M-05 in §13.16 verwijzen hiernaar):**

| ID | Wanneer | Aan wie | Titel | Tekst | Tik opent |
| --- | --- | --- | --- | --- | --- |
| M-04 | storing, oorzaak `SUSPECT_EMPTY` | idem | De afvalkalender kon niet worden bijgewerkt | De gemeente geeft geen komende ophaaldagen meer. Soms staat de nieuwe kalender nog niet online. Kijk zelf op huisvuilkalender.denhaag.nl. | idem |

**Aanvulling op "Vervallen teksten" (§13.16):**
- T-64/T-64b oud: "De gemeente heeft nog geen ophaaldagen voor de komende weken online gezet.";
- T-77 oud: "Geen ophaaldagen voor de komende twee weken";
- T-77a/T-77b/M-04 oud: "De gemeente geeft voor de komende twee weken geen (enkele) ophaaldag(en).";
- T-45a oud: "<straat> <nr><toev>, <plaats>". Nooit "'s-Gravenhage" tonen.

---

# B. Gewijzigde zinnen elders in §13

**§13.7.1, stap 4, eerste bullet** (was: "het adres zoals de gemeente het kent. Geeft de bron geen straat, dan de vorm …"):
> het adres zoals de gemeente het kent, met als plaats altijd "Den Haag" (T-45a). Geeft de bron geen straat, dan de vorm "2517 AB 12A, Den Haag". Dit wordt niet bewaard (BR-58);

**§13.7.1, stap 5** (was: "… toestand G met melding T-90 "… · **Bekijken**", en Bekijken opent de Kalender (week)."):
> **Ja, aanzetten** (4). De knop toont "Bezig…". Daarna volgt toestand G met melding T-90 "… · **Bekijken**", en Bekijken opent de Kalender (week). Ligt de eerstvolgende ophaaldag verder dan 14 dagen weg, dan zijn er nog geen taken en komt melding T-90b, zonder Bekijken. De datum staat al onder Volgende ophaaldagen in G.

**§13.7.1, foutpadentabel, rij F2** (was: "Geen enkele ophaaldag van vandaag t/m vandaag + 14, terwijl …"):
> | De gemeente geeft voor restafval, papier en PMD samen geen enkele komende ophaaldag (vandaag of later), terwijl het adres wel bakken heeft; óf het is januari en de kalender van het lopende jaar is nog helemaal leeg (AC-237). Een eerstvolgende dag verder dan 14 dagen weg is géén F2: dan gewoon C, en na aanzetten T-90b | F2 | T-64 of T-64b | **Adres zoeken** (primair), later opnieuw |

**§13.7.5, bullet "Storing"** (was: "… om welke reden ook, of een aanhoudend leeg antwoord"):
> **Storing** (`health = failed`: langer dan 48 uur zonder succes, om welke reden ook, of minstens twee vastgelegde antwoorden achter elkaar zonder enige komende ophaaldag):

**§13.7.5, bullet "Kalender van volgend jaar ontbreekt", tweede subbullet** (was: "wordt het venster helemaal leeg, dan volgt H2."):
> geeft de gemeente geen enkele komende ophaaldag meer (na de laatste decemberdatum, of op 1 januari), dan volgt H2 met T-77a. Een lege periode van een paar weken, bijvoorbeeld papier eens per 4 weken, is geen storing.

**§13.13.3, regel "Meldingen onderin"** (was: "T-90, T-91, T-92, T-93, T-94, T-31."):
> **Meldingen onderin:** T-90, T-90b, T-91, T-92, T-93, T-94, T-31.

**§13.14, tekstwireframe F2** (het tweede blok onder "F — Bron onbereikbaar / F2"; de inhoud volgt T-64):
```
┌ ⓘ De gemeente geeft voor dit adres nog   ┐
│   geen komende ophaaldagen. De kalender   │
│   van het nieuwe jaar komt meestal rond   │
│   de jaarwisseling online. Er is niets    │
│   opgeslagen. Probeer het over een paar   │
│   dagen opnieuw.                          │
└───────────────────────────────────────────┘
```

**Controle op de rest van §13:** geen andere plek gebruikt "twee weken", "komende weken" of "komende 14 dagen" nog als storingsregel.
- **T-52, T-95, §13.11 ("verder dan 14 dagen vooruit …") en T-90 ("taken voor 2 weken klaargezet")** gaan over het takenvenster van V-52, niet over storing. Die blijven staan.
- **T-73 (G″) en §13.7.5** gebruiken "venster" voor het takenvenster dat tot in januari loopt. Dat is een stille waarschuwing, geen storingsregel, en blijft staan. Alleen de H2-zin eronder is aangepast (zie hierboven).
- **§13.8.1 rij F2 en §13.8.2 rij H2** noemen alleen ID's of "Nog geen komende ophaaldagen". Die zijn ongewijzigd en kloppen.

---

# C. Wijzigingen ten opzichte van r3
1. **T-77, T-77a, T-77b, M-04:** "voor de komende twee weken" is vervangen door "geen (enkele) komende ophaaldag meer", zoals de nieuwe leeg-regel in TD r5 §18.8.4.
2. **T-64 en T-64b:** "voor de komende weken online gezet" is vervangen door "geeft voor dit adres nog geen komende ophaaldagen".
3. **T-45a:** de plaats is vast "Den Haag", niet meer de `<plaats>` uit de bron (die geeft "'s-Gravenhage").
4. **Nieuw T-90b:** de aanzetmelding bij 0 klaargezette taken, zonder Bekijken. T-90 geldt nu alleen bij `inserted` > 0.
5. **§13.7.1:** stap 4 met "Den Haag", stap 5 met T-90b, en de F2-rij met de nieuwe regel plus het tegenvoorbeeld "verder dan 14 dagen = gewoon C". "Begin januari" is in deze rij "januari" geworden, zoals in TD §18.8.1.
6. **§13.7.5:** de storingsdefinitie volgt §18.8.5 ("twee vastgelegde antwoorden zonder komende ophaaldag"). "Venster helemaal leeg → H2" is vervangen door "geen enkele komende ophaaldag meer → H2".
7. **§13.13.3:** T-90b staat in de CP-W03-lijst met meldingen.
8. **§13.14:** het F2-wireframe volgt de nieuwe T-64.
9. **Vervallen teksten:** de oude versies zijn toegevoegd.

### Vragen voor Jurgen
Geen.

### Keuzes die ik zelf maakte (binnen de productspec)
- **T-90b heeft geen knop Bekijken.** Bekijken zou een Kalenderweek zonder afvaltaken openen. De eerstvolgende datum staat al in G onder Volgende ophaaldagen, dus de knop voegt niets toe.
- **T-64b is meegenomen** met dezelfde formulering als T-64, zodat aanzetten en wijzigen gelijk blijven.
- **T-90 houdt "2 weken".** Dat gaat over het takenvenster en is geen storingsregel. Ik heb hem niet herschreven om onnodige wijzigingen te vermijden.
- **T-91 ("afvaltaken bijgewerkt") heeft geen 0-variant.** Bij een adreswijziging worden de oude open taken sowieso vervangen, dus "bijgewerkt" klopt ook bij 0 nieuwe taken.

### Punten voor de hoofdsessie
- **Architect:** in de §18.11-rij `saved`, `mode: 'enabled'` moet een splitsing komen: `inserted` > 0 → T-90 (met Bekijken), `inserted` = 0 → T-90b (zonder Bekijken). In TD r4 moeten ook regel 1018 (meldingenlijst) en de U3-lijst T-90b noemen.
- **Analist:** AC-237 citeert T-64 letterlijk en moet de nieuwe tekst krijgen. AC-183 kan een variant "eerstvolgende dag over 3 weken → aangezet, T-90b, 0 taken" krijgen. Dit sluit aan op punt 4 van TD r5.
- **Visual-designer:** in het prototype moeten F2 (T-64), H2 (T-77/T-77a/T-77b) en de adresweergave in C ("Den Haag") aangepast worden, als die daar letterlijk staan.
- **r4-D1–D4:** de opdracht beperkte deze ronde tot de punten 1–3 uit r5. Ik heb D1–D4 niet opnieuw beoordeeld. Als ze nog niet verwerkt zijn, moeten ze apart mee.

### Status
KLAAR VOOR VISUEEL ONTWERP (tekstwijzigingen). Er zijn geen open vragen.

Relevante bestanden:
- /home/user/takenlijstje/docs/wijzigingen/W-03/solution-architect-r5.md
- /home/user/takenlijstje/docs/wijzigingen/W-03/product-designer-r3.md


---

## Controle D1–D4 (solution-architect-r4.md, regels 1161–1165) op product-designer-r3/r4

Ik heb niets in bestanden geschreven. Van de vier punten was alleen D2 nog niet verwerkt.

**D1: storing zonder foutcode geeft H1 en M-03**
Al verwerkt in r3, op drie plekken:
- §13.8.2, rij H1: "`UNREACHABLE`, `FORMAT` of **geen foutcode** (achtergrondtaak lag stil)" → T-75/T-76;
- §13.10, M-03: "storing, oorzaak `UNREACHABLE`/`FORMAT`, of **geen foutcode** (de achtergrondtaak lag stil)";
- §13.7.5: "**geen foutcode** … geeft H1 met M-03".

Er hoeft niets te veranderen.

**D2: §13.13.3 wordt alleen een verwijzing**
Nog niet verwerkt: r3 noemde §13.13.3 zelf "de enige lijst". De kop en de hele inhoud van §13.13.3 (inclusief mijn r4-regel "Meldingen onderin: T-90, T-90b, …") worden vervangen door:

> ### 13.13.3 Checkpoint CP-W03: rook-screenshots WP3b
> De lijst met rook-screenshots voor WP3b staat in TD §18.16 U3 (CP-W03). Dat is de enige lijst.

Mijn r4-wijziging aan §13.13.3 vervalt daarmee.

Opmerking voor de architect:
- Neem in TD §18.16 U3, bij de meldingen onderin, **T-90b** op ("Afvalkalender staat aan · taken verschijnen 14 dagen vooraf", zonder Bekijken; na aanzetten met een eerstvolgende ophaaldag verder dan 14 dagen weg). Doe hetzelfde in TD r4 regel 1018 ("meldingen onderin: T-90 (met Bekijken), T-91, …").
- Neem in U3 ook F2 op met een adres waarvan de eerstvolgende dag over 3 weken ligt. Dat moet C geven, geen F2. Na aanzetten volgt T-90b.
- Verder in §13 verwijst alleen §13.17 naar de lijst ("AC-217 (oude UI, CP-W03-lijst §13.13.3)"). Die zin wordt: "AC-217 (oude UI, CP-W03-lijst TD §18.16 U3)".

**D3: balk blijft staan tot herstel, ook als de oorzaak verandert**
Al verwerkt in r3, §13.7.5, bullet "Een storing blijft een storing tot het echt weer lukt". Daar staat al dat de balk en "Niet bijgewerkt" blijven staan tot het bijwerken weer gelukt is. Verandert de oorzaak, dan verandert alleen de tekst in de balk (H2 wordt H1), zonder tweede melding. §13.8.2 zegt hetzelfde: "De balk blijft staan tot het bijwerken weer gelukt is. Alleen de variant (H1/H2/H3) volgt de laatste oorzaak."

Er hoeft niets te veranderen. Wil de hoofdsessie de letterlijke zin toch bij "Weer gelukt" hebben, dan kan dat zonder bezwaar. Inhoudelijk voegt hij niets toe.

**D4: T-52 met de ophaalmomenten 06:00 en 17:00**
Al verwerkt in r3. T-52 luidt: "Taken staan 14 dagen vooraf klaar. De app kijkt twee keer per dag, 's ochtends en aan het eind van de middag, of de gemeente iets veranderd heeft." Dat past bij 06:00 en 17:00 zonder exacte tijden te noemen. Er hoeft niets te veranderen.

### Vragen voor Jurgen
Geen.

Relevante bestanden:
- /home/user/takenlijstje/docs/wijzigingen/W-03/solution-architect-r4.md
- /home/user/takenlijstje/docs/wijzigingen/W-03/product-designer-r3.md
- /home/user/takenlijstje/docs/wijzigingen/W-03/product-designer-r4.md
