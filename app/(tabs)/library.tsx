import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { EmptyState } from '@/components/EmptyState';
import { PosterPlaceholder } from '@/components/PosterPlaceholder';
import { RatingStars } from '@/components/RatingStars';
import { Screen } from '@/components/Screen';
import { useDensity } from '@/contexts/DensityContext';
import { useTheme } from '@/contexts/ThemeContext';
import { fetchProgressForEntries } from '@/features/episodes/api';
import { useWatchEntries } from '@/features/watch/useWatchEntries';
import { usePullRefresh } from '@/hooks/usePullRefresh';
import { useTabBarClearance } from '@/theme/layout';
import type { EntryWithMedia } from '@/features/watch/api';
import type { MediaType } from '@/media/types';

type Sort = 'recent' | 'rating' | 'az';
const SORTS: { key: Sort; label: string }[] = [
  { key: 'recent', label: 'Récent' },
  { key: 'rating', label: 'Mieux notés' },
  { key: 'az', label: 'A-Z' },
];

function Counter({ value, label }: { value: number | string; label: string }) {
  const { colors } = useTheme();
  return (
    <View style={styles.counter}>
      <Text style={[styles.counterValue, { color: colors.textPrimary }]}>{value}</Text>
      <Text style={[styles.counterLabel, { color: colors.textMeta }]}>{label}</Text>
    </View>
  );
}

export default function Library() {
  const { colors } = useTheme();
  const { spacing } = useDensity();
  const router = useRouter();
  const { data: entries, isLoading } = useWatchEntries();
  const [sort, setSort] = useState<Sort>('recent');
  const { refreshing, onRefresh } = usePullRefresh([['watch_entries'], ['progress_all']]);
  const tabBarClearance = useTabBarClearance();

  const allIds = useMemo(() => (entries ?? []).map((e) => e.id), [entries]);
  const { data: progressRows } = useQuery({
    queryKey: ['progress_all', allIds],
    queryFn: () => fetchProgressForEntries(allIds),
    enabled: allIds.length > 0,
  });

  const stats = useMemo(() => {
    const list = entries ?? [];
    const rated = list.filter((e) => e.status === 'completed' && e.rating != null);
    const avg = rated.length
      ? rated.reduce((s, e) => s + (e.rating ?? 0), 0) / rated.length
      : null;
    return {
      movies: list.filter((e) => e.media.media_type === 'movie' && e.status === 'completed').length,
      series: list.filter((e) => e.media.media_type === 'tv' && e.status === 'completed').length,
      episodes: progressRows?.length ?? 0,
      watching: list.filter((e) => e.status === 'watching').length,
      planned: list.filter((e) => e.status === 'plan_to_watch').length,
      avg: avg != null ? avg.toFixed(1).replace('.', ',') : '—',
    };
  }, [entries, progressRows]);

  const completed = useMemo(() => {
    const list = (entries ?? []).filter((e) => e.status === 'completed');
    const sorted = [...list];
    if (sort === 'az') {
      sorted.sort((a, b) => a.media.title.localeCompare(b.media.title));
    } else if (sort === 'rating') {
      sorted.sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0));
    } else {
      sorted.sort((a, b) => b.updated_at.localeCompare(a.updated_at));
    }
    return sorted;
  }, [entries, sort]);

  const openMedia = (tmdbId: number, type: MediaType) =>
    router.push({ pathname: '/media/[id]', params: { id: String(tmdbId), type } });

  const cols = 3;
  const gap = 12;
  const posterW =
    (Dimensions.get('window').width - spacing.screenPadding * 2 - gap * (cols - 1)) / cols;

  const renderItem = ({ item }: { item: EntryWithMedia }) => (
    <Pressable
      style={{ width: posterW }}
      onPress={() => openMedia(item.media.tmdb_id, item.media.media_type)}
      accessibilityRole="button"
    >
      <PosterPlaceholder
        seed={`${item.media.tmdb_id}`}
        title={item.media.title}
        posterPath={item.media.poster_path}
        width={posterW}
      />
      <Text numberOfLines={1} style={[styles.posterTitle, { color: colors.textPrimary }]}>
        {item.media.title}
      </Text>
      {item.rating ? (
        <RatingStars value={item.rating} size={12} />
      ) : (
        <Text style={[styles.unrated, { color: colors.textMeta }]}>Non notée</Text>
      )}
    </Pressable>
  );

  const header = (
    <View>
      <View style={[styles.counters, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Counter value={stats.movies} label="films vus" />
        <Counter value={stats.series} label="séries vues" />
        <Counter value={stats.episodes} label="épisodes vus" />
        <Counter value={stats.watching} label="en cours" />
        <Counter value={stats.planned} label="à voir" />
        <Counter value={stats.avg} label="note moy." />
      </View>
      <View style={styles.sorts}>
        {SORTS.map((s) => {
          const active = sort === s.key;
          return (
            <Pressable
              key={s.key}
              onPress={() => setSort(s.key)}
              style={[styles.chip, { backgroundColor: active ? colors.accent : colors.surfaceAlt }]}
              accessibilityRole="button"
            >
              <Text
                style={[styles.chipText, { color: active ? colors.accentText : colors.textSecondary }]}
              >
                {s.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );

  return (
    <Screen padded={false}>
      {completed.length === 0 ? (
        isLoading ? (
          <View style={styles.loading}>
            <ActivityIndicator color={colors.accent} />
          </View>
        ) : (
          <>
            <View style={{ paddingHorizontal: spacing.screenPadding }}>{header}</View>
            <EmptyState
              icon="grid-outline"
              title="Aucun historique pour l'instant"
              message="Marque un titre comme vu et il rejoindra ta bibliothèque, avec ta note."
            />
          </>
        )
      ) : (
        <FlatList
          data={completed}
          keyExtractor={(item) => item.id}
          numColumns={cols}
          ListHeaderComponent={header}
          columnWrapperStyle={{ gap }}
          contentContainerStyle={{
            paddingHorizontal: spacing.screenPadding,
            paddingBottom: tabBarClearance,
            gap: 16,
          }}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={colors.textSecondary}
            />
          }
          renderItem={renderItem}
        />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  counters: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    borderRadius: 16,
    borderWidth: 1,
    paddingVertical: 8,
    marginBottom: 16,
  },
  counter: { width: '33.33%', alignItems: 'center', paddingVertical: 10 },
  counterValue: { fontSize: 22, fontWeight: '800' },
  counterLabel: { fontSize: 12, marginTop: 2 },
  sorts: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  chip: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 999 },
  chipText: { fontSize: 13, fontWeight: '600' },
  posterTitle: { fontSize: 13, fontWeight: '600', marginTop: 6, marginBottom: 2 },
  unrated: { fontSize: 11 },
});
