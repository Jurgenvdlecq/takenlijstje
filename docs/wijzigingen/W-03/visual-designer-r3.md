## Visueel ontwerp: W-03 afvalkalender — ronde 3 (tekstwijzigingen uit product-designer-r4)

Ik heb twee prototypebestanden aangepast en daarvan nieuwe screenshots gemaakt. Die screenshots heb ik met Read bekeken. DESIGN_SYSTEM.md heb ik niet aangeraakt, want het is bevroren.

### Controle van de prototypebestanden (alle 11 in docs/prototype/w03/)
Ik heb gezocht op de oude en de nieuwe formuleringen: "twee weken", "komende weken", "online gezet", "'s-Gravenhage", "Den Haag", "klaargezet", "staat aan" en "Bekijken".
- **07-storing-leeg-te-snel.html (H2):**
  - de titel is nu T-77: "Geen komende ophaaldagen meer bekend";
  - de uitleg is nu T-77b: "De gemeente geeft geen enkele komende ophaaldag meer. Dat is ongebruikelijk. …". Het is T-77b en niet T-77a, omdat de stand in het scherm op 12 oktober staat en oktober niet onder december/januari valt.
- **09-nog-geen-ophaaldagen.html (F2, aanzetten):** de tekst is nu T-64, letterlijk: "De gemeente geeft voor dit adres nog geen komende ophaaldagen. De kalender van het nieuwe jaar komt meestal rond de jaarwisseling online. Er is niets opgeslagen. Probeer het over een paar dagen opnieuw."
- **02-klopt-dit.html (T-45a):** hoeft niet te veranderen. Er staat al "Laan van Meerdervoort 12A, Den Haag", en nergens in het prototype komt "'s-Gravenhage" voor.
- **M-04, T-64b, T-77a en T-90/T-90b:** geen van deze teksten staat in het prototype. Er was dus niets aan te passen.
- **Rest:** 01, 03, 04, 05, 06, 08, 10 en 11 bevatten geen van de gewijzigde teksten en blijven zoals ze zijn.

### Vernieuwde screenshots (390×844)
In `/home/user/takenlijstje/docs/screenshots/prototype/`:
- `w03-07-storing-leeg-te-snel-390x844.png`
- `w03-09-nog-geen-ophaaldagen-390x844.png`

Beide gaven 0 consolefouten, 0 paginafouten en 0 mislukte verzoeken. De donkere varianten bestonden voor 07 en 09 niet en zijn dus ook niet nodig. De overige screenshots van w03 blijven geldig, want hun teksten zijn niet veranderd.

Wat ik op het beeld zie:
- **07:** de H2-titel past nu op één regel, waardoor het vroegere losse woord "weken" op de tweede regel vanzelf verdwenen is. `text-wrap: balance` blijft staan voor andere lengtes. De balk is rustig en grijs zonder rood. T-79 staat in de balk, "Opnieuw proberen" is een tekstknop, en de drie bakken staan eronder met "nog geen ophaaldag bekend" in text-3.
- **09:** het vlak zonder titel heeft nu vijf regels, even lang als voorheen, zonder weesregel. De velden staan gevuld eronder en "Adres zoeken" is de primaire knop onder het formulier.

---

# WIJZIGINGEN OP DE DS-INVOEGTEKST (visual-designer-r2.md)
Alle andere delen van de invoegtekst uit r2 blijven ongewijzigd.

## (2) §7.13.5, onderdeel "Status (toestand G, G′, G″)": nieuwe bullet direct na "Hoofdactie"
- **Melding na aanzetten:** de bestaande melding onderin (§7.8), in twee varianten:
  - **T-90** met de actie **Bekijken** in `toast-action`, die de Kalender (week) opent. Dit geldt als er taken zijn klaargezet (`inserted` > 0).
  - **T-90b** zonder actie en zonder lege actieruimte. De tekst loopt dan over de volle breedte. Dit geldt als er 0 taken zijn klaargezet, omdat de eerstvolgende ophaaldag verder dan 14 dagen weg ligt. De datum staat al in G onder "Volgende ophaaldagen", dus er is geen knop nodig.
  - Beide varianten krijgen het ✓-icoon, `role="status"`, ongeveer 5 s in beeld, en geen afwijkende kleur.

## (5) Oude UI, punt 2 "Instellingen": nieuwe bullet na "Uitzetten"
- **Melding na aanzetten:** gebruik de bestaande `toast` (sonner). Voor T-90 komt er `action: { label: "Bekijken" }`. Voor T-90b komt er **geen** `action`. Voeg geen nieuwe toastvariant toe.

## (4) §12 Prototype: gewijzigde regels (vervangen de regels met dezelfde ID)
| W03-02 | `w03/02-klopt-dit.html` | `w03-02-klopt-dit-390x844.png`, `…-donker-…` | Klopt dit? (C) | Adres als onderwerp zonder kaart; één hoofdactie. Ronde 2: T-46. Ronde 3: T-45a met plaats "Den Haag" gecontroleerd (stond al goed) |
| W03-07 | `w03/07-storing-leeg-te-snel.html` | `w03-07-storing-leeg-te-snel-390x844.png` | H2 (oktober, dus T-77/T-77b) met T-79 ("te snel") en drie bakken met T-45b | T-79 in de balk, geen melding onderin. Ronde 3: T-77/T-77b nieuw; de titel past nu op één regel, `text-wrap: balance` blijft voor langere varianten |
| W03-09 | `w03/09-nog-geen-ophaaldagen.html` | `w03-09-nog-geen-ophaaldagen-390x844.png` | F2 (2 januari, aanzetten: T-64) | Balk zonder titel, hoofdactie onder het formulier. Ronde 3: T-64 nieuw, vijf regels zonder weesregel |

De regels W03-01, 03, 04, 05, 06, 08, 10 en 11 blijven zoals in r2.

**Bewust niet als prototype gebouwd:** T-90 en T-90b. Het is de bestaande melding onderin (§7.8) met of zonder actie, en de beeldcontrole daarvan valt bij CP-W03 (TD §18.16 U3).

---

### Zelfcontrole op anti-patronen
Er is niets nieuw bij gekomen:
- geen rood bij een storing;
- geen nieuwe vlakken, badges of iconen;
- T-90b voegt geen component toe, alleen een melding zonder actie.

Het herhalende "nog geen ophaaldag bekend" in 07 blijft bewust staan, zoals al in r2 genoemd.

### Vragen voor Jurgen
Geen.

### Oordeel
**GEREED VOOR ARCHITECTUUR EN PLANREVIEW.** Het prototype toont alleen de teksten uit product-designer-r4. De teksten die daar vervallen zijn, komen er niet meer in voor. Ik heb de twee vernieuwde screenshots op het beeld bekeken en ze voldoen.

Bestanden:
- /home/user/takenlijstje/docs/prototype/w03/07-storing-leeg-te-snel.html
- /home/user/takenlijstje/docs/prototype/w03/09-nog-geen-ophaaldagen.html
- /home/user/takenlijstje/docs/screenshots/prototype/w03-07-storing-leeg-te-snel-390x844.png
- /home/user/takenlijstje/docs/screenshots/prototype/w03-09-nog-geen-ophaaldagen-390x844.png
