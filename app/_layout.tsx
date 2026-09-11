import { MutationCache, QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { ActivityIndicator, Alert, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { AuthProvider, useAuth } from '@/contexts/AuthContext';
import { DensityProvider } from '@/contexts/DensityContext';
import { ThemeProvider, useTheme } from '@/contexts/ThemeContext';
import { usePushRegistration } from '@/features/notifications/usePushRegistration';

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
  usePushRegistration();

  const gating = initializing || (session && !profile);

  if (gating) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg }}>
        <ActivityIndicator color={colors.accentInk} />
      </View>
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
        <QueryClientProvider client={queryClient}>
          <AuthProvider>
            <ThemeProvider>
              <DensityProvider>
                <RootNavigator />
              </DensityProvider>
            </ThemeProvider>
          </AuthProvider>
        </QueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
