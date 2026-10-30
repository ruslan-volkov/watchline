import { useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';

import { useAuth } from '@/contexts/AuthContext';
import { registerForPushNotifications } from './registerPush';
import type { PushRegistrationResult } from './attempt';

/**
 * Registers the device's push token once a user is signed in, and keeps the
 * outcome around. Retried on every return to the foreground: iOS shows its
 * permission dialog only once, so someone who refused it and then allowed
 * notifications from the system settings would otherwise stay tokenless until
 * a reinstall — the effect alone never runs again.
 *
 * `null` while the first attempt is still in flight.
 */
export function usePushRegistration(): PushRegistrationResult | null {
  const { session } = useAuth();
  const userId = session?.user.id;
  const [result, setResult] = useState<PushRegistrationResult | null>(null);
  // Read by the AppState listener, which would otherwise close over the state
  // it was registered with.
  const settled = useRef<PushRegistrationResult | null>(null);
  const running = useRef(false);

  useEffect(() => {
    settled.current = null;
    running.current = false;
    setResult(null);
    if (!userId) return;

    const attempt = async () => {
      // One attempt at a time, and none at all once the token is in: a
      // foreground event must not become a registration loop.
      if (running.current || settled.current === 'registered') return;
      running.current = true;
      try {
        const next = await registerForPushNotifications(userId);
        settled.current = next;
        setResult(next);
      } finally {
        running.current = false;
      }
    };

    void attempt();
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') void attempt();
    });
    return () => sub.remove();
  }, [userId]);

  return result;
}
