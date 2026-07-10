import { useSafeAreaInsets } from 'react-native-safe-area-context';

/** Geometry of the floating (Instagram-style) tab bar, shared by the tab layout
 *  and every tab screen so content clears the detached, rounded bar. */
export const FLOATING_TAB_BAR_HEIGHT = 52;
export const FLOATING_TAB_BAR_MARGIN = 44;

/** Distance from the screen bottom to the bar — sits a bit lower, close to the
 *  home indicator without overlapping it. */
export function tabBarBottomOffset(insetBottom: number): number {
  return Math.max(insetBottom - 10, 6);
}

/** Bottom padding a scrollable needs so its last row clears the floating bar. */
export function useTabBarClearance(): number {
  const insets = useSafeAreaInsets();
  return tabBarBottomOffset(insets.bottom) + FLOATING_TAB_BAR_HEIGHT + 14;
}
