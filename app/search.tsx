import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
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
import { StatusBadge } from '@/components/StatusBadge';
import { useDensity } from '@/contexts/DensityContext';
import { useTheme } from '@/contexts/ThemeContext';
import { useMediaSearch } from '@/features/media/useMediaSearch';
import { useEntryMutations } from '@/features/watch/useEntryMutations';
import { useWatchEntries } from '@/features/watch/useWatchEntries';
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
  const { add, update } = useEntryMutations();

  const { data: entries } = useWatchEntries();
  const trackedStatus = useMemo(() => {
    const map = new Map<string, WatchStatus>();
    for (const e of entries ?? []) map.set(`${e.media.media_type}-${e.media.tmdb_id}`, e.status);
    return map;
  }, [entries]);

  const [query, setQuery] = useState('');
  const debounced = useDebounced(query);
  const { data: results, isLoading } = useMediaSearch(debounced);

  const [selected, setSelected] = useState<MediaSummary | null>(null);
  const [ratingFor, setRatingFor] = useState<{ entryId: string; title: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const chooseStatus = async (summary: MediaSummary, status: WatchStatus) => {
    setBusy(true);
    try {
      const entry = await add.mutateAsync({ summary, status });
      setSelected(null);
      if (status === 'completed') {
        // Passing to "vu" triggers optional rating.
        setRatingFor({ entryId: entry.id, title: summary.title });
      } else if (summary.mediaType === 'tv' && status === 'watching') {
        // Adding a series "en cours": open its sheet so you can tick what you've
        // already watched (per episode or whole seasons).
        router.back();
        router.push({ pathname: '/media/[id]', params: { id: String(summary.tmdbId), type: 'tv' } });
      } else {
        router.back();
      }
    } finally {
      setBusy(false);
    }
  };

  const submitRating = async (rating: number | null, notes: string | null) => {
    if (ratingFor) await update.mutateAsync({ entryId: ratingFor.entryId, patch: { rating, notes } });
    setRatingFor(null);
    router.back();
  };

  const listData = useMemo(() => results ?? [], [results]);

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
            autoFocus
            style={[styles.input, { color: colors.textPrimary }]}
            returnKeyType="search"
          />
        </View>
        <Pressable onPress={() => router.back()} hitSlop={8} accessibilityRole="button">
          <Text style={[styles.cancel, { color: colors.accent }]}>Annuler</Text>
        </Pressable>
      </View>

      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.accent} />
        </View>
      ) : listData.length === 0 ? (
        <EmptyState
          icon="film-outline"
          title={query ? 'Aucun résultat' : 'Cherche un titre'}
          message={
            query
              ? 'Essaie un autre nom — orthographe ou titre original.'
              : 'Tape le nom d’un film ou d’une série pour l’ajouter à ton suivi.'
          }
        />
      ) : (
        <FlatList
          data={listData}
          keyExtractor={(item) => `${item.mediaType}-${item.tmdbId}`}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ paddingHorizontal: spacing.screenPadding, paddingBottom: 40 }}
          renderItem={({ item }) => {
            const typeLabel = item.mediaType === 'tv' ? 'Série' : 'Film';
            const year = item.releaseDate ? item.releaseDate.slice(0, 4) : null;
            const tracked = trackedStatus.get(`${item.mediaType}-${item.tmdbId}`);
            return (
              <ListRow
                seed={`${item.tmdbId}`}
                title={item.title}
                posterPath={item.posterPath}
                subtitle={year ? `${typeLabel} · ${year}` : typeLabel}
                onPress={() => {
                  Keyboard.dismiss();
                  setSelected(item);
                }}
                right={
                  tracked ? (
                    <StatusBadge status={tracked} />
                  ) : (
                    <Ionicons name="add-circle-outline" size={24} color={colors.accent} />
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
        onSkip={() => {
          setRatingFor(null);
          router.back();
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
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
