import type { WatchStatus } from '@/media/types';

export type ColorScheme = 'light' | 'dark';
export type Density = 'comfortable' | 'compact';

/**
 * Semantic color tokens. A single source of truth resolved per color scheme —
 * no separate dark palette to maintain. `useTheme()` picks the active set.
 */
export interface ColorTokens {
  bg: string;
  surface: string;
  surfaceAlt: string;
  textPrimary: string;
  textSecondary: string;
  textMeta: string;
  accent: string;
  accentText: string;
  border: string;
  overlay: string;
  star: string;
  starEmpty: string;
  danger: string;
}

const light: ColorTokens = {
  bg: '#FBFAF8',
  surface: '#FFFFFF',
  surfaceAlt: '#F2EFEA',
  textPrimary: '#1F1B16',
  textSecondary: '#5E574E',
  textMeta: '#9A9187',
  accent: '#6C5CE7',
  accentText: '#FFFFFF',
  border: '#ECE7E0',
  overlay: 'rgba(0,0,0,0.45)',
  star: '#E8A33D',
  starEmpty: '#D9D3CA',
  danger: '#C0563E',
};

const dark: ColorTokens = {
  bg: '#141210',
  surface: '#1E1B18',
  surfaceAlt: '#282420',
  textPrimary: '#F5F1EB',
  textSecondary: '#B8B0A6',
  textMeta: '#7E766C',
  accent: '#9A8CFF',
  accentText: '#141210',
  border: '#332E29',
  overlay: 'rgba(0,0,0,0.6)',
  star: '#F0B44E',
  starEmpty: '#4A443D',
  danger: '#E0765C',
};

export const colorTokens: Record<ColorScheme, ColorTokens> = { light, dark };

/**
 * Status badge palette — light background + same-hue text (never black-on-color).
 * One entry per scheme so badges read correctly in both.
 */
export interface StatusColor {
  bg: string;
  fg: string;
}

export const statusColors: Record<ColorScheme, Record<WatchStatus, StatusColor>> = {
  light: {
    plan_to_watch: { bg: '#E8E4FB', fg: '#5B4BD1' },
    watching: { bg: '#DDF0E6', fg: '#2F7D52' },
    completed: { bg: '#F1E7DA', fg: '#8A6A3E' },
  },
  dark: {
    plan_to_watch: { bg: '#2E2952', fg: '#B7ADFF' },
    watching: { bg: '#1F3A2C', fg: '#7FD1A0' },
    completed: { bg: '#3A3122', fg: '#D6B888' },
  },
};

export const statusLabels: Record<WatchStatus, string> = {
  plan_to_watch: 'À voir',
  watching: 'En cours',
  completed: 'Vu',
};

/** Spacing scale that shifts with density — same components, two rhythms. */
export interface Spacing {
  xs: number;
  sm: number;
  md: number;
  lg: number;
  xl: number;
  rowGap: number;
  cardPadding: number;
  screenPadding: number;
  posterRadius: number;
  radius: number;
}

const comfortable: Spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 20,
  xl: 28,
  rowGap: 16,
  cardPadding: 16,
  screenPadding: 20,
  posterRadius: 12,
  radius: 16,
};

const compact: Spacing = {
  xs: 2,
  sm: 6,
  md: 8,
  lg: 12,
  xl: 18,
  rowGap: 8,
  cardPadding: 10,
  screenPadding: 14,
  posterRadius: 8,
  radius: 12,
};

export const spacingByDensity: Record<Density, Spacing> = { comfortable, compact };

/** Type scale (sentence case everywhere; simple hierarchy). */
export const typography = {
  screenTitle: { fontSize: 26, fontWeight: '700' as const, letterSpacing: -0.4 },
  sectionTitle: { fontSize: 13, fontWeight: '600' as const, letterSpacing: 0.3 },
  body: { fontSize: 16, fontWeight: '500' as const },
  bodyStrong: { fontSize: 16, fontWeight: '700' as const },
  meta: { fontSize: 13, fontWeight: '500' as const },
};
