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
import { useTheme } from '@/contexts/ThemeContext';
import { MESSAGE_MAX_LENGTH } from '../../../supabase/functions/recommend-media/rules';
import type { RecommendationItem } from './feed';
import { useRecommendationMutations } from './useRecommendationMutations';

interface Props {
  /** The recommendation to nudge about; the sheet is open while there is one. */
  item: RecommendationItem | null;
  onClose: () => void;
  onSent: () => void;
}

/** Bottom sheet to send a friend a reminder, with a word of your own. */
export function NudgeSheet({ item, onClose, onSent }: Props) {
  const { colors } = useTheme();
  const { nudge } = useRecommendationMutations();
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (item) setMessage('');
  }, [item]);

  const submit = () => {
    if (!item) return;
    nudge.mutate({ id: item.rec.id, message: message.trim() || null }, { onSuccess: onSent });
  };

  return (
    <Modal visible={!!item} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable
        style={[styles.backdrop, { backgroundColor: colors.overlay }]}
        onPress={onClose}
        accessible={false}
      >
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <Pressable
            style={[styles.sheet, { backgroundColor: colors.surface }]}
            onPress={(e) => e.stopPropagation()}
            accessible={false}
          >
            <View style={[styles.handle, { backgroundColor: colors.border }]} />
            <Text style={[styles.title, { color: colors.textPrimary }]} numberOfLines={2}>
              {`Relancer pour ${item?.rec.media.title ?? ''}`}
            </Text>
            <TextInput
              value={message}
              onChangeText={setMessage}
              placeholder="Ajoute un mot… (optionnel)"
              placeholderTextColor={colors.textMeta}
              maxLength={MESSAGE_MAX_LENGTH}
              multiline
              testID="nudge-message"
              style={[
                styles.message,
                { backgroundColor: colors.surfaceAlt, color: colors.textPrimary },
              ]}
            />
            <Button
              label="Envoyer la relance"
              onPress={submit}
              loading={nudge.isPending}
              style={{ marginTop: 14 }}
            />
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
  title: { fontSize: 20, fontWeight: '700', marginBottom: 14 },
  message: {
    minHeight: 80,
    borderRadius: 14,
    padding: 14,
    fontSize: 15,
    textAlignVertical: 'top',
  },
});
