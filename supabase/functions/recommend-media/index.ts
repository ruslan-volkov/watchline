import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2';

import {
  cleanMessage,
  nudgeBlock,
  nudgeCopy,
  recommendationCopy,
  type PushCopy,
} from './rules.ts';

function json(obj: unknown, status = 200): Response {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

/** The caller's accepted friends. */
async function friendIds(admin: SupabaseClient, userId: string): Promise<Set<string>> {
  const { data } = await admin
    .from('friendships')
    .select('user_id, friend_id')
    .eq('status', 'accepted')
    .or(`user_id.eq.${userId},friend_id.eq.${userId}`);
  return new Set((data ?? []).map((f) => (f.user_id === userId ? f.friend_id : f.user_id)));
}

/** Best effort: the row is already written, and opted-out recipients are skipped. */
async function push(admin: SupabaseClient, recipientIds: string[], copy: PushCopy): Promise<void> {
  const { data: optedIn } = await admin
    .from('profiles')
    .select('id')
    .in('id', recipientIds)
    .eq('recommendations_enabled', true);
  const ids = (optedIn ?? []).map((p) => p.id as string);
  if (ids.length === 0) return;

  const { data: tokens } = await admin.from('push_tokens').select('token').in('user_id', ids);
  if (!tokens || tokens.length === 0) return;

  await fetch('https://exp.host/--/api/v2/push/send', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(
      tokens.map((t) => ({
        to: t.token,
        sound: 'default',
        title: copy.title,
        body: copy.body,
        data: { type: 'recommendation' },
      })),
    ),
  }).catch(() => null);
}

/**
 * Recommends a title to friends, or nudges a friend about one already recommended.
 * Rows are written here rather than by the app, so that the friendship check and the
 * nudge limits can't be stepped around, and so that one call can't be replayed into
 * repeated pushes. verify_jwt is on, and the sender comes from their token, never from
 * the body.
 *
 * Body: `{ mediaId, recipientIds, message? }` to send, `{ recommendationId, message? }`
 * to nudge.
 */
Deno.serve(async (req: Request) => {
  const auth = req.headers.get('Authorization') ?? '';
  if (!auth.startsWith('Bearer ')) return json({ error: 'unauthorized' }, 401);

  const caller = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    { global: { headers: { Authorization: auth } } },
  );
  const {
    data: { user },
    error: authError,
  } = await caller.auth.getUser();
  if (authError || !user) return json({ error: 'unauthorized' }, 401);

  const body = await req.json().catch(() => null);
  const message = cleanMessage(body?.message);

  const admin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  const friends = await friendIds(admin, user.id);
  const { data: sender } = await admin
    .from('profiles')
    .select('username')
    .eq('id', user.id)
    .maybeSingle();
  const username = (sender?.username as string | null) ?? null;

  if (typeof body?.recommendationId === 'string') {
    const { data: rec } = await admin
      .from('recommendations')
      .select(
        'id, recipient_id, last_nudged_at, nudge_count, media(title), inbox:recommendation_inbox(dismissed_at)',
      )
      .eq('id', body.recommendationId)
      .eq('sender_id', user.id)
      .maybeSingle();
    if (!rec || !friends.has(rec.recipient_id)) return json({ error: 'not found' }, 404);

    const blocked = nudgeBlock(rec, Date.now());
    if (blocked) return json({ error: blocked }, 429);

    // Guarded on the count just read, so two simultaneous calls can't both pass the
    // check above and push twice.
    const { data: claimed } = await admin
      .from('recommendations')
      .update({
        last_nudged_at: new Date().toISOString(),
        nudge_count: rec.nudge_count + 1,
        ...(message ? { message } : {}),
      })
      .eq('id', rec.id)
      .eq('nudge_count', rec.nudge_count)
      .select('id');
    if (!claimed || claimed.length === 0) return json({ error: 'cooldown' }, 429);

    await admin
      .from('recommendation_inbox')
      .update({ seen_at: null })
      .eq('recommendation_id', rec.id);

    // A dismissed title stays quiet. The response is the same either way: the sender
    // must not be able to tell "Pas pour moi" from a delivered nudge.
    const inbox = rec.inbox as unknown as { dismissed_at: string | null } | null;
    if (!inbox?.dismissed_at) {
      const media = rec.media as unknown as { title: string };
      await push(admin, [rec.recipient_id], nudgeCopy(username, media.title, message));
    }
    return json({ ok: true });
  }

  const mediaId = typeof body?.mediaId === 'string' ? body.mediaId : null;
  const recipientIds: unknown[] = Array.isArray(body?.recipientIds) ? body.recipientIds : [];
  const targets = [...new Set(recipientIds)].filter(
    (id): id is string => typeof id === 'string' && friends.has(id),
  );
  if (!mediaId || targets.length === 0) return json({ error: 'friends required' }, 403);

  const { data: media } = await admin.from('media').select('title').eq('id', mediaId).maybeSingle();
  if (!media) return json({ error: 'not found' }, 404);

  // A friend who already has this recommendation keeps it as it is, and gets no push:
  // going back to them is what a nudge is for, with its limits.
  const { data: created, error } = await admin
    .from('recommendations')
    .upsert(
      targets.map((recipient_id) => ({
        sender_id: user.id,
        recipient_id,
        media_id: mediaId,
        message,
      })),
      { onConflict: 'sender_id,recipient_id,media_id', ignoreDuplicates: true },
    )
    .select('recipient_id');
  if (error) return json({ error: error.message }, 500);

  const newRecipients = (created ?? []).map((r) => r.recipient_id as string);
  if (newRecipients.length > 0) {
    await push(admin, newRecipients, recommendationCopy(username, media.title, message));
  }
  return json({ ok: true });
});
