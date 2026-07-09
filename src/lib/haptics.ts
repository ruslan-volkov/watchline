import * as Haptics from 'expo-haptics';

/** Light tap feedback — used when marking an episode watched. */
export function tapHaptic(): void {
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
}

/** Success feedback — used when completing a whole season. */
export function successHaptic(): void {
  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
}
