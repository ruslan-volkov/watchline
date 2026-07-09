import { createContext, useContext, useMemo } from 'react';

import { useAuth } from '@/contexts/AuthContext';
import { spacingByDensity, type Density, type Spacing } from '@/theme/tokens';

interface DensityContextValue {
  density: Density;
  spacing: Spacing;
  setDensity: (density: Density) => void;
}

const DensityContext = createContext<DensityContextValue | undefined>(undefined);

export function DensityProvider({ children }: { children: React.ReactNode }) {
  const { profile, updateProfile } = useAuth();
  const density: Density = profile?.density_preference ?? 'comfortable';

  const value = useMemo<DensityContextValue>(
    () => ({
      density,
      spacing: spacingByDensity[density],
      setDensity: (next) => {
        void updateProfile({ density_preference: next });
      },
    }),
    [density, updateProfile],
  );

  return <DensityContext.Provider value={value}>{children}</DensityContext.Provider>;
}

export function useDensity(): DensityContextValue {
  const ctx = useContext(DensityContext);
  if (!ctx) throw new Error('useDensity must be used within DensityProvider');
  return ctx;
}
