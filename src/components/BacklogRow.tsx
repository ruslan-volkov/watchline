import { Ionicons } from '@expo/vector-icons';
import { useRef } from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';
import ReanimatedSwipeable, {
  type SwipeableMethods,
} from 'react-native-gesture-handler/ReanimatedSwipeable';
import Animated, {
  Easing,
  FadeIn,
  FadeOut,
  LinearTransition,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { AnimatedCheck } from '@/components/AnimatedCheck';
import { CardRow } from '@/components/CardRow';
import { useDensity } from '@/contexts/DensityContext';
import { useTheme } from '@/contexts/ThemeContext';

export interface BacklogRowItem {
  key: string;
  seed: string;
  title: string;
  posterPath: string | null;
  backdropPath?: string | null;
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
 * Animated "À rattraper" banner row: tapping the check marks the shown episode
 * and washes the artwork green; swiping left sets the title aside. Rows fade out
 * and the list reflows smoothly when a title leaves the backlog.
 */
export function BacklogRow({ item, onOpen, onMark, onSnooze }: Props) {
  const { colors } = useTheme();
  const { spacing } = useDensity();
  const swipeRef = useRef<SwipeableMethods>(null);

  // Keyed so the check resets when the row advances to the next episode.
  const epKey = item.episode ? `${item.episode.seasonNumber}-${item.episode.episodeNumber}` : 'movie';

  // Green confirmation wash over the card, receding after it swells. Capped low
  // so the row stays readable through it.
  const flash = useSharedValue(0);
  const washStyle = useAnimatedStyle(() => ({ opacity: flash.value * 0.18 }));

  const handleMark = () => {
    flash.value = withSequence(
      withTiming(1, { duration: 260, easing: Easing.out(Easing.cubic) }),
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
      style={[
        styles.snoozeAction,
        {
          backgroundColor: colors.surfaceAlt,
          borderRadius: spacing.posterRadius,
          marginBottom: spacing.sm,
        },
      ]}
      accessibilityRole="button"
      accessibilityLabel="Mettre en pause"
    >
      <Ionicons name="pause" size={20} color={colors.textSecondary} />
      <Text style={[styles.snoozeText, { color: colors.textSecondary }]}>Pause</Text>
    </Pressable>
  );

  const content = (
    <CardRow
      seed={item.seed}
      title={item.title}
      posterPath={item.posterPath}
      backdropPath={item.backdropPath}
      subtitle={item.subtitle}
      onPress={onOpen}
      overlay={
        <Animated.View
          pointerEvents="none"
          style={[StyleSheet.absoluteFill, { backgroundColor: colors.success }, washStyle]}
        />
      }
      right={
        onMark ? (
          <AnimatedCheck
            resetKey={epKey}
            onMark={handleMark}
            accessibilityLabel={item.episode ? 'Marquer cet épisode vu' : 'Marquer comme vu'}
          />
        ) : undefined
      }
    />
  );

  return (
    <Animated.View
      layout={LinearTransition.duration(260)}
      entering={FadeIn.duration(200)}
      exiting={FadeOut.duration(160)}
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
  snoozeAction: {
    width: 78,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
    marginLeft: 6,
  },
  snoozeText: { fontSize: 12, fontWeight: '600' },
});
