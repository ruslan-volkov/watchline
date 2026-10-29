import { Link } from 'expo-router';
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
import { useTheme } from '@/contexts/ThemeContext';
import { track } from '@/lib/analytics';
import { supabase } from '@/lib/supabase';

export default function SignUp() {
  const { colors } = useTheme();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [needsConfirm, setNeedsConfirm] = useState(false);

  const onSignUp = async () => {
    setLoading(true);
    setError(null);
    const { data, error: err } = await supabase.auth.signUp({
      email: email.trim(),
      password,
    });
    setLoading(false);
    if (err) {
      setError(err.message);
      return;
    }
    track('signed_up', { method: 'email' });
    // If the project requires email confirmation, no session is returned yet.
    if (!data.session) setNeedsConfirm(true);
    // Otherwise the auth listener + guard route to onboarding.
  };

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: colors.bg }]}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.flex}
      >
        <View style={styles.content}>
          <Text style={[styles.title, { color: colors.textPrimary }]}>Créer un compte</Text>

          {needsConfirm ? (
            <Text style={[styles.info, { color: colors.textSecondary }]}>
              On t’a envoyé un e-mail de confirmation. Confirme ton adresse puis reviens te connecter.
            </Text>
          ) : (
            <>
              <View style={styles.form}>
                <TextField
                  label="E-mail"
                  value={email}
                  onChangeText={setEmail}
                  autoCapitalize="none"
                  keyboardType="email-address"
                  autoComplete="email"
                  placeholder="toi@exemple.com"
                />
                <TextField
                  label="Mot de passe"
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry
                  placeholder="6 caractères minimum"
                />
                {error ? <Text style={[styles.error, { color: colors.danger }]}>{error}</Text> : null}
                <Button
                  label="Continuer"
                  onPress={onSignUp}
                  loading={loading}
                  disabled={!email || password.length < 6}
                  style={{ marginTop: 6 }}
                />
              </View>

              <View style={styles.footer}>
                <Text style={{ color: colors.textSecondary }}>Déjà un compte ? </Text>
                <Link href="/(auth)/sign-in" style={[styles.link, { color: colors.accentInk }]}>
                  Se connecter
                </Link>
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
  title: { fontSize: 26, fontWeight: '700', marginBottom: 28 },
  info: { fontSize: 16, lineHeight: 23 },
  form: {},
  error: { fontSize: 14, marginBottom: 8, marginLeft: 4 },
  footer: { flexDirection: 'row', justifyContent: 'center', marginTop: 24 },
  link: { fontWeight: '700' },
});
