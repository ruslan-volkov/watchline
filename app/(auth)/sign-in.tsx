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

export default function SignIn() {
  const { colors } = useTheme();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onSignIn = async () => {
    setLoading(true);
    setError(null);
    const { error: err } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    if (err) setError(err.message);
    else track('signed_in', { method: 'email' });
    setLoading(false);
    // On success the auth listener + guard route onward.
  };

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: colors.bg }]}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.flex}
      >
        <View style={styles.content}>
          <Text style={[styles.brand, { color: colors.accentInk }]}>Watchline</Text>
          <Text style={[styles.tagline, { color: colors.textPrimary }]}>
            Ce que tu regardes, suivi simplement.
          </Text>

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
              placeholder="••••••••"
            />
            {error ? <Text style={[styles.error, { color: colors.danger }]}>{error}</Text> : null}
            <Button
              label="Se connecter"
              onPress={onSignIn}
              loading={loading}
              disabled={!email || !password}
              style={{ marginTop: 6 }}
            />
          </View>

          <View style={styles.footer}>
            <Text style={{ color: colors.textSecondary }}>Pas encore de compte ? </Text>
            <Link href="/(auth)/sign-up" style={[styles.link, { color: colors.accentInk }]}>
              Créer un compte
            </Link>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  flex: { flex: 1 },
  content: { flex: 1, paddingHorizontal: 28, justifyContent: 'center' },
  brand: { fontSize: 16, fontWeight: '800', letterSpacing: 0.5, marginBottom: 8 },
  tagline: { fontSize: 26, fontWeight: '700', lineHeight: 32, marginBottom: 32 },
  form: {},
  error: { fontSize: 14, marginBottom: 8, marginLeft: 4 },
  footer: { flexDirection: 'row', justifyContent: 'center', marginTop: 24 },
  link: { fontWeight: '700' },
});
