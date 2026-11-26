import { useGlobalSearchParams, usePathname } from 'expo-router';
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

import { useAuth } from '@/contexts/AuthContext';
import {
  type AnalyticsProperties,
  identify,
  initAnalytics,
  isAnalyticsEnabled,
  resetIdentity,
  screenNameFromPath,
  setAnalyticsEnabled,
  trackScreen,
} from '@/lib/analytics';

interface AnalyticsContextValue {
  /** Whether usage statistics are being shared (the Profil switch). */
  enabled: boolean;
  setEnabled: (next: boolean) => void;
}

const AnalyticsContext = createContext<AnalyticsContextValue | undefined>(undefined);

/**
 * Wires the analytics module into the app's lifecycle: reads stored consent,
 * follows the signed-in account, and turns router navigation into `$screen`
 * events. Expo Router has no screen-tracking integration of its own — the
 * documented approach is to watch `usePathname()` from the root layout, which
 * is what the effect below does.
 *
 * Mounts under AuthProvider (it needs the session) and inside the router.
 */
export function AnalyticsProvider({ children }: { children: React.ReactNode }) {
  const { session, profile } = useAuth();
  const pathname = usePathname();
  const params = useGlobalSearchParams();
  // Nothing is sent before stored consent has been read, so an opted-out user
  // can't leak a launch or a first screen view through a race.
  const [ready, setReady] = useState(false);
  const [enabled, setEnabledState] = useState(isAnalyticsEnabled());

  useEffect(() => {
    let active = true;
    void initAnalytics().then(() => {
      if (!active) return;
      setEnabledState(isAnalyticsEnabled());
      setReady(true);
    });
    return () => {
      active = false;
    };
  }, []);

  const userId = session?.user.id ?? null;
  const username = profile?.username ?? null;

  useEffect(() => {
    if (!ready) return;
    if (userId) identify(userId, { username });
    else resetIdentity();
  }, [ready, userId, username]);

  // `useGlobalSearchParams` hands back a fresh object on every render, so the
  // effect keys off a serialised copy — otherwise one navigation would report
  // several screen views.
  const paramsKey = JSON.stringify(params ?? {});
  useEffect(() => {
    if (!ready) return;
    const parsed = JSON.parse(paramsKey) as AnalyticsProperties;
    trackScreen(screenNameFromPath(pathname), { path: pathname, ...parsed });
  }, [ready, pathname, paramsKey]);

  const setEnabled = useCallback((next: boolean) => {
    setEnabledState(next);
    void setAnalyticsEnabled(next);
  }, []);

  const value = useMemo<AnalyticsContextValue>(
    () => ({ enabled, setEnabled }),
    [enabled, setEnabled],
  );

  return <AnalyticsContext.Provider value={value}>{children}</AnalyticsContext.Provider>;
}

export function useAnalyticsConsent(): AnalyticsContextValue {
  const ctx = useContext(AnalyticsContext);
  if (!ctx) throw new Error('useAnalyticsConsent must be used within AnalyticsProvider');
  return ctx;
}
