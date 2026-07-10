import { useEffect, type ReactNode } from 'react';
import { StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

interface Props {
  open: boolean;
  children: ReactNode;
}

/** Accordion container: animates its height + opacity between 0 and the natural
 *  content height. Children stay mounted (measured) so the reveal is smooth both
 *  ways. */
export function Collapsible({ open, children }: Props) {
  // Natural content height — only ever set from a real (>0) measurement, so a
  // clipped/collapsed layout pass can't wipe it out.
  const contentH = useSharedValue(0);
  // Animated 0→1 openness, driven by an effect (reliable across re-renders).
  const openness = useSharedValue(open ? 1 : 0);

  useEffect(() => {
    openness.value = withTiming(open ? 1 : 0, {
      duration: 260,
      easing: Easing.out(Easing.cubic),
    });
  }, [open, openness]);

  const style = useAnimatedStyle(() => ({
    // Until measured, render at natural height so the first paint isn't clipped.
    height: contentH.value === 0 ? undefined : contentH.value * openness.value,
    opacity: openness.value,
  }));

  const onLayout = (e: LayoutChangeEvent) => {
    const h = e.nativeEvent.layout.height;
    if (h > 0) contentH.value = h;
  };

  return (
    <Animated.View style={[styles.clip, style]}>
      <View onLayout={onLayout}>{children}</View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  clip: { overflow: 'hidden' },
});
