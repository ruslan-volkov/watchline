import { useEffect, useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { Button } from '@/components/Button';
import { RatingStars } from '@/components/RatingStars';
import { useTheme } from '@/contexts/ThemeContext';

interface Props {
  visible: boolean;
  title: string;
  initialRating?: number | null;
  initialNotes?: string | null;
  onSubmit: (rating: number | null, notes: string | null) => void;
  /** "Passer" — always available, rating is never mandatory. */
  onSkip: () => void;
}

/** Bottom sheet for tap-to-rate + free note. Never pre-fills unless editing. */
export function RatingSheet({
  visible,
  title,
  initialRating,
  initialNotes,
  onSubmit,
  onSkip,
}: Props) {
  const { colors } = useTheme();
  const [rating, setRating] = useState<number | null>(initialRating ?? null);
  const [notes, setNotes] = useState(initialNotes ?? '');

  useEffect(() => {
    if (visible) {
      setRating(initialRating ?? null);
      setNotes(initialNotes ?? '');
    }
  }, [visible, initialRating, initialNotes]);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onSkip}>
      <Pressable style={[styles.backdrop, { backgroundColor: colors.overlay }]} onPress={onSkip}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <Pressable
            style={[styles.sheet, { backgroundColor: colors.surface }]}
            onPress={(e) => e.stopPropagation()}
          >
            <View style={[styles.handle, { backgroundColor: colors.border }]} />
            <Text style={[styles.title, { color: colors.textPrimary }]}>{title}</Text>
            <Text style={[styles.label, { color: colors.textSecondary }]}>Ta note</Text>
            <View style={styles.stars}>
              <RatingStars value={rating} size={34} onChange={setRating} />
            </View>
            <TextInput
              value={notes}
              onChangeText={setNotes}
              placeholder="Une note ? (optionnel)"
              placeholderTextColor={colors.textMeta}
              multiline
              style={[
                styles.notes,
                { backgroundColor: colors.surfaceAlt, color: colors.textPrimary },
              ]}
            />
            <Button
              label="Enregistrer"
              onPress={() => onSubmit(rating, notes.trim() || null)}
              style={{ marginTop: 14 }}
            />
            <Pressable onPress={onSkip} style={styles.skip} accessibilityRole="button">
              <Text style={[styles.skipText, { color: colors.textSecondary }]}>Passer</Text>
            </Pressable>
          </Pressable>
        </KeyboardAvoidingView>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: 'flex-end' },
  sheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    paddingBottom: 34,
  },
  handle: { width: 40, height: 4, borderRadius: 2, alignSelf: 'center', marginBottom: 16 },
  title: { fontSize: 20, fontWeight: '700', marginBottom: 18 },
  label: { fontSize: 13, fontWeight: '600', marginBottom: 8 },
  stars: { marginBottom: 18 },
  notes: {
    minHeight: 80,
    borderRadius: 14,
    padding: 14,
    fontSize: 15,
    textAlignVertical: 'top',
  },
  skip: { alignItems: 'center', paddingVertical: 14 },
  skipText: { fontSize: 15, fontWeight: '600' },
});
