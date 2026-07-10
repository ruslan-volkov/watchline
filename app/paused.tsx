import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useMemo } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { EmptyState } from '@/components/EmptyState';
import { ListRow } from '@/components/ListRow';
import { useTheme } from '@/contexts/ThemeContext';
import { useEntryMutations } from '@/features/watch/useEntryMutations';
import { useWatchEntries } from '@/features/watch/useWatchEntries';
import { statusLabels } from '@/theme/tokens';
import type { MediaType } from '@/media/types';

export default function Paused() {
  const { colors } = useTheme();
  const router = useRouter();
  const { data: entries, isLoading } = useWatchEntries();
  const { update } = useEntryMutations();

  const paused = useMemo(() => (entries ?? []).filter((e) => e.snoozed), [entries]);

  const openMedia = (tmdbId: number, type: MediaType) =>
    router.push({ pathname: '/media/[id]', params: { id: String(tmdbId), type } });

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: colors.bg }]} edges={['top']}>
      <View style={styles.topBar}>
        <Pressable onPress={() => router.back()} hitSlop={10} accessibilityRole="button">
          <Ionicons name="chevron-back" size={26} color={colors.textPrimary} />
        </Pressable>
        <Text style={[styles.title, { color: colors.textPrimary }]}>En pause</Text>
        <View style={{ width: 26 }} />
      </View>

      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.accent} />
        </View>
      ) : paused.length === 0 ? (
        <EmptyState
          icon="pause-circle-outline"
          title="Rien en pause"
          message="Mets un titre de côté (glisse-le vers la gauche dans « À rattraper ») pour le retrouver ici."
        />
      ) : (
        <FlatList
          data={paused}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => (
            <ListRow
              seed={`${item.media.tmdb_id}`}
              title={item.media.title}
              posterPath={item.media.poster_path}
              subtitle={statusLabels[item.status]}
              onPress={() => openMedia(item.media.tmdb_id, item.media.media_type)}
              right={
                <Pressable
                  onPress={() => update.mutate({ entryId: item.id, patch: { snoozed: false } })}
                  style={[styles.resume, { backgroundColor: colors.accent }]}
                  accessibilityRole="button"
                >
                  <Text style={[styles.resumeText, { color: colors.accentText }]}>Reprendre</Text>
                </Pressable>
              }
            />
          )}
        />
      )}
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
  list: { paddingHorizontal: 20, paddingBottom: 24 },
  resume: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999 },
  resumeText: { fontSize: 13, fontWeight: '700' },
});
