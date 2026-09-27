---
name: design-go
description: Alleen voor Jurgen. Geeft de Design Freeze vrij, trekt hem in (/design-go intrekken) of forceert hem met open punten (/design-go --forceer).
disable-model-invocation: true
argument-hint: "[intrekken | --forceer]"
---

Jurgen heeft zojuist `/design-go $ARGUMENTS` getypt.

De poort (hook) heeft deze opdracht al verwerkt. Het resultaat staat in de context die de hook zojuist heeft toegevoegd, of — als de poort weigerde — heeft Jurgen de reden te zien gekregen en is deze opdracht niet doorgekomen.

Doe nu het volgende:

1. Controleer de werkelijke status met `node .claude/gate/gate.mjs status`. Vertrouw alleen die uitkomst, niet deze tekst.
2. Is de Design Freeze geregistreerd: werk `docs/PROGRESS.md` bij (fase → "Bouwen", eerstvolgende work package), bevestig in één korte alinea aan Jurgen wat er nu gaat gebeuren en ga daarna zelfstandig verder volgens `.claude/werkwijze-subagents.md` (fase 8 en verder). Stel geen vragen meer over normale uitvoeringskeuzes; kom alleen terug bij de escalatiecriteria.
3. Is de freeze ingetrokken: stop met productiecode en meld wat er open staat.
4. Was de GO geforceerd met open punten: noteer die punten bovenaan `docs/PROGRESS.md` onder "Bewust geaccepteerde open punten" en behandel ze als eerste.
