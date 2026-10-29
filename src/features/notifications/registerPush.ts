import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import { track } from '@/lib/analytics';
import { supabase } from '@/lib/supabase';

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
 * Register this device's Expo push token for the user. No-ops silently when push
 * isn't available (Expo Go on SDK 53+, simulator, no EAS project, denied
 * permission) — it starts working once running in a development/production build.
 */
export async function registerForPushNotifications(userId: string): Promise<void> {
  try {
    if (!Device.isDevice) return;
    const projectId = getProjectId();
    if (!projectId) return;

    const existing = await Notifications.getPermissionsAsync();
    let granted = existing.granted;
    if (!granted) {
      granted = (await Notifications.requestPermissionsAsync()).granted;
      // Only when the system prompt actually appeared — recording the already
      // granted case on every launch would drown the accept rate in noise.
      track('push_registration', { granted });
    }
    if (!granted) return;

    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'Digest quotidien',
        importance: Notifications.AndroidImportance.DEFAULT,
      });
    }

    const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId });
    await supabase
      .from('push_tokens')
      .upsert(
        { user_id: userId, token, platform: Platform.OS },
        { onConflict: 'user_id,token', ignoreDuplicates: true },
      );
  } catch (_e) {
    // Push unavailable in this environment — safe to ignore.
  }
}
