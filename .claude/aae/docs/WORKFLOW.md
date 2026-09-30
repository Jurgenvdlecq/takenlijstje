# Proportionele kwaliteitsbewaking

## Risico en routing
De hoofdsessie verricht altijd de supervisorfunctie; een aparte supervisor-agent is alleen nodig bij wezenlijke onzekerheid. Begin niet blind Lean wanneer informatie over rechten/data/foutimpact ontbreekt. Lees hoogstens de bronnen die dat verschil bepalen. De gebruiker hoeft geen agents of modellen te kiezen.

Lean: duidelijke kleine wijziging, laag risico/lage onzekerheid, nul of een specialist. Standard: samenhangende gewone feature of analyse; meestal een tot twee specialisten. High Assurance: concrete hoge impact op geld, autorisatie of gevoelige data; migratie is alleen High Assurance wanneer de concrete migratie dat risico werkelijk heeft. Het project is niet permanent een niveau; de huidige verandering bepaalt de aanpak.

Standaardlimiet zonder extra toestemming: Lean 1 agentaanroep, Standard 3 (inclusief mogelijke supervisor), High Assurance 6. Een taakbudget kan bewust lager zijn. Parallel 1; 2 kan alleen met onafhankelijke vragen, onderbouwing en GO. Maximaal 12 totaal als absolute schemalimiet; splits grotere opdrachten in door de gebruiker begrepen uitkomsten. Geen nieuwe taak-ID als automatische budgetreset.

## Niet-onderhandelbaar bewijs, wel vrije keuze van expertise
- Iedere implementatie: functioneel doel, regressie en scopecontrole.
- UI: relevante visuele toestand plus basistoegankelijkheid. Een agent is niet verplicht, het bewijs wel.
- Autorisatie: toegestane en geweigerde acties plus gegevensisolatie.
- Migratie: omzetting, gegevensbehoud en aantoonbaar herstelpad.
- Financiele logica: kernberekeningen en afrondings-/grensgevallen.
- Gevoelige data: passende omgang en logging.
- Achtergrondtaken: dubbele verwerking en retrygedrag.
- Externe effecten: mislukkingen en veilige foutafhandeling.

Voor High Assurance implementatie is een actueel onafhankelijk oordeel van een passende code/security/testspecialist nodig. De rest van het team is niet automatisch verplicht. De bronfingerprint van die review moet bij de actuele code passen. Een rapport kan inhoudelijk onvoldoende zijn ondanks geldige JSON; de hoofdsessie blijft kritisch beoordelen.

Analyse heeft alleen analysebewijs, geen verplichte applicatietests. In een analyse mogen goedgekeurde gerichte tests worden gebruikt om een concrete bewering te toetsen, maar nooit als algemene automatische testslag. Inspectie, handmatige proef en uitgevoerde test zijn verschillende bewijsvormen.

## Design Freeze
Bij nieuwe productrichting of ingrijpende kernflow: eerst probleem, oplossing, acceptatiecriteria en noodzakelijke visuele richting. Leg relevante keuzes vast in een compacte notitie. De implementatieroute verwijst ernaar en vraagt GO. Geen vaste lijst verplichte ontwerpdocumenten of plan-critic per niveau. Bij miniwijzigingen kan deze fase vervallen.

## Definitie van gereed
READY: alle criteria en verplichte bewijssoorten zijn onderbouwd op dezelfde route en bronversie. PARTIAL: bruikbaar resultaat maar bewijs/functionaliteit ontbreekt. BLOCKED: een concrete randvoorwaarde verhindert betrouwbare afronding. De laatste twee zijn legitieme eindresultaten en mogen niet in automatische herstelrondes eindigen.

De sluitcontrole controleert structuur, verwijzingen, bronversie en succesvolle commandoreceipts. Zij kan niet waarheidsgetrouw vaststellen of een Markdown-notitie echt een goede menselijke waarneming bevat. Dit is geen kwaliteitscertificaat, OS-sandbox of vervanging van hostrechten.

## Afweging van testkosten
Stuur op runtime, logvolume, modelcontext en risicodekking. Het aantal tests op zichzelf zegt niets over Claude Max-verbruik. Een korte volledige suite kan beter zijn dan lange selectielogica. Browserinstallatie of een dure externe proef hoort niet automatisch bij een kleine wijziging.

## Bijvangst en herstel
Noteer alleen relevante ontdekkingen buiten scope. Repareer pas wanneer de hoofdopdracht anders aantoonbaar onjuist zou worden, of na nieuwe toestemming. Bij twee dezelfde mislukte commandopogingen zonder bronwijziging blokkeert de runner een volgende automatische poging. Verander een hypothese of vraag om de ontbrekende randvoorwaarde.

Hervat na contextverlies vanuit compacte voortgang plus taakstatus, niet vanuit een nieuwe brede audit. Bekende besluiten blijven staan. Nieuwe code maakt oud bewijs mogelijk ongeldig; de bronhash voorkomt blind hergebruik. Een verlopen/onbekend agentslot wordt niet op een timer gratis opnieuw beschikbaar: eerst echte processen stoppen, dan gecontroleerd herstellen.
