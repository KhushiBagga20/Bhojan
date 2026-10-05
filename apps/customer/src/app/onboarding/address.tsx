import { router } from 'expo-router';
import { Button, LoadingState, Screen, StepIndicator, Text } from '@/components';
import { AddressFields, EMPTY_ADDRESS, useAddressForm, type AddressValues } from '@/features/AddressForm';
import { saveDraft, useDraft } from '@/lib/draft';

/** Onboarding step 1. Kept on the device until the person signs in. */
export default function OnboardingAddress() {
  const draft = useDraft();
  if (draft.isPending) {
    return (
      <Screen back>
        <LoadingState />
      </Screen>
    );
  }
  const saved = draft.data?.address;
  return (
    <AddressStep
      initial={saved ? { ...EMPTY_ADDRESS, ...saved, instructions: saved.instructions ?? '' } : EMPTY_ADDRESS}
    />
  );
}

function AddressStep({ initial }: { initial: AddressValues }) {
  const form = useAddressForm(initial);

  const onContinue = async () => {
    const values = form.submit();
    if (!values) return;
    await saveDraft({ address: values });
    router.push('/onboarding/preferences');
  };

  return (
    <Screen
      keyboard
      back
      title="Where should we deliver?"
      subtitle="We'll show you home kitchens that deliver to this address."
      footer={<Button label="Continue" icon="forward" onPress={onContinue} />}
    >
      <StepIndicator step={1} total={2} />
      <AddressFields form={form} />
      <Text variant="secondary" color="textSecondary">
        Your address is only shared with the kitchen that cooks for you.
      </Text>
    </Screen>
  );
}
