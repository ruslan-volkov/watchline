import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';

import { useTheme } from '@/contexts/ThemeContext';

type IconName = keyof typeof Ionicons.glyphMap;

/** Filled icon when the tab is active, outline when not. */
function tabIcon(active: IconName, inactive: IconName) {
  return ({ focused, color }: { focused: boolean; color: string }) => (
    <Ionicons name={focused ? active : inactive} size={24} color={color} />
  );
}

export default function TabsLayout() {
  const { colors, scheme } = useTheme();
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.textMeta,
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopWidth: 0,
          elevation: 12,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: -2 },
          shadowOpacity: scheme === 'dark' ? 0.28 : 0.07,
          shadowRadius: 10,
        },
        tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
        tabBarItemStyle: { paddingTop: 4 },
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
