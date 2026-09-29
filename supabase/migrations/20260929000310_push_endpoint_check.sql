-- =============================================================================
-- WP3-herstel (security-review WP3, punt 1 en 2): de database accepteert alleen
-- pushabonnementen bij de bekende pushdiensten, ook bij een rechtstreekse
-- REST-insert. Zelfde patroon als PUSH_ENDPOINT_PATTERN in src/lib/push-endpoints.ts:
-- de host bestaat alleen uit letters, cijfers, punten en streepjes (geen
-- parserverschillen), poort hooguit 443; het pad alleen zichtbare ASCII zonder
-- " ' ; < > \ ` { } (security-herreview WP3, punt A).
-- =============================================================================

-- Eerst afwijkende bestaande abonnementen weg (op live: 0 abonnementen); het
-- toestel meldt zich bij het volgende openen van de app opnieuw aan
delete from public.push_subscriptions
where endpoint !~ '^https://([a-z0-9-]+\.)*(fcm\.googleapis\.com|push\.services\.mozilla\.com|push\.apple\.com|notify\.windows\.com)(:443)?/[!#-&(-:=?-\[\]-_a-z|~]*$'
   or char_length(endpoint) > 1000;

alter table public.push_subscriptions
  add constraint push_subscriptions_endpoint_allowlist check (
    char_length(endpoint) <= 1000
    and endpoint ~ '^https://([a-z0-9-]+\.)*(fcm\.googleapis\.com|push\.services\.mozilla\.com|push\.apple\.com|notify\.windows\.com)(:443)?/[!#-&(-:=?-\[\]-_a-z|~]*$'
  );
