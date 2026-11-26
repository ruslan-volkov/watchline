import { useEffect } from 'react';
import { StyleSheet, View, type ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

interface Props {
  /** 0..1 fraction filled. Animates when it changes. */
  progress: number;
  color: string;
  trackColor: string;
  height?: number;
  radius?: number;
  style?: ViewStyle;
}

/** Thin progress bar whose fill width animates smoothly on change. */
export function ProgressBar({ progress, color, trackColor, height = 5, radius, style }: Props) {
  const clamped = Math.max(0, Math.min(1, progress));
  const w = useSharedValue(clamped);

  useEffect(() => {
    w.value = withTiming(clamped, { duration: 320 });
  }, [clamped, w]);

  const fillStyle = useAnimatedStyle(() => ({ width: `${w.value * 100}%` }));
  const r = radius ?? height / 2;

  return (
    <View style={[styles.track, { height, backgroundColor: trackColor, borderRadius: r }, style]}>
      <Animated.View style={[{ height, backgroundColor: color, borderRadius: r }, fillStyle]} />
    </View>
  );
}

const styles = StyleSheet.create({
  track: { overflow: 'hidden', width: '100%' },
});
