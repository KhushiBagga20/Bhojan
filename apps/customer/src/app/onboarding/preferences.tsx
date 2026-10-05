import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import type { DietaryPreference } from '@bhojan/shared';
import { Button, Screen, StepIndicator, Text } from '@/components';
import { PreferenceChoices } from '@/features/PreferenceChoices';
import { saveDraft, useDraft } from '@/lib/draft';

/** Onboarding step 2 (optional). */
export default function OnboardingPreferences() {
  const draft = useDraft();
  const [selected, setSelected] = useState<DietaryPreference[]>(['VEGETARIAN']);

  useEffect(() => {
    if (draft.data?.preferences) setSelected(draft.data.preferences);
  }, [draft.data?.preferences]);

  const finish = async (preferences: DietaryPreference[]) => {
    await saveDraft({ preferences });
    router.push('/discover');
  };

  return (
    <Screen
      back
      title="What kind of meals do you prefer?"
      subtitle="Choose any that apply. Kitchens will see this when they cook for you."
      footer={
        <>
          <Button label="Continue" icon="forward" onPress={() => finish(selected)} />
          <Button label="Skip this step" variant="quiet" onPress={() => finish([])} />
        </>
      }
    >
      <StepIndicator step={2} total={2} />
      <PreferenceChoices value={selected} onChange={setSelected} />
      <Text variant="secondary" color="textSecondary">
        You can change these any time from the Me tab.
      </Text>
    </Screen>
  );
}
