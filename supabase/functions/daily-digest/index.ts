import { createClient } from 'npm:@supabase/supabase-js@2';

// Shared secret so only the scheduled cron job (not the public internet) can
// trigger the digest. verify_jwt is disabled; this header is the gate.
const CRON_SECRET = Deno.env.get('CRON_SECRET') ?? 'wl_cron_7f3a9c21b8e64d05';
// TMDB read token — provided as a Supabase Edge Function secret:
//   supabase secrets set TMDB_ACCESS_TOKEN=<v4 token>
// When absent, episode-of-the-day detection is skipped (movies still work).
const TMDB_TOKEN = Deno.env.get('TMDB_ACCESS_TOKEN');
const TMDB = 'https://api.themoviedb.org/3';

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

// Current hour (0-23) at `date` in the given IANA timezone; falls back to Paris
// if the stored timezone is missing or invalid.
function hourInTz(date: Date, tz: string): number {
  const zone = tz || 'Europe/Paris';
  try {
    const h = new Intl.DateTimeFormat('en-US', { timeZone: zone, hour: '2-digit', hour12: false }).format(date);
    return Number(h) % 24;
  } catch (_e) {
    const h = new Intl.DateTimeFormat('en-US', { timeZone: 'Europe/Paris', hour: '2-digit', hour12: false }).format(date);
    return Number(h) % 24;
  }
}

// Hour component of a `time` value like "09:00:00".
function digestHour(t: string | null): number {
  return t ? Number(t.slice(0, 2)) % 24 : 9;
}

function json(obj: unknown, status = 200): Response {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

// Does this show have an episode airing on `today`? One TMDB call per show,
// checking next/last episode-to-air.
async function showAiringToday(tvId: number, today: string): Promise<boolean> {
  if (!TMDB_TOKEN) return false;
  try {
    const res = await fetch(`${TMDB}/tv/${tvId}?language=fr-FR`, {
      headers: { Authorization: `Bearer ${TMDB_TOKEN}` },
    });
    if (!res.ok) return false;
    const d = await res.json();
    return [d?.next_episode_to_air?.air_date, d?.last_episode_to_air?.air_date].includes(today);
  } catch (_e) {
    return false;
  }
}

Deno.serve(async (req: Request) => {
  if (req.headers.get('x-cron-secret') !== CRON_SECRET) {
    return json({ error: 'unauthorized' }, 401);
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );
  const today = todayIso();

  const [{ data: tokens }, { data: profiles }] = await Promise.all([
    supabase.from('push_tokens').select('user_id, token'),
    supabase.from('profiles').select('id, digest_enabled, digest_time, timezone'),
  ]);

  // Runs hourly; a user is due when the current hour in their timezone matches
  // their chosen digest_time hour.
  const now = new Date();
  const digestUsers = new Set(
    (profiles ?? [])
      .filter((p) => p.digest_enabled)
      .filter((p) => hourInTz(now, p.timezone) === digestHour(p.digest_time))
      .map((p) => p.id),
  );
  // Users who asked for the digest but have no device registered are skipped
  // below without a trace. Count them so the gap shows up in the function logs
  // instead of needing a query against the database.
  const tokenOwners = new Set((tokens ?? []).map((t) => t.user_id));
  const missingTokens = (profiles ?? []).filter(
    (p) => p.digest_enabled && !tokenOwners.has(p.id),
  ).length;

  const tokensByUser = new Map<string, string[]>();
  for (const t of tokens ?? []) {
    if (!digestUsers.has(t.user_id)) continue;
    const arr = tokensByUser.get(t.user_id) ?? [];
    arr.push(t.token);
    tokensByUser.set(t.user_id, arr);
  }
  if (tokensByUser.size === 0) return json({ sent: 0, missingTokens, reason: 'no eligible tokens' });

  const userIds = [...tokensByUser.keys()];
  const { data: entries } = await supabase
    .from('watch_entries')
    .select('user_id, status, media(media_type, tmdb_id, title, release_date)')
    .in('user_id', userIds);

  const watchingShows = new Set<number>();
  for (const e of entries ?? []) {
    const m = (e as any).media;
    if (e.status === 'watching' && m?.media_type === 'tv') watchingShows.add(m.tmdb_id);
  }
  const airingToday = new Set<number>();
  await Promise.all(
    [...watchingShows].map(async (id) => {
      if (await showAiringToday(id, today)) airingToday.add(id);
    }),
  );

  const messages: { to: string; sound: string; title: string; body: string }[] = [];
  for (const uid of userIds) {
    const titles: string[] = [];
    for (const e of (entries ?? []).filter((x) => x.user_id === uid)) {
      const m = (e as any).media;
      if (!m) continue;
      if (m.media_type === 'movie' && e.status === 'plan_to_watch' && m.release_date === today) {
        titles.push(m.title);
      }
      if (m.media_type === 'tv' && e.status === 'watching' && airingToday.has(m.tmdb_id)) {
        titles.push(`${m.title} (nouvel épisode)`);
      }
    }
    if (titles.length === 0) continue;
    const body =
      titles.length <= 3 ? titles.join(', ') : `${titles.slice(0, 2).join(', ')} +${titles.length - 2}`;
    const title =
      titles.length > 1 ? `${titles.length} sorties aujourd'hui` : 'Une sortie aujourd’hui';
    for (const to of tokensByUser.get(uid)!) {
      messages.push({ to, sound: 'default', title, body });
    }
  }

  if (messages.length === 0) return json({ sent: 0, missingTokens });

  const push = await fetch('https://exp.host/--/api/v2/push/send', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(messages),
  });
  const result = await push.json().catch(() => null);
  return json({ sent: messages.length, missingTokens, result });
});
