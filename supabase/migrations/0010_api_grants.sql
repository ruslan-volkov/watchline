-- The Data API reaches a table only when the API role holds table privileges;
-- RLS then filters the rows. The two places this schema runs disagree about the
-- default privileges `postgres` hands to new tables in `public`: the CLI's local
-- image grants anon/authenticated only Dxtm (no DML), while the cloud platform
-- still grants the permissive arwdDxtm. Measured on a cloud project created in
-- October 2026, so this is local-vs-cloud, not old-project-vs-new. A schema that
-- leans on the default is therefore not reproducible: on a cold local replay
-- these six tables come up without SELECT and every request fails with 42501
-- ("permission denied for table ..."), while the same schema works on the cloud.
--
-- Privileges mirror each table's RLS policies. The two layers are independent --
-- a grant without a policy returns zero rows, a policy without a grant returns
-- 42501 -- and they should agree, so that reading this file tells you what the
-- API can do.
--
-- `anon` is left out, on purpose: every policy keys on auth.uid(), so an
-- unauthenticated caller has no business reaching these tables. Note that this
-- only withholds a grant -- it does not take one away, so on a cloud project anon
-- keeps the permissive defaults described above. Harmless today (RLS yields it no
-- rows, and TRUNCATE, the one privilege RLS ignores, is not reachable through
-- PostgREST), but the gap was real, and 0016 closes it for anon.

grant select, insert, update         on public.profiles         to authenticated;
grant select, insert, update, delete on public.friendships      to authenticated;
grant select, insert                 on public.media            to authenticated;
grant select, insert, update, delete on public.watch_entries    to authenticated;
grant select, insert, delete         on public.episode_progress to authenticated;
grant select, insert, delete         on public.push_tokens      to authenticated;

-- service_role bypasses RLS but still needs privileges. The daily-digest Edge
-- Function is read-only and touches exactly these four tables (`media` through
-- the embedded select on watch_entries).
grant select on public.profiles      to service_role;
grant select on public.push_tokens   to service_role;
grant select on public.watch_entries to service_role;
grant select on public.media         to service_role;
