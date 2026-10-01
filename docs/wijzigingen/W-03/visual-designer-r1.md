## Visual-designer W-03, ronde 1 (ontwerpvoorstel, geen rendering)

Rapport van de `aae-visual-designer` (2026-10-01, AAE-taak W03-AFVAL-002), letterlijk bewaard door de hoofdsessie.

**Vraag:** volstaan de bestaande componenten, tokens en iconen voor W-03?
**Conclusie:** ja, met één kleine aanvulling (twee regels in de iconentabel) en één klein patroon (keuzerondjes). Er is geen nieuwe stijlrichting nodig.

**Belangrijkste bevinding:** de oude UI (WP3b, main) draait nog op de oude tokens. Dat blijkt uit `task-card.tsx`: `bg-card`, `text-xs text-muted-foreground`, `Badge` en `Clock`. Ook `shared.tsx` gebruikt `Card` met `bg-accent`. De DS-tokens `sunken`, `text-3` en `text-meta` gelden pas in de nieuwe UI (WP4 en verder). Voor WP3b gelden dus de bestaande klassen, en `text-meta`/`text-3` in het ontwerp lees je als `text-xs text-muted-foreground`. Een eigen tokenlaag voor W-03 is niet nodig.

### Per element
1. **Kenmerk ♻ Afvalkalender in de rij: hergebruik ja.**
   - De meta-regel in `task-card.tsx:107` is een flexrij van kleine spans met icoon (`Repeat size-3`, `Clock size-3`). Een span met `<Recycle className="size-3.5">` en de tekst past erin zonder nieuwe stijl.
   - Het komt in plaats van de categorie (regel 123) en van `Repeat`.
   - Het "Bezig"-label (Badge `progress`) blijft erachter staan. Dat is het bestaande label.
   - Geen badge en geen kleur, conform DS §7.9.
2. **Rechterkolom "vanaf 22:00" / "vóór 07:45" / "vanaf 12:00": ja, het past in de bestaande rijindeling, maar dit is nog niet beoordeeld.**
   - De oude rij heeft geen rechterkolom. De tijd staat nu als `Clock` + "21:00" in de meta-regel (regel 109) en de deadline als Badge.
   - De kleinste aanpak voor de oude UI: vervang voor afvaltaken de klok-span door tekst "vanaf 22:00" (zonder klokje) in dezelfde meta-regel. Dat is een tekst- en logicawijziging, geen stijlwijziging.
   - De DS-rechterkolom (§7.4, `text-when`) is nieuwe-UI-werk (WP5).
3. **Waarschuwingsbalk toestand H: hergebruik ja, geen nieuw component.**
   - In de oude UI bestaat het vlak al: `rounded-2xl bg-muted/50 p-3` (`notifications-section.tsx:116`) en `Hint` met icoon (`push-device.tsx:232`, `rounded-xl bg-card p-3 text-xs`, geen rood).
   - Gebruik `bg-muted/50`, `rounded-2xl`, `p-3`, icoon `CircleAlert` size-4 in `text-muted-foreground`, plus een knop `secondary`. Dit is hetzelfde patroon als DS §8 ("Fout met cache": `sunken`, icoon, geen rood).
   - Het DS-icoon `circle-alert` bestaat al in de tabel (kop Verlopen, foutregels). Voor de storingsbalk is dus geen nieuw icoon nodig. De betekenis "waarschuwing zonder rood" wordt wel toegevoegd (zie regel hieronder).
   - Let op: de oude code gebruikt voor dit soort iconen `AlertTriangle` (`task-card.tsx:3`). Neem voor de balk `CircleAlert` zoals DS en UX voorschrijven.
