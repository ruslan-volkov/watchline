import { useQueryClient } from '@tanstack/react-query';
import * as Notifications from 'expo-notifications';
import { useRouter } from 'expo-router';
import { useEffect, useRef } from 'react';
import { AppState } from 'react-native';

import { recommendationsKey } from '@/features/recommendations/useRecommendations';
import { pushRoute } from './pushRoute';

/**
 * Opens the right screen when a push is tapped, and keeps the recommendations badge
 * current, since a recommendation lands without the app doing anything.
 *
 * `ready`: the user is signed in and onboarded. Before that, a push tapped from a cold
 * start would race the redirects of useProtectedRoute.
 */
export function useNotificationRouting(ready: boolean) {
  const router = useRouter();
  const qc = useQueryClient();
  // A cold start can report the same tap twice: as the last response and to the
  // listener. It also stays the last response when `ready` comes back after a sign-out.
  const handled = useRef<string | null>(null);

  useEffect(() => {
    if (!ready) return;

    const open = (response: Notifications.NotificationResponse) => {
      const { identifier, content } = response.notification.request;
      if (handled.current === identifier) return;
      handled.current = identifier;
      const route = pushRoute(content.data);
      if (route) router.push(route);
    };
    const refresh = () => qc.invalidateQueries({ queryKey: recommendationsKey });

    const last = Notifications.getLastNotificationResponse();
    if (last) open(last);

    const tapped = Notifications.addNotificationResponseReceivedListener(open);
    const received = Notifications.addNotificationReceivedListener(refresh);
    const foreground = AppState.addEventListener('change', (state) => {
      if (state === 'active') void refresh();
    });
    return () => {
      tapped.remove();
      received.remove();
      foreground.remove();
    };
  }, [ready, router, qc]);
}
