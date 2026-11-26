import type { Href } from 'expo-router';

import { RECOMMENDATIONS_ROUTE } from '@/features/recommendations/feed';

const ROUTES: Record<string, Href> = {
  recommendation: RECOMMENDATIONS_ROUTE,
  friend_request: '/friends',
  friend_accepted: '/friends',
};

/** Where tapping a push leads, from the `type` its Edge Function set. `null` keeps the
 *  app where it opens, for pushes that have no screen of their own (digest, downloads). */
export function pushRoute(data: Record<string, unknown> | null | undefined): Href | null {
  const type = data?.type;
  return (typeof type === 'string' && ROUTES[type]) || null;
}
