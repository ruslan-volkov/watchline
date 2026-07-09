import { useRouter } from 'expo-router';
import { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/Button';
import { TextField } from '@/components/TextField';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';

export default function Onboarding() {
  const { colors } = useTheme();
  const { updateProfile } = useAuth();
  const router = useRouter();
  const [step, setStep] = useState<'form' | 'done'>('form');
  const [username, setUsername] = useState('');
  const [saving, setSaving] = useState(false);

  const initial = username.trim().charAt(0).toUpperCase() || '?';

  const finish = async () => {
    setSaving(true);
    try {
      // Persist only at the end so the session guard doesn't bounce us off
      // the confirmation step early.
      await updateProfile({ username: username.trim() });
      router.replace('/(tabs)');
      router.push('/search');
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: colors.bg }]}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.flex}
      >
        <View style={styles.content}>
          <View style={[styles.avatar, { backgroundColor: colors.surfaceAlt }]}>
            <Text style={[styles.avatarText, { color: colors.textSecondary }]}>{initial}</Text>
          </View>

          {step === 'form' ? (
            <>
              <Text style={[styles.title, { color: colors.textPrimary }]}>
                Comment veux-tu qu’on t’appelle ?
              </Text>
              <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
                Un pseudo, c’est tout ce qu’il faut pour commencer.
              </Text>
              <View style={styles.form}>
                <TextField
                  label="Pseudo"
                  value={username}
                  onChangeText={setUsername}
                  autoCapitalize="none"
                  placeholder="ex. marin"
                  maxLength={24}
                  returnKeyType="done"
                />
                <Button
                  label="Continuer"
                  onPress={() => setStep('done')}
                  disabled={username.trim().length < 2}
                  style={{ marginTop: 6 }}
                />
              </View>
            </>
          ) : (
            <>
              <Text style={[styles.title, { color: colors.textPrimary }]}>
                Bienvenue, {username.trim()} 👋
              </Text>
              <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
                Ajoute un premier titre : une série que tu suis ou un film que tu veux voir.
              </Text>
              <View style={styles.form}>
                <Button label="Ajouter un titre" onPress={finish} loading={saving} />
              </View>
            </>
          )}
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  flex: { flex: 1 },
  content: { flex: 1, paddingHorizontal: 28, justifyContent: 'center' },
  avatar: {
    width: 84,
    height: 84,
    borderRadius: 42,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  avatarText: { fontSize: 34, fontWeight: '800' },
  title: { fontSize: 26, fontWeight: '700', lineHeight: 32, marginBottom: 10 },
  subtitle: { fontSize: 16, lineHeight: 23, marginBottom: 28 },
  form: {},
});
