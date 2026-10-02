# Visuele en ingelogde controles

Herbruik eerst bestaande projecttests en componenten. Geen automatische browserinstallatie of complete viewportmatrix. Een screenshot van de loginpagina is geen controle van het takenoverzicht.

Optioneel: runtime/visual.mjs gebruikt reeds lokaal beschikbare Playwright of @playwright/test. Kies 1-4 scenes, een relevante viewport en maximaal acht gerichte interactiestappen per scene. Voor iedere scene zijn een verwachte URL-path en een zichtbare marker verplicht. Bij loginredirect of ontbrekende marker faalt de capture. Geen willekeurige page.evaluate.

Voorbeeld config in een afgesproken projectbestand:

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
    "viewport": {"width":390,"height":844},
    "steps": [{"action":"expect-visible","selector":"[data-testid=taak]"}]
  }]
}
```

storage_state is optioneel; voor een ingelogd scherm gebruik je een testaccount/fixture. Maak die sessie via het bestaande geautoriseerde projectproces, niet door productiecredentials in een agentprompt te plakken. `.claude/aae/private` staat in .gitignore. Authcookies zijn secrets: handmatig beheren, niet door de specialist lezen en niet uploaden. Het hulpscript voert geen login/wachtwoordbeheer voor je uit.

Registreer een command met argv `["node", ".claude/aae/runtime/visual.mjs", "scripts/visual-fixture.json"]`, purpose `test`, de config en het hulpscript in watch, begrensde timeout en max_runs. Laat de al bestaande lokale testserver gecontroleerd beschikbaar zijn; de helper start geen server. Geen onbeheerde background-shell starten om de gate te omzeilen. Een remote preview vereist expliciet `allow_remote:true`; gebruik alleen testdata en een daarvoor toegestane omgeving. Dit is geen netwerk-sandbox: de pagina kan eigen requests uitvoeren.

De helper schrijft screenshots plus `docs/aae/evidence/<taak>/visual-manifest.json` met route-/bronversie en **CAPTURED_NOT_REVIEWED**. Open de echte afbeeldingen voordat je ze visueel goedkeurt. Een image capture is niet automatisch een UX-test of toegankelijkheidsverklaring. Playwright/Chromium ontbreken? Rapporteer NOT_RUN en overleg alleen wanneer die controle noodzakelijk is. Geen fictieve screenshots of automatische dependency-installatie.

De configuratie-/foutafhandeling is lokaal getest; een echte browserflow is niet in deze distributie uitgevoerd. Inhoudelijke selectors en testdata zijn per app anders en horen niet in een generiek agentpakket.
