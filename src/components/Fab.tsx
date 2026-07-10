import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet } from 'react-native';

import { useTheme } from '@/contexts/ThemeContext';
import { useTabBarClearance } from '@/theme/layout';

interface Props {
  icon?: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
  accessibilityLabel: string;
}

/** Floating action button, bottom-right — thumb-reachable, sits above the tab bar. */
export function Fab({ icon = 'add', onPress, accessibilityLabel }: Props) {
  const { colors } = useTheme();
  const clearance = useTabBarClearance();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      style={({ pressed }) => [
        styles.fab,
        { bottom: clearance, backgroundColor: colors.accent, opacity: pressed ? 0.85 : 1 },
      ]}
    >
      <Ionicons name={icon} size={28} color={colors.accentText} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  fab: {
    position: 'absolute',
    right: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 6,
  },
});
