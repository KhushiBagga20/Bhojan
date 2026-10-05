'use client';

import type { Session } from '@supabase/supabase-js';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { isOfflineError } from '@bhojan/shared';
import { isSupabaseConfigured, supabase } from '@/lib/supabase';

interface SessionValue {
  session: Session | null;
  userId: string | null;
  initializing: boolean;
  signOut: () => Promise<void>;
}

const SessionContext = createContext<SessionValue | null>(null);

export function useSession(): SessionValue {
  const value = useContext(SessionContext);
  if (!value) throw new Error('useSession must be used inside Providers');
  return value;
}

export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: { staleTime: 20_000, retry: (count, error) => isOfflineError(error) && count < 2 },
          mutations: { retry: false },
        },
      }),
  );
  const [session, setSession] = useState<Session | null>(null);
  const [initializing, setInitializing] = useState(isSupabaseConfigured);

  useEffect(() => {
    if (!isSupabaseConfigured) return;
    supabase.auth
      .getSession()
      .then(({ data }) => setSession(data.session))
      .finally(() => setInitializing(false));
    const { data } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next);
      if (!next) queryClient.clear();
    });
    return () => data.subscription.unsubscribe();
  }, [queryClient]);

  const value = useMemo<SessionValue>(
    () => ({
      session,
      userId: session?.user.id ?? null,
      initializing,
      signOut: async () => {
        await supabase.auth.signOut();
        queryClient.clear();
      },
    }),
    [session, initializing, queryClient],
  );

  return (
    <QueryClientProvider client={queryClient}>
      <SessionContext.Provider value={value}>{children}</SessionContext.Provider>
    </QueryClientProvider>
  );
}
