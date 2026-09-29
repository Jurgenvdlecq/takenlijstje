# Technische bronnen en compatibiliteitsbasis
Geraadpleegd op 29 september 2026. Gebruik de actuele officiele documentatie bij een toekomstige update; onderstaande URLs zijn bronnen, geen geinstalleerde afhankelijkheden.

- https://code.claude.com/docs/en/hooks : PreToolUse kan blokkeren; SubagentStart zelf kan een start niet blokkeren. Agent/Task-reservering gebeurt daarom vooraf. Gemeenschappelijke agentvelden, SubagentStop en PostToolUse geven lifecycleinformatie. Hook-args ondersteunen exec-form.
- https://code.claude.com/docs/en/sub-agents : `model`, `tools`, `disallowedTools`, `maxTurns`, expliciete rolconfiguratie. Een partial-marker op maxTurns vereist volgens de documentatie v2.1.246+. Daarom is dat de conservatieve minimale CLI-baseline van dit pakket.
- https://code.claude.com/docs/en/settings : project-, lokale en managed instellingen kunnen naast elkaar gelden. De installer wist die andere lagen niet.
- https://code.claude.com/docs/en/permissions : hostrechten blijven de buitenste uitvoeringsgrens; geen bypassPermissions.
- https://code.claude.com/docs/en/costs : abonnementsgebruik en API-kostenschatting zijn niet hetzelfde.

Ondersteunde implementatiebasis: Node 20+ zonder externe runtimepackages, normale Claude Code-sessie in een projectroot, CLI-baseline 2.1.246+. Lokale tests worden op Node 22/Linux uitgevoerd. macOS/WSL/native Windows en daadwerkelijke Claude Code-hostwerking moeten in de eigen omgeving worden gecontroleerd. Geen universele compatibiliteitsgarantie voor toekomstige versies, plugins of managed beleid.
