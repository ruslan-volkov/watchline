import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, View } from 'react-native';

import { useTheme } from '@/contexts/ThemeContext';
import { tapHaptic } from '@/lib/haptics';

interface Props {
  /** 0.5..5 (half-star steps), or 0/undefined for none. Never pre-filled unless rated. */
  value?: number | null;
  size?: number;
  /** When provided, stars are tappable — left half sets .5, right half sets full. */
  onChange?: (value: number) => void;
}

/** 5-star rating with half-star support. Tap-to-rate when `onChange` is set. */
export function RatingStars({ value, size = 22, onChange }: Props) {
  const { colors } = useTheme();
  const filled = value ?? 0;
  const interactive = typeof onChange === 'function';

  const pick = (v: number) => {
    tapHaptic();
    onChange?.(v);
  };

  return (
    <View style={styles.row}>
      {[1, 2, 3, 4, 5].map((star) => {
        const name =
          filled >= star ? 'star' : filled >= star - 0.5 ? 'star-half' : 'star-outline';
        const color = filled >= star - 0.5 ? colors.star : colors.starEmpty;
        return (
          <View key={star} style={[styles.star, { width: size, height: size }]}>
            <Ionicons name={name} size={size} color={color} />
            {interactive ? (
              <>
                <Pressable
                  style={[styles.zone, { left: 0, width: size / 2 }]}
                  onPress={() => pick(star - 0.5)}
                  accessibilityRole="button"
                  accessibilityLabel={`Noter ${star - 0.5} sur 5`}
                />
                <Pressable
                  style={[styles.zone, { right: 0, width: size / 2 }]}
                  onPress={() => pick(star)}
                  accessibilityRole="button"
                  accessibilityLabel={`Noter ${star} sur 5`}
                />
              </>
            ) : null}
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 4 },
  star: { alignItems: 'center', justifyContent: 'center' },
  zone: { position: 'absolute', top: 0, bottom: 0 },
});
