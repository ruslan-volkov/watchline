import { StyleSheet, Text, View } from 'react-native';

import { useTheme } from '@/contexts/ThemeContext';
import { statusLabels } from '@/theme/tokens';
import type { WatchStatus } from '@/media/types';

/** Discreet status pill: light fill + same-hue text (never black-on-color). */
export function StatusBadge({ status }: { status: WatchStatus }) {
  const { status: statusColors } = useTheme();
  const c = statusColors[status];
  return (
    <View style={[styles.pill, { backgroundColor: c.bg }]}>
      <Text style={[styles.label, { color: c.fg }]}>{statusLabels[status]}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 999,
  },
  label: { fontSize: 12, fontWeight: '700', letterSpacing: 0.2 },
});
