import { MutationCache, QueryClient } from '@tanstack/react-query';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { Stack, useRouter, useSegments } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { Alert, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { AnalyticsProvider } from '@/contexts/AnalyticsContext';
import { AuthProvider, useAuth } from '@/contexts/AuthContext';
import { DensityProvider } from '@/contexts/DensityContext';
import { ThemeProvider, useTheme } from '@/contexts/ThemeContext';
import { NasConfigProvider } from '@/features/nas/NasConfigContext';
import { PushRegistrationProvider } from '@/features/notifications/PushRegistrationContext';
import { QUERY_CACHE_MAX_AGE, queryPersister } from '@/lib/queryPersist';

// Splash grounds, kept in sync with the expo-splash-screen plugin in app.json.
const SPLASH_LIGHT = '#F5C518';
const SPLASH_DARK = '#17140C';

// Hold the native splash (brand ground + timeline mark) until auth has settled.
// Otherwise it hides as soon as JS mounts and the app shows a bare white screen
// with a spinner while the session loads. Called at module scope, not in a hook:
// by the time a component runs, the splash may already be gone.
SplashScreen.preventAutoHideAsync().catch(() => {
  // Already hidden — nothing left to hold.
});
SplashScreen.setOptions({ fade: true, duration: 250 });

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 30_000, retry: 1 } },
  // Screens fire mutations without their own error handling, so a failed write
  // (rejected insert, network drop) would otherwise vanish silently.
  mutationCache: new MutationCache({
    onError: (error) => {
      console.warn('[mutation]', error);
      Alert.alert('Action impossible', 'La modification n’a pas pu être enregistrée. Réessaie.');
    },
  }),
});

function useProtectedRoute() {
  const { session, profile, initializing } = useAuth();
  const segments = useSegments() as string[];
  const router = useRouter();

  useEffect(() => {
    if (initializing) return;
    // Session present but profile row not yet fetched: wait to avoid a flash.
    if (session && !profile) return;

    const inAuthGroup = segments[0] === '(auth)';

    if (!session) {
      if (!inAuthGroup) router.replace('/(auth)/sign-in');
      return;
    }

    if (profile && !profile.username) {
      const onOnboarding = inAuthGroup && segments[1] === 'onboarding';
      if (!onOnboarding) router.replace('/(auth)/onboarding');
      return;
    }

    // Authenticated & onboarded: bounce away from root / auth screens.
    if (segments.length === 0 || inAuthGroup) {
      router.replace('/(tabs)');
    }
  }, [session, profile, initializing, segments, router]);
}

function RootNavigator() {
  const { initializing, session, profile } = useAuth();
  const { colors, scheme } = useTheme();
  useProtectedRoute();

  const gating = initializing || (session && !profile);

  // Reveal the app only once there's something real to show.
  useEffect(() => {
    if (!gating) SplashScreen.hide();
  }, [gating]);

  if (gating) {
    // The native splash still covers this view; paint it the same ground so an
    // early hide lands on the brand colour instead of a white flash.
    return (
      <View style={{ flex: 1, backgroundColor: scheme === 'dark' ? SPLASH_DARK : SPLASH_LIGHT }} />
    );
  }

  return (
    <>
      <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg } }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="media/[id]" options={{ headerShown: false }} />
        <Stack.Screen name="search" options={{ presentation: 'modal' }} />
      </Stack>
    </>
  );
}

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <PersistQueryClientProvider
          client={queryClient}
          persistOptions={{
            persister: queryPersister,
            maxAge: QUERY_CACHE_MAX_AGE,
            // Only successful queries are worth restoring; a failed fetch should
            // retry on the next launch, not come back as stale truth.
            dehydrateOptions: {
              shouldDehydrateQuery: (query) => query.state.status === 'success',
            },
          }}
        >
          <AuthProvider>
            <ThemeProvider>
              <DensityProvider>
                <AnalyticsProvider>
                  <PushRegistrationProvider>
                    <NasConfigProvider>
                      <RootNavigator />
                    </NasConfigProvider>
                  </PushRegistrationProvider>
                </AnalyticsProvider>
              </DensityProvider>
            </ThemeProvider>
          </AuthProvider>
        </PersistQueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
