-- Loaded by `supabase db reset` / `supabase start` only. It is never applied to a
-- deployed project, which is why the two environment-specific values the digest
-- schedule reads (0015) are set here rather than in a migration.

-- The database reaches the API gateway over the compose network, so this address does
-- not depend on which host ports config.toml happens to use.
select vault.create_secret('http://kong:8000', 'project_url',
  'Base URL pg_net posts to; set per environment, never committed for production');

-- A local secret of its own: pushing production's value onto a dev stack would make
-- the two environments share a credential for no benefit.
select vault.create_secret(encode(gen_random_bytes(32), 'hex'), 'digest_cron_secret',
  'Must match the CRON_SECRET of the function being served locally');

-- The schedule itself is part of the schema and gets replayed here, but a dev stack
-- notifying people hourly serves nobody — and with real push tokens seeded it would
-- reach actual devices. Parity covers the structure, not the sending.
--
-- Through alter_job, not an UPDATE: cron.job is not writable by this role, and the
-- direct write fails while `supabase db reset` still exits 0.
select cron.alter_job(
  (select jobid from cron.job where jobname = 'watchline-daily-digest'),
  active := false
);
