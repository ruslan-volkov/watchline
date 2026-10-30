import AsyncStorage from '@react-native-async-storage/async-storage';
import PostHog from 'posthog-react-native';

import type { MediaType, WatchStatus } from '@/media/types';

/**
 * Product analytics, behind one seam.
 *
 * Everything the app records goes through `track()`, whose event names and
 * payloads are typed below — so a renamed event breaks the build instead of
 * quietly splitting a funnel in two. The PostHog client is created lazily and
 * only ever when two things hold: a project key is configured, and the user
 * hasn't opted out. With no `EXPO_PUBLIC_POSTHOG_KEY` the whole module is a
 * no-op (same spirit as the TMDB fallback), so the app runs unchanged for a
 * contributor who never sets one up.
 *
 * Deliberately *not* recorded: email, raw search text, note bodies, title
 * names. Titles travel as `tmdb_id`, searches as a length and a result count.
 */

const apiKey = process.env.EXPO_PUBLIC_POSTHOG_KEY;
// EU ingestion by default — the app's audience is French-speaking, and it keeps
// event data inside the EU unless someone opts into the US cloud explicitly.
const host = process.env.EXPO_PUBLIC_POSTHOG_HOST ?? 'https://eu.i.posthog.com';

/** Mirrors the "Partager les statistiques d'usage" switch in Profil. */
const CONSENT_KEY = 'watchline-analytics-consent';

/**
 * What PostHog accepts as a property value — mirrored here rather than imported
 * from `@posthog/core`, which is a transitive dependency and not part of the
 * SDK's public surface.
 */
type PropertyValue =
  | string
  | number
  | boolean
  | null
  | PropertyValue[]
  | { [key: string]: PropertyValue };

export type AnalyticsProperties = Record<string, PropertyValue>;

/** Where an action was taken from, so the same event can be compared by surface. */
export type Surface =
  | 'home'
  | 'watchlist'
  | 'library'
  | 'search'
  | 'trending'
  | 'media_detail'
  | 'paused'
  | 'friend'
  | 'calendar';

/** How an episode got marked watched. */
export type MarkMode = 'next' | 'manual' | 'cascade';

/**
 * The full event vocabulary. `void` means the event carries no properties of
 * its own (the autocaptured person/device/app properties still ride along).
 */
interface EventProps {
  signed_up: { method: 'email' };
  signed_in: { method: 'email' };
  signed_out: void;
  onboarding_completed: void;

  entry_added: { media_type: MediaType; status: WatchStatus; tmdb_id: number; source: Surface };
  entry_status_changed: { status: WatchStatus; source: Surface };
  entry_rated: { rating: number | null; has_notes: boolean; source: Surface };
  entry_snooze_toggled: { snoozed: boolean; source: Surface };
  entry_removed: { source: Surface };

  /** `completed_entry`: this mark was the one that finished the title. */
  episode_marked: { mode: MarkMode; count: number; completed_entry: boolean };
  episode_unmarked: { count: number };

  media_opened: { media_type: MediaType; tmdb_id: number; source: Surface };
  search_performed: { query_length: number; result_count: number };

  friend_request_sent: void;
  friend_request_accepted: void;

  push_registration: { granted: boolean };
  setting_changed: { setting: string; value: string };
}

export type AnalyticsEvent = keyof EventProps;

let client: PostHog | null = null;
/** `null` until the stored consent has been read — see `initAnalytics`. */
let consent: boolean | null = null;

function ensureClient(): PostHog | null {
  if (client) return client;
  if (!apiKey) return null;

  client = new PostHog(apiKey, {
    host,
    // Defaults, spelled out because they matter here: events batch up to 20 or
    // 10s, and queue to disk in between, so a kill or a tunnel doesn't lose a
    // session's worth of actions.
    flushAt: 20,
    flushInterval: 10_000,
    // "Application Opened/Backgrounded/Installed/Updated" for free.
    captureAppLifecycleEvents: true,
  });

  // Dev builds send to the same project; filter on `app_env` in PostHog rather
  // than dropping the events, or there'd be no way to check instrumentation.
  client.register({ app_env: __DEV__ ? 'development' : 'production' });
  return client;
}

/**
 * Read the stored consent and bring the client up if it's granted. Called once
 * from AnalyticsProvider; until it resolves nothing is sent, so an opted-out
 * user never leaks a launch event through a race.
 */
export async function initAnalytics(): Promise<void> {
  if (consent !== null) return;
  let stored: string | null = null;
  try {
    stored = await AsyncStorage.getItem(CONSENT_KEY);
  } catch {
    // Storage unavailable — treat as "never answered", i.e. opted in.
  }
  consent = stored !== 'off';
  if (consent) ensureClient();
}

/** True unless the user has turned the switch off. */
export function isAnalyticsEnabled(): boolean {
  return consent !== false;
}

/** Flip consent and persist it. Turning it off stops sending immediately. */
export async function setAnalyticsEnabled(next: boolean): Promise<void> {
  consent = next;
  // Take effect before the (awaited) write, so an event recorded in the same
  // handler as the switch flip still has a client to go out through.
  if (next) ensureClient()?.optIn();
  // Nothing is recorded about the opt-out itself: the point is to stop sending.
  else client?.optOut();
  try {
    await AsyncStorage.setItem(CONSENT_KEY, next ? 'on' : 'off');
  } catch {
    // Not persisted; the in-memory flag still holds for this session.
  }
}

/**
 * Record an event. No-op when analytics is off or unconfigured; in dev without
 * a key it logs instead, so instrumentation can be checked without a project.
 */
export function track<E extends AnalyticsEvent>(
  ...args: EventProps[E] extends void ? [event: E] : [event: E, props: EventProps[E]]
): void {
  const [event, props] = args as [E, AnalyticsProperties | undefined];
  const ph = client;
  if (!ph) {
    if (__DEV__ && !apiKey) console.log('[analytics]', event, props ?? '');
    return;
  }
  ph.capture(event, props);
}

/**
 * Collapse a router path into a screen name: `/media/550` and `/media/1399`
 * are the same screen, and keeping the id in the name would scatter one screen
 * across thousands of rows in PostHog. The id still travels as a property.
 */
export function screenNameFromPath(pathname: string): string {
  if (pathname === '/' || pathname === '') return '/';
  return pathname
    .split('/')
    .map((segment) =>
      // Numeric ids (TMDB) and uuids (entries, profiles) are the dynamic bits.
      /^\d+$/.test(segment) ||
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(segment)
        ? '[id]'
        : segment,
    )
    .join('/');
}

/** A screen view. Expo Router has no built-in hook for this; see AnalyticsProvider. */
export function trackScreen(name: string, props?: AnalyticsProperties): void {
  if (!client) {
    if (__DEV__ && !apiKey) console.log('[analytics] $screen', name, props ?? '');
    return;
  }
  client.screen(name, props);
}

/** Tie the events to the signed-in account. Safe to call on every session change. */
export function identify(userId: string, props?: { username?: string | null }): void {
  client?.identify(userId, {
    // Enough to find a person in PostHog without storing an email there.
    ...(props?.username ? { username: props.username } : {}),
    $set_once: { first_seen_at: new Date().toISOString() },
  });
}

/**
 * Forget the person on sign-out, so the next account on this device starts as
 * someone new. `reset()` also clears PostHog's own opt-out flag, so re-apply it.
 */
export function resetIdentity(): void {
  if (!client) return;
  client.reset();
  client.register({ app_env: __DEV__ ? 'development' : 'production' });
  if (consent === false) client.optOut();
}
