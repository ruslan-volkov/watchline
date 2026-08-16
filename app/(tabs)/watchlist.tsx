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
  View,
} from 'react-native';

import { Collapsible } from '@/components/Collapsible';
import { EmptyState } from '@/components/EmptyState';
import { Fab } from '@/components/Fab';
import { ListRow } from '@/components/ListRow';
import { PosterPlaceholder } from '@/components/PosterPlaceholder';
import { ProgressBar } from '@/components/ProgressBar';
import { Screen } from '@/components/Screen';
import { SectionHeader } from '@/components/SectionHeader';
import { useDensity } from '@/contexts/DensityContext';
import { useTheme } from '@/contexts/ThemeContext';
import { useNowWatching, type NowWatchingCardData } from '@/features/watch/useNowWatching';
import { useWatchEntries } from '@/features/watch/useWatchEntries';
import { usePullRefresh } from '@/hooks/usePullRefresh';
import { useTabBarClearance } from '@/theme/layout';
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

/** Collapsible section with a tappable header (title · count + chevron). */
function Section({
  title,
  count,
  open,
  onToggle,
  children,
}: {
  title: string;
  count: number;
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  const { colors } = useTheme();
  return (
    <View>
      <Pressable onPress={onToggle} style={styles.sectionHeader} accessibilityRole="button">
        <SectionHeader>{`${title} · ${count}`}</SectionHeader>
        <Ionicons
          name={open ? 'chevron-up' : 'chevron-down'}
          size={18}
          color={colors.textMeta}
        />
      </Pressable>
      <Collapsible open={open}>{children}</Collapsible>
    </View>
  );
}

/** In-progress series row: poster, next episode, and a progress bar. */
function WatchingRow({ card, onPress }: { card: NowWatchingCardData; onPress: () => void }) {
  const { colors } = useTheme();
  return (
    <Pressable onPress={onPress} style={styles.watchRow} accessibilityRole="button">
      <PosterPlaceholder
        seed={`${card.entry.media.tmdb_id}`}
        title={card.entry.media.title}
        posterPath={card.entry.media.poster_path}
        width={48}
      />
      <View style={styles.watchText}>
        <Text numberOfLines={1} style={[styles.watchTitle, { color: colors.textPrimary }]}>
          {card.entry.media.title}
        </Text>
        <Text numberOfLines={1} style={[styles.watchSub, { color: colors.textSecondary }]}>
          {card.subtitle}
        </Text>
        <ProgressBar
          progress={card.progress}
          color={colors.accent}
          trackColor={colors.surfaceAlt}
          height={5}
          style={{ marginTop: 6 }}
        />
      </View>
    </Pressable>
  );
}

export default function Watchlist() {
  const { colors } = useTheme();
  const { spacing } = useDensity();
  const router = useRouter();
  const { data: entries, isLoading } = useWatchEntries();
  const { cards } = useNowWatching();
  const [filter, setFilter] = useState<Filter>('all');
  const [enCoursOpen, setEnCoursOpen] = useState(true);
  const [aVoirOpen, setAVoirOpen] = useState(true);
  const { refreshing, onRefresh } = usePullRefresh([['watch_entries'], ['progress_all']]);
  const tabBarClearance = useTabBarClearance();

  // "À voir" — not-yet-started titles.
  const items = useMemo(
    () =>
      (entries ?? [])
        .filter((e) => e.status === 'plan_to_watch' && !e.snoozed)
        .filter((e) => filter === 'all' || e.media.media_type === filter),
    [entries, filter],
  );
  // "En cours" — series being watched (always TV; hidden under the Films filter).
  const watching = useMemo(() => (filter === 'movie' ? [] : cards), [cards, filter]);

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

      {items.length === 0 && watching.length === 0 ? (
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
        <ScrollView
          contentContainerStyle={{
            paddingHorizontal: spacing.screenPadding,
            paddingBottom: tabBarClearance + 72,
          }}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={colors.textSecondary}
            />
          }
        >
          {watching.length > 0 ? (
            <Section
              title="En cours"
              count={watching.length}
              open={enCoursOpen}
              onToggle={() => setEnCoursOpen((v) => !v)}
            >
              {watching.map((c) => (
                <WatchingRow
                  key={c.entry.id}
                  card={c}
                  onPress={() => openMedia(c.entry.media.tmdb_id, 'tv')}
                />
              ))}
            </Section>
          ) : null}

          {items.length > 0 ? (
            <Section
              title="À voir"
              count={items.length}
              open={aVoirOpen}
              onToggle={() => setAVoirOpen((v) => !v)}
            >
              {items.map((item) => (
                <ListRow
                  key={item.id}
                  seed={`${item.media.tmdb_id}`}
                  title={item.media.title}
                  posterPath={item.media.poster_path}
                  subtitle={subtitleFor(item)}
                  onPress={() => openMedia(item.media.tmdb_id, item.media.media_type)}
                />
              ))}
            </Section>
          ) : null}
        </ScrollView>
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
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  watchRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8 },
  watchText: { flex: 1, marginLeft: 12 },
  watchTitle: { fontSize: 16, fontWeight: '600', marginBottom: 2 },
  watchSub: { fontSize: 13, fontWeight: '500' },
});
