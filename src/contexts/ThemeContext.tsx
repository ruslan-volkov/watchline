import { createContext, useContext, useMemo } from 'react';
import { useColorScheme } from 'react-native';

import { useAuth } from '@/contexts/AuthContext';
import {
  colorTokens,
  statusColors,
  typography,
  type ColorScheme,
  type ColorTokens,
} from '@/theme/tokens';
import type { Enums } from '@/types/db';

type ThemePreference = Enums<'theme_pref'>;

interface ThemeContextValue {
  scheme: ColorScheme;
  preference: ThemePreference;
  colors: ColorTokens;
  status: (typeof statusColors)[ColorScheme];
  typography: typeof typography;
  setPreference: (pref: ThemePreference) => void;
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const { profile, updateProfile } = useAuth();
  const system = useColorScheme();
  const preference: ThemePreference = profile?.theme_preference ?? 'system';
  const scheme: ColorScheme =
    preference === 'system' ? (system === 'dark' ? 'dark' : 'light') : preference;

  const value = useMemo<ThemeContextValue>(
    () => ({
      scheme,
      preference,
      colors: colorTokens[scheme],
      status: statusColors[scheme],
      typography,
      setPreference: (pref) => {
        void updateProfile({ theme_preference: pref });
      },
    }),
    [scheme, preference, updateProfile],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider');
  return ctx;
}
