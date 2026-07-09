import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, View } from 'react-native';

import { useTheme } from '@/contexts/ThemeContext';
import { tapHaptic } from '@/lib/haptics';

interface Props {
  /** 1..5, or 0/undefined for none. Never pre-filled unless the user rated. */
  value?: number | null;
  size?: number;
  /** When provided, stars are tappable (tap-to-rate). */
  onChange?: (value: number) => void;
}

/** 5-star rating. Tap-to-rate when `onChange` is set; read-only otherwise. */
export function RatingStars({ value, size = 22, onChange }: Props) {
  const { colors } = useTheme();
  const filled = value ?? 0;
  const interactive = typeof onChange === 'function';

  return (
    <View style={styles.row}>
      {[1, 2, 3, 4, 5].map((star) => {
        const active = star <= filled;
        const icon = (
          <Ionicons
            name={active ? 'star' : 'star-outline'}
            size={size}
            color={active ? colors.star : colors.starEmpty}
          />
        );
        if (!interactive) {
          return (
            <View key={star} style={styles.star}>
              {icon}
            </View>
          );
        }
        return (
          <Pressable
            key={star}
            onPress={() => {
              tapHaptic();
              onChange?.(star);
            }}
            hitSlop={6}
            style={styles.star}
            accessibilityRole="button"
            accessibilityLabel={`Noter ${star} sur 5`}
          >
            {icon}
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row' },
  star: { paddingHorizontal: 2 },
});
