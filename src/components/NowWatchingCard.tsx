import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { PosterPlaceholder } from '@/components/PosterPlaceholder';
import { ProgressBar } from '@/components/ProgressBar';
import { useTheme } from '@/contexts/ThemeContext';
import { tapHaptic } from '@/lib/haptics';
import { posterAccentColor } from '@/theme/posterColors';

interface Props {
  seed: string;
  title: string;
  posterPath?: string | null;
  /** Line under the title, e.g. "S2E3 · 5/8". */
  subtitle: string;
  /** 0..1 fraction watched. */
  progress: number;
  width: number;
  onPress?: () => void;
  /** Tap-only check (never swipe — conflicts with the horizontal carousel). */
  onCheck?: () => void;
}

/** "En cours" card: poster + thin progress bar + overlay check button. */
export function NowWatchingCard({
  seed,
  title,
  posterPath,
  subtitle,
  progress,
  width,
  onPress,
  onCheck,
}: Props) {
  const { colors, scheme } = useTheme();
  const posterH = Math.round(width * 1.5);
  const accent = posterAccentColor(seed, scheme);
  const clamped = Math.max(0, Math.min(1, progress));

  return (
    <Pressable onPress={onPress} style={{ width }} accessibilityRole="button">
      <View>
        <PosterPlaceholder
          seed={seed}
          title={title}
          posterPath={posterPath}
          width={width}
          height={posterH}
        />
        {onCheck ? (
          <Pressable
            onPress={() => {
              tapHaptic();
              onCheck();
            }}
            hitSlop={8}
            style={[styles.check, { backgroundColor: colors.overlay }]}
            accessibilityRole="button"
            accessibilityLabel="Marquer le prochain épisode vu"
          >
            <Ionicons name="checkmark" size={18} color="#FFFFFF" />
          </Pressable>
        ) : null}
        <ProgressBar
          progress={clamped}
          color={accent}
          trackColor={colors.overlay}
          height={4}
          radius={0}
          style={styles.track}
        />
      </View>
      <Text numberOfLines={1} style={[styles.title, { color: colors.textPrimary }]}>
        {title}
      </Text>
      <Text numberOfLines={1} style={[styles.subtitle, { color: colors.textSecondary }]}>
        {subtitle}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  check: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  track: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    borderBottomLeftRadius: 12,
    borderBottomRightRadius: 12,
  },
  title: { fontSize: 14, fontWeight: '600', marginTop: 6 },
  subtitle: { fontSize: 12, fontWeight: '500', marginTop: 1 },
});
