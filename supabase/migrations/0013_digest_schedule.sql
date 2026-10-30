-- The digest schedule existed only inside the production project. 0004 carries it as a
-- commented block marked "applied out-of-band", because the command embedded the shared
-- secret and committing it would have published it. So the one piece of state that
-- decides when users are notified was described nowhere.
--
-- The cost of that became concrete while rotating the secret: changing it means
-- rewriting the literal inside cron's SQL, which only someone allowed to read the value
-- can do. Reading the secret — and the target URL — from Vault at call time keeps both
-- out of the command, so the job can live in a migration like the rest of the schema.
-- Pattern from https://supabase.com/docs/guides/functions/schedule-functions
--
-- Hourly, not daily: the function compares each user's local hour to their digest_time,
-- so a single daily trigger would only ever reach the users whose chosen hour matched.

do $$
begin
  if not exists (select 1 from pg_extension where extname = 'supabase_vault') then
    raise exception 'supabase_vault is required by the digest schedule but is not enabled';
  end if;
end $$;

-- This migration deliberately seeds neither value. Inventing a secret here would break
-- an existing project silently — the job would start sending one the deployed function
-- does not know — and inventing a URL would be worse, since a wrong one posts somewhere.
-- Both are environment state: supabase/seed.sql sets them for the local stack, and an
-- existing project is seeded once with the secret the function already holds, so that
-- applying this changes nothing observable.
--
-- When either is missing the job fails at run time and the reason is recorded in
-- cron.job_run_details, rather than the schedule quietly pointing at nothing.

-- cron.schedule upserts on the job name (pg_cron 1.6), so replaying this is safe and
-- leaves exactly one job.
select cron.schedule(
  'watchline-daily-digest',
  '0 * * * *',
  $job$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'project_url')
           || '/functions/v1/daily-digest',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'digest_cron_secret')
    ),
    body := '{}'::jsonb
  );
  $job$
);
