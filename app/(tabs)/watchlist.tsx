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

import { AnimatedCheck } from '@/components/AnimatedCheck';
import { CardRow } from '@/components/CardRow';
import { Collapsible } from '@/components/Collapsible';
import { EmptyState } from '@/components/EmptyState';
import { Fab } from '@/components/Fab';
import { Screen } from '@/components/Screen';
import { SectionHeader } from '@/components/SectionHeader';
import { useDensity } from '@/contexts/DensityContext';
import { useTheme } from '@/contexts/ThemeContext';
import { useMarkNext } from '@/features/episodes/useMarkNext';
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

/** In-progress series banner: artwork, next episode, progress bar, and a quick
 *  check to mark the next episode watched without opening the detail. */
function WatchingRow({ card, onPress }: { card: NowWatchingCardData; onPress: () => void }) {
  const markNext = useMarkNext();
  const ep = card.nextEpisode;
  // Only offer the quick-check when the next episode has actually aired — you
  // can't have watched one that isn't out yet, and "no air date" means an
  // announced-but-unscheduled episode, not an available one.
  const canMark = !!ep?.airDate && daysFromToday(ep.airDate) <= 0;
  const markSeen = () => {
    if (!ep) return;
    markNext.mutate({
      entryId: card.entry.id,
      episode: { seasonNumber: ep.seasonNumber, episodeNumber: ep.episodeNumber },
      watchedBefore: card.watched,
      total: card.total,
    });
  };
  return (
    <CardRow
      seed={`${card.entry.media.tmdb_id}`}
      title={card.entry.media.title}
      posterPath={card.entry.media.poster_path}
      backdropPath={card.entry.media.backdrop_path}
      subtitle={card.subtitle}
      progress={card.progress}
      onPress={onPress}
      right={
        canMark && ep ? (
          <AnimatedCheck
            resetKey={`${ep.seasonNumber}-${ep.episodeNumber}`}
            onMark={markSeen}
            accessibilityLabel={`Marquer S${ep.seasonNumber}E${ep.episodeNumber} vu`}
          />
        ) : undefined
      }
    />
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
  const { refreshing, onRefresh } = usePullRefresh([['watch_entries'], ['progress_all'], ['media_details']]);
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
            <ActivityIndicator color={colors.accentInk} />
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
                <CardRow
                  key={item.id}
                  seed={`${item.media.tmdb_id}`}
                  title={item.media.title}
                  posterPath={item.media.poster_path}
                  backdropPath={item.media.backdrop_path}
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
});
