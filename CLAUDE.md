# Projectinstructies

## Altijd
- Communiceer in het Nederlands. Samenvattingen voor Jurgen in gewone taal, zonder technisch jargon.
- Lees bij het begin van elke sessie eerst `docs/PROGRESS.md`. Besluiten daarin zijn bindend en worden niet opnieuw geïnterpreteerd.
- Volg de werkwijze hieronder. Kwaliteit gaat boven snelheid.

## Bij een nieuw project of een nieuwe grote functie
1. Bepaal eerst het kwaliteitsniveau (1, 2 of 3) en leg het vast in `docs/PROGRESS.md`. Bij twijfel het hogere.
2. Voer discovery uit en stel de vragen die ertoe doen. Ga niet programmeren.
3. Zet de agents in volgens de agentmatrix.
4. Niveau 2/3: productiecode pas na Jurgens `/design-go`. De poort dwingt dit af.
5. Bouw in work packages, met tests, reviews en screenshot-checkpoints tussendoor.
6. Stop pas als de Definition of Done echt gehaald is. Zeg het eerlijk als iets functioneel klaar is maar visueel nog niet.

## Eenmalig per project of omgeving
- Bewijs dat screenshots werken: `node scripts/visual-check.mjs capability`, open het screenshot met Read en noteer in `docs/PROGRESS.md` wat je ziet.
- Controleer de poort: `node .claude/gate/test-gate.mjs` en `node .claude/gate/gate.mjs status`.

@.claude/werkwijze-subagents.md
