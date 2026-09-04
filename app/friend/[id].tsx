import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Avatar } from '@/components/Avatar';
import { EmptyState } from '@/components/EmptyState';
import { ListRow } from '@/components/ListRow';
import { PosterPlaceholder } from '@/components/PosterPlaceholder';
import { RatingStars } from '@/components/RatingStars';
import { SectionHeader } from '@/components/SectionHeader';
import { useTheme } from '@/contexts/ThemeContext';
import { fetchEntries } from '@/features/watch/api';
import type { MediaType } from '@/media/types';

export default function FriendProfile() {
  const { colors } = useTheme();
  const router = useRouter();
  const params = useLocalSearchParams<{ id: string; name?: string }>();
  const friendId = params.id;
  const name = params.name ?? 'Ami';

  const { data: entries, isLoading } = useQuery({
    queryKey: ['friend_entries', friendId],
    queryFn: () => fetchEntries(friendId),
    enabled: !!friendId,
  });

  const watching = useMemo(
    () => (entries ?? []).filter((e) => e.status === 'watching'),
    [entries],
  );
  const completed = useMemo(
    () =>
      (entries ?? [])
        .filter((e) => e.status === 'completed')
        .sort((a, b) => b.updated_at.localeCompare(a.updated_at)),
    [entries],
  );

  const openMedia = (tmdbId: number, type: MediaType) =>
    router.push({ pathname: '/media/[id]', params: { id: String(tmdbId), type } });

  const cols = 3;
  const gap = 12;
  const posterW = (Dimensions.get('window').width - 20 * 2 - gap * (cols - 1)) / cols;
  const empty = !isLoading && (entries?.length ?? 0) === 0;

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: colors.bg }]} edges={['top']}>
      <View style={styles.topBar}>
        <Pressable onPress={() => router.back()} hitSlop={10} accessibilityRole="button">
          <Ionicons name="chevron-back" size={26} color={colors.textPrimary} />
        </Pressable>
        <Text style={[styles.title, { color: colors.textPrimary }]} numberOfLines={1}>
          {name}
        </Text>
        <View style={{ width: 26 }} />
      </View>

      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.accentInk} />
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <View style={styles.header}>
            <Avatar name={name} seed={friendId} size={72} />
            <Text style={[styles.name, { color: colors.textPrimary }]}>{name}</Text>
          </View>

          {empty ? (
            <EmptyState
              icon="eye-off-outline"
              title="Activité masquée"
              message="Cet ami ne partage pas son activité, ou n'a rien suivi pour l'instant."
            />
          ) : (
            <>
              {watching.length > 0 ? (
                <>
                  <SectionHeader>En ce moment</SectionHeader>
                  {watching.map((e) => (
                    <ListRow
                      key={e.id}
                      seed={`${e.media.tmdb_id}`}
                      title={e.media.title}
                      posterPath={e.media.poster_path}
                      subtitle={e.media.media_type === 'tv' ? 'Série' : 'Film'}
                      onPress={() => openMedia(e.media.tmdb_id, e.media.media_type)}
                    />
                  ))}
                </>
              ) : null}

              {completed.length > 0 ? (
                <>
                  <SectionHeader>{`Vus · ${completed.length}`}</SectionHeader>
                  <View style={styles.grid}>
                    {completed.map((e) => (
                      <Pressable
                        key={e.id}
                        style={{ width: posterW }}
                        onPress={() => openMedia(e.media.tmdb_id, e.media.media_type)}
                        accessibilityRole="button"
                      >
                        <PosterPlaceholder
                          seed={`${e.media.tmdb_id}`}
                          title={e.media.title}
                          posterPath={e.media.poster_path}
                          width={posterW}
                        />
                        <Text numberOfLines={1} style={[styles.posterTitle, { color: colors.textPrimary }]}>
                          {e.media.title}
                        </Text>
                        {e.rating ? <RatingStars value={e.rating} size={12} /> : null}
                      </Pressable>
                    ))}
                  </View>
                </>
              ) : null}
            </>
          )}
          <View style={{ height: 40 }} />
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    height: 44,
  },
  title: { fontSize: 18, fontWeight: '700', flex: 1, textAlign: 'center' },
  content: { paddingHorizontal: 20 },
  header: { alignItems: 'center', marginTop: 8, marginBottom: 8 },
  name: { fontSize: 20, fontWeight: '700', marginTop: 10 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  posterTitle: { fontSize: 13, fontWeight: '600', marginTop: 6, marginBottom: 2 },
});
