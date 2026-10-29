import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Keyboard,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { EmptyState } from '@/components/EmptyState';
import { ListRow } from '@/components/ListRow';
import { RatingSheet } from '@/components/RatingSheet';
import { SectionHeader } from '@/components/SectionHeader';
import { StatusBadge } from '@/components/StatusBadge';
import { Toast, type ToastState } from '@/components/Toast';
import { useDensity } from '@/contexts/DensityContext';
import { useTheme } from '@/contexts/ThemeContext';
import { useMediaSearch, useTrending } from '@/features/media/useMediaSearch';
import { useEntryMutations } from '@/features/watch/useEntryMutations';
import { useWatchEntries } from '@/features/watch/useWatchEntries';
import { track } from '@/lib/analytics';
import { tapHaptic } from '@/lib/haptics';
import { statusLabels } from '@/theme/tokens';
import type { MediaSummary, WatchStatus } from '@/media/types';

function useDebounced<T>(value: T, ms = 250): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), ms);
    return () => clearTimeout(id);
  }, [value, ms]);
  return debounced;
}

const STATUS_OPTIONS: WatchStatus[] = ['plan_to_watch', 'watching', 'completed'];

export default function Search() {
  const { colors } = useTheme();
  const { spacing } = useDensity();
  const router = useRouter();
  const { add, update, remove } = useEntryMutations('search');

  const { data: entries } = useWatchEntries();
  const trackedEntry = useMemo(() => {
    const map = new Map<string, { id: string; status: WatchStatus }>();
    for (const e of entries ?? [])
      map.set(`${e.media.media_type}-${e.media.tmdb_id}`, { id: e.id, status: e.status });
    return map;
  }, [entries]);

  const [query, setQuery] = useState('');
  const debounced = useDebounced(query);
  const { data: results, isLoading } = useMediaSearch(debounced);
  const { data: trending, isLoading: trendingLoading } = useTrending();
  const showTrending = debounced.trim().length === 0;

  // One event per distinct query, once its results have landed. The text
  // itself is never sent — only how long it was and how many titles came back,
  // which is what tells us whether search is finding things.
  const lastTracked = useRef<string | null>(null);
  useEffect(() => {
    const q = debounced.trim();
    if (!q || isLoading || !results || lastTracked.current === q) return;
    lastTracked.current = q;
    track('search_performed', { query_length: q.length, result_count: results.length });
  }, [debounced, isLoading, results]);

  const [selected, setSelected] = useState<MediaSummary | null>(null);
  const [ratingFor, setRatingFor] = useState<{ entryId: string; title: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<ToastState | null>(null);

  const chooseStatus = async (summary: MediaSummary, status: WatchStatus) => {
    setBusy(true);
    try {
      const entry = await add.mutateAsync({ summary, status });
      setSelected(null);
      tapHaptic();
      // Stay in search so you can keep adding — the result row now shows its
      // status badge. Passing to "vu" still offers the optional rating.
      if (status === 'completed') {
        setRatingFor({ entryId: entry.id, title: summary.title });
      }
    } finally {
      setBusy(false);
    }
  };

  const submitRating = async (rating: number | null, notes: string | null) => {
    if (ratingFor) await update.mutateAsync({ entryId: ratingFor.entryId, patch: { rating, notes } });
    setRatingFor(null);
  };

  // Tapping a result row opens its detail sheet; adding is reserved for the "+".
  const openMedia = (item: MediaSummary) => {
    Keyboard.dismiss();
    track('media_opened', {
      media_type: item.mediaType,
      tmdb_id: item.tmdbId,
      source: showTrending ? 'trending' : 'search',
    });
    router.push({ pathname: '/media/[id]', params: { id: String(item.tmdbId), type: item.mediaType } });
  };

  // Re-tapping the status tag removes the entry, with an "Annuler" toast that
  // re-adds it — an easy fix for a mis-add.
  const removeEntry = (item: MediaSummary, status: WatchStatus, entryId: string) => {
    tapHaptic();
    remove.mutate(entryId);
    setToast({
      message: 'Retiré de ton suivi',
      onUndo: () => add.mutate({ summary: item, status }),
    });
  };

  const listData = useMemo(
    () => (showTrending ? trending ?? [] : results ?? []),
    [showTrending, trending, results],
  );
  const loading = showTrending ? trendingLoading : isLoading;

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: colors.bg }]} edges={['top']}>
      <View style={[styles.header, { paddingHorizontal: spacing.screenPadding }]}>
        <View style={[styles.searchBox, { backgroundColor: colors.surfaceAlt }]}>
          <Ionicons name="search" size={18} color={colors.textMeta} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Rechercher un film ou une série"
            placeholderTextColor={colors.textMeta}
            style={[styles.input, { color: colors.textPrimary }]}
            returnKeyType="search"
          />
        </View>
        <Pressable onPress={() => router.back()} hitSlop={8} accessibilityRole="button">
          <Text style={[styles.cancel, { color: colors.accentInk }]}>Annuler</Text>
        </Pressable>
      </View>

      {/* Tapping anywhere outside the field closes the keyboard — with no list to
          scroll, these branches are the only thing left to tap. */}
      {loading ? (
        <Pressable style={styles.center} onPress={Keyboard.dismiss} accessible={false}>
          <ActivityIndicator color={colors.accentInk} />
        </Pressable>
      ) : listData.length === 0 ? (
        <Pressable style={styles.fill} onPress={Keyboard.dismiss} accessible={false}>
          <EmptyState
            icon="film-outline"
            title={showTrending ? 'Cherche un titre' : 'Aucun résultat'}
            message={
              showTrending
                ? 'Tape le nom d’un film ou d’une série pour l’ajouter à ton suivi.'
                : 'Essaie un autre nom — orthographe ou titre original.'
            }
          />
        </Pressable>
      ) : (
        <FlatList
          data={listData}
          keyExtractor={(item) => `${item.mediaType}-${item.tmdbId}`}
          // Taps on rows still go through; scrolling the results puts the
          // keyboard away, as everywhere else on iOS.
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          ListHeaderComponent={
            showTrending ? <SectionHeader>Tendances cette semaine</SectionHeader> : null
          }
          contentContainerStyle={{ paddingHorizontal: spacing.screenPadding, paddingBottom: 40 }}
          renderItem={({ item }) => {
            const typeLabel = item.mediaType === 'tv' ? 'Série' : 'Film';
            const year = item.releaseDate ? item.releaseDate.slice(0, 4) : null;
            const tracked = trackedEntry.get(`${item.mediaType}-${item.tmdbId}`);
            return (
              <ListRow
                seed={`${item.tmdbId}`}
                title={item.title}
                posterPath={item.posterPath}
                subtitle={year ? `${typeLabel} · ${year}` : typeLabel}
                onPress={() => openMedia(item)}
                right={
                  tracked ? (
                    <Pressable
                      onPress={() => removeEntry(item, tracked.status, tracked.id)}
                      hitSlop={8}
                      accessibilityRole="button"
                      accessibilityLabel="Retirer de mon suivi"
                    >
                      <StatusBadge status={tracked.status} />
                    </Pressable>
                  ) : (
                    <Pressable
                      onPress={() => {
                        // The status sheet slides up from the bottom — the
                        // keyboard would otherwise cover it.
                        Keyboard.dismiss();
                        setSelected(item);
                      }}
                      hitSlop={8}
                      accessibilityRole="button"
                      accessibilityLabel="Ajouter"
                    >
                      <Ionicons name="add-circle-outline" size={24} color={colors.accentInk} />
                    </Pressable>
                  )
                }
              />
            );
          }}
        />
      )}

      {/* Status chooser */}
      {selected ? (
        <Pressable
          style={[styles.backdrop, { backgroundColor: colors.overlay }]}
          onPress={() => (busy ? null : setSelected(null))}
        >
          <Pressable
            style={[styles.sheet, { backgroundColor: colors.surface }]}
            onPress={(e) => e.stopPropagation()}
          >
            <View style={[styles.handle, { backgroundColor: colors.border }]} />
            <Text style={[styles.sheetTitle, { color: colors.textPrimary }]} numberOfLines={1}>
              {selected.title}
            </Text>
            <Text style={[styles.sheetSub, { color: colors.textSecondary }]}>Ajouter comme…</Text>
            {STATUS_OPTIONS.map((status) => (
              <Pressable
                key={status}
                onPress={() => chooseStatus(selected, status)}
                disabled={busy}
                style={[styles.statusBtn, { borderColor: colors.border }]}
                accessibilityRole="button"
              >
                <Text style={[styles.statusText, { color: colors.textPrimary }]}>
                  {statusLabels[status]}
                </Text>
                <Ionicons name="chevron-forward" size={18} color={colors.textMeta} />
              </Pressable>
            ))}
          </Pressable>
        </Pressable>
      ) : null}

      <RatingSheet
        visible={!!ratingFor}
        title={ratingFor?.title ?? ''}
        onSubmit={submitRating}
        onSkip={() => setRatingFor(null)}
      />
      <Toast toast={toast} onDismiss={() => setToast(null)} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  fill: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    gap: 12,
  },
  searchBox: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    height: 42,
    borderRadius: 12,
    paddingHorizontal: 12,
    gap: 8,
  },
  input: { flex: 1, fontSize: 16 },
  cancel: { fontSize: 16, fontWeight: '600' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  backdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'flex-end',
  },
  sheet: { borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: 34 },
  handle: { width: 40, height: 4, borderRadius: 2, alignSelf: 'center', marginBottom: 16 },
  sheetTitle: { fontSize: 20, fontWeight: '700' },
  sheetSub: { fontSize: 14, marginTop: 4, marginBottom: 16 },
  statusBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    height: 52,
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 16,
    marginBottom: 10,
  },
  statusText: { fontSize: 16, fontWeight: '600' },
});
