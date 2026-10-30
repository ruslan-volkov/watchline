-- The Data API reaches a table only when the API role holds table privileges;
-- RLS then filters the rows. Supabase no longer auto-grants DML on new objects
-- in `public`, so a schema that leans on that default is not reproducible: on a
-- fresh database these six tables come up with REFERENCES/TRIGGER/TRUNCATE only
-- and every request fails with 42501 ("permission denied for table ..."). The
-- cloud project predates the change and still carries the legacy grants, which
-- is why production works and a cold replay does not.
--
-- Privileges mirror each table's RLS policies. The two layers are independent --
-- a grant without a policy returns zero rows, a policy without a grant returns
-- 42501 -- and they should agree, so that reading this file tells you what the
-- API can do.
--
-- `anon` gets nothing, on purpose: every policy keys on auth.uid(), so an
-- unauthenticated caller has no business reaching these tables.

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
