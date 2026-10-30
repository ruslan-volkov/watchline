import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useTheme } from '@/contexts/ThemeContext';
import { stateLabel, type DownloadState } from './state';

type IconName = React.ComponentProps<typeof Ionicons>['name'];

function useStateLook(state: DownloadState): { icon: IconName; color: string } {
  const { colors } = useTheme();
  switch (state.kind) {
    case 'none':
      return { icon: 'cloud-download-outline', color: colors.textMeta };
    case 'wanted':
    case 'queued':
      return { icon: 'time-outline', color: colors.accentInk };
    case 'downloading':
      return { icon: 'arrow-down-circle-outline', color: colors.accentInk };
    case 'downloaded':
      return { icon: 'cloud-done-outline', color: colors.success };
    case 'partial':
      return { icon: 'cloud-download-outline', color: colors.accentInk };
  }
}

interface Handlers {
  state: DownloadState;
  disabled?: boolean;
  onPress: () => void;
  /** Same request, with a quality profile picked by hand. */
  onLongPress: () => void;
}

/** Compact icon for a season or an episode: tap to request, long-press to choose a profile. */
export function DownloadIcon({ state, disabled, onPress, onLongPress }: Handlers) {
  const { icon, color } = useStateLook(state);
  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      disabled={disabled || state.kind === 'downloaded'}
      hitSlop={8}
      accessibilityRole="button"
      accessibilityLabel={stateLabel(state, 'Télécharger sur le NAS')}
    >
      <Ionicons name={icon} size={20} color={color} />
    </Pressable>
  );
}

/** Full-width row for a movie or a series: icon, state, tap to request. */
export function DownloadRow({
  idleLabel,
  ...handlers
}: Handlers & { idleLabel: string }) {
  const { colors } = useTheme();
  const { icon, color } = useStateLook(handlers.state);
  return (
    <Pressable
      onPress={handlers.onPress}
      onLongPress={handlers.onLongPress}
      disabled={handlers.disabled || handlers.state.kind === 'downloaded'}
      style={[styles.row, { borderColor: colors.border }]}
      accessibilityRole="button"
    >
      <Ionicons name={icon} size={22} color={color} />
      <View style={styles.text}>
        <Text style={[styles.label, { color: colors.textPrimary }]}>
          {stateLabel(handlers.state, idleLabel)}
        </Text>
        {handlers.state.kind === 'none' ? (
          <Text style={[styles.hint, { color: colors.textMeta }]}>
            Appui long pour choisir la qualité
          </Text>
        ) : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    borderWidth: 1,
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
  },
  text: { flex: 1 },
  label: { fontSize: 15, fontWeight: '600' },
  hint: { fontSize: 12, marginTop: 2 },
});
