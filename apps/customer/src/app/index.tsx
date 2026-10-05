import { Redirect } from 'expo-router';
import { ErrorState, LoadingState, Screen } from '@/components';
import { useProfile } from '@/lib/api';
import { useSession } from '@/lib/session';

/** Decides where the app opens: welcome, finishing sign-up, or home. */
export default function Index() {
  const { session, initializing } = useSession();
  const profile = useProfile();

  if (initializing || (session && profile.isPending)) {
    return (
      <Screen>
        <LoadingState message="Opening Bhojan…" />
      </Screen>
    );
  }
  if (!session) return <Redirect href="/welcome" />;
  if (profile.error) {
    return (
      <Screen>
        <ErrorState error={profile.error} action="opening your account" onRetry={() => profile.refetch()} />
      </Screen>
    );
  }
  if (!profile.data?.name) return <Redirect href="/sign-in/name" />;
  return <Redirect href="/(tabs)" />;
}
