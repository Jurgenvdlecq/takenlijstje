## Tests: WP3 security-herreview r2 (punten A en C, D-044, commit ccca1a0)
Suite gedraaid: unit **354 geslaagd / 0 gefaald** · DB-suite groen (10…60, gelijktijdigheid en upgrade) · mutatiecontrole **100/100 gevangen** · integratie niet opnieuw gedraaid: er is in deze ronde niets aan integratietests of tick-code veranderd (laatste stand 30/30).

### Toegevoegd
- `/home/user/takenlijstje/supabase/tests/60_push_endpoint.sql`:
  - 13 nieuwe weigeringen (23514) in het PAD, als gebruiker via RLS én als systeem: backtick, `'`, `"`, `\` (E'…'), `<`, `>`, `;`, `{}`, NBSP (`chr(160)`), U+FEFF (`chr(65279)`), `chr(1)`, spatie en `é` (`chr(233)`).
  - Eén extra toegestaan endpoint met álle toegestane padtekens (`aZ09-._~!#$%&()*+,/:=?@[]^_|`), zodat een te smalle klasse ook opvalt. De telling gaat daardoor van 5 naar 6.
- `/home/user/takenlijstje/src/lib/__tests__/push-endpoints.test.ts`:
  - Dezelfde 12 padgevallen als geweigerd, zowel voor `isAllowedPushEndpoint` als voor de validatie.
  - Alle toegestane padtekens worden geaccepteerd.
  - Een endpoint van 1001 tekens wordt geweigerd, terwijl `PUSH_ENDPOINT_PATTERN` er wél op past; de lengtecontrole komt dus vóór de regex. 1000 tekens mag.
  - `https://127.0.0.1.fcm.googleapis.com/x` is bewust toegestaan, en `url.parse` en `new URL` geven allebei host `127.0.0.1.fcm.googleapis.com`.
- `/home/user/takenlijstje/supabase/tests/mutatie.sh`:
  - `push_check_elke_poort` bijgewerkt naar de nieuwe padklasse; de oude tekst paste niet meer.
  - Drie nieuwe mutanten op de padklasse, alle gevangen: terug naar `[^[:space:]]` (gevangen op backtick), terug naar de oude uitsluitingsklasse (gevangen op spatie/unicode) en backtick weer toegestaan (gevangen op backtick).

### Bevindingen
- Geen nieuwe bevindingen in de productiecode.

### Conclusie
GO: de strengere padklasse is afgedekt in TypeScript en in de database, en elke verruiming van die klasse wordt door een test gevangen.
