import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { Avatar } from '@/components/Avatar';
import { Button } from '@/components/Button';
import { useTheme } from '@/contexts/ThemeContext';
import { useFriends } from '@/features/friends/useFriends';
import type { MediaSummary } from '@/media/types';
import { MESSAGE_MAX_LENGTH } from '../../../supabase/functions/recommend-media/rules';
import { alreadyRecommendedTo } from './feed';
import { useRecommendationMutations } from './useRecommendationMutations';
import { useRecommendations } from './useRecommendations';

interface Props {
  visible: boolean;
  summary: MediaSummary;
  onClose: () => void;
  /** Called once the recommendation is out, with how many friends it went to. */
  onSent: (count: number) => void;
}

/** Bottom sheet to pick friends and add a word. Friends who already got this title are
 *  shown but can't be picked: going back to them is what "Relancer" is for. */
export function RecommendSheet({ visible, summary, onClose, onSent }: Props) {
  const { colors } = useTheme();
  const router = useRouter();
  const { acceptedFriends } = useFriends();
  const { items } = useRecommendations();
  const { send } = useRecommendationMutations();
  const [selected, setSelected] = useState<string[]>([]);
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (visible) {
      setSelected([]);
      setMessage('');
    }
  }, [visible]);

  const already = useMemo(() => alreadyRecommendedTo(items, summary), [items, summary]);

  const toggle = (id: string) =>
    setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));

  const submit = () =>
    send.mutate(
      { summary, recipientIds: selected, message: message.trim() || null },
      { onSuccess: () => onSent(selected.length) },
    );

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
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
              {`Recommander ${summary.title}`}
            </Text>

            {acceptedFriends.length === 0 ? (
              <>
                <Text style={[styles.empty, { color: colors.textSecondary }]}>
                  Ajoute un ami pour lui conseiller ce titre.
                </Text>
                <Button
                  label="Ajouter des amis"
                  onPress={() => {
                    onClose();
                    router.push('/friends');
                  }}
                />
              </>
            ) : (
              <>
                <ScrollView
                  style={styles.friends}
                  keyboardShouldPersistTaps="handled"
                  showsVerticalScrollIndicator={false}
                >
                  {acceptedFriends.map(({ friendship, profile }) => {
                    if (!profile) return null;
                    const sent = already.has(profile.id);
                    const checked = selected.includes(profile.id);
                    return (
                      <Pressable
                        key={friendship.id}
                        onPress={() => toggle(profile.id)}
                        disabled={sent}
                        style={[styles.friend, sent && styles.friendSent]}
                        accessibilityRole="checkbox"
                        accessibilityState={{ checked, disabled: sent }}
                      >
                        <Avatar
                          name={profile.username}
                          avatarUrl={profile.avatar_url}
                          seed={profile.id}
                          size={36}
                        />
                        <Text
                          style={[styles.name, { color: colors.textPrimary }]}
                          numberOfLines={1}
                        >
                          {profile.username ?? 'Utilisateur'}
                        </Text>
                        {sent ? (
                          <Text style={[styles.badge, { color: colors.textMeta }]}>
                            Déjà recommandé
                          </Text>
                        ) : (
                          <View
                            style={[
                              styles.check,
                              {
                                borderColor: checked ? colors.accent : colors.border,
                                backgroundColor: checked ? colors.accent : 'transparent',
                              },
                            ]}
                          >
                            {checked ? (
                              <Ionicons name="checkmark" size={15} color={colors.accentText} />
                            ) : null}
                          </View>
                        )}
                      </Pressable>
                    );
                  })}
                </ScrollView>
                <TextInput
                  value={message}
                  onChangeText={setMessage}
                  placeholder="Un mot ? (optionnel)"
                  placeholderTextColor={colors.textMeta}
                  maxLength={MESSAGE_MAX_LENGTH}
                  multiline
                  testID="recommend-message"
                  style={[
                    styles.message,
                    { backgroundColor: colors.surfaceAlt, color: colors.textPrimary },
                  ]}
                />
                <Button
                  label="Envoyer"
                  onPress={submit}
                  disabled={selected.length === 0}
                  loading={send.isPending}
                  style={{ marginTop: 14 }}
                />
              </>
            )}
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
  empty: { fontSize: 15, marginBottom: 16 },
  friends: { maxHeight: 240, marginBottom: 12 },
  friend: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 7 },
  friendSent: { opacity: 0.6 },
  name: { flex: 1, fontSize: 16, fontWeight: '600' },
  badge: { fontSize: 13, fontWeight: '600' },
  check: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  message: {
    minHeight: 64,
    borderRadius: 14,
    padding: 14,
    fontSize: 15,
    textAlignVertical: 'top',
  },
});
