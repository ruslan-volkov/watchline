import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, { FadeIn } from 'react-native-reanimated';

import { Button } from '@/components/Button';
import { PosterPlaceholder } from '@/components/PosterPlaceholder';
import { ProgressBar } from '@/components/ProgressBar';
import { RatingSheet } from '@/components/RatingSheet';
import { RatingStars } from '@/components/RatingStars';
import { Toast, type ToastState } from '@/components/Toast';
import { useTheme } from '@/contexts/ThemeContext';
import { useEpisodeProgress } from '@/features/episodes/useEpisodeProgress';
import { episodeKey, planCascade, type EpisodeRef } from '@/features/episodes/cascade';
import { useEntryMutations } from '@/features/watch/useEntryMutations';
import { useWatchEntries } from '@/features/watch/useWatchEntries';
import { mediaProvider } from '@/media/provider';
import { successHaptic, tapHaptic } from '@/lib/haptics';
import { posterAccentColor } from '@/theme/posterColors';
import { statusLabels } from '@/theme/tokens';
import { airDateLabel, daysFromToday } from '@/utils/timeGrouping';
import type { MediaType, WatchStatus } from '@/media/types';

const STATUSES: WatchStatus[] = ['plan_to_watch', 'watching', 'completed'];

export default function MediaDetail() {
  const { colors, scheme } = useTheme();
  const router = useRouter();
  const params = useLocalSearchParams<{ id: string; type: string }>();
  const tmdbId = Number(params.id);
  const mediaType = (params.type as MediaType) ?? 'movie';

  const { add, update, remove } = useEntryMutations();
  const { data: entries } = useWatchEntries();
  const entry = useMemo(
    () => entries?.find((e) => e.media.tmdb_id === tmdbId && e.media.media_type === mediaType),
    [entries, tmdbId, mediaType],
  );

  const { data: details, isLoading } = useQuery({
    queryKey: ['media_details', mediaType, tmdbId],
    queryFn: () => mediaProvider.getDetails(tmdbId, mediaType),
  });

  const seasons = details?.seasons ?? [];
  const progress = useEpisodeProgress(entry?.id, seasons);

  const [ratingOpen, setRatingOpen] = useState(false);
  const [toast, setToast] = useState<ToastState | null>(null);
  const [overviewExpanded, setOverviewExpanded] = useState(false);

  // Season collapse: by default only the "current" season is open — the first
  // one not fully caught up. Nothing watched at all → everything collapsed.
  // Per-season taps override the default.
  const [seasonOverrides, setSeasonOverrides] = useState<Record<number, boolean>>({});
  const defaultOpenSeason = useMemo(() => {
    if (progress.watchedCount === 0) return null;
    for (const s of seasons) {
      const aired = s.episodes.filter((ep) => !ep.airDate || daysFromToday(ep.airDate) <= 0);
      const w = aired.filter((ep) => progress.isWatched(ep.seasonNumber, ep.episodeNumber)).length;
      if (aired.length === 0 || w < aired.length) return s.seasonNumber;
    }
    return null;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seasons, progress.watchedKeys, progress.watchedCount]);
  const isSeasonOpen = (n: number) => seasonOverrides[n] ?? n === defaultOpenSeason;
  const toggleSeasonOpen = (n: number) =>
    setSeasonOverrides((o) => ({ ...o, [n]: !(o[n] ?? n === defaultOpenSeason) }));

  const seed = `${tmdbId}`;

  const ensureEntryId = async (status: WatchStatus): Promise<string | undefined> => {
    if (entry) return entry.id;
    if (!details) return undefined;
    const created = await add.mutateAsync({ summary: details, status });
    return created.id;
  };

  // Holds the entry id when we just created one, so rating/status can target it
  // before the entries query has refetched.
  const [activeEntryId, setActiveEntryId] = useState<string | undefined>(undefined);
  const resolvedEntryId = entry?.id ?? activeEntryId;

  const changeStatus = async (status: WatchStatus) => {
    const id = resolvedEntryId ?? (await ensureEntryId(status));
    if (id) {
      setActiveEntryId(id);
      await update.mutateAsync({ entryId: id, patch: { status } });
    }
    if (status === 'completed') setRatingOpen(true);
  };

  const submitRating = async (rating: number | null, notes: string | null) => {
    const id = resolvedEntryId;
    if (id) {
      await update.mutateAsync({
        entryId: id,
        patch: {
          status: 'completed',
          rating,
          notes,
          finished_at: new Date().toISOString().slice(0, 10),
        },
      });
    }
    setRatingOpen(false);
  };

  const toggleEpisode = async (ref: EpisodeRef) => {
    if (!entry) {
      await ensureEntryId('watching');
      return; // entry now exists; the tap can be repeated with progress bound
    }
    if (progress.isWatched(ref.seasonNumber, ref.episodeNumber)) {
      await progress.unmark([ref]);
      return;
    }
    const plan = planCascade(seasons, ref, progress.watchedKeys);
    const doMark = async () => {
      tapHaptic();
      await progress.mark(plan.toMark);
      if (plan.extra >= 1) {
        const first = plan.toMark[0];
        const last = plan.toMark[plan.toMark.length - 1];
        setToast({
          message: `Épisodes S${first.seasonNumber}E${first.episodeNumber}–S${last.seasonNumber}E${last.episodeNumber} marqués vus aussi`,
          onUndo: () => {
            void progress.unmark(plan.toMark);
          },
        });
      }
    };
    if (plan.needsConfirm) {
      Alert.alert(
        'Marquer plusieurs épisodes ?',
        `Ça marquera ${plan.toMark.length} épisodes comme vus (jusqu’à S${ref.seasonNumber}E${ref.episodeNumber}).`,
        [
          { text: 'Annuler', style: 'cancel' },
          { text: 'Marquer', onPress: () => void doMark() },
        ],
      );
    } else {
      await doMark();
    }
  };

  const toggleSeason = async (episodes: { seasonNumber: number; episodeNumber: number }[]) => {
    if (!entry) {
      await ensureEntryId('watching');
      return;
    }
    const refs = episodes.map((e) => ({
      seasonNumber: e.seasonNumber,
      episodeNumber: e.episodeNumber,
    }));
    const allWatched = refs.every((r) => progress.isWatched(r.seasonNumber, r.episodeNumber));
    if (allWatched) {
      await progress.unmark(refs);
    } else {
      // Deliberate bulk action — mark every unwatched episode of the season, no dialog.
      successHaptic();
      await progress.mark(refs.filter((r) => !progress.isWatched(r.seasonNumber, r.episodeNumber)));
    }
  };

  const confirmRemove = () => {
    if (!entry) return;
    Alert.alert('Retirer ce titre ?', 'Il sera retiré de ton suivi et de ta watchlist.', [
      { text: 'Annuler', style: 'cancel' },
      {
        text: 'Retirer',
        style: 'destructive',
        onPress: async () => {
          await remove.mutateAsync(entry.id);
          router.back();
        },
      },
    ]);
  };

  if (isLoading) {
    return (
      <SafeAreaView style={[styles.root, styles.center, { backgroundColor: colors.bg }]}>
        <ActivityIndicator color={colors.accent} />
      </SafeAreaView>
    );
  }

  // Details couldn't be loaded (e.g. a stale/mock id not on TMDB). Don't hang —
  // let the user go back or remove the broken entry from their list.
  if (!details) {
    return (
      <SafeAreaView style={[styles.root, { backgroundColor: colors.bg }]} edges={['top']}>
        <View style={styles.topBar}>
          <Pressable onPress={() => router.back()} hitSlop={10} accessibilityRole="button">
            <Ionicons name="chevron-back" size={26} color={colors.textPrimary} />
          </Pressable>
        </View>
        <View style={[styles.center, { flex: 1, paddingHorizontal: 32 }]}>
          <Ionicons name="cloud-offline-outline" size={40} color={colors.textMeta} />
          <Text style={[styles.notFoundTitle, { color: colors.textPrimary }]}>Titre introuvable</Text>
          <Text style={[styles.notFoundText, { color: colors.textSecondary }]}>
            Ce titre n’est pas disponible sur TMDB. S’il vient d’un ancien test, tu peux le
            retirer de ton suivi.
          </Text>
          {entry ? (
            <Button label="Retirer de mon suivi" variant="secondary" onPress={confirmRemove} style={{ marginTop: 8 }} />
          ) : null}
        </View>
      </SafeAreaView>
    );
  }

  const accent = posterAccentColor(seed, scheme);

  const formatRuntime = (m: number) => {
    const h = Math.floor(m / 60);
    const min = m % 60;
    return h > 0 ? `${h}h${min ? ` ${min}` : ''}` : `${min} min`;
  };
  const metaParts: string[] = [mediaType === 'tv' ? 'Série' : 'Film'];
  if (details.releaseDate) metaParts.push(details.releaseDate.slice(0, 4));
  if (mediaType === 'movie' && details.runtimeMinutes) {
    metaParts.push(formatRuntime(details.runtimeMinutes));
  }
  if (mediaType === 'tv' && details.seasonCount) {
    metaParts.push(`${details.seasonCount} saison${details.seasonCount > 1 ? 's' : ''}`);
  }
  const genres = (details.genres ?? []).slice(0, 3);

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: colors.bg }]} edges={['top']}>
      <View style={styles.topBar}>
        <Pressable onPress={() => router.back()} hitSlop={10} accessibilityRole="button">
          <Ionicons name="chevron-back" size={26} color={colors.textPrimary} />
        </Pressable>
        {entry ? (
          <View style={styles.topActions}>
            <Pressable
              onPress={() =>
                update.mutate({ entryId: entry.id, patch: { snoozed: !entry.snoozed } })
              }
              hitSlop={10}
              accessibilityRole="button"
              accessibilityLabel={entry.snoozed ? 'Reprendre' : 'Mettre en pause'}
            >
              <Ionicons
                name={entry.snoozed ? 'play-circle-outline' : 'pause-circle-outline'}
                size={24}
                color={entry.snoozed ? colors.accent : colors.textSecondary}
              />
            </Pressable>
            <Pressable onPress={confirmRemove} hitSlop={10} accessibilityRole="button">
              <Ionicons name="trash-outline" size={22} color={colors.textSecondary} />
            </Pressable>
          </View>
        ) : null}
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.hero}>
          <PosterPlaceholder
            seed={seed}
            title={details.title}
            posterPath={details.posterPath}
            width={110}
          />
          <View style={styles.heroText}>
            <Text style={[styles.title, { color: colors.textPrimary }]}>{details.title}</Text>
            <Text style={[styles.meta, { color: colors.textMeta }]}>{metaParts.join(' · ')}</Text>
            {genres.length > 0 ? (
              <View style={styles.genres}>
                {genres.map((g) => (
                  <View key={g} style={[styles.genreChip, { backgroundColor: colors.surfaceAlt }]}>
                    <Text style={[styles.genreText, { color: colors.textSecondary }]}>{g}</Text>
                  </View>
                ))}
              </View>
            ) : null}
          </View>
        </View>

        {details.overview ? (
          <View style={styles.overviewWrap}>
            <Text
              style={[styles.overview, { color: colors.textSecondary }]}
              numberOfLines={overviewExpanded ? undefined : 3}
            >
              {details.overview}
            </Text>
            {details.overview.length > 160 ? (
              <Pressable onPress={() => setOverviewExpanded((v) => !v)} hitSlop={6}>
                <Text style={[styles.overviewMore, { color: colors.accent }]}>
                  {overviewExpanded ? 'Voir moins' : 'Voir plus'}
                </Text>
              </Pressable>
            ) : null}
          </View>
        ) : null}

        {/* Status selector */}
        <View style={[styles.segment, { backgroundColor: colors.surfaceAlt }]}>
          {STATUSES.map((s) => {
            const active = entry?.status === s;
            return (
              <Pressable
                key={s}
                onPress={() => changeStatus(s)}
                style={[styles.segmentItem, active && { backgroundColor: colors.surface }]}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
              >
                <Text
                  style={[
                    styles.segmentText,
                    { color: active ? colors.textPrimary : colors.textSecondary },
                  ]}
                >
                  {statusLabels[s]}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {/* Rating */}
        {entry ? (
          <Pressable
            onPress={() => setRatingOpen(true)}
            style={[styles.ratingRow, { borderColor: colors.border }]}
            accessibilityRole="button"
          >
            <View>
              <Text style={[styles.ratingLabel, { color: colors.textSecondary }]}>Ta note</Text>
              {entry.rating ? (
                <View style={{ marginTop: 4 }}>
                  <RatingStars value={entry.rating} size={20} />
                </View>
              ) : (
                <Text style={[styles.ratingHint, { color: colors.textMeta }]}>Pas encore notée</Text>
              )}
            </View>
            <Text style={[styles.ratingCta, { color: colors.accent }]}>
              {entry.rating ? 'Modifier' : 'Noter'}
            </Text>
          </Pressable>
        ) : null}

        {entry?.notes ? (
          <Text style={[styles.notes, { color: colors.textSecondary, borderColor: colors.border }]}>
            {entry.notes}
          </Text>
        ) : null}

        {/* Seasons & episodes */}
        {mediaType === 'tv'
          ? seasons.map((season) => {
              // Base progress + the "mark season" toggle on aired episodes only,
              // so an ongoing season can reach 100% before all episodes exist.
              const airedEps = season.episodes.filter(
                (ep) => !ep.airDate || daysFromToday(ep.airDate) <= 0,
              );
              const total = airedEps.length;
              const watched = airedEps.filter((ep) =>
                progress.watchedKeys.has(episodeKey(ep.seasonNumber, ep.episodeNumber)),
              ).length;
              const frac = total ? watched / total : 0;
              const open = isSeasonOpen(season.seasonNumber);
              return (
                <View key={season.seasonNumber} style={styles.season}>
                  <Pressable
                    style={styles.seasonHeader}
                    onPress={() => toggleSeasonOpen(season.seasonNumber)}
                    accessibilityRole="button"
                  >
                    <Ionicons
                      name={open ? 'chevron-down' : 'chevron-forward'}
                      size={18}
                      color={colors.textMeta}
                      style={styles.seasonChevron}
                    />
                    <Text style={[styles.seasonName, { color: colors.textPrimary }]}>
                      {season.name}
                    </Text>
                    <View style={styles.seasonRight}>
                      <Text style={[styles.seasonCount, { color: colors.textMeta }]}>
                        {watched}/{total}
                      </Text>
                      <Pressable
                        onPress={() => toggleSeason(airedEps)}
                        hitSlop={8}
                        accessibilityRole="button"
                        accessibilityLabel={
                          watched === total ? 'Décocher la saison' : 'Marquer la saison vue'
                        }
                        style={[
                          styles.seasonCheck,
                          {
                            borderColor: watched > 0 ? accent : colors.border,
                            backgroundColor: total > 0 && watched === total ? accent : 'transparent',
                          },
                        ]}
                      >
                        {total > 0 && watched === total ? (
                          <Ionicons name="checkmark" size={17} color="#fff" />
                        ) : watched > 0 ? (
                          <View style={[styles.partialDash, { backgroundColor: accent }]} />
                        ) : null}
                      </Pressable>
                    </View>
                  </Pressable>
                  {open ? (
                    <Animated.View entering={FadeIn.duration(160)}>
                  <ProgressBar
                    progress={frac}
                    color={accent}
                    trackColor={colors.surfaceAlt}
                    height={5}
                    radius={3}
                    style={{ marginBottom: 10 }}
                  />
                  {season.episodes.map((ep) => {
                    const isWatched = progress.watchedKeys.has(
                      episodeKey(ep.seasonNumber, ep.episodeNumber),
                    );
                    const unaired = !!ep.airDate && daysFromToday(ep.airDate) > 0;
                    return (
                      <Pressable
                        key={`${ep.seasonNumber}-${ep.episodeNumber}`}
                        onPress={() => (unaired ? undefined : toggleEpisode(ep))}
                        disabled={unaired}
                        style={styles.episode}
                        accessibilityRole="checkbox"
                        accessibilityState={{ checked: isWatched, disabled: unaired }}
                      >
                        <Text
                          style={[
                            styles.episodeText,
                            {
                              color: unaired
                                ? colors.textMeta
                                : isWatched
                                  ? colors.textMeta
                                  : colors.textPrimary,
                            },
                          ]}
                          numberOfLines={1}
                        >
                          {ep.episodeNumber}. {ep.title}
                        </Text>
                        {unaired && ep.airDate ? (
                          <Text style={[styles.episodeDate, { color: colors.textMeta }]}>
                            {airDateLabel(ep.airDate)}
                          </Text>
                        ) : null}
                        {unaired ? (
                          <View style={[styles.checkbox, { borderColor: 'transparent' }]}>
                            <Ionicons name="time-outline" size={18} color={colors.textMeta} />
                          </View>
                        ) : (
                          <View
                            style={[
                              styles.checkbox,
                              {
                                borderColor: isWatched ? accent : colors.border,
                                backgroundColor: isWatched ? accent : 'transparent',
                              },
                            ]}
                          >
                            {isWatched ? <Ionicons name="checkmark" size={15} color="#fff" /> : null}
                          </View>
                        )}
                      </Pressable>
                    );
                  })}
                    </Animated.View>
                  ) : null}
                </View>
              );
            })
          : null}

        <View style={{ height: 40 }} />
      </ScrollView>

      <RatingSheet
        visible={ratingOpen}
        title={details.title}
        initialRating={entry?.rating}
        initialNotes={entry?.notes}
        onSubmit={submitRating}
        onSkip={() => setRatingOpen(false)}
      />
      <Toast toast={toast} onDismiss={() => setToast(null)} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  center: { alignItems: 'center', justifyContent: 'center' },
  notFoundTitle: { fontSize: 19, fontWeight: '700', marginTop: 14, marginBottom: 6 },
  notFoundText: { fontSize: 15, lineHeight: 21, textAlign: 'center', marginBottom: 18 },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    height: 44,
  },
  topActions: { flexDirection: 'row', alignItems: 'center', gap: 18 },
  content: { paddingHorizontal: 20 },
  hero: { flexDirection: 'row', marginBottom: 16 },
  heroText: { flex: 1, marginLeft: 16 },
  title: { fontSize: 22, fontWeight: '700', marginBottom: 4 },
  meta: { fontSize: 13, fontWeight: '600', marginBottom: 8 },
  genres: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 8 },
  genreChip: { paddingHorizontal: 9, paddingVertical: 4, borderRadius: 999 },
  genreText: { fontSize: 11, fontWeight: '600' },
  overviewWrap: { marginBottom: 18 },
  overview: { fontSize: 14, lineHeight: 21 },
  overviewMore: { fontSize: 13, fontWeight: '700', marginTop: 4 },
  segment: {
    flexDirection: 'row',
    borderRadius: 12,
    padding: 4,
    marginBottom: 16,
  },
  segmentItem: {
    flex: 1,
    height: 38,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  segmentText: { fontSize: 14, fontWeight: '600' },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
  },
  ratingLabel: { fontSize: 13, fontWeight: '600' },
  ratingHint: { fontSize: 14, marginTop: 4 },
  ratingCta: { fontSize: 15, fontWeight: '700' },
  notes: {
    fontSize: 14,
    lineHeight: 20,
    borderWidth: 1,
    borderRadius: 14,
    padding: 14,
    marginBottom: 12,
  },
  season: { marginTop: 20 },
  seasonHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  seasonChevron: { marginRight: 6 },
  seasonName: { fontSize: 16, fontWeight: '700', flex: 1 },
  seasonRight: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  seasonCount: { fontSize: 13, fontWeight: '600' },
  seasonCheck: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  partialDash: { width: 12, height: 2.5, borderRadius: 2 },
  episode: { flexDirection: 'row', alignItems: 'center', paddingVertical: 9 },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 8,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 12,
  },
  episodeText: { flex: 1, fontSize: 15, fontWeight: '500' },
  episodeDate: { fontSize: 12, fontWeight: '600', marginLeft: 8 },
});
