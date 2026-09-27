---
name: onderhoud-go
description: Alleen voor Jurgen. Geeft 30 minuten vrij om het agentensysteem zelf (agents, werkwijze, templates, poortconfiguratie) te wijzigen.
disable-model-invocation: true
---

Jurgen heeft onderhoud aan het agentensysteem vrijgegeven voor 30 minuten.

- Alleen de hoofdsessie mag nu `.claude/agents/`, `.claude/werkwijze-subagents.md`, `.claude/templates/`, `.claude/gate/` en `.claude/settings.json` wijzigen. Subagents niet.
- `.claude/state/` blijft altijd beschermd.
- Voer alleen de wijziging uit waar Jurgen om vraagt. Draai daarna `node .claude/gate/test-gate.mjs` en meld het resultaat. Een mislukte poorttest betekent: wijziging terugdraaien.
