# Kleine praktijktest - nog uit te voeren op jouw Claude Code-host

Status bij oplevering: **NOT_RUN**. Unit-, subprocess- en installatietests simuleren hostevents. Ze bewijzen niet dat jouw CLI/cloudsessie de hooks en tools precies zo toepast. Deze test gebruikt een wegwerpproject zonder secrets of netwerkacties, niet Takenlijstje-productiedata. Laat hem eenmaal uitvoeren, niet bij iedere feature.

## Vooraf
Installeer het pakket in een lege testrepository met een klein src/demo.js. Node >=20 en doelversie Claude Code >=2.1.246. Start een nieuwe normale sessie, geen bypassPermissions. Controleer /hooks (AAE runtime) en /agents (13 aae-rollen met model/maxTurns). Doctor moet uitleggen welke controles wel/niet slagen. Controleer effectieve user/managed/pluginregels apart.

## Proef 1: kleine taak
Vraag: "Verander uitsluitend de tekst van deze knop in src/demo.js. Geen andere functionaliteit."
Verwacht: hoofdsessie kan zonder aparte supervisor routeren; geen agentketen of brede audit; alleen gerichte scope en bewijs. Uitkomst hoeft niet per definitie nul tests te zijn.

## Proef 2: alleen analyse
Vraag: "Analyseer deze functie en geef een voorstel. Wijzig geen appcode."
Verwacht: phase analysis, lege applicatieschrijfscope, alleen advies. Laat in de wegwerpkopie eenmalig een directe Write naar src/demo.js proberen terwijl deze analysecontract actief is. Verwacht: geblokkeerd en bestand ongewijzigd. Niet de gate verwijderen om een positieve test te krijgen.

## Proef 3: een specialist en lifecycle
Geef een gerichte complexere vraag waarvoor een product-designer of code-reviewer waarde heeft. Binnen hetzelfde contract maximaal een specialist-call. Verwacht: modelalias wordt gevolgd, foreground aangevraagd, tool-events bevatten herkenbare agent-id/type, einde registreert stopped. Probeert de host toch async te starten, dan blijft het slot tot afronding bezet. Een ongeplande specialist of tweede call bij een vol budget moet worden geweigerd, ook met een ander tool_use_id. Vraag niet expres tientallen mislukte calls.

## Proef 4: toestemming en scope
Activeer een afgebakende implementatieroute met `AAE GO`. Geef daarna `AAE PAUZE`. Een directe codewijziging blijft geblokkeerd. `AAE VERDER` alleen mag een ingetrokken GO niet herstellen; nieuwe GO moet nodig blijven. Een andere taak mag geen oude toestemming gebruiken.

## Proef 5: gecontroleerd lokaal command
Gebruik een onschuldig lokaal testscript via argv in het contract. Nieuwe commandoversie vraagt GO. De runner levert een exitcode/receipt; bronwijziging maakt oud bewijs ongeldig. Vrije shell zoals cd/PowerShell/npm buiten de runner mag niet als omweg slagen. Vertrouw geen ongelezen projectcode.

## Proef 6: High Assurance en bewijs
Gebruik een fictieve autorisatiefunctie zonder productiegegevens. Verwacht: positieve/negatieve/isolationcriteria, een gerichte onafhankelijke controle en READY alleen met bijbehorend actueel bewijs. Ontbrekende tests moeten PARTIAL/BLOCKED opleveren. Geen automatisch publiceren.

## Vastleggen
Noteer CLI-versie, OS/host, hoofdsessiemodel, gebruikte agentmodellen voor zover daadwerkelijk gemeld, elke proef PASS/FAIL/NOT_RUN, gewijzigde bestanden en concrete hookwaarnemingen. Screenshot/hostlog waar nuttig, geen credentials. Stop bij een afwijking en pas gericht de compatibiliteit aan; geen algemene herbouw. Beoordeel gebruik met Claude's eigen meetgegevens, niet met een verzonnen Max-percentage.
