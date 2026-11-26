import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Avatar } from '@/components/Avatar';
import { Button } from '@/components/Button';
import { TextField } from '@/components/TextField';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { pickAndUploadAvatar } from '@/features/profile/avatar';

export default function EditProfile() {
  const { colors } = useTheme();
  const { profile, session, updateProfile } = useAuth();
  const router = useRouter();

  const [username, setUsername] = useState(profile?.username ?? '');
  const [avatarUrl, setAvatarUrl] = useState(profile?.avatar_url ?? null);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);

  const changePhoto = async () => {
    if (!session) return;
    setUploading(true);
    try {
      const res = await pickAndUploadAvatar(session.user.id);
      if (res.status === 'denied') {
        Alert.alert('Accès refusé', 'Autorise l’accès aux photos pour changer ton avatar.');
      } else if (res.status === 'uploaded' && res.avatarUrl) {
        setAvatarUrl(res.avatarUrl);
        await updateProfile({ avatar_url: res.avatarUrl });
      }
    } catch (_e) {
      Alert.alert('Oups', 'L’envoi de la photo a échoué. Réessaie.');
    } finally {
      setUploading(false);
    }
  };

  const trimmed = username.trim();
  const dirty = trimmed !== (profile?.username ?? '');
  const valid = trimmed.length >= 2;

  const save = async () => {
    if (!valid || !dirty) {
      router.back();
      return;
    }
    setSaving(true);
    try {
      await updateProfile({ username: trimmed });
      router.back();
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: colors.bg }]} edges={['top']}>
      <View style={styles.topBar}>
        <Pressable onPress={() => router.back()} hitSlop={10} accessibilityRole="button">
          <Ionicons name="chevron-back" size={26} color={colors.textPrimary} />
        </Pressable>
        <Text style={[styles.title, { color: colors.textPrimary }]}>Modifier le profil</Text>
        <View style={{ width: 26 }} />
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.flex}
      >
        <View style={styles.content}>
          <View style={styles.avatar}>
            <Pressable onPress={changePhoto} disabled={uploading} accessibilityRole="button">
              <Avatar
                name={trimmed || profile?.username}
                avatarUrl={avatarUrl}
                seed={profile?.id}
                size={84}
              />
              <View
                style={[styles.camera, { backgroundColor: colors.accent, borderColor: colors.bg }]}
              >
                {uploading ? (
                  <ActivityIndicator size="small" color={colors.accentText} />
                ) : (
                  <Ionicons name="camera" size={16} color={colors.accentText} />
                )}
              </View>
            </Pressable>
            <Text style={[styles.changePhoto, { color: colors.accentInk }]}>Changer la photo</Text>
          </View>

          <TextField
            label="Pseudo"
            value={username}
            onChangeText={setUsername}
            autoCapitalize="none"
            placeholder="ex. marin"
            maxLength={24}
            returnKeyType="done"
            onSubmitEditing={save}
          />

          <Button
            label="Enregistrer"
            onPress={save}
            loading={saving}
            disabled={!valid || !dirty}
            style={{ marginTop: 8 }}
          />
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  flex: { flex: 1 },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    height: 44,
  },
  title: { fontSize: 18, fontWeight: '700' },
  content: { paddingHorizontal: 24, paddingTop: 16 },
  avatar: { alignItems: 'center', marginBottom: 24 },
  camera: {
    position: 'absolute',
    right: -2,
    bottom: -2,
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 3,
    alignItems: 'center',
    justifyContent: 'center',
  },
  changePhoto: { fontSize: 14, fontWeight: '600', marginTop: 10 },
});
