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

## GO-envelop (v3.2-local)
Eén `AAE GO` keurt het hele werkpakket uit het contract goed. Na GO voert de hoofdsessie de route zelfstandig uit, inclusief herstelrondes, commits, pushes, PR en een vooraf goedgekeurde merge/deploy. Vervolgberichten van de gebruiker laten de GO staan; alleen `AAE PAUZE` trekt hem in.

Een gewijzigd contract blijft binnen de envelop (route blijft `active`, GO blijft geldig) als alles hieronder geldt:
- zelfde taak-ID, fase en modus; risico en onzekerheid gelijk of lager; dezelfde risicovlaggen;
- schrijfscope binnen de goedgekeurde schrijfscope (leesscope mag ruimer);
- `approval_required` en `design_freeze` ongewijzigd; geen beslisgrens verwijderd;
- bewijs niet lichter: elk bestaand acceptatiecriterium blijft letterlijk staan (toevoegen mag) en elke bestaande controle blijft met dezelfde methode en omschrijving in het bewijsplan (toevoegen mag);
- dezelfde agents (geen nieuwe, geen verwijderde), met dezelfde vraag, hetzelfde resultaat en stopcriterium, hetzelfde model, minstens dezelfde bestanden en gelijke of lagere `max_calls`;
- agentbudget, extern budget en parallelisme niet hoger (het commandobudget mag omhoog tot het schemamaximum);
- een commando houdt hetzelfde doel; een `"gate": "ready"` op een commando (ook een lokaal commando) mag niet vervallen; publish/install/destructive-commando's blijven ongewijzigd (argv, timeout, gate, watch) en draaien niet vaker;
- een nieuw of gewijzigd lokaal commando (read/test/build/preview) moet volledig op de toegestane lijst staan (`safeLocalArgv` in `runtime/core.mjs`): begin `node --test`, `npx vitest run`, `npx tsc --noEmit`, `npx eslint`, `npx playwright test`, of `git status|diff|log|show|rev-parse|merge-base`; daarna alleen de per programma toegestane opties (bijvoorbeeld `--porcelain`, `--stat`, `--max-warnings=0`) en eenvoudige relatieve paden of git-refs (geen absolute paden, geen `..`, geen `:` of `=`). Bij `node --test` alleen testbestanden (`.test.`/`.spec.`) of de mappen `tests`, `test`, `__tests__`, `spec`, `src`. Andere argv (ook een eigen script of opties als `--fix`, `--import`, `--outputFile`) is materieel; zet die vooraf in het contract. Alleen-lezende git-operanden worden niet tegen de leesscope gehouden (bewust: ze lezen alleen de eigen repository);
- integraties niet breder: zelfde Supabase-project, geen extra tools of calls, geen nieuwe gevoelige migraties/SQL, zelfde PR-base en -head.

Alles daarbuiten is materieel: `route` zet de taak op `pending` en noemt de reden in `envelope_changes`. Vraag dan één nieuwe GO met een korte uitleg.

Wat altijd bij de gebruiker terugkomt, ook binnen de envelop: een databasehandeling die niet vooraf was goedgekeurd én materieel meer risico geeft; destructieve of moeilijk omkeerbare databasewijzigingen of het verwijderen/onherstelbaar wijzigen van productiegegevens (`AAE GEVOELIG GO`); onverwachte wijzigingen aan authenticatie, autorisatie, security of secrets; werk buiten het pakket; een oplossing met duidelijk hoger risico; een punt uit `decision_points`; twijfel bij een vooraf goedgekeurde merge/deploy.

Een vooraf beschreven, niet-destructieve migratie valt onder de ene GO, ook als die na een fout opnieuw of gecorrigeerd moet worden binnen hetzelfde doel.

## Herstelrondes (v3.2-local)
Een mislukte test, review, build, migratie of implementatiepoging vraagt geen nieuwe GO. De hoofdsessie analyseert, herstelt binnen de scope, test en reviewt opnieuw en commit/pusht opnieuw tot de acceptatiecriteria gehaald zijn of het budget op is. Plan budgetten daarom met ruimte voor herstel. De bestaande rem blijft: na twee identieke mislukkingen zonder bronwijziging eerst de hypothese veranderen.

## Vooraf goedgekeurde merge/deploy (v3.2-local)
Neem merge/deploy naar main, als dat bij het pakket hoort, vooraf op als commando met `"gate": "ready"` (bijvoorbeeld `git push origin <werkbranch>:main`). De runner voert het alleen uit als `docs/aae/RESULT.json` READY is op de actuele route en bron, met alle criteria en controles aantoonbaar geslaagd. Formuleer acceptatiecriteria zo dat ze vóór de merge bewezen kunnen worden; de nacontrole van de uitrol (bijvoorbeeld de deployment en een rooktest) komt in het eindrapport. Bij twijfel of een afwijking: stoppen en de gebruiker vragen.
