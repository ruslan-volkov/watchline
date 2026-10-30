-- 0010 grants `authenticated` and `service_role` what each table's RLS policies need,
-- and names `anon` nowhere. That withholds a grant; it does not take one away. And the
-- two places this schema runs disagree about what anon starts with: the CLI's local
-- image leaves it Dxtm, while the cloud platform grants arwdDxtm through ALTER DEFAULT
-- PRIVILEGES. So on a deployed project anon kept full DML on every one of these tables,
-- and 0010's
-- claim that it gets nothing has never been true there.
--
-- Nothing was reachable through it: every policy keys on auth.uid(), which is null for
-- anon, `media`'s policies are `to authenticated`, and TRUNCATE -- the one privilege RLS
-- does not filter -- is not exposed by PostgREST. The point is not an open door. It is
-- that the privilege state was whatever each platform defaulted to, rather than what the
-- schema says, and that no test could tell: the assertions in rls.test.sql only ever ran
-- against the local stack, where the assumption happened to hold.
--
-- The app is unaffected. Every query on these tables runs behind a session (see
-- AuthContext), so this only changes how an unauthenticated request fails: 42501 instead
-- of an empty result. Avatars keep working -- that is storage.objects, not these tables.
--
-- Two things this deliberately does not do:
--   * `authenticated` and `service_role` are also wider on the cloud than 0010 declares
--     (UPDATE and DELETE on `media`, for instance, which no policy allows). Harmless
--     under RLS, but restating the whole privilege set is a larger change than the
--     finding that prompted this one.
--   * ALTER DEFAULT PRIVILEGES is left alone, because it governs objects no migration
--     here owns. A new table therefore has to be revoked explicitly, here and in
--     rls.test.sql. An explicit list cannot catch its own omissions, and merging master
--     proved the point: 0013 arrived with nas_webhook_tokens, which granted
--     authenticated and service_role but said nothing about anon, so the table had to be
--     added below by hand. The list is where a new table is declared, not a safety net.

revoke all on public.profiles         from anon;
revoke all on public.friendships      from anon;
revoke all on public.media            from anon;
revoke all on public.watch_entries    from anon;
revoke all on public.episode_progress from anon;
revoke all on public.push_tokens      from anon;
revoke all on public.nas_webhook_tokens from anon;
