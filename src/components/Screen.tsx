import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView, type Edge } from 'react-native-safe-area-context';

import { useDensity } from '@/contexts/DensityContext';
import { useTheme } from '@/contexts/ThemeContext';

interface Props {
  children: React.ReactNode;
  /** Screen title rendered at the top when provided. */
  title?: string;
  /** Element aligned to the right of the title (e.g. an add button). */
  headerRight?: React.ReactNode;
  edges?: Edge[];
  /** Set false to let a child (e.g. FlatList) own horizontal padding. */
  padded?: boolean;
}

/** Themed safe-area container with the standard screen-title header. */
export function Screen({ children, title, headerRight, edges = ['top'], padded = true }: Props) {
  const { colors, typography } = useTheme();
  const { spacing } = useDensity();

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: colors.bg }]} edges={edges}>
      {title ? (
        <View
          style={[
            styles.header,
            {
              paddingHorizontal: spacing.screenPadding,
              paddingTop: spacing.sm,
              paddingBottom: spacing.sm,
            },
          ]}
        >
          <Text style={[typography.screenTitle, { color: colors.textPrimary }]}>{title}</Text>
          {headerRight}
        </View>
      ) : null}
      <View
        style={[
          styles.body,
          padded && { paddingHorizontal: spacing.screenPadding },
          !title && { paddingTop: spacing.sm },
        ]}
      >
        {children}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  body: { flex: 1 },
});
