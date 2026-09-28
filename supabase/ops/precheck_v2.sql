-- =============================================================================
-- Voorcontroles WP2 (TECHNICAL_DESIGN §12.4 M1 en M5; AC-055) — ALLEEN LEZEN
--
-- Deel a/b/c/f ≠ 0 → STOPPEN, niets toepassen, opties aan Jurgen voorleggen.
-- Deel d → vergelijken met de lijst "Stap 0 WP1" in docs/PROGRESS.md.
-- Deel e → de aantallen die bij M5 aan Jurgen worden getoond (vlak ervoor opnieuw tellen).
-- Deel g → alleen vóór M5: ontvangers van "taak gedaan" na de WP2a-deploy.
--          Vervang __DEPLOY_MOMENT__ door het tijdstip van de WP2a-deploy (UTC).
-- =============================================================================

-- (a) gebruiker in meer dan één huishouden (BR-44; unique (user_id) in …_210)
select 'a_gebruiker_meerdere_huishoudens' as controle, count(*) as aantal
from (
  select user_id from public.household_members
  where user_id is not null
  group by user_id having count(distinct household_id) > 1
) x;

-- (b) meer dan één registratie per taak (unique (task_id) in …_210)
select 'b_meerdere_registraties_per_taak' as controle, count(*) as aantal
from (
  select task_id from public.task_completions
  where task_id is not null
  group by task_id having count(*) > 1
) x;

-- (c) meer dan één actieve boodschappenlijst per huishouden (index in …_200)
select 'c_meerdere_actieve_lijsten' as controle, count(*) as aantal
from (
  select household_id from public.shopping_lists
  where archived_at is null
  group by household_id having count(*) > 1
) x;

-- (d) uitgezette leden met een account (namen: vergelijken met stap 0 in PROGRESS)
select 'd_uitgezet_met_account' as controle, m.id as member_id, m.display_name, m.household_id
from public.household_members m
where m.user_id is not null and not m.is_active
order by m.display_name;

-- (f) huishouden met een andere tijdzone dan Europe/Amsterdam (check in …_200, V-39)
select 'f_andere_tijdzone' as controle, count(*) as aantal
from public.households where timezone <> 'Europe/Amsterdam';

-- (e) wat verdwijnt bij …_210 (BR-46.3)
select 'e_toewijzingen (task_assignments)' as soort, count(*) as aantal from public.task_assignments
union all select 'e_ruilverzoeken (task_swap_requests)', count(*) from public.task_swap_requests
union all select 'e_afwezigheden (member_absences)', count(*) from public.member_absences
union all select 'e_leden_zonder_account', count(*) from public.household_members where user_id is null
union all select 'e_taken_met_toegewezen_persoon', count(*) from public.tasks where assigned_member_id is not null
union all select 'e_taken_met_wie_afvinkte', count(*) from public.tasks where completed_by_member_id is not null
union all select 'e_taken_met_punten', count(*) from public.tasks where points is not null
union all select 'e_historie_met_persoon', count(*) from public.task_completions where member_id is not null
union all select 'e_historie_met_punten', count(*) from public.task_completions where points <> 0
union all select 'e_reeksen_met_verdeling', count(*) from public.task_recurrences
  where assignment_strategy <> 'none' or fixed_member_id is not null or cardinality(rotation_member_ids) > 0
union all select 'e_boodschappen_met_toegevoegd_door', count(*) from public.shopping_items where added_by_member_id is not null
union all select 'e_boodschappen_met_gekocht_door', count(*) from public.shopping_items where bought_by_member_id is not null
union all select 'e_lijsten_met_maker', count(*) from public.shopping_lists where created_by_member_id is not null
union all select 'e_meldingen_vervallen_soort', count(*) from public.notifications
  where type in ('task_assigned', 'swap_request', 'swap_accepted')
union all select 'e_meldingen_taak_gedaan_en_overzichten', count(*) from public.notifications
  where type in ('task_completed', 'daily_summary', 'evening_summary')
union all select 'e_open_uitnodigingen_voor_lid_zonder_account', count(*) from public.household_invitations
  where member_id is not null and accepted_at is null
union all select 'e_huishoudens_met_puntinstellingen', count(*) from public.households
  where points_enabled or points_goal is not null or members_can_assign_others;

-- (e, wat blijft) ter controle na M6
select 'blijft_historie' as soort, count(*) as aantal from public.task_completions
union all select 'blijft_taken', count(*) from public.tasks
union all select 'blijft_reeksen', count(*) from public.task_recurrences
union all select 'blijft_notities', count(*) from public.task_comments
union all select 'blijft_leden_met_account', count(*) from public.household_members where user_id is not null;

-- (g) alleen vóór M5 (AC-073): per afvinking de ontvangers van "taak gedaan" na de
-- WP2a-deploy, vergeleken met wie de voorkeur NU aan heeft. Een verschil is alleen
-- in orde als die voorkeur ná de melding is gewijzigd (kolom voorkeur_later_gewijzigd).
with recent as (
  select n.dedupe_key, n.household_id, n.created_at, n.member_id
  from public.notifications n
  where n.type = 'task_completed' and n.created_at > '__DEPLOY_MOMENT__'::timestamptz
),
expected as (
  select distinct r.dedupe_key, m.id as member_id
  from recent r
  join public.household_members m on m.household_id = r.household_id and m.is_active and m.user_id is not null
  join public.user_preferences p on p.member_id = m.id and p.notify_task_completed
)
select 'g_ontbreekt' as verschil, e.dedupe_key, e.member_id,
       (select p.updated_at > min(r.created_at) from public.user_preferences p, recent r
        where p.member_id = e.member_id and r.dedupe_key = e.dedupe_key group by p.updated_at) as voorkeur_later_gewijzigd
from expected e
where not exists (select 1 from recent r where r.dedupe_key = e.dedupe_key and r.member_id = e.member_id)
union all
select 'g_te_veel', r.dedupe_key, r.member_id,
       (select p.updated_at > r.created_at from public.user_preferences p where p.member_id = r.member_id)
from recent r
where not exists (select 1 from expected e where e.dedupe_key = r.dedupe_key and e.member_id = r.member_id);
