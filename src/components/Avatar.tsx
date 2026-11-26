import { Image } from 'expo-image';
import { StyleSheet, Text, View } from 'react-native';

import { useTheme } from '@/contexts/ThemeContext';
import { posterColor, posterTextColor } from '@/theme/posterColors';

interface Props {
  name?: string | null;
  avatarUrl?: string | null;
  size?: number;
  /** Stable seed for the placeholder color; defaults to the name. */
  seed?: string;
}

/** Circular avatar: real image if available, else a colored initial. */
export function Avatar({ name, avatarUrl, size = 44, seed }: Props) {
  const { scheme } = useTheme();
  const initial = (name ?? '?').trim().charAt(0).toUpperCase() || '?';
  const key = seed ?? name ?? '?';

  if (avatarUrl) {
    return (
      <Image
        source={{ uri: avatarUrl }}
        style={{ width: size, height: size, borderRadius: size / 2 }}
        contentFit="cover"
      />
    );
  }

  return (
    <View
      style={[
        styles.fill,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: posterColor(key, scheme),
        },
      ]}
    >
      <Text
        style={{ color: posterTextColor(key, scheme), fontSize: size * 0.42, fontWeight: '800' }}
      >
        {initial}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { alignItems: 'center', justifyContent: 'center' },
});
