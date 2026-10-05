import { QueryClientProvider } from '@tanstack/react-query';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { colors } from '@bhojan/shared';
import { SetupNeeded } from '@/features/SetupNeeded';
import { queryClient } from '@/lib/queryClient';
import { SessionProvider } from '@/lib/session';
import { isSupabaseConfigured } from '@/lib/supabase';
import { fontAssets, ThemeProvider, useTheme } from '@/theme';

SplashScreen.preventAutoHideAsync().catch(() => {});

function RootStack() {
  const { reduceMotion } = useTheme();
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        // Gentle, familiar transitions; none at all when motion is reduced.
        animation: reduceMotion ? 'none' : 'default',
        contentStyle: { backgroundColor: colors.background },
      }}
    />
  );
}

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts(fontAssets);

  useEffect(() => {
    if (fontsLoaded || fontError) SplashScreen.hideAsync().catch(() => {});
  }, [fontsLoaded, fontError]);

  // If fonts fail to load the system font is used; the app still works.
  if (!fontsLoaded && !fontError) return null;

  return (
    <SafeAreaProvider>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider>
          <StatusBar style="dark" />
          {isSupabaseConfigured ? (
            <SessionProvider>
              <RootStack />
            </SessionProvider>
          ) : (
            <SetupNeeded />
          )}
        </ThemeProvider>
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}
