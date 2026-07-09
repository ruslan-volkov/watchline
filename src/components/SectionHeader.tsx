import { StyleSheet, Text } from 'react-native';

import { useDensity } from '@/contexts/DensityContext';
import { useTheme } from '@/contexts/ThemeContext';

/** Discreet section title (uppercase, muted) — the quiet tier of the hierarchy. */
export function SectionHeader({ children }: { children: string }) {
  const { colors, typography } = useTheme();
  const { spacing } = useDensity();
  return (
    <Text
      style={[
        styles.text,
        typography.sectionTitle,
        { color: colors.textMeta, marginBottom: spacing.sm, marginTop: spacing.lg },
      ]}
    >
      {children.toUpperCase()}
    </Text>
  );
}

const styles = StyleSheet.create({
  text: {},
});