4. **Instellingensectie: grotendeels ja, met één uitzondering.**
   - `SettingsSection id="afvalkalender" icon={Recycle}` voldoet.
   - Velden: `Field` + `Input` (`household-section.tsx`). Postcode en huisnummer naast elkaar kan met `grid grid-cols-[3fr_2fr] gap-3`, wat een gewone Tailwind-regel is.
   - Knoppen: `Button` primair, `link`/`ghost` voor de tekstknop en `destructive` voor Uitzetten.
   - De bevestiging bij uitzetten gebruikt de bestaande `Dialog`, `DialogFooter` en `ScopeDialog` (`destructive`).
   - De eenmalige tip gebruikt `Hint` plus een ✕-knop.
   - **Uitzondering, keuzerondjes bij meerdere adressen:** er is geen radiocomponent. `ColorSwatches` en `EmojiPicker` gebruiken `role="radio"`-knoppen, maar zonder rondje.
   - Kleinste aanvulling: een `role="radiogroup"` met rijen van minimaal 44 px en een native `<input type="radio" class="accent-primary">`, met de tekst "12A" als label. Dit is lokaal in de sectie, geen nieuw DS-component.
   - Alternatief als je dit patroon wilt vermijden: chips met vinkje (DS §7.3), maar dat wijkt af van UX §13.7.1 ("keuzerondjes").
   - Danger-quiet bestaat niet in de oude `Button` (alleen `destructive`, `outline`, `secondary`, `ghost`, `link`). Gebruik `ghost` met `text-destructive`, of `outline`, voor "Afvalkalender uitzetten…". Dit is een verschil tussen de oude UI en DS §7.1.
5. **Taakdetail: hergebruik ja.**
   - De bovenregel is nu een rij `Badge`s (`task-detail-sheet.tsx:109`). Een `Badge variant="outline"` met `Recycle` kan, maar DS §7.9 telt dat als extra badge.
   - Aanbeveling voor de oude UI: een gewone tekstregel in `text-sm text-muted-foreground` boven de titel ("Afvalkalender · ophaaldag di 6 okt"), zodat er geen badge bij komt. Dit is mijn voorkeur; de Badge-variant zou ook werken.
   - De infolijst is `InfoRow` (label `text-muted-foreground`, waarde `font-medium`). "Uiterlijk" is al `font-medium`. Vet moet nog worden toegevoegd (`font-semibold`), want het is nu hetzelfde gewicht als de andere waarden.
   - Het icoon `Hourglass` bij "Uiterlijk" bestaat al.
   - De uitlegregel is `text-xs text-muted-foreground` onder de infolijst.

### Letterlijke regels voor DESIGN_SYSTEM §7.10 (tabel)
```
| recycle | afvaltaak / Afvalkalender (meta in de rij, 14 px; bovenregel in het taakdetail; icoon van de instellingensectie). Nooit een prullenbak: die betekent "verwijderen". |
```
En bij de bestaande regel `circle-alert` de betekenis uitbreiden tot:
```
| circle-alert | kop Verlopen, foutregels, waarschuwingsbalk "Afvalkalender niet bijgewerkt" (sunken, zonder rood) |
```

### Afwijkingen van het design system, met reden
- **Oude UI:** de klassen `muted`/`card`/`text-xs`/`Badge` blijven. Het DS beschrijft de nieuwe UI en een mix zou twee systemen geven.
- **Geen nieuwe badge:** het kenmerk is meta-tekst, dus DS §7.9 blijft kloppen (drie badges).
- **Keuzerondjes:** een lokaal patroon, omdat DS §7.3 geen radio kent. Beslis bij WP7 of dit een gedeeld component wordt.

### Pas met de rook-screenshots (WP3b, 390×844) te beoordelen
- Of ♻ + "Afvalkalender" naast "Bezig" in één meta-regel past zonder te breken.
- Of "vanaf 22:00" leesbaar is zonder klokje.
- Of de balk H en `Hint` niet te zwak overkomen.
- Of de tweekoloms postcode/huisnummer (60/40) past.
- Hoe lang de instellingenpagina wordt: de screenshot `instellingen-390x844.png` is 7883 px hoog en toont de sectie-volgorde, maar niet op leesbare schaal.
- De radio-rijen, de contrastwaarden en de donkere modus.

### Niet gecontroleerd
- `globals.css` en `badge.tsx` (door de padbeperking niet gelezen).
- De volledige `settings-page.tsx` en de oude `Dialog`-footer.
- De Badge-varianten.
- Alle DS-claims komen uit tekst; er is geen eigen rendering gemaakt. Dit is een ontwerpvoorstel, geen geslaagde visuele test.

STATUS: READY
