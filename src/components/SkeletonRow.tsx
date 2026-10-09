import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import { useDensity } from '@/contexts/DensityContext';
import { useTheme } from '@/contexts/ThemeContext';

/** A CardRow-shaped placeholder, pulsing while the real data loads. Showing the
 *  list's own shape reads as "almost there" where a lone spinner reads as "wait". */
export function SkeletonRow() {
  const { colors, scheme } = useTheme();
  const { spacing, density } = useDensity();
  const compact = density === 'compact';
  const posterW = compact ? 38 : 46;
  const pulse = useSharedValue(0.45);

  useEffect(() => {
    pulse.value = withRepeat(
      withTiming(1, { duration: 900, easing: Easing.inOut(Easing.quad) }),
      -1,
      true,
    );
  }, [pulse]);

  const pulseStyle = useAnimatedStyle(() => ({ opacity: pulse.value }));
  const block = { backgroundColor: colors.surfaceAlt };

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: colors.surface,
          borderColor: colors.border,
          borderRadius: spacing.posterRadius,
          padding: compact ? 7 : 9,
          marginBottom: compact ? 4 : 6,
          shadowOpacity: scheme === 'dark' ? 0 : 0.06,
        },
      ]}
    >
      <Animated.View style={[styles.row, pulseStyle]}>
        <View
          style={[
            block,
            { width: posterW, height: Math.round(posterW * 1.5), borderRadius: compact ? 6 : 8 },
          ]}
        />
        <View style={[styles.text, { marginLeft: spacing.md }]}>
          <View style={[styles.bar, block, { width: '62%', height: compact ? 11 : 12 }]} />
          <View style={[styles.bar, block, { width: '38%', height: compact ? 9 : 10 }]} />
        </View>
      </Animated.View>
    </View>
  );
}

/** A short run of placeholder rows — enough to fill the fold, never a full page. */
export function SkeletonList({ count = 5 }: { count?: number }) {
  return (
    <View accessibilityLabel="Chargement" accessible>
      {Array.from({ length: count }, (_, i) => (
        <SkeletonRow key={i} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 6,
    elevation: 2,
  },
  row: { flexDirection: 'row', alignItems: 'center' },
  text: { flex: 1 },
  bar: { borderRadius: 4, marginBottom: 6 },
});
