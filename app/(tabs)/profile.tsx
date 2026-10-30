import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Linking, Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';

import { Button } from '@/components/Button';
import { Screen } from '@/components/Screen';
import { SectionHeader } from '@/components/SectionHeader';
import { useAnalyticsConsent } from '@/contexts/AnalyticsContext';
import { useAuth } from '@/contexts/AuthContext';
import { useDensity } from '@/contexts/DensityContext';
import { useTheme } from '@/contexts/ThemeContext';
import { useFriends } from '@/features/friends/useFriends';
import { SERVICES, serviceLabels } from '@/features/nas/config';
import { useNasConfig } from '@/features/nas/NasConfigContext';
import { usePushStatus } from '@/features/notifications/PushRegistrationContext';
import type { PushRegistrationResult } from '@/features/notifications/attempt';
import { useWatchEntries } from '@/features/watch/useWatchEntries';
import { track } from '@/lib/analytics';
import { useTabBarClearance } from '@/theme/layout';
import type { Density } from '@/theme/tokens';
import type { Enums } from '@/types/db';

type ThemePref = Enums<'theme_pref'>;

function Segmented<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { key: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  const { colors } = useTheme();
  return (
    <View style={[styles.segment, { backgroundColor: colors.surfaceAlt }]}>
      {options.map((o) => {
        const active = value === o.key;
        return (
          <Text
            key={o.key}
            onPress={() => onChange(o.key)}
            style={[
              styles.segmentItem,
              active && { backgroundColor: colors.surface },
              { color: active ? colors.textPrimary : colors.textSecondary },
            ]}
          >
            {o.label}
          </Text>
        );
      })}
    </View>
  );
}

/**
 * What to tell the user when the device never got a push token. Without this the
 * digest row claimed to be on while nothing could be delivered.
 */
function digestNotice(
  status: PushRegistrationResult | null,
): { hint: string; openSettings?: boolean } | null {
  switch (status) {
    // Still trying, or the token is in: nothing to warn about.
    case null:
    case 'registered':
      return null;
    case 'permission-denied':
      return {
        hint: 'Les notifications sont refusées pour Watchline. Autorise-les pour recevoir le digest.',
        openSettings: true,
      };
    case 'not-a-device':
      return {
        hint: 'Un simulateur ne reçoit pas de notifications. Le digest arrivera sur ton téléphone.',
      };
    case 'no-project-id':
      return { hint: 'Cette version de l’app ne peut pas recevoir de notifications.' };
    case 'write-failed':
      return { hint: 'Cet appareil n’a pas pu être enregistré. Réessaie en rouvrant l’app.' };
    case 'error':
      return {
        hint: 'Impossible d’enregistrer cet appareil pour l’instant. Réessaie en rouvrant l’app.',
      };
  }
}

function Row({ children }: { children: React.ReactNode }) {
  const { colors } = useTheme();
  return <View style={[styles.row, { borderColor: colors.border }]}>{children}</View>;
}

