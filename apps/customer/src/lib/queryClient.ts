import { focusManager, onlineManager, QueryClient } from '@tanstack/react-query';
import { AppState, Platform } from 'react-native';
import { isOfflineError } from '@bhojan/shared';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      // Don't retry errors that won't fix themselves (permissions, missing rows).
      retry: (failureCount, error) => isOfflineError(error) && failureCount < 2,
    },
    mutations: {
      retry: false,
    },
  },
});

// Refetch when the app comes back to the foreground so meal statuses are fresh.
if (Platform.OS !== 'web') {
  AppState.addEventListener('change', (state) => focusManager.setFocused(state === 'active'));
}

// Treat the app as online by default; failed requests surface a clear offline message.
onlineManager.setOnline(true);
