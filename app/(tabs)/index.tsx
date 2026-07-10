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

import { BacklogRow } from '@/components/BacklogRow';
import { EmptyState } from '@/components/EmptyState';
import { Fab } from '@/components/Fab';
import { ListRow } from '@/components/ListRow';
import { NowWatchingCard } from '@/components/NowWatchingCard';
import { RatingSheet } from '@/components/RatingSheet';
import { Screen } from '@/components/Screen';
import { Toast, type ToastState } from '@/components/Toast';
import { SectionHeader } from '@/components/SectionHeader';
import { StatusBadge } from '@/components/StatusBadge';
import { UpcomingCalendar } from '@/components/UpcomingCalendar';
import { useDensity } from '@/contexts/DensityContext';
import { useTheme } from '@/contexts/ThemeContext';
import { useMarkNext } from '@/features/episodes/useMarkNext';
import { useEntryMutations } from '@/features/watch/useEntryMutations';
import { useNowWatching } from '@/features/watch/useNowWatching';
import { useWatchEntries } from '@/features/watch/useWatchEntries';
import { usePullRefresh } from '@/hooks/usePullRefresh';
import { bucketRank, daysFromToday, proximityBucket, releaseSubtitle } from '@/utils/timeGrouping';
import type { MediaType } from '@/media/types';

interface UpcomingItem {
  key: string;
  date: string;
  bucket: string;
  seed: string;
  title: string;
  posterPath: string | null;
  subtitle: string;
  isMovie: boolean;
  tmdbId: number;
  mediaType: MediaType;
}

