import { createClient } from 'npm:@supabase/supabase-js@2';

function json(obj: unknown, status = 200): Response {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

/**
 * Notifies the addressee of a friend request. Called by the app right after the
 * request row is inserted — verify_jwt is on, and the caller's identity comes
 * from their own token, never from the body.
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

  let addresseeId: string | null = null;
  try {
    const body = await req.json();
    addresseeId = typeof body?.addresseeId === 'string' ? body.addresseeId : null;
  } catch (_e) {
    addresseeId = null;
  }
  if (!addresseeId) return json({ error: 'addresseeId required' }, 400);

  const admin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  // The push is only legitimate if that pending request really exists and was
  // sent by the caller. Without this check the endpoint would be a way to ping
  // any user at will.
  const { data: friendship } = await admin
    .from('friendships')
    .select('id')
    .eq('user_id', user.id)
    .eq('friend_id', addresseeId)
    .eq('status', 'pending')
    .maybeSingle();
  if (!friendship) return json({ error: 'no pending request' }, 403);

  const [{ data: recipient }, { data: sender }] = await Promise.all([
    admin.from('profiles').select('friend_requests_enabled').eq('id', addresseeId).maybeSingle(),
    admin.from('profiles').select('username').eq('id', user.id).maybeSingle(),
  ]);
  if (recipient && recipient.friend_requests_enabled === false) {
    return json({ sent: 0, reason: 'opted out' });
  }

  const { data: tokens } = await admin
    .from('push_tokens')
    .select('token')
    .eq('user_id', addresseeId);
  if (!tokens || tokens.length === 0) return json({ sent: 0, reason: 'no tokens' });

  const who = sender?.username ? `@${sender.username}` : 'Quelqu’un';
  const messages = tokens.map((t) => ({
    to: t.token,
    sound: 'default',
    title: 'Nouvelle demande d’ami',
    body: `${who} veut t’ajouter sur Watchline.`,
    data: { type: 'friend_request' },
  }));

  const push = await fetch('https://exp.host/--/api/v2/push/send', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(messages),
  });
  const result = await push.json().catch(() => null);
  return json({ sent: messages.length, result });
});
