# Installatie en gebruik

Voor Claude Code in de cloud (claude.ai/code of de Code-tab in de Claude-app). Alles staat in de repository zelf. De cloud leest je eigen `~/.claude`-map niet, daarom zit alles in `.claude/` van het project.

## 1. In een repository zetten (kan vanaf de telefoon)

1. Upload `agentsysteem.zip` naar de hoofdmap van de repository via GitHub, met "Add file" → "Upload files". Eén zipbestand werkt ook op de telefoon.
2. Start een Claude Code-sessie op die repository en plak:

   > Pak agentsysteem.zip uit in de hoofdmap van de repository (overschrijf bestaande bestanden met dezelfde naam), verwijder daarna de zip en commit met de melding "Agentensysteem geïnstalleerd". Doe verder niets.

3. **Start een nieuwe sessie.** De hooks worden bij het starten van een sessie geladen.
4. Plak in die nieuwe sessie:

   > Richt dit project in volgens CLAUDE.md: draai `node .claude/gate/test-gate.mjs`, draai `node scripts/visual-check.mjs capability`, open het screenshot met Read en maak `docs/PROGRESS.md` aan vanuit `.claude/templates/PROGRESS.md` met onder "Capabilities" wat je werkelijk ziet. Meld mij in gewone taal of de poort en de screenshots werken.

## 2. Screenshots in de cloud mogelijk maken (eenmalig per cloudomgeving)

Standaard kan de cloud geen browser downloaden: de Playwright-downloadserver staat niet op de standaardlijst ("Trusted"). De officiële Chrome-testbrowser staat wél op een toegestaan adres. Zet daarom in je cloudomgeving (omgevingskiezer → tandwiel → **Setup script**):

```bash
#!/bin/bash
npm i -g playwright-core@1 || true
npx -y @puppeteer/browsers install chrome-headless-shell@stable --path /root/.cache/chrome-hs || true
npx -y playwright@1 install-deps chromium || true
```

Dit script draait één keer en wordt daarna bewaard, dus nieuwe sessies starten snel.

Werkt de capability-test daarna nog steeds niet, kies dan bij **Network access** "Custom", vink de standaardlijst aan, voeg `cdn.playwright.dev` en `playwright.download.prss.microsoft.com` toe, en vervang de tweede regel van het script door `npx -y playwright@1 install --with-deps chromium`.

Lukt ook dat niet, dan meldt het systeem eerlijk **VISUAL QA GEBLOKKEERD**. Een app op niveau 2 of 3 wordt dan niet als "visueel gereviewd" gepresenteerd.

## 3. Een nieuw project starten

Plak in een sessie:

> Nieuw project: <je idee in een paar zinnen>. Volg de werkwijze uit CLAUDE.md.

Claude bepaalt het niveau, stelt vragen, ontwerpt en laat alles bekritiseren. Daarna krijg je één totaalvoorstel. Productiecode komt pas na jouw GO.

## 4. De drie opdrachten die alleen jij kunt geven

| Opdracht | Wat het doet |
| --- | --- |
| `/design-go` | Geeft het ontwerp vrij: vanaf nu mag Claude bouwen. Mist er nog iets (documenten, oordeel van de plan-critic, prototype-screenshots), dan zie je wat er ontbreekt en gebeurt er niets. |
| `/design-go --forceer` | Toch vrijgeven met open punten. Die punten worden vastgelegd. |
| `/design-go intrekken` | Trekt de vrijgave in. Bouwen stopt. |
| `/niveau 2 <reden>` | Zet het kwaliteitsniveau bewust vast (1, 2 of 3). Verhogen na een vrijgave laat die vrijgave vervallen. |
| `/onderhoud-go` | Geeft 30 minuten om het agentensysteem zelf aan te passen. |

**Waarom Claude dit niet zelf kan:** deze opdrachten worden alleen herkend als ze in jouw eigen bericht staan. Claude kan ze niet zelf starten, kan het statusbestand niet aanpassen, en kan geen nieuwe sessie openen om ze te "typen". Verandert iemand na jouw GO stiekem een goedgekeurd ontwerpdocument, dan vervalt de vrijgave vanzelf.

## 5. Klusjes & Punten onder het nieuwe systeem brengen

Installeer eerst volgens stap 1 in de Klusjes-repository, in een nieuwe sessie. Daarna:

> Dit is een bestaand project. Behandel het als niveau 2 en volg sectie 15 van .claude/werkwijze-subagents.md. Begin met de inventarisatie: lees de huidige code, draai de tests, maak screenshots van de bestaande schermen en schrijf docs/INVENTARIS.md. Neem de besluiten uit PLAN.md over als uitgangspunt en vraag die niet opnieuw. Bouw geen nieuwe functies.

Zet daarna zelf `/niveau 2 bestaand project, meerdere gebruikers`. Totdat jij `/design-go` geeft, kan er geen productiecode veranderen.

## 6. De rollen in het kort

Ontwerp vóór het bouwen: product-analyst, product-designer, visual-designer, solution-architect, plan-critic.
Controle tijdens en na het bouwen: code-reviewer, security-reviewer, test-writer, ux-reviewer, visual-qa, performance-reviewer, accessibility-reviewer.
Welke verplicht zijn per niveau staat in de agentmatrix (sectie 5 van `.claude/werkwijze-subagents.md`).

## 7. Onderhoud

Na elke wijziging aan de poort: `node .claude/gate/test-gate.mjs`. Die test bevat meer dan 90 omzeilpogingen en moet volledig slagen.
