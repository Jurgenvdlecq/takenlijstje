## Tests: WP1, AC-004-tekst bijgewerkt

**Uitkomst: alle 43 E2E-tests geslaagd, 0 gefaald en 0 overgeslagen**, getest tegen de herbouwde app op :3100. Typecheck is groen.

**Wat ik veranderde:** in `/home/user/takenlijstje/tests/e2e/wp1-rechten.spec.ts` verwacht de AC-004-test nu letterlijk de tekst uit het criterium: "Dit mag je niet (meer) wijzigen. Er is niets veranderd." De controle dat reeks en uitvoeringen ongewijzigd zijn, is gebleven.

**De run:** `wp1-rechten.spec.ts` heb ik gedraaid als deel van de volledige suite, met jouw omgeving (`E2E_RESEED=1`, `E2E_CRON_SECRET=test-cron-secret`, lokale sleutels). Daarin zitten ook:
- de 9 bestaande tests;
- N1, N2 en N4, die nu groen zijn;
- de positieve `/api/status`-test met het geheim.

**Bevindingen:** de AC-004-afwijking is opgelost. Het enige open punt is LAAG: de melding voor vervallen soorten toont nog de technische naam, omdat `OBSOLETE_LABELS` leeg is. Dat hoort bij WP2a.

### Conclusie
GO: alle WP1-criteria met een DB-, Unit-, Int- of E2E-toets zijn gedekt en groen. De database-suite (276 controles, mutatiecontrole 20/20) heb ik bij deze laatste run niet opnieuw gedraaid. AC-030 (lint) is niet door mij getest; security-review heeft die gecontroleerd met `eslint --stdin`.
