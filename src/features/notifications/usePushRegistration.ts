import { useEffect } from 'react';

import { useAuth } from '@/contexts/AuthContext';
import { registerForPushNotifications } from './registerPush';

/** Registers the device's push token once a user is signed in. */
export function usePushRegistration() {
  const { session } = useAuth();
  const userId = session?.user.id;

  useEffect(() => {
    if (userId) void registerForPushNotifications(userId);
  }, [userId]);
}
