import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useTheme } from '@/contexts/ThemeContext';

interface Props {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  /** One sentence explaining the value — never an apology. */
  message: string;
  actionLabel?: string;
  onAction?: () => void;
}

/** icon → contextual title → value sentence → action button. */
export function EmptyState({ icon, title, message, actionLabel, onAction }: Props) {
  const { colors } = useTheme();
  return (
    <View style={styles.wrap}>
      <View style={[styles.iconWrap, { backgroundColor: colors.surfaceAlt }]}>
        <Ionicons name={icon} size={30} color={colors.textSecondary} />
      </View>
      <Text style={[styles.title, { color: colors.textPrimary }]}>{title}</Text>
      <Text style={[styles.message, { color: colors.textSecondary }]}>{message}</Text>
      {actionLabel && onAction ? (
        <Pressable
          onPress={onAction}
          style={[styles.button, { backgroundColor: colors.accent }]}
          accessibilityRole="button"
        >
          <Text style={[styles.buttonText, { color: colors.accentText }]}>{actionLabel}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32, paddingVertical: 48 },
  iconWrap: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 18,
  },
  title: { fontSize: 19, fontWeight: '700', marginBottom: 6, textAlign: 'center' },
  message: { fontSize: 15, lineHeight: 21, textAlign: 'center', marginBottom: 20 },
  button: { paddingHorizontal: 22, paddingVertical: 12, borderRadius: 999 },
  buttonText: { fontSize: 15, fontWeight: '700' },
});
