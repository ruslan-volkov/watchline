import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { SectionHeader } from '@/components/SectionHeader';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { ArrServiceForm } from '@/features/nas/ArrServiceForm';
import { SERVICES, serviceLabels } from '@/features/nas/config';

export default function Nas() {
  const { colors } = useTheme();
  const router = useRouter();
  const { session } = useAuth();
  // Where Radarr / Sonarr post when a download finishes (see the Edge Function).
  const webhookUrl = `${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/nas-download-complete?user=${session?.user.id}`;

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: colors.bg }]} edges={['top']}>
      <View style={styles.topBar}>
        <Pressable
          onPress={() => router.back()}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel="Retour"
        >
          <Ionicons name="chevron-back" size={26} color={colors.textPrimary} />
        </Pressable>
        <Text style={[styles.title, { color: colors.textPrimary }]}>NAS</Text>
        <View style={{ width: 26 }} />
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        // Lifts the focused field above the keyboard; a shrunk view would leave it hidden.
        automaticallyAdjustKeyboardInsets
        showsVerticalScrollIndicator={false}
      >
        <Text style={[styles.intro, { color: colors.textSecondary }]}>
          Relie Watchline à Radarr (films) et Sonarr (séries) pour lancer un téléchargement
          depuis la fiche d’un titre. La qualité et les langues restent réglées sur le NAS.
        </Text>

        {SERVICES.map((service) => (
          <View key={service}>
            <SectionHeader>{serviceLabels[service]}</SectionHeader>
            <ArrServiceForm service={service} />
          </View>
        ))}

        <SectionHeader>Notification de fin</SectionHeader>
        <Text style={[styles.intro, { color: colors.textSecondary }]}>
          Pour être prévenu quand un téléchargement est terminé, ajoute dans Radarr et Sonarr
          (Réglages → Connect → Webhook, événement « On Import ») cette adresse en POST, avec
          l’en-tête x-webhook-secret.
        </Text>
        <Text
          selectable
          style={[
            styles.webhook,
            { color: colors.textPrimary, backgroundColor: colors.surface, borderColor: colors.border },
          ]}
        >
          {webhookUrl}
        </Text>
        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    height: 44,
  },
  title: { fontSize: 18, fontWeight: '700' },
  content: { paddingHorizontal: 20 },
  intro: { fontSize: 14, lineHeight: 20, marginTop: 8 },
  webhook: {
    fontSize: 12,
    lineHeight: 18,
    borderWidth: 1,
    borderRadius: 14,
    padding: 14,
    marginTop: 12,
  },
});
