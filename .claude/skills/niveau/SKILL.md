---
name: niveau
description: Alleen voor Jurgen. Zet het kwaliteitsniveau van dit project bewust vast op 1, 2 of 3.
disable-model-invocation: true
argument-hint: "1|2|3 [reden]"
---

Jurgen heeft zojuist `/niveau $ARGUMENTS` getypt. De poort heeft dit vastgelegd.

1. Controleer met `node .claude/gate/gate.mjs status` welk niveau nu geldt en of een bestaande Design Freeze is vervallen.
2. Zet `Kwaliteitsniveau: X` in `docs/PROGRESS.md` gelijk aan het vastgezette niveau en noteer de reden.
3. Pas de verdere aanpak aan volgens de agentmatrix in `.claude/werkwijze-subagents.md`. Is het niveau omhoog gegaan, vul dan de ontbrekende voorbereiding aan voordat je verder bouwt.
4. Meld Jurgen in twee of drie zinnen wat dit concreet verandert.
