import { Pressable, StyleSheet, Text, View } from 'react-native';

import { CardRow } from '@/components/CardRow';
import { useTheme } from '@/contexts/ThemeContext';
import { nudgeBlock } from '../../../supabase/functions/recommend-media/rules';
import type { RecommendationItem } from './feed';

interface Props {
  item: RecommendationItem;
  onOpen: () => void;
  onAdd: () => void;
  onDismiss: () => void;
  onNudge: () => void;
}

function Pill({
  label,
  onPress,
  primary,
}: {
  label: string;
  onPress: () => void;
  primary?: boolean;
}) {
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      hitSlop={6}
      style={[styles.pill, { backgroundColor: primary ? colors.accent : colors.surfaceAlt }]}
      accessibilityRole="button"
    >
      <Text style={[styles.pillText, { color: primary ? colors.accentText : colors.textPrimary }]}>
        {label}
      </Text>
    </Pressable>
  );
}

/** One recommendation, sent or received. The arrow and "De / À" carry the direction;
 *  the accent is kept for what's new, so it keeps meaning "this needs you". */
export function RecommendationRow({ item, onOpen, onAdd, onDismiss, onNudge }: Props) {
  const { colors } = useTheme();
  const { rec, direction, other, unseen, inMyList } = item;
  const name = other?.username ? `@${other.username}` : 'Un ami';
  const kind = rec.media.media_type === 'tv' ? 'Série' : 'Film';
  const subtitle = direction === 'received' ? `↙ De ${name} · ${kind}` : `↗ À ${name} · ${kind}`;
  const blocked = nudgeBlock(rec, Date.now());

  return (
    <CardRow
      seed={`${rec.media.tmdb_id}`}
      title={rec.media.title}
      posterPath={rec.media.poster_path}
      backdropPath={rec.media.backdrop_path}
      subtitle={subtitle}
      onPress={onOpen}
      style={unseen ? { borderLeftWidth: 3, borderLeftColor: colors.accentInk } : undefined}
      right={
        unseen ? (
          <View
            style={[styles.dot, { backgroundColor: colors.accentInk }]}
            accessibilityLabel="Nouveau"
          />
        ) : undefined
      }
      footer={
        <View style={styles.footer}>
          {rec.message ? (
            <Text style={[styles.message, { color: colors.textSecondary }]}>
              {`« ${rec.message} »`}
            </Text>
          ) : null}
          {direction === 'received' ? (
            inMyList ? (
              <Text style={[styles.status, { color: colors.textMeta }]}>Dans ta liste</Text>
            ) : (
              <View style={styles.actions}>
                <Pill label="Ajouter à ma liste" onPress={onAdd} primary />
                <Pill label="Pas pour moi" onPress={onDismiss} />
              </View>
            )
          ) : (
            <View style={styles.actions}>
              <Text style={[styles.status, { color: colors.textMeta }]}>
                {rec.added_at
                  ? 'Ajouté à sa liste'
                  : rec.nudge_count > 0
                    ? `Relancé ${rec.nudge_count} fois`
                    : 'Envoyé'}
              </Text>
              {blocked === null ? (
                <Pill label="Relancer" onPress={onNudge} />
              ) : blocked === 'cooldown' ? (
                <Text style={[styles.status, { color: colors.textMeta }]}>
                  · Relance possible demain
                </Text>
              ) : null}
            </View>
          )}
        </View>
      }
    />
  );
}

const styles = StyleSheet.create({
  dot: { width: 9, height: 9, borderRadius: 5 },
  footer: { marginTop: 8, gap: 8 },
  message: { fontSize: 14, fontStyle: 'italic', lineHeight: 19 },
  actions: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8 },
  status: { fontSize: 13, fontWeight: '600' },
  pill: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999 },
  pillText: { fontSize: 13, fontWeight: '700' },
});
