import { Ionicons } from '@expo/vector-icons';
import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import ReanimatedSwipeable, {
  type SwipeableMethods,
} from 'react-native-gesture-handler/ReanimatedSwipeable';
import Animated, {
  Easing,
  FadeIn,
  FadeInDown,
  interpolateColor,
  LinearTransition,
  SlideOutRight,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { PosterPlaceholder } from '@/components/PosterPlaceholder';
import { useDensity } from '@/contexts/DensityContext';
import { useTheme } from '@/contexts/ThemeContext';
import { successHaptic } from '@/lib/haptics';

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
  /** Called when swiped left to "Pause" (set the title aside). */
  onSnooze?: () => void;
}

/**
 * Animated "À rattraper" row: a "Vu" pill marks the item; the subtitle then
 * fades to the next episode when data updates. Rows fade out and the list
 * reflows smoothly when a title leaves the backlog.
 */
export function BacklogRow({ item, onOpen, onMark, onSnooze }: Props) {
  const { colors } = useTheme();
  const { density } = useDensity();
  const posterW = density === 'compact' ? 40 : 48;
  const swipeRef = useRef<SwipeableMethods>(null);

  // Keyed so the subtitle re-animates when the row advances to the next episode.
  const epKey = item.episode ? `${item.episode.seasonNumber}-${item.episode.episodeNumber}` : 'movie';

  // Green confirmation: the check fill and the row wash rise together (same
  // timing) so they swell as one; the wash then recedes while the check stays.
  const [confirmed, setConfirmed] = useState(false);
  const flash = useSharedValue(0);
  const fill = useSharedValue(0);
  const RISE = 260;
  const EASE = Easing.out(Easing.cubic);

  useEffect(() => {
    setConfirmed(false);
    fill.value = 0;
  }, [epKey, fill]);

  const rowStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(
      flash.value,
      [0, 1],
      ['rgba(0,0,0,0)', 'rgba(46,158,91,0.16)'],
    ),
  }));
  const fillStyle = useAnimatedStyle(() => ({
    opacity: fill.value,
    transform: [{ scale: 0.6 + 0.4 * fill.value }],
  }));

  const handleMark = () => {
    successHaptic();
    setConfirmed(true);
    fill.value = withTiming(1, { duration: RISE, easing: EASE });
    flash.value = withSequence(
      withTiming(1, { duration: RISE, easing: EASE }),
      withTiming(0, { duration: 620, easing: Easing.inOut(Easing.quad) }),
    );
    onMark?.();
  };

  const renderRightActions = () => (
    <Pressable
      onPress={() => {
        swipeRef.current?.close();
        onSnooze?.();
      }}
      style={[styles.snoozeAction, { backgroundColor: colors.surfaceAlt }]}
      accessibilityRole="button"
      accessibilityLabel="Mettre en pause"
    >
      <Ionicons name="pause" size={20} color={colors.textSecondary} />
      <Text style={[styles.snoozeText, { color: colors.textSecondary }]}>Pause</Text>
    </Pressable>
  );

  const content = (
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
            style={({ pressed }) => [
              styles.check,
              { borderColor: colors.border, opacity: pressed ? 0.5 : 1 },
            ]}
          >
            <Ionicons name="checkmark" size={18} color={colors.textMeta} />
            {confirmed ? (
              <Animated.View style={[styles.checkFill, { backgroundColor: colors.success }, fillStyle]}>
                <Ionicons name="checkmark" size={18} color="#fff" />
              </Animated.View>
            ) : null}
          </Pressable>
        ) : null}
    </Pressable>
  );

  return (
    <Animated.View
      layout={LinearTransition.duration(260)}
      entering={FadeIn.duration(200)}
      exiting={SlideOutRight.duration(260).easing(Easing.in(Easing.cubic))}
      style={[styles.wrap, rowStyle]}
    >
      {onSnooze ? (
        <ReanimatedSwipeable
          ref={swipeRef}
          renderRightActions={renderRightActions}
          overshootRight={false}
          rightThreshold={40}
          friction={1.6}
        >
          {content}
        </ReanimatedSwipeable>
      ) : (
        content
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: { borderRadius: 12, marginHorizontal: -8, paddingHorizontal: 8 },
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
    overflow: 'hidden',
  },
  checkFill: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  snoozeAction: {
    width: 78,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
    borderRadius: 12,
    marginLeft: 6,
  },
  snoozeText: { fontSize: 12, fontWeight: '600' },
});
