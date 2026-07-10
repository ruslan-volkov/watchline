import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { EmptyState } from '@/components/EmptyState';
import { Fab } from '@/components/Fab';
import { ListRow } from '@/components/ListRow';
import { Screen } from '@/components/Screen';
import { useDensity } from '@/contexts/DensityContext';
import { useTheme } from '@/contexts/ThemeContext';
import { useWatchEntries } from '@/features/watch/useWatchEntries';
import { usePullRefresh } from '@/hooks/usePullRefresh';
import { daysFromToday, releaseSubtitle } from '@/utils/timeGrouping';
import type { EntryWithMedia } from '@/features/watch/api';
import type { MediaType } from '@/media/types';

type Filter = 'all' | 'movie' | 'tv';
const FILTERS: { key: Filter; label: string }[] = [
  { key: 'all', label: 'Tout' },
  { key: 'movie', label: 'Films' },
  { key: 'tv', label: 'Séries' },
];

function subtitleFor(entry: EntryWithMedia): string {
  const { release_date, media_type } = entry.media;
  if (release_date && daysFromToday(release_date) > 0) {
    return releaseSubtitle(release_date, media_type === 'movie' ? 'movie' : 'episode');
  }
  return media_type === 'movie' ? 'Disponible' : 'Disponible';
}

export default function Watchlist() {
  const { colors } = useTheme();
  const { spacing } = useDensity();
  const router = useRouter();
  const { data: entries, isLoading } = useWatchEntries();
  const [filter, setFilter] = useState<Filter>('all');
  const { refreshing, onRefresh } = usePullRefresh([['watch_entries']]);

  const items = useMemo(
    () =>
      (entries ?? [])
        .filter((e) => e.status === 'plan_to_watch' && !e.snoozed)
        .filter((e) => filter === 'all' || e.media.media_type === filter),
    [entries, filter],
  );

  const openMedia = (tmdbId: number, type: MediaType) =>
    router.push({ pathname: '/media/[id]', params: { id: String(tmdbId), type } });

  return (
    <Screen padded={false}>
      <View style={[styles.filters, { paddingHorizontal: spacing.screenPadding }]}>
        {FILTERS.map((f) => {
          const active = filter === f.key;
          return (
            <Pressable
              key={f.key}
              onPress={() => setFilter(f.key)}
              style={[
                styles.chip,
                { backgroundColor: active ? colors.accent : colors.surfaceAlt },
              ]}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
            >
              <Text
                style={[styles.chipText, { color: active ? colors.accentText : colors.textSecondary }]}
              >
                {f.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {items.length === 0 ? (
        isLoading ? (
          <View style={styles.loading}>
            <ActivityIndicator color={colors.accent} />
          </View>
        ) : (
          <EmptyState
            icon="bookmark-outline"
            title="Ta watchlist est vide"
            message="Garde ici les films et séries que tu veux voir — tu les retrouveras au bon moment."
            actionLabel="Ajouter un titre"
            onAction={() => router.push('/search')}
          />
        )
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ paddingHorizontal: spacing.screenPadding, paddingBottom: 24 }}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={colors.textSecondary}
            />
          }
          renderItem={({ item }) => (
            <ListRow
              seed={`${item.media.tmdb_id}`}
              title={item.media.title}
              posterPath={item.media.poster_path}
              subtitle={subtitleFor(item)}
              onPress={() => openMedia(item.media.tmdb_id, item.media.media_type)}
            />
          )}
        />
      )}
      <Fab onPress={() => router.push('/search')} accessibilityLabel="Ajouter un titre" />
    </Screen>
  );
}

const styles = StyleSheet.create({
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  filters: { flexDirection: 'row', gap: 8, paddingBottom: 8 },
  chip: { paddingHorizontal: 16, paddingVertical: 7, borderRadius: 999 },
  chipText: { fontSize: 14, fontWeight: '600' },
});
