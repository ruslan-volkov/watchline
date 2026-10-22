import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useMemo, useRef, useState } from 'react';
import {
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';

import { AnimatedCheck } from '@/components/AnimatedCheck';
import { BacklogRow } from '@/components/BacklogRow';
import { CardRow } from '@/components/CardRow';
import { Collapsible } from '@/components/Collapsible';
import { EmptyState } from '@/components/EmptyState';
import { Fab } from '@/components/Fab';
import { RatingSheet } from '@/components/RatingSheet';
import { Screen } from '@/components/Screen';
import { SkeletonList } from '@/components/SkeletonRow';
import { Toast, type ToastState } from '@/components/Toast';
import { SectionHeader } from '@/components/SectionHeader';
import { UpcomingCalendar, type CalendarItem } from '@/components/UpcomingCalendar';
import { useDensity } from '@/contexts/DensityContext';
import { useTheme } from '@/contexts/ThemeContext';
import { useMarkNext } from '@/features/episodes/useMarkNext';
import { useEntryMutations } from '@/features/watch/useEntryMutations';
import { useNowWatching } from '@/features/watch/useNowWatching';
import { useWatchEntries } from '@/features/watch/useWatchEntries';
import { usePullRefresh } from '@/hooks/usePullRefresh';
import { useTabBarClearance } from '@/theme/layout';
import {
  bucketRank,
  dayMonthLabel,
  daysFromToday,
  isOverdue,
  proximityBucket,
  releaseSubtitle,
  RECENT_WINDOW_DAYS,
} from '@/utils/timeGrouping';
import type { MediaType } from '@/media/types';

/** How far the bottom-right floating cluster (Liste/Calendrier toggle stacked
 *  above the FAB) rises past the tab-bar clearance. Content pads this much extra
 *  so the last rows' checkboxes aren't hidden behind it. */
const BOTTOM_CONTROLS_CLEARANCE = 176;

interface UpcomingItem {
  key: string;
  date: string;
  bucket: string;
  seed: string;
  title: string;
  posterPath: string | null;
  backdropPath: string | null;
  subtitle: string;
  isMovie: boolean;
  tmdbId: number;
  mediaType: MediaType;
  /** Set for a released movie: enables the inline "mark seen" check + rating. */
  movieEntryId?: string;
  /** Set for a series row: enables the inline "mark watched" check. */
  episode?: {
    entryId: string;
    seasonNumber: number;
    episodeNumber: number;
    watched: number;
    total: number;
  };
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
  const [backlogOpen, setBacklogOpen] = useState(false);
  const [undatedOpen, setUndatedOpen] = useState(false);
  const [upcomingView, setUpcomingView] = useState<'list' | 'calendar'>('list');
  const scrollRef = useRef<Animated.ScrollView>(null);

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
  const { refreshing, onRefresh } = usePullRefresh([['watch_entries'], ['progress_all'], ['media_details']]);
  const tabBarClearance = useTabBarClearance();

  const openMedia = (tmdbId: number, type: MediaType) =>
    router.push({ pathname: '/media/[id]', params: { id: String(tmdbId), type } });

  const upcoming = useMemo<UpcomingItem[]>(() => {
    const items: UpcomingItem[] = [];
    for (const e of entries ?? []) {
      const isMovie = e.media.media_type === 'movie';
      // Movie / series premiere from the watchlist, out within the recent window
      // or still to come. Older ones drop into "À rattraper".
      if (
        e.status === 'plan_to_watch' &&
        !e.snoozed &&
        e.media.release_date &&
        daysFromToday(e.media.release_date) >= -RECENT_WINDOW_DAYS
      ) {
        items.push({
          key: `entry-${e.id}`,
          date: e.media.release_date,
          bucket: proximityBucket(e.media.release_date),
          seed: `${e.media.tmdb_id}`,
          title: e.media.title,
          posterPath: e.media.poster_path,
          backdropPath: e.media.backdrop_path,
          subtitle: releaseSubtitle(e.media.release_date, isMovie ? 'movie' : 'episode'),
          isMovie,
          tmdbId: e.media.tmdb_id,
          mediaType: e.media.media_type,
          movieEntryId: isMovie ? e.id : undefined,
        });
      }
    }
    // Next unwatched episode of watching series: still to come, or aired within
    // the recent window — a fresh episode shouldn't vanish into the backlog the
    // morning after it drops. Older ones belong to "À rattraper".
    for (const c of cards) {
      const ep = c.nextEpisode;
      if (ep?.airDate && daysFromToday(ep.airDate) >= -RECENT_WINDOW_DAYS) {
        items.push({
          key: `ep-${c.entry.id}`,
          date: ep.airDate,
          bucket: proximityBucket(ep.airDate),
          seed: `${c.entry.media.tmdb_id}`,
          title: c.entry.media.title,
          posterPath: c.entry.media.poster_path,
          backdropPath: c.entry.media.backdrop_path,
          subtitle: releaseSubtitle(ep.airDate, 'episode', `S${ep.seasonNumber}E${ep.episodeNumber}`),
          isMovie: false,
          tmdbId: c.entry.media.tmdb_id,
          mediaType: 'tv',
          episode: {
            entryId: c.entry.id,
            seasonNumber: ep.seasonNumber,
            episodeNumber: ep.episodeNumber,
            watched: c.watched,
            total: c.total,
          },
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

  // Long overdue and unwatched: titles out more than RECENT_WINDOW_DAYS ago + the
  // next such episode of each series. Anything more recent (today included) stays
  // in the timeline above, under its own "sortis cette semaine" style bucket.
  const backlog = useMemo(() => {
    const items: {
      key: string;
      seed: string;
      title: string;
      posterPath: string | null;
      backdropPath: string | null;
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
        // An undated title is unannounced, not late: it waits in the watchlist
        // until TMDB gives it a date.
        if (isOverdue(e.media.release_date)) {
          const isMovie = e.media.media_type === 'movie';
          items.push({
            key: `p-${e.id}`,
            seed: `${e.media.tmdb_id}`,
            title: e.media.title,
            posterPath: e.media.poster_path,
            backdropPath: e.media.backdrop_path,
            subtitle: isMovie ? 'Sorti · à voir' : 'Dispo · à commencer',
            tmdbId: e.media.tmdb_id,
            mediaType: e.media.media_type,
            entryId: e.id,
            movieEntryId: isMovie ? e.id : undefined,
          });
        }
      }
    }

    // Series: the next episode to watch, only once it's long overdue — aired more
    // than RECENT_WINDOW_DAYS ago. An episode with no air date isn't out yet (a
    // season TMDB has announced but not scheduled), so it belongs nowhere until it
    // gets a date. Recent airings show in the timeline above.
    for (const c of cards) {
      const ep = c.nextEpisode;
      if (!ep) continue;
      if (!isOverdue(ep.airDate)) continue;
      items.push({
        key: `s-${c.entry.id}`,
        seed: `${c.entry.media.tmdb_id}`,
        title: c.entry.media.title,
        posterPath: c.entry.media.poster_path,
        backdropPath: c.entry.media.backdrop_path,
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

  // Waiting on TMDB for a date: watchlist titles with no release date, and
  // series in progress whose next episode isn't scheduled. Neither belongs in a
  // chronological list, and neither is late — hence their own collapsed shelf.
  const undated = useMemo(() => {
    const items: {
      key: string;
      seed: string;
      title: string;
      posterPath: string | null;
      backdropPath: string | null;
      subtitle: string;
      tmdbId: number;
      mediaType: MediaType;
    }[] = [];

    for (const e of entries ?? []) {
      if (e.status !== 'plan_to_watch' || e.snoozed || e.media.release_date) continue;
      items.push({
        key: `u-${e.id}`,
        seed: `${e.media.tmdb_id}`,
        title: e.media.title,
        posterPath: e.media.poster_path,
        backdropPath: e.media.backdrop_path,
        subtitle: e.media.media_type === 'movie' ? 'Film · sortie non datée' : 'Série · sortie non datée',
        tmdbId: e.media.tmdb_id,
        mediaType: e.media.media_type,
      });
    }

    for (const c of cards) {
      if (!c.awaitingDate) continue;
      const ep = c.nextEpisode;
      items.push({
        key: `uw-${c.entry.id}`,
        seed: `${c.entry.media.tmdb_id}`,
        title: c.entry.media.title,
        posterPath: c.entry.media.poster_path,
        backdropPath: c.entry.media.backdrop_path,
        subtitle: ep
          ? `S${ep.seasonNumber}E${ep.episodeNumber} · date non annoncée`
          : 'À jour · suite non datée',
        tmdbId: c.entry.media.tmdb_id,
        mediaType: 'tv',
      });
    }
    return items;
  }, [entries, cards]);

  // Calendar data: every tracked title at its release date (past + future),
  // plus upcoming episodes of series in progress.
  const calendarItems = useMemo<CalendarItem[]>(() => {
    const items: CalendarItem[] = [];
    // Watching series: only the next episode to watch (even if it aired a few
    // days ago and is still unseen) — not the whole unwatched tail.
    for (const c of cards) {
      const ep = c.nextEpisode;
      if (ep?.airDate) {
        items.push({
          key: `ce-${c.entry.id}`,
          date: ep.airDate,
          seed: `${c.entry.media.tmdb_id}`,
          title: c.entry.media.title,
          posterPath: c.entry.media.poster_path,
          subtitle: `S${ep.seasonNumber}E${ep.episodeNumber}`,
          tmdbId: c.entry.media.tmdb_id,
          mediaType: 'tv',
        });
      }
    }
    for (const e of entries ?? []) {
      // Skip snoozed, already-watched, and undated titles.
      if (e.snoozed || e.status === 'completed' || !e.media.release_date) continue;
      // Watching series are represented by their episodes above, not the premiere.
      if (e.media.media_type === 'tv' && e.status === 'watching') continue;
      items.push({
        key: `cr-${e.id}`,
        date: e.media.release_date,
        seed: `${e.media.tmdb_id}`,
        title: e.media.title,
        posterPath: e.media.poster_path,
        subtitle: e.media.media_type === 'movie' ? 'Film' : 'Série',
        tmdbId: e.media.tmdb_id,
        mediaType: e.media.media_type,
      });
    }
    return items;
  }, [entries, cards]);

  const hasContent = (entries?.length ?? 0) > 0;

  return (
    <Screen padded={false}>
      {!hasContent ? (
        isLoading ? (
          <View style={{ paddingHorizontal: spacing.screenPadding }}>
            <SkeletonList />
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
        <>
        <View pointerEvents="box-none" style={[styles.toggleBar, { bottom: tabBarClearance + 68 }]}>
          <View style={styles.viewToggle}>
            {(['list', 'calendar'] as const).map((v) => {
              const active = upcomingView === v;
              return (
                <Pressable
                  key={v}
                  onPress={() => setUpcomingView(v)}
                  style={[
                    styles.viewToggleItem,
                    { backgroundColor: active ? colors.accent : colors.surface },
                  ]}
                  accessibilityRole="button"
                  accessibilityLabel={v === 'list' ? 'Vue liste' : 'Vue calendrier'}
                  accessibilityState={{ selected: active }}
                >
                  <Ionicons
                    name={v === 'list' ? 'list' : 'calendar'}
                    size={22}
                    color={active ? colors.accentText : colors.textSecondary}
                  />
                </Pressable>
              );
            })}
          </View>
        </View>
        <Animated.ScrollView
          ref={scrollRef}
          contentContainerStyle={{
            paddingHorizontal: spacing.screenPadding,
            paddingBottom: tabBarClearance + BOTTOM_CONTROLS_CLEARANCE,
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
          {upcomingView === 'calendar' ? (
            calendarItems.length > 0 ? (
              <UpcomingCalendar
                items={calendarItems}
                onOpen={openMedia}
                screenPadding={spacing.screenPadding}
                scrollRef={scrollRef}
              />
            ) : (
              <Text style={[styles.quiet, { color: colors.textMeta }]}>
                Rien dans ton calendrier pour l’instant.
              </Text>
            )
          ) : (
            <>
          {backlog.length > 0 ? (
            <Animated.View entering={FadeIn.duration(260)}>
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
              <Collapsible open={backlogOpen}>
                {backlog.map((item) => (
                  <BacklogRow
                    key={item.key}
                    item={{
                      key: item.key,
                      seed: item.seed,
                      title: item.title,
                      posterPath: item.posterPath,
                      backdropPath: item.backdropPath,
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
                ))}
              </Collapsible>
            </Animated.View>
          ) : null}

          {grouped.map(([bucket, items]) => (
            <Animated.View key={bucket} entering={FadeIn.duration(260)}>
              <SectionHeader>{bucket}</SectionHeader>
              {items.map((item) => {
                // Out today → offer the check straight away; the date would just
                // read "today" anyway. Future rows keep showing their date.
                const markable = daysFromToday(item.date) <= 0;
                const onMark = !markable
                  ? undefined
                  : item.episode
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
                      : undefined;
                return (
                  <CardRow
                    key={item.key}
                    seed={item.seed}
                    title={item.title}
                    posterPath={item.posterPath}
                    backdropPath={item.backdropPath}
                    subtitle={item.subtitle}
                    onPress={() => openMedia(item.tmdbId, item.mediaType)}
                    right={
                      onMark ? (
                        <AnimatedCheck
                          resetKey={
                            item.episode
                              ? `${item.episode.seasonNumber}-${item.episode.episodeNumber}`
                              : item.key
                          }
                          onMark={onMark}
                          accessibilityLabel={
                            item.episode ? 'Marquer cet épisode vu' : 'Marquer comme vu'
                          }
                        />
                      ) : (
                        <Text style={[styles.upcomingDate, { color: colors.textMeta }]}>
                          {dayMonthLabel(item.date)}
                        </Text>
                      )
                    }
                  />
                );
              })}
            </Animated.View>
          ))}

          {undated.length > 0 ? (
            <Animated.View entering={FadeIn.duration(260)}>
              <Pressable
                onPress={() => setUndatedOpen((v) => !v)}
                style={styles.collapseHeader}
                accessibilityRole="button"
              >
                <SectionHeader>{`Pas encore daté · ${undated.length}`}</SectionHeader>
                <Ionicons
                  name={undatedOpen ? 'chevron-up' : 'chevron-down'}
                  size={18}
                  color={colors.textMeta}
                />
              </Pressable>
              <Collapsible open={undatedOpen}>
                {undated.map((item) => (
                  <CardRow
                    key={item.key}
                    seed={item.seed}
                    title={item.title}
                    posterPath={item.posterPath}
                    backdropPath={item.backdropPath}
                    subtitle={item.subtitle}
                    onPress={() => openMedia(item.tmdbId, item.mediaType)}
                  />
                ))}
              </Collapsible>
            </Animated.View>
          ) : null}

          {backlog.length === 0 && grouped.length === 0 && undated.length === 0 ? (
            <Text style={[styles.quiet, { color: colors.textMeta }]}>
              Rien à rattraper ni à l’horizon pour l’instant.
            </Text>
          ) : null}
            </>
          )}
        </Animated.ScrollView>
        </>
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
  upcomingDate: { fontSize: 13, fontWeight: '600' },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  collapseHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  toggleBar: {
    position: 'absolute',
    right: 20,
    width: 56,
    alignItems: 'center',
    zIndex: 10,
  },
  viewToggle: { flexDirection: 'column', alignItems: 'center', gap: 8 },
  viewToggleItem: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 5,
    elevation: 3,
  },
});

