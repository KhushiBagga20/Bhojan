import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import { AppState, Platform } from 'react-native';
import type { Database } from '@bhojan/shared';

// Accept the dashboard's "REST URL" (…/rest/v1/) as well: the client adds that path itself.
const url = (process.env.EXPO_PUBLIC_SUPABASE_URL ?? '')
  .trim()
  .replace(/\/+$/, '')
  .replace(/\/rest\/v1$/, '');
const key = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '';

/** False until .env.local is filled in; the app shows setup instructions instead of crashing. */
export const isSupabaseConfigured = url.startsWith('http') && key.length > 20;

export const supabase = createClient<Database>(
  isSupabaseConfigured ? url : 'http://localhost:54321',
  key || 'not-configured',
  {
    auth: {
      // AsyncStorage works on iOS, Android and web alike.
      storage: AsyncStorage,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
    },
  },
);

// Refresh the session only while the app is in the foreground (native only; the
// browser handles this itself).
if (Platform.OS !== 'web') {
  AppState.addEventListener('change', (state) => {
    if (state === 'active') supabase.auth.startAutoRefresh();
    else supabase.auth.stopAutoRefresh();
  });
}
