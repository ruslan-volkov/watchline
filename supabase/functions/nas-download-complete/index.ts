import { createClient } from 'npm:@supabase/supabase-js@2';

import { describeEvent } from './event.ts';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function json(obj: unknown, status = 200): Response {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

/**
 * Receives Radarr / Sonarr webhooks and pushes "finished downloading" to the
 * user who owns the token in the URL (`?token=<uuid>`, shown in the app's NAS
 * screen). verify_jwt is off, because the NAS has no Supabase session: the token
 * is the credential.
 */
Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') return json({ error: 'method not allowed' }, 405);

  const token = new URL(req.url).searchParams.get('token') ?? '';
  if (!UUID.test(token)) return json({ error: 'unauthorized' }, 401);

  const event = await req.json().catch(() => null);
  if (!event || typeof event !== 'object') return json({ error: 'invalid body' }, 400);

  const admin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );
  const { data: owner } = await admin
    .from('nas_webhook_tokens')
    .select('user_id')
    .eq('token', token)
    .maybeSingle();
  if (!owner) return json({ error: 'unauthorized' }, 401);

  const message = describeEvent(event);
  if (!message) return json({ sent: 0, reason: 'ignored' });

  const { data: tokens } = await admin.from('push_tokens').select('token').eq('user_id', owner.user_id);
  if (!tokens || tokens.length === 0) return json({ sent: 0, reason: 'no tokens' });

  const push = await fetch('https://exp.host/--/api/v2/push/send', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(
      tokens.map((t) => ({
        to: t.token,
        sound: 'default',
        title: message.title,
        body: message.body,
        data: { type: 'download_complete' },
      })),
    ),
  });
  const result = await push.json().catch(() => null);
  return json({ sent: tokens.length, result });
});
