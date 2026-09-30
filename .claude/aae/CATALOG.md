# Selectieve agentcatalogus
Een rol wordt geselecteerd voor een concrete onbeantwoorde vraag, niet omdat de agent bestaat.

| Rol | Wel | Niet |
|---|---|---|
| supervisor | wezenlijke routingonzekerheid/risico | automatisch bij iedere miniwijziging |
| product-analyst | probleem, bestaande functie of regels onduidelijk | duidelijke lokale opdracht |
| product-designer | nieuwe/gewijzigde belangrijke gebruikershandeling | bekende kleine copy/styling |
| visual-designer | nieuwe noodzakelijke visuele richting | bestaand design system volstaat |
| solution-architect | brede interfaces, nieuwe datamodellen of onduidelijke migraties/integraties | bekende bestaande migratie via de goedgekeurde Supabase-adapter |
| plan-critic | planfout zou materieel duur zijn | vast verplicht document per niveau |
| test-writer | testontwerp voor kernregels/randgevallen | routinematige simpele assertion |
| code-reviewer | onafhankelijke controle van relevante logica | standaard na iedere tik |
| security-reviewer | concrete gewijzigde trust boundary | login bestaat elders in app |
| ux-reviewer | betekenisvolle nieuwe kerninteractie | puur technische wijziging |
| visual-qa | echte pixels/states moeten worden gecontroleerd | geen beschikbare actuele beelden |
| performance-reviewer | gemeten/plausibel relevant zwaar pad | preventief optimaliseren |
| accessibility-reviewer | extra interactie-/doelgroeprisico | basislabels die bouwer zelf kan controleren |

De eigenlijke namen beginnen met `aae-`. Alle specialisten zijn read-only. Dit beperkt bevoegdheden, niet hun inhoudelijke expertise. De hoofdsessie bouwt, voert tests uit en kan zelf basiscontroles doen. Geen aparte specialist is niet hetzelfde als geen kwaliteitscontrole.

Supervisor: haiku, maximaal 8 agentbeurten. Overige rollen standaard sonnet, 14-20 beurten afhankelijk van rol. Dit zijn uitvoeringsgrenzen, geen token- of eurogaranties. Route kan een ondersteunde alias selecteren; opus vereist expliciete goedkeuring. Een model dat niet beschikbaar is veroorzaakt een gerichte stop, geen automatische dure fallback.

AAE v3.1: externe Supabase-readchecks en een bekende migratie worden door de hoofdsessie uitgevoerd en tellen niet als agentcalls. GitHub PR-aanmaak is eveneens een gecontroleerde externe actie, geen reden voor een specialist.
