import { Pressable, StyleSheet, Text, View } from 'react-native';

import { PosterPlaceholder } from '@/components/PosterPlaceholder';
import { useDensity } from '@/contexts/DensityContext';
import { useTheme } from '@/contexts/ThemeContext';

interface Props {
  seed: string;
  title: string;
  posterPath?: string | null;
  /** Always contextualized — never a raw date ("sort demain", "S3E7 dispo"). */
  subtitle: string;
  onPress?: () => void;
  /** Optional trailing element (badge, chevron, rating…). */
  right?: React.ReactNode;
}

/** Poster + title + contextual subtext. Shared by timeline & watchlist rows. */
export function ListRow({ seed, title, posterPath, subtitle, onPress, right }: Props) {
  const { colors } = useTheme();
  const { spacing, density } = useDensity();
  const posterW = density === 'compact' ? 40 : 48;

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.row,
        {
          paddingVertical: spacing.sm,
          opacity: pressed && onPress ? 0.6 : 1,
        },
      ]}
      accessibilityRole={onPress ? 'button' : undefined}
    >
      <PosterPlaceholder
        seed={seed}
        title={title}
        posterPath={posterPath}
        width={posterW}
        radius={spacing.posterRadius}
      />
      <View style={[styles.text, { marginLeft: spacing.md }]}>
        <Text numberOfLines={1} style={[styles.title, { color: colors.textPrimary }]}>
          {title}
        </Text>
        <Text numberOfLines={1} style={[styles.subtitle, { color: colors.textSecondary }]}>
          {subtitle}
        </Text>
      </View>
      {right ? <View style={styles.right}>{right}</View> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
  text: { flex: 1 },
  title: { fontSize: 16, fontWeight: '600', marginBottom: 2 },
  subtitle: { fontSize: 13, fontWeight: '500' },
  right: { marginLeft: 10 },
});
