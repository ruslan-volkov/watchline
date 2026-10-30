import { createClient } from 'npm:@supabase/supabase-js@2';

import { describeEvent } from './event.ts';

// Shared secret that Radarr / Sonarr send in the `x-webhook-secret` header
// (Settings → Connect → Webhook → Headers). verify_jwt is off, because the NAS
// has no Supabase session; this header is the gate. No default on purpose: with
// no secret configured the function refuses everything.
//   supabase secrets set NAS_WEBHOOK_SECRET=<long random string>
const WEBHOOK_SECRET = Deno.env.get('NAS_WEBHOOK_SECRET');

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function json(obj: unknown, status = 200): Response {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

/**
 * Receives Radarr / Sonarr webhooks and pushes "finished downloading" to the
 * user named in the URL (`?user=<uuid>`, shown in the app's NAS screen).
 */
Deno.serve(async (req: Request) => {
  if (!WEBHOOK_SECRET) return json({ error: 'not configured' }, 500);
  if (req.method !== 'POST') return json({ error: 'method not allowed' }, 405);
  if (req.headers.get('x-webhook-secret') !== WEBHOOK_SECRET) {
    return json({ error: 'unauthorized' }, 401);
  }

  const userId = new URL(req.url).searchParams.get('user') ?? '';
  if (!UUID.test(userId)) return json({ error: 'user required' }, 400);

  const event = await req.json().catch(() => null);
  if (!event || typeof event !== 'object') return json({ error: 'invalid body' }, 400);

  const message = describeEvent(event);
  if (!message) return json({ sent: 0, reason: 'ignored' });

  const admin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );
  const { data: tokens } = await admin.from('push_tokens').select('token').eq('user_id', userId);
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
