---
name: database-migrations
description: "Write, test and ship a Supabase migration for Watchline: tables, columns, RLS policies, grants, functions, triggers. Use when a change touches the database schema or permissions, or when adding a file under supabase/migrations/."
---

# Database migrations

Watchline's database is Supabase Postgres. The schema lives in `supabase/migrations/`, the permission tests in `supabase/tests/database/`. Clients reach tables through the Data API (PostgREST) as `authenticated`; Edge Functions reach them as `service_role`.

## Writing the file

- One concern per file, named `NNNN_snake_case_summary.sql`, numbered after the highest existing one. Never edit a migration that has shipped: write a new one.
- Open with a comment that says **why**, not what: the problem, and what was considered and rejected. Read `0010`, `0011` and `0015` before writing one; they are the house style.
- Every migration must replay on an empty database. CI starts a fresh Postgres and applies every file in order, so a migration that only works on top of production's history fails there.

## Permissions: two layers, both required

A table is reachable only when the role holds a **grant** and a **policy** lets the row through. A grant without a policy returns zero rows; a policy without a grant returns `42501`. Write both, and make them agree, so the migration alone tells a reader what the API can do.

- **Revoke before granting** on every new table: `revoke all on public.<table> from anon, authenticated, service_role;` then grant exactly what the policies allow. Production still carries legacy default privileges (ALL for `anon` and `authenticated`); local and CI databases don't, so tests cannot catch a missing revoke. `0015` is the incident this rule comes from.
- Grant column-level `update (col, ...)` when callers may change only some columns.
- `anon` gets nothing unless a feature is explicitly public.
- `service_role` bypasses RLS but still needs grants: give each Edge Function only what it touches, and say which function in a comment.
- Enable RLS on every new table in the same migration that creates it.

## Functions

- Helpers called only from policies live in the `private` schema (not served by PostgREST), so they don't become `/rest/v1/rpc/...` endpoints. See `0011`.
- `security definer` functions always `set search_path = public`, and `revoke execute ... from public, anon` before granting.
- Functions meant to be called over RPC stay in `public`, and their grants are explicit.

## Testing

Every migration that changes who can read or write what gets a pgTAP test in `supabase/tests/database/`, following `rls.test.sql` and `recommendations.test.sql`:

- `begin; select plan(N); ... select * from finish(); rollback;`
- Fixtures inserted as the owner (RLS bypassed), then `set local role authenticated` plus the JWT claim for each user under test, `reset role` between actors.
- Test the refusals, not only the happy path: the stranger, the hidden friend, the column a user must not update, the over-long value the check constraint rejects.

Run locally with `supabase start` then `npm run test:db`. CI runs the same.

## After the schema changes

- Regenerate `src/types/db.ts` from the local database (`supabase gen types typescript --local > src/types/db.ts`) and fix the type errors it surfaces; `npm run typecheck` must pass.
- If an Edge Function's access changed, update its `service_role` grants in the same migration.

## Shipping

Both hosted projects' migration histories match these files (repaired 2026-11-26/27), so `supabase db push` is the way a migration ships. Staging first, then production:

1. After the PR merges, push to staging (`lmagsjyusqjxpngpqqcn`): `supabase link --project-ref lmagsjyusqjxpngpqqcn`, then `supabase db push --dry-run`. The dry run must list exactly the new files. Then `supabase db push`.
2. Check the change on staging. A free project pauses after 7 days of low activity, so restore it first if it's paused.
3. Repeat on production (`ruagmrftlzfrispfmvsp`).

A migration that reads a Vault secret (as `0018` does) needs that secret in each project's Vault before it's pushed; say so in the PR description.

Never change the schema from the dashboard or the SQL editor: a change that bypasses the files is exactly the drift the repair removed. If a hotfix had to go in that way, write it as a migration file and mark it applied with `supabase migration repair`.

A human runs the pushes. Don't run `db push` or `migration repair` against a hosted project yourself.
