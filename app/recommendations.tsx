import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { EmptyState } from '@/components/EmptyState';
import { Toast, type ToastState } from '@/components/Toast';
import { useTheme } from '@/contexts/ThemeContext';
import { filterFeed, type FeedFilter, type RecommendationItem } from '@/features/recommendations/feed';
import { NudgeSheet } from '@/features/recommendations/NudgeSheet';
import { RecommendationRow } from '@/features/recommendations/RecommendationRow';
import { useRecommendationMutations } from '@/features/recommendations/useRecommendationMutations';
import { useRecommendations } from '@/features/recommendations/useRecommendations';
import { usePullRefresh } from '@/hooks/usePullRefresh';
import { track } from '@/lib/analytics';

const FILTERS: { key: FeedFilter; label: string }[] = [
  { key: 'all', label: 'Tout' },
  { key: 'received', label: 'Reçues' },
  { key: 'sent', label: 'Envoyées' },
];

const EMPTY_MESSAGES: Record<FeedFilter, string> = {
  all: 'Ouvre un film ou une série et touche l’avion en papier pour le conseiller à un ami.',
  received: 'Les titres que tes amis te conseillent arriveront ici.',
  sent: 'Ouvre un film ou une série et touche l’avion en papier pour le conseiller à un ami.',
};

export default function Recommendations() {
  const { colors } = useTheme();
  const router = useRouter();
  const { isLoading, items } = useRecommendations();
  const { addToList, dismiss, markSeen } = useRecommendationMutations();
  const { refreshing, onRefresh } = usePullRefresh([['recommendations']]);

  const [filter, setFilter] = useState<FeedFilter>('all');
  const [nudging, setNudging] = useState<RecommendationItem | null>(null);
  const [toast, setToast] = useState<ToastState | null>(null);

  const visible = useMemo(() => filterFeed(items, filter), [items, filter]);

  // On leaving rather than on arrival: new rows keep their highlight while they're read.
  useFocusEffect(useCallback(() => markSeen, [markSeen]));

  const openMedia = ({ rec }: RecommendationItem) => {
    const { tmdb_id: tmdbId, media_type: type } = rec.media;
    track('media_opened', { media_type: type, tmdb_id: tmdbId, source: 'recommendations' });
    router.push({ pathname: '/media/[id]', params: { id: String(tmdbId), type } });
  };

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: colors.bg }]} edges={['top']}>
      <View style={styles.topBar}>
        <Pressable onPress={() => router.back()} hitSlop={10} accessibilityRole="button">
          <Ionicons name="chevron-back" size={26} color={colors.textPrimary} />
        </Pressable>
        <Text style={[styles.title, { color: colors.textPrimary }]}>Recommandations</Text>
        <View style={{ width: 26 }} />
      </View>

      <View style={styles.filters}>
        {FILTERS.map((f) => {
          const active = filter === f.key;
          return (
            <Pressable
              key={f.key}
              onPress={() => setFilter(f.key)}
              style={[styles.chip, { backgroundColor: active ? colors.accent : colors.surfaceAlt }]}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
            >
              <Text
                style={[
                  styles.chipText,
                  { color: active ? colors.accentText : colors.textSecondary },
                ]}
              >
                {f.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.accentInk} />
        </View>
      ) : (
        <FlatList
          data={visible}
          keyExtractor={(item) => item.rec.id}
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={colors.textSecondary}
            />
          }
          ListEmptyComponent={
            <EmptyState
              icon="paper-plane-outline"
              title="Rien pour l’instant"
              message={EMPTY_MESSAGES[filter]}
            />
          }
          renderItem={({ item }) => (
            <RecommendationRow
              item={item}
              onOpen={() => openMedia(item)}
              onAdd={() => addToList.mutate(item)}
              onDismiss={() => dismiss.mutate(item.rec.id)}
              onNudge={() => setNudging(item)}
            />
          )}
        />
      )}

      <NudgeSheet
        item={nudging}
        onClose={() => setNudging(null)}
        onSent={() => {
          setNudging(null);
          setToast({ message: 'Relance envoyée' });
        }}
      />
      <Toast toast={toast} onDismiss={() => setToast(null)} />
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
  title: { fontSize: 18, fontWeight: '700' },
  filters: { flexDirection: 'row', gap: 8, paddingHorizontal: 20, paddingVertical: 8 },
  chip: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 999 },
  chipText: { fontSize: 14, fontWeight: '600' },
  content: { paddingHorizontal: 20, paddingTop: 4, paddingBottom: 40, flexGrow: 1 },
});
