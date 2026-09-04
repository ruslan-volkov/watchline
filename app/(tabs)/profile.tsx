import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';

import { Button } from '@/components/Button';
import { Screen } from '@/components/Screen';
import { SectionHeader } from '@/components/SectionHeader';
import { useAuth } from '@/contexts/AuthContext';
import { useDensity } from '@/contexts/DensityContext';
import { useTheme } from '@/contexts/ThemeContext';
import { useFriends } from '@/features/friends/useFriends';
import { useWatchEntries } from '@/features/watch/useWatchEntries';
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

function Row({ children }: { children: React.ReactNode }) {
  const { colors } = useTheme();
  return <View style={[styles.row, { borderColor: colors.border }]}>{children}</View>;
}

export default function Profile() {
  const { colors, preference, setPreference } = useTheme();
  const { profile, session, updateProfile, signOut } = useAuth();
  const { density, setDensity } = useDensity();
  const router = useRouter();
  const { acceptedFriends, incoming } = useFriends();
  const { data: entries } = useWatchEntries();
  const pausedCount = (entries ?? []).filter((e) => e.snoozed).length;
  const tabBarClearance = useTabBarClearance();

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

        <SectionHeader>Affichage</SectionHeader>
        <Row>
          <Text style={[styles.label, { color: colors.textPrimary }]}>Thème</Text>
          <Segmented options={themeOptions} value={preference} onChange={setPreference} />
        </Row>
        <Row>
          <Text style={[styles.label, { color: colors.textPrimary }]}>Densité</Text>
          <Segmented options={densityOptions} value={density} onChange={setDensity} />
        </Row>

        <SectionHeader>Notifications</SectionHeader>
        <Row>
          <Text style={[styles.label, { color: colors.textPrimary }]}>Digest quotidien</Text>
          <Switch
            value={profile?.digest_enabled ?? true}
            onValueChange={(v) => void updateProfile({ digest_enabled: v })}
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
            onValueChange={(v) => void updateProfile({ activity_visible: v })}
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
