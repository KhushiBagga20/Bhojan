import { Card, Screen, Text } from '@/components';

/** Shown to developers when the Supabase keys are missing, instead of a crash. */
export function SetupNeeded() {
  return (
    <Screen title="Almost ready" subtitle="Bhojan needs to be connected to its database.">
      <Card>
        <Text variant="body">1. Copy apps/customer/.env.example to apps/customer/.env.local</Text>
        <Text variant="body">2. Fill in EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY</Text>
        <Text variant="body">3. Restart with: npx expo start --clear</Text>
      </Card>
    </Screen>
  );
}
