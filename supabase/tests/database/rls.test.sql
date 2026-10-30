-- Row-level security end to end: who can see / change whose data.
-- Run with `supabase test db` (needs `supabase start`).
begin;
select plan(26);

-- ============ Fixtures (as the table owner, RLS bypassed) ============
-- alice <-> bob: accepted friends. alice -> carol: request still pending. dave: stranger.
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000000a', 'alice@test.local'),
  ('00000000-0000-0000-0000-00000000000b', 'bob@test.local'),
  ('00000000-0000-0000-0000-00000000000c', 'carol@test.local'),
  ('00000000-0000-0000-0000-00000000000d', 'dave@test.local');

select is(
  (select count(*)::int from public.profiles where id::text like '00000000-0000-0000-0000-00000000000_'),
  4,
  'signing up creates a profile through the auth trigger'
);

update public.profiles set username = 'alice' where id = '00000000-0000-0000-0000-00000000000a';
update public.profiles set username = 'bob'   where id = '00000000-0000-0000-0000-00000000000b';
update public.profiles set username = 'carol' where id = '00000000-0000-0000-0000-00000000000c';
update public.profiles set username = 'dave'  where id = '00000000-0000-0000-0000-00000000000d';

insert into public.friendships (user_id, friend_id, status) values
  ('00000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-00000000000b', 'accepted'),
  ('00000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-00000000000c', 'pending');

insert into public.media (id, tmdb_id, media_type, title) values
  ('11111111-1111-1111-1111-111111111111', 1, 'tv', 'Test Show');

insert into public.watch_entries (id, user_id, media_id) values
  ('22222222-2222-2222-2222-22222222222a', '00000000-0000-0000-0000-00000000000a', '11111111-1111-1111-1111-111111111111'),
  ('22222222-2222-2222-2222-22222222222b', '00000000-0000-0000-0000-00000000000b', '11111111-1111-1111-1111-111111111111'),
  ('22222222-2222-2222-2222-22222222222c', '00000000-0000-0000-0000-00000000000c', '11111111-1111-1111-1111-111111111111');

insert into public.episode_progress (entry_id, season_number, episode_number) values
  ('22222222-2222-2222-2222-22222222222b', 1, 1);

-- ============ alice ============
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000a","role":"authenticated"}', true);
set local role authenticated;

select is((select count(*)::int from public.watch_entries where user_id = '00000000-0000-0000-0000-00000000000a'),
  1, 'alice sees her own entries');
select is((select count(*)::int from public.watch_entries where user_id = '00000000-0000-0000-0000-00000000000b'),
  1, 'alice sees an accepted friend''s entries');
select is((select count(*)::int from public.episode_progress),
  1, 'alice sees an accepted friend''s episode progress');
select is((select count(*)::int from public.watch_entries where user_id = '00000000-0000-0000-0000-00000000000c'),
  0, 'alice does not see the entries of someone whose request is still pending');
select is((select count(*)::int from public.profiles where id = '00000000-0000-0000-0000-00000000000c'),
  1, 'alice sees the profile of a pending request, to show its username');
select is((select count(*)::int from public.profiles where id = '00000000-0000-0000-0000-00000000000d'),
  0, 'alice does not see the profile of a stranger');
select is((select count(*)::int from public.search_profiles('dav')),
  1, 'search_profiles finds a stranger by username');
select is((select count(*)::int from public.search_profiles('alice')),
  0, 'search_profiles leaves the caller out of the results');

select throws_ok(
  $$ insert into public.watch_entries (user_id, media_id)
     values ('00000000-0000-0000-0000-00000000000b', '11111111-1111-1111-1111-111111111111') $$,
  '42501', null, 'alice cannot write an entry on behalf of someone else');

insert into public.push_tokens (user_id, token) values ('00000000-0000-0000-0000-00000000000a', 'ExponentPushToken[alice]');
select is((select count(*)::int from public.push_tokens), 1, 'alice sees her own push token');

