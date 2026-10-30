import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import { track } from '@/lib/analytics';
import { supabase } from '@/lib/supabase';
import { attemptPushRegistration, type PushRegistrationResult } from './attempt';

export type { PushRegistrationResult };

// Foreground presentation: show a banner + play sound when a digest arrives.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

function getProjectId(): string | undefined {
  return (
    Constants.expoConfig?.extra?.eas?.projectId ??
    (Constants as unknown as { easConfig?: { projectId?: string } }).easConfig?.projectId
  );
}

/**
 * Register this device's Expo push token for the user and report how it went.
 * Push is unavailable in several environments (Expo Go on SDK 53+, simulator,
 * no EAS project, denied permission); the result says which one, so the Profil
 * screen can stop claiming the digest is armed when it cannot be delivered.
 */
export function registerForPushNotifications(userId: string): Promise<PushRegistrationResult> {
  // Kept across the two permission calls below so the analytics event can tell
  // a real system prompt from iOS answering instantly after a refusal.
  let current: Notifications.NotificationPermissionsStatus | undefined;

  return attemptPushRegistration({
    isDevice: Device.isDevice,
    projectId: getProjectId(),
    getPermissions: async () => (current = await Notifications.getPermissionsAsync()),
    requestPermissions: async () => {
      const promptable = current?.canAskAgain ?? true;
      const status = await Notifications.requestPermissionsAsync();
      // Only when the system prompt actually appeared — recording the already
      // granted case, or the instant refusal iOS returns once the permission
      // has been denied, would drown the accept rate in noise. The attempt is
      // retried on every foreground, so that would be every return to the app.
      if (promptable) track('push_registration', { granted: status.granted });
      return status;
    },
    prepareChannel: async () => {
      if (Platform.OS !== 'android') return;
      await Notifications.setNotificationChannelAsync('default', {
        name: 'Digest quotidien',
        importance: Notifications.AndroidImportance.DEFAULT,
      });
    },
    getToken: async (projectId) => (await Notifications.getExpoPushTokenAsync({ projectId })).data,
    saveToken: async (token) => {
      const { error } = await supabase
        .from('push_tokens')
        .upsert(
          { user_id: userId, token, platform: Platform.OS },
          { onConflict: 'user_id,token', ignoreDuplicates: true },
        );
      return { error };
    },
  });
}
