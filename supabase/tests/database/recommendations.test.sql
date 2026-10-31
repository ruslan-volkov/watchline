-- Who can read and change a recommendation.
-- Run with `supabase test db` (needs `supabase start`).
begin;
select plan(17);

-- ============ Fixtures (as the table owner, RLS bypassed) ============
-- alice <-> bob: accepted friends. dave: stranger.
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000000a', 'alice@test.local'),
  ('00000000-0000-0000-0000-00000000000b', 'bob@test.local'),
  ('00000000-0000-0000-0000-00000000000d', 'dave@test.local');

insert into public.friendships (user_id, friend_id, status) values
  ('00000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-00000000000b', 'accepted');

insert into public.media (id, tmdb_id, media_type, title) values
  ('11111111-1111-1111-1111-111111111111', 1, 'tv', 'Test Show');

-- ============ The Edge Function's role writes the row ============
set local role service_role;
insert into public.recommendations (id, sender_id, recipient_id, media_id, message) values
  ('33333333-3333-3333-3333-333333333333', '00000000-0000-0000-0000-00000000000a',
   '00000000-0000-0000-0000-00000000000b', '11111111-1111-1111-1111-111111111111', 'À voir !');
select is((select count(*)::int from public.recommendation_inbox),
  1, 'a recommendation gets its inbox row');
select is((select count(*)::int from public.friendships
            where user_id = '00000000-0000-0000-0000-00000000000a'),
  1, 'the Edge Function can read friendships');
reset role;

select throws_ok(
  $$ insert into public.recommendations (sender_id, recipient_id, media_id, message)
     values ('00000000-0000-0000-0000-00000000000b', '00000000-0000-0000-0000-00000000000a',
             '11111111-1111-1111-1111-111111111111', repeat('x', 141)) $$,
  '23514', null, 'a message over 140 characters is refused');
select is((select recommendations_enabled from public.profiles
            where id = '00000000-0000-0000-0000-00000000000b'),
  true, 'recommendation pushes are on by default');

-- ============ alice, the sender ============
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000a","role":"authenticated"}', true);
set local role authenticated;

select is((select count(*)::int from public.recommendations),
  1, 'the sender sees what she sent');
select is((select count(*)::int from public.recommendation_inbox),
  0, 'the sender cannot see what the recipient did with it');
select throws_ok(
  $$ insert into public.recommendations (sender_id, recipient_id, media_id)
     values ('00000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-00000000000b',
             '11111111-1111-1111-1111-111111111111') $$,
  '42501', null, 'the client cannot insert: sending goes through the Edge Function');
select throws_ok(
  $$ update public.recommendations set nudge_count = 0 $$,
  '42501', null, 'the sender cannot reset her nudge limits');

update public.recommendations set added_at = now();
reset role;
select is((select added_at from public.recommendations), null,
  'the sender cannot claim the recipient added the title');

-- ============ bob, the recipient ============
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000b","role":"authenticated"}', true);
set local role authenticated;

select is((select count(*)::int from public.recommendations),
  1, 'the recipient sees what he received');
select is((select count(*)::int from public.recommendation_inbox),
  1, 'the recipient sees his inbox row');
select throws_ok(
  $$ update public.recommendations set message = 'autre chose' $$,
  '42501', null, 'the recipient cannot rewrite the message');

update public.recommendations set added_at = now();
update public.recommendation_inbox set seen_at = now(), dismissed_at = now();
reset role;
select isnt((select added_at from public.recommendations), null,
  'the recipient records that he added the title');
select isnt((select dismissed_at from public.recommendation_inbox), null,
  'the recipient dismisses it');

-- ============ dave, a stranger ============
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000d","role":"authenticated"}', true);
set local role authenticated;
select is((select count(*)::int from public.recommendations),
  0, 'a stranger sees no recommendation');
reset role;

-- ============ unfriending ============
delete from public.friendships where user_id = '00000000-0000-0000-0000-00000000000a';
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000b","role":"authenticated"}', true);
set local role authenticated;
select is((select count(*)::int from public.recommendations),
  0, 'recommendations disappear once they are no longer friends');
reset role;

-- ============ anonymous ============
select set_config('request.jwt.claims', '{"role":"anon"}', true);
set local role anon;
select throws_ok($$ select * from public.recommendations $$, '42501', null,
  'anonymous callers cannot read recommendations');
reset role;

select * from finish();
rollback;
