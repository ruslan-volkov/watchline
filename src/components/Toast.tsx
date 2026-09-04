import { useEffect, useRef } from 'react';
import { Animated, Pressable, StyleSheet, Text } from 'react-native';

import { useTheme } from '@/contexts/ThemeContext';

export interface ToastState {
  message: string;
  /** Optional undo action; shows an "Annuler" button when present. */
  onUndo?: () => void;
}

interface Props {
  toast: ToastState | null;
  onDismiss: () => void;
  /** Auto-dismiss delay in ms. */
  duration?: number;
}

/** Non-blocking bottom toast with an optional Undo action. */
export function Toast({ toast, onDismiss, duration = 4000 }: Props) {
  const { colors } = useTheme();
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!toast) return;
    Animated.timing(opacity, { toValue: 1, duration: 180, useNativeDriver: true }).start();
    const id = setTimeout(() => {
      Animated.timing(opacity, { toValue: 0, duration: 180, useNativeDriver: true }).start(
        onDismiss,
      );
    }, duration);
    return () => clearTimeout(id);
  }, [toast, duration, opacity, onDismiss]);

  if (!toast) return null;

  return (
    <Animated.View style={[styles.wrap, { opacity }]} pointerEvents="box-none">
      <Animated.View style={[styles.toast, { backgroundColor: colors.textPrimary }]}>
        <Text style={[styles.message, { color: colors.bg }]} numberOfLines={2}>
          {toast.message}
        </Text>
        {toast.onUndo ? (
          <Pressable
            onPress={() => {
              toast.onUndo?.();
              onDismiss();
            }}
            hitSlop={8}
            accessibilityRole="button"
          >
            <Text style={[styles.undo, { color: colors.accentInk }]}>Annuler</Text>
          </Pressable>
        ) : null}
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    left: 16,
    right: 16,
    bottom: 24,
    alignItems: 'center',
  },
  toast: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 16,
    gap: 16,
    maxWidth: 480,
    width: '100%',
  },
  message: { flex: 1, fontSize: 14, fontWeight: '600' },
  undo: { fontSize: 14, fontWeight: '800' },
});
