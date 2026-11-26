import { useMemo, useRef, useState, type RefObject } from 'react';
import {
  Dimensions,
  Pressable,
  StyleSheet,
  Text,
  View,
  type LayoutChangeEvent,
} from 'react-native';
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
  /** Parent scroll view — used to jump to the current month on open. */
  scrollRef?: RefObject<ScrollLike | null>;
  /** Called right before the programmatic jump, so the parent can ignore the
   *  resulting scroll event (e.g. keep a floating header visible). */
  onBeforeJump?: () => void;
  /** Jump to the current month on open. Off when the parent is restoring a
   *  previously saved scroll position instead. */
  autoJump?: boolean;
}

/** Minimal scroll surface the calendar needs — works for RN and Animated ScrollView. */
interface ScrollLike {
  scrollTo: (opts: { x?: number; y?: number; animated?: boolean }) => void;
}

const MIN_COLS = 1;
const MAX_COLS = 5;
const GAP = 10;

/** Vertical "photo library" style timeline: releases grouped by month, with a
 *  pinch gesture to change grid density (1 = one row per title, up to 5). */
export function UpcomingCalendar({
  items,
  onOpen,
  screenPadding,
  scrollRef,
  onBeforeJump,
  autoJump = true,
}: Props) {
  const { colors } = useTheme();
  const [columns, setColumns] = useState(3);

  // Jump the parent scroll to the current month (or the nearest upcoming one)
  // once both the calendar's offset and the target month's offset are known.
  const rootY = useRef<number | null>(null);
  const monthY = useRef<number | null>(null);
  const jumped = useRef(false);
  const tryJump = () => {
    if (
      !autoJump ||
      jumped.current ||
      rootY.current == null ||
      monthY.current == null ||
      !scrollRef?.current
    ) {
      return;
    }
    onBeforeJump?.();
    scrollRef.current.scrollTo({
      y: Math.max(0, rootY.current + monthY.current - 12),
      animated: false,
    });
    jumped.current = true;
  };

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

  // Coarser grouping the further back we go: current year + future are grouped
  // by month, past years are grouped by year.
  const months = useMemo(() => {
    const curYear = new Date().getFullYear();
    const map = new Map<string, { key: string; label: string; items: CalendarItem[] }>();
    for (const it of items) {
      const year = Number(it.date.slice(0, 4));
      const monthly = year >= curYear;
      const key = monthly ? it.date.slice(0, 7) : String(year);
      const label = monthly ? monthYearLabel(it.date) : String(year);
      let group = map.get(key);
      if (!group) {
        group = { key, label, items: [] };
        map.set(key, group);
      }
      group.items.push(it);
    }
    return [...map.values()].sort((a, b) => a.key.localeCompare(b.key));
  }, [items]);

  const now = new Date();
  const nowKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  // Current month if present, else the first upcoming one, else the latest.
  const targetKey = months.find((m) => m.key >= nowKey)?.key ?? months[months.length - 1]?.key;

  const availWidth = Dimensions.get('window').width - screenPadding * 2;
  const posterW = (availWidth - GAP * (columns - 1)) / columns;
  const listMode = columns === 1;

  return (
    <GestureDetector gesture={pinch}>
      <View
        onLayout={(e: LayoutChangeEvent) => {
          rootY.current = e.nativeEvent.layout.y;
          tryJump();
        }}
      >
        {months.map((month) => (
          <View
            key={month.key}
            onLayout={
              month.key === targetKey
                ? (e: LayoutChangeEvent) => {
                    monthY.current = e.nativeEvent.layout.y;
                    tryJump();
                  }
                : undefined
            }
          >
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
                    <PosterPlaceholder
                      seed={it.seed}
                      title={it.title}
                      posterPath={it.posterPath}
                      width={46}
                    />
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
                      <PosterPlaceholder
                        seed={it.seed}
                        title={it.title}
                        posterPath={it.posterPath}
                        width={posterW}
                      />
                      <View style={[styles.datePill, { backgroundColor: colors.overlay }]}>
                        <Text style={styles.datePillText}>{dayMonthLabel(it.date)}</Text>
                      </View>
                    </View>
                    {columns <= 3 ? (
                      <>
                        <Text
                          numberOfLines={1}
                          style={[styles.gridTitle, { color: colors.textPrimary }]}
                        >
                          {it.title}
                        </Text>
                        <Text
                          numberOfLines={1}
                          style={[styles.gridSub, { color: colors.textMeta }]}
                        >
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
