import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { Tabs } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTheme } from '@/contexts/ThemeContext';
import {
  FLOATING_TAB_BAR_HEIGHT,
  FLOATING_TAB_BAR_MARGIN,
  tabBarBottomOffset,
} from '@/theme/layout';

type IconName = keyof typeof Ionicons.glyphMap;

/** Filled icon when the tab is active, outline when not. */
function tabIcon(active: IconName, inactive: IconName) {
  return ({ focused, color }: { focused: boolean; color: string }) => (
    <Ionicons name={focused ? active : inactive} size={24} color={color} />
  );
}

export default function TabsLayout() {
  const { colors, scheme } = useTheme();
  const insets = useSafeAreaInsets();
  const radius = FLOATING_TAB_BAR_HEIGHT / 2;
  const dark = scheme === 'dark';
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.accentInk,
        tabBarInactiveTintColor: colors.textMeta,
        tabBarShowLabel: false,
        // Detached, floating pill with a frosted-glass background (Instagram-style).
        tabBarBackground: () => (
          <View style={[styles.blurWrap, { borderRadius: radius }]}>
            <BlurView
              intensity={dark ? 40 : 60}
              tint={dark ? 'dark' : 'light'}
              style={StyleSheet.absoluteFill}
            />
            {/* Light opaque veil over the blur so icons stay legible. */}
            <View
              style={[
                StyleSheet.absoluteFill,
                { backgroundColor: dark ? 'rgba(28,25,23,0.45)' : 'rgba(255,255,255,0.55)' },
              ]}
            />
          </View>
        ),
        tabBarStyle: {
          position: 'absolute',
          // RN's default tab bar pins start:0/end:0, which override left/right
          // (start/end win in Yoga). marginHorizontal insets it regardless.
          marginHorizontal: FLOATING_TAB_BAR_MARGIN,
          bottom: tabBarBottomOffset(insets.bottom),
          height: FLOATING_TAB_BAR_HEIGHT,
          borderRadius: radius,
          backgroundColor: 'transparent',
          borderTopWidth: 0,
          // Cancel the home-indicator padding RN adds inside the bar — the pill is
          // already lifted above it, so icons must center in the full height.
          paddingTop: 0,
          paddingBottom: 0,
          elevation: 16,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 6 },
          shadowOpacity: dark ? 0.4 : 0.14,
          shadowRadius: 16,
        },
        tabBarItemStyle: { height: FLOATING_TAB_BAR_HEIGHT },
        // The item button hardcodes justifyContent: 'flex-start', pinning the icon
        // to the top. Auto vertical margins on the icon wrapper (the one element
        // that receives tabBarIconStyle) absorb the free space equally = centered.
        tabBarIconStyle: { marginTop: 'auto', marginBottom: 'auto' },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{ title: 'Accueil', tabBarIcon: tabIcon('home', 'home-outline') }}
      />
      <Tabs.Screen
        name="watchlist"
        options={{ title: 'Watchlist', tabBarIcon: tabIcon('bookmark', 'bookmark-outline') }}
      />
      <Tabs.Screen
        name="library"
        options={{ title: 'Bibliothèque', tabBarIcon: tabIcon('grid', 'grid-outline') }}
      />
      <Tabs.Screen
        name="profile"
        options={{ title: 'Profil', tabBarIcon: tabIcon('person', 'person-outline') }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  // Clips the blur + veil to the pill's rounded corners.
  blurWrap: { ...StyleSheet.absoluteFillObject, overflow: 'hidden' },
});
