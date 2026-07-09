import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Avatar } from '@/components/Avatar';
import { SectionHeader } from '@/components/SectionHeader';
import { useTheme } from '@/contexts/ThemeContext';
import { useFriendMutations } from '@/features/friends/useFriendMutations';
import { useFriends } from '@/features/friends/useFriends';
import { useUserSearch } from '@/features/friends/useUserSearch';
import { usePullRefresh } from '@/hooks/usePullRefresh';

export default function Friends() {
  const { colors } = useTheme();
  const router = useRouter();
  const { me, acceptedFriends, incoming, outgoing, other, activityByUser } = useFriends();
  const { send, accept, remove } = useFriendMutations();
  const { refreshing, onRefresh } = usePullRefresh([['friendships'], ['friend_activity']]);

  const openProfile = (id: string, username?: string | null) =>
    router.push({ pathname: '/friend/[id]', params: { id, name: username ?? '' } });

  const [query, setQuery] = useState('');
  const { data: results, isFetching } = useUserSearch(query);
  const searching = query.trim().length >= 2;

  // Relationship state per user id, to pick the right action in search results.
  const relation = useMemo(() => {
    const map = new Map<string, 'friend' | 'outgoing' | 'incoming'>();
    for (const a of acceptedFriends) if (a.profile) map.set(a.profile.id, 'friend');
    for (const f of outgoing) if (f.addressee) map.set(f.addressee.id, 'outgoing');
    for (const f of incoming) if (f.requester) map.set(f.requester.id, 'incoming');
    return map;
  }, [acceptedFriends, outgoing, incoming]);

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: colors.bg }]} edges={['top']}>
      <View style={styles.topBar}>
        <Pressable onPress={() => router.back()} hitSlop={10} accessibilityRole="button">
          <Ionicons name="chevron-back" size={26} color={colors.textPrimary} />
        </Pressable>
        <Text style={[styles.title, { color: colors.textPrimary }]}>Amis</Text>
        <View style={{ width: 26 }} />
      </View>

      <View style={[styles.searchBox, { backgroundColor: colors.surfaceAlt }]}>
        <Ionicons name="search" size={18} color={colors.textMeta} />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Ajouter par pseudo"
          placeholderTextColor={colors.textMeta}
          autoCapitalize="none"
          style={[styles.input, { color: colors.textPrimary }]}
        />
        {query ? (
          <Pressable onPress={() => setQuery('')} hitSlop={8}>
            <Ionicons name="close-circle" size={18} color={colors.textMeta} />
          </Pressable>
        ) : null}
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.textSecondary} />
        }
      >
        {searching ? (
          <>
            <SectionHeader>Résultats</SectionHeader>
            {isFetching ? (
              <ActivityIndicator color={colors.accent} style={{ marginTop: 16 }} />
            ) : (results ?? []).length === 0 ? (
              <Text style={[styles.quiet, { color: colors.textMeta }]}>
                Aucun pseudo ne correspond.
              </Text>
            ) : (
              (results ?? []).map((u) => {
                const rel = relation.get(u.id);
                return (
                  <View key={u.id} style={styles.row}>
                    <Pressable
                      style={styles.friendMain}
                      onPress={() => openProfile(u.id, u.username)}
                      accessibilityRole="button"
                    >
                      <Avatar name={u.username} avatarUrl={u.avatar_url} seed={u.id} />
                      <Text style={[styles.name, { color: colors.textPrimary }]} numberOfLines={1}>
                        {u.username}
                      </Text>
                    </Pressable>
                    {rel === 'friend' ? (
                      <Text style={[styles.badge, { color: colors.textMeta }]}>Ami</Text>
                    ) : rel === 'outgoing' ? (
                      <Text style={[styles.badge, { color: colors.textMeta }]}>Envoyée</Text>
                    ) : rel === 'incoming' ? (
                      <Text style={[styles.badge, { color: colors.accent }]}>Vous a ajouté</Text>
                    ) : (
                      <Pressable
                        onPress={() => send.mutate(u.id)}
                        style={[styles.action, { backgroundColor: colors.accent }]}
                        accessibilityRole="button"
                      >
                        <Text style={[styles.actionText, { color: colors.accentText }]}>Ajouter</Text>
                      </Pressable>
                    )}
                  </View>
                );
              })
            )}
          </>
        ) : (
          <>
            {incoming.length > 0 ? (
              <>
                <SectionHeader>Demandes reçues</SectionHeader>
                {incoming.map((f) => (
                  <View key={f.id} style={styles.row}>
                    <Pressable
                      style={styles.friendMain}
                      onPress={() => openProfile(f.user_id, f.requester?.username)}
                      accessibilityRole="button"
                    >
                      <Avatar name={f.requester?.username} avatarUrl={f.requester?.avatar_url} seed={f.user_id} />
                      <Text style={[styles.name, { color: colors.textPrimary }]} numberOfLines={1}>
                        {f.requester?.username ?? 'Utilisateur'}
                      </Text>
                    </Pressable>
                    <Pressable
                      onPress={() => accept.mutate(f.id)}
                      style={[styles.action, { backgroundColor: colors.accent }]}
                      accessibilityRole="button"
                    >
                      <Text style={[styles.actionText, { color: colors.accentText }]}>Accepter</Text>
                    </Pressable>
                    <Pressable onPress={() => remove.mutate(f.id)} hitSlop={8} style={styles.decline}>
                      <Ionicons name="close" size={20} color={colors.textMeta} />
                    </Pressable>
                  </View>
                ))}
              </>
            ) : null}

            <SectionHeader>Mes amis</SectionHeader>
            {acceptedFriends.length === 0 ? (
              <Text style={[styles.quiet, { color: colors.textMeta }]}>
                Personne pour l’instant. Ajoute un ami par son pseudo ci-dessus.
              </Text>
            ) : (
              acceptedFriends.map(({ friendship, profile }) => {
                const activity = profile ? activityByUser.get(profile.id) : undefined;
                return (
                  <View key={friendship.id} style={styles.row}>
                    <Pressable
                      style={styles.friendMain}
                      onPress={() =>
                        profile &&
                        router.push({
                          pathname: '/friend/[id]',
                          params: { id: profile.id, name: profile.username ?? '' },
                        })
                      }
                      accessibilityRole="button"
                    >
                      <Avatar name={profile?.username} avatarUrl={profile?.avatar_url} seed={profile?.id} />
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.name, { color: colors.textPrimary }]} numberOfLines={1}>
                          {profile?.username ?? 'Utilisateur'}
                        </Text>
                        <Text style={[styles.activity, { color: colors.textSecondary }]} numberOfLines={1}>
                          {activity ? `Regarde ${activity.title}` : 'Activité masquée'}
                        </Text>
                      </View>
                    </Pressable>
                    <Pressable onPress={() => remove.mutate(friendship.id)} hitSlop={8}>
                      <Ionicons name="ellipsis-horizontal" size={20} color={colors.textMeta} />
                    </Pressable>
                  </View>
                );
              })
            )}

            {outgoing.length > 0 ? (
              <>
                <SectionHeader>Demandes envoyées</SectionHeader>
                {outgoing.map((f) => (
                  <View key={f.id} style={styles.row}>
                    <Pressable
                      style={styles.friendMain}
                      onPress={() => openProfile(f.friend_id, f.addressee?.username)}
                      accessibilityRole="button"
                    >
                      <Avatar name={f.addressee?.username} avatarUrl={f.addressee?.avatar_url} seed={f.friend_id} />
                      <Text style={[styles.name, { color: colors.textPrimary }]} numberOfLines={1}>
                        {f.addressee?.username ?? 'Utilisateur'}
                      </Text>
                    </Pressable>
                    <Text style={[styles.badge, { color: colors.textMeta }]}>En attente</Text>
                    <Pressable onPress={() => remove.mutate(f.id)} hitSlop={8} style={styles.decline}>
                      <Ionicons name="close" size={20} color={colors.textMeta} />
                    </Pressable>
                  </View>
                ))}
              </>
            ) : null}
          </>
        )}
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
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 44,
    borderRadius: 12,
    paddingHorizontal: 12,
    gap: 8,
    marginHorizontal: 20,
    marginBottom: 4,
  },
  input: { flex: 1, fontSize: 16 },
  content: { paddingHorizontal: 20 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 8 },
  friendMain: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12 },
  name: { flex: 1, fontSize: 16, fontWeight: '600' },
  activity: { fontSize: 13, marginTop: 1 },
  badge: { fontSize: 13, fontWeight: '600' },
  action: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 999 },
  actionText: { fontSize: 14, fontWeight: '700' },
  decline: { padding: 2 },
  quiet: { fontSize: 14, marginTop: 8 },
});
