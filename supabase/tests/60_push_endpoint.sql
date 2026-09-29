-- =============================================================================
-- Tests: WP3-herstel — CHECK op push_subscriptions.endpoint (…_310;
-- security-review WP3, punt 1 en 2). Ook een rechtstreekse REST/SQL-insert
-- buiten de allowlist wordt geweigerd (23514); de vier pushdiensten slagen.
-- Iedere fout stopt het script (ON_ERROR_STOP), dus "geen output" = geslaagd.
-- =============================================================================

\o /dev/null

create or replace function pg_temp.expect_sqlstate(p_sql text, p_state text, p_label text)
returns void language plpgsql as $$
declare
  v_state text;
  v_msg text;
begin
  begin
    execute p_sql;
  exception when others then
    get stacked diagnostics v_state = returned_sqlstate, v_msg = message_text;
    if v_state <> p_state then
      raise exception 'VERKEERDE FOUT bij %: verwacht %, kreeg % (%)', p_label, p_state, v_state, v_msg;
    end if;
    return;
  end;
  raise exception 'VERWACHTE FOUT % BLEEF UIT: %', p_state, p_label;
end;
$$;

create or replace function pg_temp.assert(p_condition boolean, p_label text)
returns void language plpgsql as $$
begin
  if not coalesce(p_condition, false) then
    raise exception 'ASSERT MISLUKT: %', p_label;
  end if;
end;
$$;

create or replace function pg_temp.als(p_user uuid)
returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', p_user)::text, false);
$$;

grant execute on all functions in schema pg_temp to authenticated;

\set u_push '60000000-0000-0000-0000-0000000000e1'
insert into auth.users (id, email, raw_user_meta_data) values (:'u_push', 'push.check@example.com', '{"display_name":"Push"}');
set role authenticated;
select pg_temp.als(:'u_push');
select public.create_household('Push check', 'Push');

-- Toegestaan: alle vier de diensten, als gebruiker via RLS (zoals de REST-insert van de app)
insert into public.push_subscriptions (user_id, endpoint, p256dh, auth) values
  (:'u_push', 'https://fcm.googleapis.com/fcm/send/abc:def', 'p', 'a'),
  (:'u_push', 'https://updates.push.services.mozilla.com/wpush/v2/gAAAA', 'p', 'a'),
  (:'u_push', 'https://web.push.apple.com/QGx1c3Q', 'p', 'a'),
  (:'u_push', 'https://wns2-db5p.notify.windows.com/w/?token=abc', 'p', 'a'),
  (:'u_push', 'https://fcm.googleapis.com:443/fcm/send/poort', 'p', 'a'),
  -- alle toegestane padtekens (D-044): de klasse is niet te smal
  (:'u_push', 'https://fcm.googleapis.com/fcm/send/aZ09-._~!#$%&()*+,/:=?@[]^_|', 'p', 'a');
select pg_temp.assert((select count(*) = 6 from public.push_subscriptions where user_id = :'u_push'),
  'SR-WP3-1: abonnementen bij de vier pushdiensten worden opgeslagen');

-- Geweigerd: als gebruiker (REST) én als systeem
create temp table geweigerd (endpoint text);
insert into geweigerd values
  ('https://evil.com/fcm/send/abc'),
  ('https://fcm.googleapis.com.evil.com/x'),
  ('https://evilfcm.googleapis.com/x'),
  ('https://FCM.GoogleAPIs.com/x'),
  ('https://evil.com;.fcm.googleapis.com/x'),
  ('https://169.254.169.254;.fcm.googleapis.com/x'),
  ('https://localhost;.push.apple.com/x'),
  ('https://evil.com{.fcm.googleapis.com/x'),
  ('https://evil.com`.fcm.googleapis.com/x'),
  ('https://evil.com''.fcm.googleapis.com/x'),
  ('https://evil.com".fcm.googleapis.com/x'),
  (E'https://evil.com\\.fcm.googleapis.com/x'),
  ('https://evil.com .fcm.googleapis.com/x'),
  ('https://user:pass@fcm.googleapis.com/x'),
  ('https://fcm.googleapis.com@evil.com/x'),
  ('https://fcm.googleapis.com:8443/x'),
  ('https://fcm.googleapis.com'),
  ('https://fcm.googleapis.com/' || repeat('a', 1000)),
  -- D-044: het PAD alleen zichtbare ASCII zonder " ' ; < > \ ` { }
  ('https://fcm.googleapis.com/a`b'),
  ('https://fcm.googleapis.com/a''b'),
  ('https://fcm.googleapis.com/a"b'),
  (E'https://fcm.googleapis.com/a\\b'),
  ('https://fcm.googleapis.com/a<b'),
  ('https://fcm.googleapis.com/a>b'),
  ('https://fcm.googleapis.com/a;b'),
  ('https://fcm.googleapis.com/a{b}'),
  ('https://fcm.googleapis.com/a' || chr(160) || 'b'),
  ('https://fcm.googleapis.com/a' || chr(65279) || 'b'),
  ('https://fcm.googleapis.com/a' || chr(1) || 'b'),
  ('https://fcm.googleapis.com/a b'),
  ('https://fcm.googleapis.com/caf' || chr(233));
grant select on geweigerd to authenticated;

select pg_temp.expect_sqlstate(
  format($q$insert into public.push_subscriptions (user_id, endpoint, p256dh, auth) values (%L, %L, 'p', 'a')$q$, :'u_push', endpoint),
  '23514', 'SR-WP3-1 (gebruiker): ' || left(endpoint, 60))
from geweigerd;

reset role;
select set_config('request.jwt.claims', '', false);
select pg_temp.expect_sqlstate(
  format($q$insert into public.push_subscriptions (user_id, endpoint, p256dh, auth) values (%L, %L, 'p', 'a')$q$, :'u_push', endpoint),
  '23514', 'SR-WP3-1 (systeem): ' || left(endpoint, 60))
from geweigerd;

-- Een bestaand abonnement kan ook niet naar een verkeerde host worden omgezet
select pg_temp.expect_sqlstate(
  format($q$update public.push_subscriptions set endpoint = 'https://evil.com;.fcm.googleapis.com/x' where user_id = %L$q$, :'u_push'),
  '23514', 'SR-WP3-1: endpoint omzetten naar een verkeerde host');
select pg_temp.assert((select count(*) = 6 from public.push_subscriptions where user_id = :'u_push'),
  'SR-WP3-1: na de weigeringen staan er nog precies de 6 toegestane abonnementen');

\o
select 'WP3-herstel: push-endpoint-CHECK (…_310) geslaagd' as resultaat;
