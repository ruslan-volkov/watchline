import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn, FadeInDown, FadeOut, LinearTransition } from 'react-native-reanimated';

import { PosterPlaceholder } from '@/components/PosterPlaceholder';
import { useDensity } from '@/contexts/DensityContext';
import { useTheme } from '@/contexts/ThemeContext';
import { tapHaptic } from '@/lib/haptics';

export interface BacklogRowItem {
  key: string;
  seed: string;
  title: string;
  posterPath: string | null;
  subtitle: string;
  /** Present for series rows — enables the inline animated check. */
  episode?: { seasonNumber: number; episodeNumber: number };
}

interface Props {
  item: BacklogRowItem;
  onOpen: () => void;
  /** Called when the check is tapped (mark the shown episode watched). */
  onMark?: () => void;
}

/**
 * Animated "À rattraper" row: tapping the check pops + fills it, then the new
 * episode's subtitle fades in when data updates. Rows fade out and the list
 * reflows smoothly when a series leaves the backlog.
 */
export function BacklogRow({ item, onOpen, onMark }: Props) {
  const { colors } = useTheme();
  const { density } = useDensity();
  const posterW = density === 'compact' ? 40 : 48;

  const [confirmed, setConfirmed] = useState(false);

  // Reset the check once the row advances to the next episode.
  const epKey = item.episode ? `${item.episode.seasonNumber}-${item.episode.episodeNumber}` : 'movie';
  useEffect(() => {
    setConfirmed(false);
  }, [epKey]);

  const handleMark = () => {
    tapHaptic();
    setConfirmed(true);
    onMark?.();
  };

  return (
    <Animated.View
      layout={LinearTransition.duration(260)}
      entering={FadeIn.duration(200)}
      exiting={FadeOut.duration(160)}
    >
      <Pressable
        onPress={onOpen}
        style={({ pressed }) => [styles.row, { opacity: pressed ? 0.6 : 1 }]}
        accessibilityRole="button"
      >
        <PosterPlaceholder seed={item.seed} title={item.title} posterPath={item.posterPath} width={posterW} />
        <View style={styles.text}>
          <Text numberOfLines={1} style={[styles.title, { color: colors.textPrimary }]}>
            {item.title}
          </Text>
          <Animated.Text
            key={epKey}
            entering={FadeInDown.duration(240)}
            numberOfLines={1}
            style={[styles.subtitle, { color: colors.textSecondary }]}
          >
            {item.subtitle}
          </Animated.Text>
        </View>
        {onMark ? (
          <Pressable
            onPress={handleMark}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={item.episode ? 'Marquer cet épisode vu' : 'Marquer comme vu'}
          >
            <View
              style={[
                styles.check,
                {
                  borderColor: colors.accent,
                  backgroundColor: confirmed ? colors.accent : 'transparent',
                },
              ]}
            >
              <Ionicons name="checkmark" size={18} color={confirmed ? colors.accentText : colors.accent} />
            </View>
          </Pressable>
        ) : null}
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8 },
  text: { flex: 1, marginLeft: 12 },
  title: { fontSize: 16, fontWeight: '600', marginBottom: 2 },
  subtitle: { fontSize: 13, fontWeight: '500' },
  check: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 10,
  },
});