export default function Timeline() {
  const { colors } = useTheme();
  const { spacing } = useDensity();
  const router = useRouter();
  const { data: entries, isLoading } = useWatchEntries();
  const { cards } = useNowWatching();
  const markNext = useMarkNext();
  const { update } = useEntryMutations();
  const [ratingFor, setRatingFor] = useState<{ entryId: string; title: string } | null>(null);
  const [toast, setToast] = useState<ToastState | null>(null);
  const [backlogOpen, setBacklogOpen] = useState(true);
  const [upcomingView, setUpcomingView] = useState<'list' | 'calendar'>('list');

  const snooze = (entryId: string) => {
    update.mutate({ entryId, patch: { snoozed: true } });
    setToast({
      message: 'Mis en pause',
      onUndo: () => update.mutate({ entryId, patch: { snoozed: false } }),
    });
  };

  const markMovieSeen = (entryId: string, title: string) => {
    update.mutate({
      entryId,
      patch: { status: 'completed', finished_at: new Date().toISOString().slice(0, 10) },
    });
    setRatingFor({ entryId, title });
  };
  const submitRating = (rating: number | null, notes: string | null) => {
    if (ratingFor) update.mutate({ entryId: ratingFor.entryId, patch: { rating, notes } });
    setRatingFor(null);
  };
  const { refreshing, onRefresh } = usePullRefresh([['watch_entries'], ['progress_all']]);

  // "En cours" is open by default, but auto-collapses when its header would fall
  // below the fold (i.e. the content above already fills the screen). A manual
  // tap overrides the auto behavior.
  const [nowWatchingOverride, setNowWatchingOverride] = useState<boolean | null>(null);
  const [viewportH, setViewportH] = useState(0);
  const [nowWatchingY, setNowWatchingY] = useState<number | null>(null);
  const nowWatchingAutoOpen =
    nowWatchingY == null || viewportH === 0 ? true : nowWatchingY < viewportH - 60;
  const nowWatchingOpen = nowWatchingOverride ?? nowWatchingAutoOpen;

  const openMedia = (tmdbId: number, type: MediaType) =>
    router.push({ pathname: '/media/[id]', params: { id: String(tmdbId), type } });

  const upcoming = useMemo<UpcomingItem[]>(() => {
    const items: UpcomingItem[] = [];
    for (const e of entries ?? []) {
      const isMovie = e.media.media_type === 'movie';
      // Movie / series premiere from the watchlist, releasing today or later.
      if (
        e.status === 'plan_to_watch' &&
        !e.snoozed &&
        e.media.release_date &&
        daysFromToday(e.media.release_date) >= 0
      ) {
        items.push({
          key: `entry-${e.id}`,
          date: e.media.release_date,
          bucket: proximityBucket(e.media.release_date),
          seed: `${e.media.tmdb_id}`,
          title: e.media.title,
          posterPath: e.media.poster_path,
          subtitle: releaseSubtitle(e.media.release_date, isMovie ? 'movie' : 'episode'),
          isMovie,
          tmdbId: e.media.tmdb_id,
          mediaType: e.media.media_type,
        });
      }
    }
    // Next unwatched episode of watching series, only if it airs in the future
    // (already-aired ones belong to the "À rattraper" section instead).
    for (const c of cards) {
      const ep = c.nextEpisode;
      if (ep?.airDate && daysFromToday(ep.airDate) > 0) {
        items.push({
          key: `ep-${c.entry.id}`,
          date: ep.airDate,
          bucket: proximityBucket(ep.airDate),
          seed: `${c.entry.media.tmdb_id}`,
          title: c.entry.media.title,
          posterPath: c.entry.media.poster_path,
          subtitle: releaseSubtitle(ep.airDate, 'episode', `S${ep.seasonNumber}E${ep.episodeNumber}`),
          isMovie: false,
          tmdbId: c.entry.media.tmdb_id,
          mediaType: 'tv',
        });
      }
    }
    return items.sort((a, b) => a.date.localeCompare(b.date));
  }, [entries, cards]);

  const grouped = useMemo(() => {
    const map = new Map<string, UpcomingItem[]>();
    for (const item of upcoming) {
      const arr = map.get(item.bucket) ?? [];
      arr.push(item);
      map.set(item.bucket, arr);
    }
    return [...map.entries()].sort((a, b) => {
      const rank = bucketRank(a[0]) - bucketRank(b[0]);
      return rank !== 0 ? rank : a[1][0].date.localeCompare(b[1][0].date);
    });
  }, [upcoming]);

  // Released but unwatched: movies already out + the next aired episode of series.
  const backlog = useMemo(() => {
    const items: {
      key: string;
      seed: string;
      title: string;
      posterPath: string | null;
      subtitle: string;
      tmdbId: number;
      mediaType: MediaType;
      /** The watch entry id — used to snooze (set aside) the title. */
      entryId: string;
      /** Set for released movies: enables the inline "mark seen" check + rating. */
      movieEntryId?: string;
      /** Set for series rows: enables the inline "mark watched" check. */
      episode?: {
        entryId: string;
        seasonNumber: number;
        episodeNumber: number;
        watched: number;
        total: number;
      };
    }[] = [];

    for (const e of entries ?? []) {
      if (e.status === 'plan_to_watch' && !e.snoozed) {
        const rd = e.media.release_date;
        if (!rd || daysFromToday(rd) <= 0) {
          const isMovie = e.media.media_type === 'movie';
          items.push({
            key: `p-${e.id}`,
            seed: `${e.media.tmdb_id}`,
            title: e.media.title,
            posterPath: e.media.poster_path,
            subtitle: isMovie ? 'Sorti · à voir' : 'Dispo · à commencer',
            tmdbId: e.media.tmdb_id,
            mediaType: e.media.media_type,
            entryId: e.id,
            movieEntryId: isMovie ? e.id : undefined,
          });
        }
      }
    }

    // Series: show the specific next episode to watch, if it has already aired
    // (aired = air date today-or-past, or unknown).
    for (const c of cards) {
      const ep = c.nextEpisode;
      if (!ep) continue;
      const aired = !ep.airDate || daysFromToday(ep.airDate) <= 0;
      if (!aired) continue;
      items.push({
        key: `s-${c.entry.id}`,
        seed: `${c.entry.media.tmdb_id}`,
        title: c.entry.media.title,
        posterPath: c.entry.media.poster_path,
        subtitle: `S${ep.seasonNumber}E${ep.episodeNumber} · ${ep.title}`,
        tmdbId: c.entry.media.tmdb_id,
        mediaType: 'tv',
        entryId: c.entry.id,
        episode: {
          entryId: c.entry.id,
          seasonNumber: ep.seasonNumber,
          episodeNumber: ep.episodeNumber,
          watched: c.watched,
          total: c.total,
        },
      });
    }
    return items;
  }, [entries, cards]);

  const hasContent = (entries?.length ?? 0) > 0;
  const cardWidth = 118;

  return (
    <Screen padded={false}>
      {!hasContent ? (
        isLoading ? (
          <View style={styles.loading}>
            <ActivityIndicator color={colors.accent} />
          </View>
        ) : (
          <EmptyState
            icon="planet-outline"
            title="Rien à l'horizon"
            message="Ajoute des titres et retrouve ici leurs prochaines sorties, groupées par échéance."
            actionLabel="Ajouter un titre"
            onAction={() => router.push('/search')}
          />
        )
      ) : (
        <ScrollView
          contentContainerStyle={{ paddingHorizontal: spacing.screenPadding, paddingBottom: 32 }}
          showsVerticalScrollIndicator={false}
          onLayout={(e) => setViewportH(e.nativeEvent.layout.height)}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={colors.textSecondary}
            />
          }
        >
          <View style={[styles.viewToggle, { backgroundColor: colors.surfaceAlt }]}>
            {(['list', 'calendar'] as const).map((v) => {
              const active = upcomingView === v;
              return (
                <Pressable
                  key={v}
                  onPress={() => setUpcomingView(v)}
                  style={[styles.viewToggleItem, active && { backgroundColor: colors.surface }]}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                >
                  <Text
                    style={[
                      styles.viewToggleText,
                      { color: active ? colors.textPrimary : colors.textSecondary },
                    ]}
                  >
                    {v === 'list' ? 'Liste' : 'Calendrier'}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          {upcomingView === 'calendar' ? (
            upcoming.length > 0 ? (
              <UpcomingCalendar
                items={upcoming}
                onOpen={openMedia}
                screenPadding={spacing.screenPadding}
              />
            ) : (
              <Text style={[styles.quiet, { color: colors.textMeta }]}>
                Rien à venir dans ton suivi pour l’instant.
              </Text>
            )
          ) : (
            <>
          {backlog.length > 0 ? (
            <View>
              <Pressable
                onPress={() => setBacklogOpen((v) => !v)}
                style={styles.collapseHeader}
                accessibilityRole="button"
              >
                <SectionHeader>{`À rattraper · ${backlog.length}`}</SectionHeader>
                <Ionicons
                  name={backlogOpen ? 'chevron-up' : 'chevron-down'}
                  size={18}
                  color={colors.textMeta}
                />
              </Pressable>
              {backlogOpen
                ? backlog.map((item) => (
                    <BacklogRow
                      key={item.key}
                      item={{
                        key: item.key,
                        seed: item.seed,
                        title: item.title,
                        posterPath: item.posterPath,
                        subtitle: item.subtitle,
                        episode: item.episode
                          ? {
                              seasonNumber: item.episode.seasonNumber,
                              episodeNumber: item.episode.episodeNumber,
                            }
                          : undefined,
                      }}
                      onOpen={() => openMedia(item.tmdbId, item.mediaType)}
                      onSnooze={() => snooze(item.entryId)}
                      onMark={
                        item.episode
                          ? () =>
                              markNext.mutate({
                                entryId: item.episode!.entryId,
                                episode: {
                                  seasonNumber: item.episode!.seasonNumber,
                                  episodeNumber: item.episode!.episodeNumber,
                                },
                                watchedBefore: item.episode!.watched,
                                total: item.episode!.total,
                              })
                          : item.movieEntryId
                            ? () => markMovieSeen(item.movieEntryId!, item.title)
                            : undefined
                      }
                    />
                  ))
                : null}
            </View>
          ) : null}

          {grouped.map(([bucket, items]) => (
            <View key={bucket}>
              <SectionHeader>{bucket}</SectionHeader>
              {items.map((item) => (
                <ListRow
                  key={item.key}
                  seed={item.seed}
                  title={item.title}
                  posterPath={item.posterPath}
                  subtitle={item.subtitle}
                  onPress={() => openMedia(item.tmdbId, item.mediaType)}
                  right={item.isMovie ? <StatusBadge status="plan_to_watch" /> : undefined}
                />
              ))}
            </View>
          ))}

          {backlog.length === 0 && grouped.length === 0 && cards.length === 0 ? (
            <Text style={[styles.quiet, { color: colors.textMeta }]}>
              Rien à rattraper ni à l’horizon pour l’instant.
            </Text>
          ) : null}

          {cards.length > 0 ? (
            <View onLayout={(e) => setNowWatchingY(e.nativeEvent.layout.y)}>
              <Pressable
                onPress={() => setNowWatchingOverride(!nowWatchingOpen)}
                style={styles.collapseHeader}
                accessibilityRole="button"
              >
                <SectionHeader>{`En cours · ${cards.length}`}</SectionHeader>
                <Ionicons
                  name={nowWatchingOpen ? 'chevron-up' : 'chevron-down'}
                  size={18}
                  color={colors.textMeta}
                />
              </Pressable>
              {nowWatchingOpen ? (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ gap: 14, paddingVertical: 4 }}
              >
                {cards.map((c) => (
                  <NowWatchingCard
                    key={c.entry.id}
                    seed={`${c.entry.media.tmdb_id}`}
                    title={c.entry.media.title}
                    posterPath={c.entry.media.poster_path}
                    subtitle={c.subtitle}
                    progress={c.progress}
                    width={cardWidth}
                    onPress={() => openMedia(c.entry.media.tmdb_id, 'tv')}
                    onCheck={
                      c.nextEpisode
                        ? () =>
                            markNext.mutate({
                              entryId: c.entry.id,
                              episode: {
                                seasonNumber: c.nextEpisode!.seasonNumber,
                                episodeNumber: c.nextEpisode!.episodeNumber,
                              },
                              watchedBefore: c.watched,
                              total: c.total,
                            })
                        : undefined
                    }
                  />
                ))}
              </ScrollView>
              ) : null}
            </View>
          ) : null}
            </>
          )}
        </ScrollView>
      )}
      <Fab onPress={() => router.push('/search')} accessibilityLabel="Ajouter un titre" />
      <RatingSheet
        visible={!!ratingFor}
        title={ratingFor?.title ?? ''}
        onSubmit={submitRating}
        onSkip={() => setRatingFor(null)}
      />
      <Toast toast={toast} onDismiss={() => setToast(null)} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  quiet: { fontSize: 15, marginTop: 24, textAlign: 'center' },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  collapseHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  viewToggle: {
    flexDirection: 'row',
    alignSelf: 'flex-start',
    borderRadius: 10,
    padding: 3,
    marginTop: 4,
    marginBottom: 10,
  },
  viewToggleItem: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 8 },
  viewToggleText: { fontSize: 13, fontWeight: '600' },
});

