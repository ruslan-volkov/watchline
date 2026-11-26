import { createClient } from 'npm:@supabase/supabase-js@2';

function json(obj: unknown, status = 200): Response {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

/**
 * Notifies the requester that their friend request was accepted — the mirror of
 * notify-friend-request. Called by the app right after the row flips to
 * "accepted"; verify_jwt is on, and the accepter's identity comes from their own
 * token, never from the body.
 */
Deno.serve(async (req: Request) => {
  const auth = req.headers.get('Authorization') ?? '';
  if (!auth.startsWith('Bearer ')) return json({ error: 'unauthorized' }, 401);

  const caller = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: auth } },
  });
  const {
    data: { user },
    error: authError,
  } = await caller.auth.getUser();
  if (authError || !user) return json({ error: 'unauthorized' }, 401);

  let friendshipId: string | null = null;
  try {
    const body = await req.json();
    friendshipId = typeof body?.friendshipId === 'string' ? body.friendshipId : null;
  } catch (_e) {
    friendshipId = null;
  }
  if (!friendshipId) return json({ error: 'friendshipId required' }, 400);

  const admin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  // Only the addressee can announce an acceptance, and only once the row really
  // says "accepted". The requester is read from that row, not from the body, so
  // the endpoint can't be used to ping an arbitrary user.
  const { data: friendship } = await admin
    .from('friendships')
    .select('user_id')
    .eq('id', friendshipId)
    .eq('friend_id', user.id)
    .eq('status', 'accepted')
    .maybeSingle();
  if (!friendship) return json({ error: 'no accepted request' }, 403);

  const requesterId = friendship.user_id as string;

  const [{ data: recipient }, { data: accepter }] = await Promise.all([
    admin.from('profiles').select('friend_requests_enabled').eq('id', requesterId).maybeSingle(),
    admin.from('profiles').select('username').eq('id', user.id).maybeSingle(),
  ]);
  if (recipient && recipient.friend_requests_enabled === false) {
    return json({ sent: 0, reason: 'opted out' });
  }

  const { data: tokens } = await admin
    .from('push_tokens')
    .select('token')
    .eq('user_id', requesterId);
  if (!tokens || tokens.length === 0) return json({ sent: 0, reason: 'no tokens' });

  const who = accepter?.username ? `@${accepter.username}` : 'Quelqu’un';
  const messages = tokens.map((t) => ({
    to: t.token,
    sound: 'default',
    title: 'Demande acceptée',
    body: `${who} fait maintenant partie de tes amis sur Watchline.`,
    data: { type: 'friend_accepted' },
  }));

  const push = await fetch('https://exp.host/--/api/v2/push/send', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(messages),
  });
  const result = await push.json().catch(() => null);
  return json({ sent: messages.length, result });
});
