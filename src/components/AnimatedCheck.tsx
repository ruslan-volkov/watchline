import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { useTheme } from '@/contexts/ThemeContext';
import { successHaptic } from '@/lib/haptics';

interface Props {
  /** Called when tapped (after the green fill starts). */
  onMark: () => void;
  /** Changes when the target advances (e.g. next episode) → resets the fill. */
  resetKey: string;
  accessibilityLabel: string;
}

/** Circular "mark watched" check with a green fill confirmation. Shared by the
 *  home backlog-style rows and the watchlist "En cours" rows. */
export function AnimatedCheck({ onMark, resetKey, accessibilityLabel }: Props) {
  const { colors } = useTheme();
  const [confirmed, setConfirmed] = useState(false);
  const fill = useSharedValue(0);

  useEffect(() => {
    setConfirmed(false);
    fill.value = 0;
  }, [resetKey, fill]);

  const fillStyle = useAnimatedStyle(() => ({
    opacity: fill.value,
    transform: [{ scale: 0.6 + 0.4 * fill.value }],
  }));

  const handle = () => {
    successHaptic();
    setConfirmed(true);
    fill.value = withTiming(1, { duration: 260, easing: Easing.out(Easing.cubic) });
    onMark();
  };

  return (
    <Pressable
      onPress={handle}
      hitSlop={8}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      style={({ pressed }) => [
        styles.check,
        { borderColor: colors.border, opacity: pressed ? 0.5 : 1 },
      ]}
    >
      <Ionicons name="checkmark" size={18} color={colors.textMeta} />
      {confirmed ? (
        <Animated.View style={[styles.fill, { backgroundColor: colors.success }, fillStyle]}>
          <Ionicons name="checkmark" size={18} color="#fff" />
        </Animated.View>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  check: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  fill: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
