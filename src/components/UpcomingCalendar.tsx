import { useMemo, useState } from 'react';
import { Dimensions, Pressable, StyleSheet, Text, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { runOnJS } from 'react-native-reanimated';

import { PosterPlaceholder } from '@/components/PosterPlaceholder';
import { SectionHeader } from '@/components/SectionHeader';
import { useTheme } from '@/contexts/ThemeContext';
import { dayMonthLabel, monthYearLabel } from '@/utils/timeGrouping';
import type { MediaType } from '@/media/types';

export interface CalendarItem {
  key: string;
  date: string;
  seed: string;
  title: string;
  posterPath: string | null;
  subtitle: string;
  tmdbId: number;
  mediaType: MediaType;
}

interface Props {
  items: CalendarItem[];
  onOpen: (tmdbId: number, type: MediaType) => void;
  /** Horizontal padding of the parent, to compute poster widths. */
  screenPadding: number;
}

const MIN_COLS = 1;
const MAX_COLS = 5;
const GAP = 10;

/** Vertical "photo library" style timeline: releases grouped by month, with a
 *  pinch gesture to change grid density (1 = one row per title, up to 5). */
export function UpcomingCalendar({ items, onOpen, screenPadding }: Props) {
  const { colors } = useTheme();
  const [columns, setColumns] = useState(3);

  const step = (zoomIn: boolean) =>
    setColumns((c) => (zoomIn ? Math.max(MIN_COLS, c - 1) : Math.min(MAX_COLS, c + 1)));

  const pinch = useMemo(
    () =>
      Gesture.Pinch().onEnd((e) => {
        'worklet';
        if (e.scale > 1.2) runOnJS(step)(true);
        else if (e.scale < 0.85) runOnJS(step)(false);
      }),
    [],
  );

  const months = useMemo(() => {
    const map = new Map<string, CalendarItem[]>();
    for (const it of items) {
      const key = it.date.slice(0, 7);
      (map.get(key) ?? map.set(key, []).get(key)!).push(it);
    }
    return [...map.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([, list]) => ({ label: monthYearLabel(list[0].date), items: list }));
  }, [items]);

  const availWidth = Dimensions.get('window').width - screenPadding * 2;
  const posterW = (availWidth - GAP * (columns - 1)) / columns;
  const listMode = columns === 1;

  return (
    <GestureDetector gesture={pinch}>
      <View>
        {months.map((month) => (
          <View key={month.label}>
            <SectionHeader>{month.label}</SectionHeader>
            <View style={styles.grid}>
              {month.items.map((it) =>
                listMode ? (
                  <Pressable
                    key={it.key}
                    style={styles.listRow}
                    onPress={() => onOpen(it.tmdbId, it.mediaType)}
                    accessibilityRole="button"
                  >
                    <PosterPlaceholder seed={it.seed} title={it.title} posterPath={it.posterPath} width={46} />
                    <View style={styles.listText}>
                      <Text numberOfLines={1} style={[styles.title, { color: colors.textPrimary }]}>
                        {it.title}
                      </Text>
                      <Text numberOfLines={1} style={[styles.sub, { color: colors.textSecondary }]}>
                        {dayMonthLabel(it.date)} · {it.subtitle}
                      </Text>
                    </View>
                  </Pressable>
                ) : (
                  <Pressable
                    key={it.key}
                    style={{ width: posterW, marginBottom: 14 }}
                    onPress={() => onOpen(it.tmdbId, it.mediaType)}
                    accessibilityRole="button"
                  >
                    <View>
                      <PosterPlaceholder seed={it.seed} title={it.title} posterPath={it.posterPath} width={posterW} />
                      <View style={[styles.datePill, { backgroundColor: colors.overlay }]}>
                        <Text style={styles.datePillText}>{dayMonthLabel(it.date)}</Text>
                      </View>
                    </View>
                    {columns <= 3 ? (
                      <>
                        <Text numberOfLines={1} style={[styles.gridTitle, { color: colors.textPrimary }]}>
                          {it.title}
                        </Text>
                        <Text numberOfLines={1} style={[styles.gridSub, { color: colors.textMeta }]}>
                          {it.subtitle}
                        </Text>
                      </>
                    ) : null}
                  </Pressable>
                ),
              )}
            </View>
          </View>
        ))}
      </View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: GAP },
  listRow: { width: '100%', flexDirection: 'row', alignItems: 'center', paddingVertical: 8 },
  listText: { flex: 1, marginLeft: 12 },
  title: { fontSize: 16, fontWeight: '600', marginBottom: 2 },
  sub: { fontSize: 13, fontWeight: '500' },
  datePill: {
    position: 'absolute',
    top: 6,
    left: 6,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
  },
  datePillText: { color: '#fff', fontSize: 10, fontWeight: '600' },
  gridTitle: { fontSize: 13, fontWeight: '600', marginTop: 5 },
  gridSub: { fontSize: 11, fontWeight: '500', marginTop: 1 },
});
