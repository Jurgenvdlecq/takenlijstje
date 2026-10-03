# Visuele en ingelogde controles

Herbruik eerst bestaande projecttests en -scripts (voor dit project: `node scripts/visual-check.mjs capability`). Geen automatische browserinstallatie of complete viewportmatrix. Een screenshot van de loginpagina is geen controle van het takenoverzicht. Open de echte afbeeldingen voordat je een visueel oordeel geeft; zeg eerlijk als iets functioneel klaar is maar visueel nog niet.

Optioneel: `runtime/visual.mjs` gebruikt reeds lokaal beschikbare Playwright of `@playwright/test` en werkt alleen binnen een werkpakket in uitvoering. Kies 1-4 scènes, een relevante viewport en maximaal acht gerichte stappen per scène. Per scène zijn een verwacht URL-pad en een zichtbare marker verplicht; bij een loginredirect of ontbrekende marker faalt de opname. Geen willekeurige `page.evaluate`.

```json
{
  "schema_version": 1,
  "base_url": "http://127.0.0.1:3000",
  "storage_state": ".claude/aae/private/testgebruiker.json",
  "scenes": [{
    "id": "vandaag-mobiel",
    "path": "/vandaag",
    "expected_path": "/vandaag",
    "expected_visible": "[data-testid=vandaag]",
    "viewport": {"width": 390, "height": 844},
    "steps": [{"action": "expect-visible", "selector": "[data-testid=taak]"}]
  }]
}
```

`storage_state` is optioneel; gebruik een testaccount of fixture, nooit productiecredentials in een agentprompt. `.claude/aae/private` staat in `.gitignore`; authcookies zijn secrets en worden nooit door een model gelezen. Een remote preview vereist `allow_remote: true` en testdata.

Het commando `node .claude/aae/runtime/visual.mjs <config>` valt niet onder de lokale allowlist: zet het als `plan.commands` (doel `test`, met config in `watch`) én exact in `envelope.extra_commands`, zodat de GO het goedkeurt. De helper start geen server en installeert niets; ontbreekt Playwright, meld dan VISUAL NOT_RUN.

De uitvoer is `docs/aae/evidence/<werkpakket>/visual-manifest.json` met envelop- en bronhash en status **CAPTURED_NOT_REVIEWED**. Een opname is geen interactietest en geen toegankelijkheidsverklaring.
