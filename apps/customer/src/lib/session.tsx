import type { Session } from '@supabase/supabase-js';
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { isSupabaseConfigured, supabase } from './supabase';
import { queryClient } from './queryClient';

interface SessionContextValue {
  session: Session | null;
  userId: string | null;
  /** True until the stored session has been restored on launch. */
  initializing: boolean;
  signOut: () => Promise<void>;
}

const SessionContext = createContext<SessionContextValue | null>(null);

/**
 * Drops everything fetched for the previous person. Screens that are still on
 * show reload what is public; nothing is left waiting on data that was removed.
 */
function forgetCachedData(): void {
  void queryClient.resetQueries();
}

export function SessionProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [initializing, setInitializing] = useState(isSupabaseConfigured);

  useEffect(() => {
    if (!isSupabaseConfigured) return;
    supabase.auth
      .getSession()
      .then(({ data }) => setSession(data.session))
      .finally(() => setInitializing(false));

    const { data } = supabase.auth.onAuthStateChange((event, next) => {
      setSession(next);
      // Someone signing out must not leave their data behind for the next person.
      // Only on a real sign-out: at launch a signed-out visitor also arrives here
      // with no session, and wiping the cache then would strand the public lists
      // (kitchens, areas) that have already started loading.
      if (event === 'SIGNED_OUT') forgetCachedData();
    });
    return () => data.subscription.unsubscribe();
  }, []);

  const value = useMemo<SessionContextValue>(
    () => ({
      session,
      userId: session?.user.id ?? null,
      initializing,
      signOut: async () => {
        await supabase.auth.signOut();
        forgetCachedData();
      },
    }),
    [session, initializing],
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionContextValue {
  const value = useContext(SessionContext);
  if (!value) throw new Error('useSession must be used inside SessionProvider');
  return value;
}
