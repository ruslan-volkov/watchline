-- The hosted project still applies the legacy default privileges described in 0010: a
-- new table comes up with ALL for anon and authenticated, and the grants in 0014 only
-- added to those. That left a recipient able to rewrite the message and the nudge
-- counters of their own rows, and TRUNCATE, which RLS does not cover. Start from nothing
-- and grant what 0014 meant. A fresh database ends up with the same privileges.
--
-- Local and CI databases never had those defaults, so tests can't catch this. A
-- migration that creates a table has to revoke before it grants.
revoke all on public.recommendations from anon, authenticated, service_role;
revoke all on public.recommendation_inbox from anon, authenticated, service_role;

grant select on public.recommendations to authenticated;
grant update (added_at) on public.recommendations to authenticated;
grant select on public.recommendation_inbox to authenticated;
grant update (seen_at, dismissed_at) on public.recommendation_inbox to authenticated;

grant select, insert, update on public.recommendations to service_role;
grant select, insert, update on public.recommendation_inbox to service_role;
