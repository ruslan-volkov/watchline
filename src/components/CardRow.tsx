import { Image } from 'expo-image';
import { Pressable, StyleSheet, Text, View, type ViewStyle } from 'react-native';

import { ProgressBar } from '@/components/ProgressBar';
import { useDensity } from '@/contexts/DensityContext';
import { useTheme } from '@/contexts/ThemeContext';
import { posterColor, posterTextColor } from '@/theme/posterColors';

interface Props {
  /** Stable seed for the placeholder color (tmdb id as string). */
  seed: string;
  title: string;
  /** Square tile art — the poster, center-cropped; backdrop as a fallback. */
  posterPath?: string | null;
  backdropPath?: string | null;
  subtitle: string;
  onPress?: () => void;
  /** Trailing control, vertically centered (check button, date…). */
  right?: React.ReactNode;
  /** 0..1 — draws a progress bar across the bottom of the card. */
  progress?: number;
  /** Extra layer clipped to the card's rounded corners (e.g. a confirmation wash). */
  overlay?: React.ReactNode;
  style?: ViewStyle;
}

/** Elevated card row: square artwork, title + subtitle, optional trailing control
 *  and a full-width progress bar. Sizing follows the density preference. */
export function CardRow({
  seed,
  title,
  posterPath,
  backdropPath,
  subtitle,
  onPress,
  right,
  progress,
  overlay,
  style,
}: Props) {
  const { colors, scheme } = useTheme();
  const { spacing, density } = useDensity();
  const compact = density === 'compact';
  const tile = compact ? 52 : 64;
  const image = posterPath ?? backdropPath ?? null;
  // bg and surface are nearly identical in light mode, so the card needs a
  // hairline + soft shadow to read as elevated.
  const dark = scheme === 'dark';

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole={onPress ? 'button' : undefined}
      style={({ pressed }) => [
        styles.card,
        {
          backgroundColor: colors.surface,
          borderColor: colors.border,
          borderRadius: spacing.posterRadius,
          padding: compact ? 9 : 12,
          marginBottom: spacing.sm,
          shadowOpacity: dark ? 0 : 0.06,
          opacity: pressed && onPress ? 0.75 : 1,
        },
        style,
      ]}
    >
      <View style={styles.row}>
        {image ? (
          <Image
            source={{ uri: image }}
            style={{ width: tile, height: tile, borderRadius: compact ? 8 : 10 }}
            contentFit="cover"
            transition={150}
          />
        ) : (
          <View
            style={[
              styles.center,
              {
                width: tile,
                height: tile,
                borderRadius: compact ? 8 : 10,
                backgroundColor: posterColor(seed, scheme),
              },
            ]}
          >
            <Text style={[styles.initial, { color: posterTextColor(seed, scheme) }]}>
              {title.trim().charAt(0).toUpperCase() || '?'}
            </Text>
          </View>
        )}

        <View style={[styles.text, { marginLeft: spacing.md }]}>
          <Text
            numberOfLines={1}
            style={[styles.title, compact && styles.titleCompact, { color: colors.textPrimary }]}
          >
            {title}
          </Text>
          <Text
            numberOfLines={1}
            style={[
              styles.subtitle,
              compact && styles.subtitleCompact,
              { color: colors.textSecondary },
            ]}
          >
            {subtitle}
          </Text>
        </View>

        {right ? <View style={{ marginLeft: spacing.sm }}>{right}</View> : null}
      </View>

      {progress !== undefined ? (
        <ProgressBar
          progress={progress}
          color={colors.accent}
          trackColor={colors.surfaceAlt}
          height={4}
          style={{ marginTop: compact ? 8 : 10 }}
        />
      ) : null}

      {overlay}
    </Pressable>
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
  center: { alignItems: 'center', justifyContent: 'center' },
  initial: { fontSize: 24, fontWeight: '800' },
  text: { flex: 1 },
  title: { fontSize: 16, fontWeight: '600', marginBottom: 2 },
  titleCompact: { fontSize: 15, marginBottom: 1 },
  subtitle: { fontSize: 13, fontWeight: '500' },
  subtitleCompact: { fontSize: 12 },
});