insert into public.nas_webhook_tokens (user_id) values ('00000000-0000-0000-0000-00000000000a');
select is((select count(*)::int from public.nas_webhook_tokens), 1, 'alice gets her own NAS webhook token');
select throws_ok(
  $$ insert into public.nas_webhook_tokens (user_id) values ('00000000-0000-0000-0000-00000000000b') $$,
  '42501', null, 'alice cannot create a NAS webhook token for someone else');
select throws_ok(
  $$ update public.nas_webhook_tokens set token = gen_random_uuid() $$,
  '42501', null, 'alice cannot rewrite her NAS webhook token');

create temp table old_nas_token as select token from public.nas_webhook_tokens;
grant select on old_nas_token to authenticated;
delete from public.nas_webhook_tokens;
insert into public.nas_webhook_tokens (user_id) values ('00000000-0000-0000-0000-00000000000a');
select isnt((select token from public.nas_webhook_tokens), (select token from old_nas_token),
  'alice can replace her NAS webhook token with a new one');

reset role;

-- ============ bob hides his activity ============
update public.profiles set activity_visible = false where id = '00000000-0000-0000-0000-00000000000b';

select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000a","role":"authenticated"}', true);
set local role authenticated;
select is((select count(*)::int from public.watch_entries where user_id = '00000000-0000-0000-0000-00000000000b'),
  0, 'a friend who hides activity disappears from alice''s view of entries');
select is((select count(*)::int from public.profiles where id = '00000000-0000-0000-0000-00000000000b'),
  1, 'but the friend''s profile stays visible');
reset role;

-- ============ dave, a stranger ============
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000d","role":"authenticated"}', true);
set local role authenticated;

select is((select count(*)::int from public.push_tokens),
  0, 'dave cannot see alice''s push token');
select is((select count(*)::int from public.nas_webhook_tokens),
  0, 'dave cannot see alice''s NAS webhook token');
delete from public.nas_webhook_tokens;
reset role;
select is((select count(*)::int from public.nas_webhook_tokens), 1, 'dave cannot delete alice''s NAS webhook token');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000d","role":"authenticated"}', true);
set local role authenticated;

update public.friendships set status = 'accepted'
 where user_id = '00000000-0000-0000-0000-00000000000a' and friend_id = '00000000-0000-0000-0000-00000000000c';
reset role;
select is((select status::text from public.friendships
            where user_id = '00000000-0000-0000-0000-00000000000a' and friend_id = '00000000-0000-0000-0000-00000000000c'),
  'pending', 'dave cannot accept a request he is not part of');

-- ============ anonymous ============
select set_config('request.jwt.claims', '{"role":"anon"}', true);
set local role anon;
select throws_ok($$ select * from public.profiles $$, '42501', null,
  'anonymous callers cannot read profiles at all (0010 grants anon nothing)');
select throws_ok($$ select * from public.search_profiles('a') $$, '42501', null,
  'anonymous callers cannot run search_profiles');
reset role;

-- The two assertions above only prove anon cannot SELECT. They passed long before
-- 0016 because the CLI's local image withholds DML by default -- while the cloud
-- platform grants anon everything, so the same assertions would fail there. A test
-- that only ever runs where the assumption happens to hold cannot catch that, which
-- is why this one checks the privileges themselves rather than one symptom of them.
-- Listed table by table on purpose: a new table in `public` belongs in 0010's grants
-- and in this list, or it inherits whatever the platform's default happens to be.
select is(
  (select coalesce(string_agg(table_name || ':' || privilege_type, ' '
                              order by table_name, privilege_type), '')
     from information_schema.role_table_grants
    where grantee = 'anon'
      and table_schema = 'public'
      and table_name in ('profiles', 'friendships', 'media',
                         'watch_entries', 'episode_progress', 'push_tokens',
                         'nas_webhook_tokens')),
  '',
  'anon holds no privilege at all on the tables this schema owns (0016)'
);

-- ============ helpers stay off the REST surface ============
select hasnt_function('public', 'are_friends', array['uuid', 'uuid'],
  'are_friends is not exposed in public (0011)');
select has_function('private', 'are_friends', array['uuid', 'uuid'],
  'are_friends lives in the private schema');

select * from finish();
rollback;
