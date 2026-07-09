import { Image, type ImageStyle } from 'expo-image';
import { StyleSheet, Text, View, type ViewStyle } from 'react-native';

import { useTheme } from '@/contexts/ThemeContext';
import { posterColor, posterTextColor } from '@/theme/posterColors';

interface Props {
  /** Stable seed for the placeholder color (media id or tmdb id as string). */
  seed: string;
  title: string;
  posterPath?: string | null;
  width: number;
  /** Defaults to a 2:3 poster ratio. */
  height?: number;
  radius?: number;
  style?: ViewStyle;
}

/** Real poster when available, otherwise a deterministic pastel tile with the initial. */
export function PosterPlaceholder({
  seed,
  title,
  posterPath,
  width,
  height,
  radius = 12,
  style,
}: Props) {
  const { scheme } = useTheme();
  const h = height ?? Math.round(width * 1.5);

  if (posterPath) {
    return (
      <Image
        source={{ uri: posterPath }}
        style={[{ width, height: h, borderRadius: radius }, style as ImageStyle]}
        contentFit="cover"
        transition={150}
      />
    );
  }

  const initial = title.trim().charAt(0).toUpperCase() || '?';
  return (
    <View
      style={[
        styles.fill,
        {
          width,
          height: h,
          borderRadius: radius,
          backgroundColor: posterColor(seed, scheme),
        },
        style,
      ]}
    >
      <Text style={[styles.initial, { color: posterTextColor(seed, scheme), fontSize: width * 0.4 }]}>
        {initial}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { alignItems: 'center', justifyContent: 'center' },
  initial: { fontWeight: '800' },
});