export default function Profile() {
  const { colors, preference, setPreference } = useTheme();
  const { profile, session, updateProfile, signOut } = useAuth();
  const { density, setDensity } = useDensity();
  const { enabled: analyticsEnabled, setEnabled: setAnalyticsEnabled } = useAnalyticsConsent();
  const router = useRouter();
  const { acceptedFriends, incoming } = useFriends();
  const { data: entries } = useWatchEntries();
  const pushStatus = usePushStatus();
  const pausedCount = (entries ?? []).filter((e) => e.snoozed).length;
  const { config: nasConfig } = useNasConfig();
  const configuredServices = SERVICES.filter((s) => nasConfig[s]);
  const notice = digestNotice(pushStatus);
  const tabBarClearance = useTabBarClearance();

  const changeSetting = <T extends string>(setting: string, value: T, apply: (v: T) => void) => {
    apply(value);
    track('setting_changed', { setting, value });
  };

  const themeOptions: { key: ThemePref; label: string }[] = [
    { key: 'system', label: 'Système' },
    { key: 'light', label: 'Clair' },
    { key: 'dark', label: 'Sombre' },
  ];
  const densityOptions: { key: Density; label: string }[] = [
    { key: 'comfortable', label: 'Confort' },
    { key: 'compact', label: 'Dense' },
  ];

  return (
    <Screen
      title={profile?.username ?? 'Profil'}
      padded={false}
      headerRight={
        <Pressable onPress={() => router.push('/edit-profile')} hitSlop={8} accessibilityRole="button">
          <Text style={{ color: colors.accentInk, fontSize: 15, fontWeight: '600' }}>Modifier</Text>
        </Pressable>
      }
    >
      <ScrollView
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: tabBarClearance }}
        showsVerticalScrollIndicator={false}
      >
        <SectionHeader>Amis</SectionHeader>
        <Pressable
          onPress={() => router.push('/friends')}
          style={[styles.soon, { backgroundColor: colors.surface, borderColor: colors.border }]}
          accessibilityRole="button"
        >
          <Ionicons name="people-outline" size={22} color={colors.textSecondary} />
          <View style={{ flex: 1 }}>
            <Text style={[styles.soonTitle, { color: colors.textPrimary }]}>
              {acceptedFriends.length > 0
                ? `${acceptedFriends.length} ami${acceptedFriends.length > 1 ? 's' : ''}`
                : 'Ajouter des amis'}
            </Text>
            <Text style={[styles.soonText, { color: colors.textSecondary }]}>
              Vois l’activité passive de tes proches.
            </Text>
          </View>
          {incoming.length > 0 ? (
            <View style={[styles.badge, { backgroundColor: colors.accent }]}>
              <Text style={[styles.badgeText, { color: colors.accentText }]}>{incoming.length}</Text>
            </View>
          ) : null}
          <Ionicons name="chevron-forward" size={20} color={colors.textMeta} />
        </Pressable>

        <SectionHeader>Ma liste</SectionHeader>
        <Pressable
          onPress={() => router.push('/paused')}
          style={[styles.soon, { backgroundColor: colors.surface, borderColor: colors.border }]}
          accessibilityRole="button"
        >
          <Ionicons name="pause-circle-outline" size={22} color={colors.textSecondary} />
          <View style={{ flex: 1 }}>
            <Text style={[styles.soonTitle, { color: colors.textPrimary }]}>
              {pausedCount > 0 ? `${pausedCount} en pause` : 'En pause'}
            </Text>
            <Text style={[styles.soonText, { color: colors.textSecondary }]}>
              Les titres que tu as mis de côté.
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color={colors.textMeta} />
        </Pressable>

        <SectionHeader>NAS</SectionHeader>
        <Pressable
          onPress={() => router.push('/nas')}
          style={[styles.soon, { backgroundColor: colors.surface, borderColor: colors.border }]}
          accessibilityRole="button"
        >
          <Ionicons name="server-outline" size={22} color={colors.textSecondary} />
          <View style={{ flex: 1 }}>
            <Text style={[styles.soonTitle, { color: colors.textPrimary }]}>Téléchargements</Text>
            <Text style={[styles.soonText, { color: colors.textSecondary }]}>
              {configuredServices.length > 0
                ? `Configuré : ${configuredServices.map((s) => serviceLabels[s]).join(', ')}`
                : 'Branche Radarr et Sonarr pour télécharger depuis l’app.'}
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color={colors.textMeta} />
        </Pressable>

        <SectionHeader>Affichage</SectionHeader>
        <Row>
          <Text style={[styles.label, { color: colors.textPrimary }]}>Thème</Text>
          <Segmented
            options={themeOptions}
            value={preference}
            onChange={(v) => changeSetting('theme', v, setPreference)}
          />
        </Row>
        <Row>
          <Text style={[styles.label, { color: colors.textPrimary }]}>Densité</Text>
          <Segmented
            options={densityOptions}
            value={density}
            onChange={(v) => changeSetting('density', v, setDensity)}
          />
        </Row>

        <SectionHeader>Notifications</SectionHeader>
        <Row>
          <View style={{ flex: 1 }}>
            <Text style={[styles.label, { color: colors.textPrimary }]}>Digest quotidien</Text>
            {notice ? (
              <>
                <Text style={[styles.hint, { color: colors.danger }]}>{notice.hint}</Text>
                {notice.openSettings ? (
                  <Text
                    onPress={() => void Linking.openSettings()}
                    style={[styles.hintAction, { color: colors.accentInk }]}
                    accessibilityRole="button"
                  >
                    Ouvrir les Réglages
                  </Text>
                ) : null}
              </>
            ) : null}
          </View>
          <Switch
            value={profile?.digest_enabled ?? true}
            onValueChange={(v) =>
              changeSetting('digest', String(v), () => void updateProfile({ digest_enabled: v }))
            }
            // Off-brand track while no token exists: the preference is still on,
            // but nothing can be delivered, so it mustn't read as armed.
            trackColor={{ true: notice ? colors.border : colors.accent }}
          />
        </Row>
        <Row>
          <View style={{ flex: 1 }}>
            <Text style={[styles.label, { color: colors.textPrimary }]}>Amis</Text>
            <Text style={[styles.hint, { color: colors.textMeta }]}>
              Être prévenu quand quelqu’un t’ajoute ou accepte ta demande.
            </Text>
          </View>
          <Switch
            value={profile?.friend_requests_enabled ?? true}
            onValueChange={(v) =>
              changeSetting('friend_requests', String(v), () =>
                void updateProfile({ friend_requests_enabled: v }),
              )
            }
            trackColor={{ true: colors.accent }}
          />
        </Row>
        <Row>
          <View style={{ flex: 1 }}>
            <Text style={[styles.label, { color: colors.textPrimary }]}>Activité visible</Text>
            <Text style={[styles.hint, { color: colors.textMeta }]}>
              Autorise tes amis à voir ce que tu regardes.
            </Text>
          </View>
          <Switch
            value={profile?.activity_visible ?? true}
            onValueChange={(v) =>
              changeSetting('activity_visible', String(v), () =>
                void updateProfile({ activity_visible: v }),
              )
            }
            trackColor={{ true: colors.accent }}
          />
        </Row>

        <SectionHeader>Confidentialité</SectionHeader>
        <Row>
          <View style={{ flex: 1 }}>
            <Text style={[styles.label, { color: colors.textPrimary }]}>
              Partager les statistiques d’usage
            </Text>
            <Text style={[styles.hint, { color: colors.textMeta }]}>
              Des événements d’usage pour améliorer l’app. Jamais ton e-mail, tes recherches ni tes
              notes.
            </Text>
          </View>
          <Switch
            value={analyticsEnabled}
            onValueChange={(v) => {
              // Order matters when turning it on: consent first, or the event
              // has nothing to go out through. Turning it off records nothing.
              setAnalyticsEnabled(v);
              if (v) track('setting_changed', { setting: 'analytics', value: 'on' });
            }}
            trackColor={{ true: colors.accent }}
          />
        </Row>

        <SectionHeader>Compte</SectionHeader>
        <Row>
          <Text style={[styles.label, { color: colors.textSecondary }]}>{session?.user.email}</Text>
        </Row>
        <Button
          label="Se déconnecter"
          variant="secondary"
          onPress={() => void signOut()}
          style={{ marginTop: 16 }}
        />
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  soon: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    borderWidth: 1,
    borderRadius: 14,
    padding: 16,
  },
  soonTitle: { fontSize: 15, fontWeight: '700', marginBottom: 2 },
  soonText: { fontSize: 13, lineHeight: 18 },
  badge: {
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  badgeText: { fontSize: 12, fontWeight: '800' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    paddingVertical: 16,
    gap: 12,
  },
  label: { fontSize: 16, fontWeight: '500' },
  hint: { fontSize: 12, marginTop: 2 },
  hintAction: { fontSize: 12, fontWeight: '700', marginTop: 6 },
  segment: { flexDirection: 'row', borderRadius: 10, padding: 3 },
  segmentItem: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
    fontSize: 13,
    fontWeight: '600',
    overflow: 'hidden',
    textAlign: 'center',
  },
});
