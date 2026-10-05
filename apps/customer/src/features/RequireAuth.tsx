import { Redirect, usePathname } from 'expo-router';
import type { ReactNode } from 'react';
import { LoadingState, Screen } from '@/components';
import { useSession } from '@/lib/session';

/** Screens that need an account send people to sign in, then bring them back. */
export function RequireAuth({ children }: { children: ReactNode }) {
  const { session, initializing } = useSession();
  const pathname = usePathname();
  if (initializing) {
    return (
      <Screen>
        <LoadingState />
      </Screen>
    );
  }
  if (!session) return <Redirect href={{ pathname: '/sign-in/phone', params: { returnTo: pathname } }} />;
  return <>{children}</>;
}
