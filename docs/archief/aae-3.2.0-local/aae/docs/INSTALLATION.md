# Installatie, samenvoeging en herstel

## Geen blinde vervanging
Gebruik `install.mjs` in de distributie. Standaard alleen een plan; `--apply` voert uit. Pak het pakket buiten de doelrepository uit. Node >=20. Geen netwerk, Git, appbuild, schema-update of agentstart door de installer.

De installer controleert de payloadhashes, detecteert symlinks en vergelijkt bestaande systeemfiles. Eigen beheer: `.claude/aae` en `aae-*` agentdefinities. Bij een bestaande exacte v3-installatie gebruikt de installer het beheermanifest om de v3.1-update zonder blinde overschrijving te plannen. Gedeeld: CLAUDE.md, .claude/settings.json, settings.local.json en .gitignore. Eigen projecttekst en overige permissions/hooks blijven behouden. Alleen herkenbare eigen hookhandlers worden verwijderd/vervangen. Herkende v1/v2-agentbestanden krijgen een herstelkopie voordat ze uit de actieve instructiemappen worden gehaald. Oude `docs/*` blijven staan, maar zijn geen v3/v3.1-goedkeuringsbron.

Een gewijzigde oude agent of onbekende wijziging aan een beheerd v3-bestand geeft een conflict, geen stil verlies. Een CLAUDE.md met oude aansturing en eigen afspraken moet eerst gericht worden samengevoegd. Bewaar de eigen afspraken en verwijder uitsluitend achterhaalde aansturing. Daarna:

```sh
node install.mjs --project "/project" --resolved-claude "/tijdelijk/CLAUDE-samengevoegd.md"
```

Pas na review hetzelfde met `--apply`. De tijdelijke kopie wordt niet vertrouwd als semantisch perfect; dat moet de gebruiker/assistent beoordelen. Verander niet alleen de conflictmelding om door te kunnen.

## Bestaande beperkingen
Global, managed, plugin- en geneste instructies kunnen aanvullend gelden. De installer wist ze niet. `doctor` kijkt alleen naar de lokale aanwezigheid en integriteit. Controleer na een nieuwe sessie `/hooks`, `/agents` en bij gebruik van Supabase een read-only `get_project_url`-probe en de effectieve rechten. Een host die hooks uitschakelt of Node niet kan starten valt buiten deze gate. Geen bypassPermissions.

## Herstel
Elke toegepaste installatie heeft `.aae-backups/<tijd-id>/RESTORE.json`. Het bestand bevat geen werkende uitvoeringsinstructie, maar een inventaris met voor/na-hashes en backupblobs. De originele bestanden worden met hun mode bewaard. Bewaar de uitgepakte pakketmap voor terugdraaien.

```sh
node install.mjs --project "/project" --rollback ".aae-backups/<werkelijk-id>"
node install.mjs --project "/project" --rollback ".aae-backups/<werkelijk-id>" --apply
```

Eerste opdracht is weer alleen het plan. Terugdraaien weigert gewijzigde bestanden te overschrijven. De installer draait bij een fout tijdens toepassen de reeds uitgevoerde bestandswijzigingen terug. Het is geen databasebackup en geen rollback van appwijzigingen. Tijdens installatie/rollback mogen geen andere processen dezelfde instructiebestanden wijzigen. Sluit Claude eerst.

## Installatiecontrole
`node .claude/aae/runtime/cli.mjs doctor` controleert Node, waar beschikbaar `claude --version`, projecthookconfiguratie en beheerde bestandsintegriteit. Het start geen model en claimt geen live gedragstest. Doe de aanvullende LIVE_CHECK in een wegwerpproject. Appdeployments gebeuren nooit automatisch.

## Crash of vastgelopen registraties
Een reserved/running slot blijft uit voorzorg bezet wanneer de host geen einde doorgeeft. Stop eerst de echte subagent/processen in de host, gebruik dan `AAE HERSTEL`, vervolgens beoordeel de route opnieuw. Herstel stopt zelf geen processen en wist geen verbruik. Een overgebleven proceslock na een harde crash wordt niet automatisch gestolen: sluit sessies, controleer de PID in `.claude/aae/state/lock/owner.json` handmatig, maak een kopie van state en verwijder alleen de lock wanneer die PID zeker niet meer draait. Een nieuw proces kan dezelfde PID krijgen; beoordeel ook de context. Geen advies om blind state te verwijderen.

## Windows en cloud
Bestandspaden en subprocessen zijn platformonafhankelijk opgezet, maar hier niet op native Windows of een Claude cloud-host getest. De runner gebruikt shell:false. `.cmd` is op Windows geen rechtstreeks uitvoerbare binary: kies daar expliciet een Node-entrypoint of beoordeelde wrapper; geen automatische omschakeling naar een shell. Gebruik de juiste absolute projectlocatie. Vereiste runtimebeschikbaarheid is onderdeel van de live-check.
