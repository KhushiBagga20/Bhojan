import { useState } from 'react';
import { describeError, type DietaryPreference } from '@bhojan/shared';
import { Button, ErrorState, FormField, LoadingState, Notice, Screen, SectionHeader } from '@/components';
import { PreferenceChoices } from '@/features/PreferenceChoices';
import { RequireAuth } from '@/features/RequireAuth';
import { announce } from '@/lib/a11y';
import { useProfile, useUpdateProfile } from '@/lib/api';

export default function ProfileDetails() {
  return (
    <RequireAuth>
      <Details />
    </RequireAuth>
  );
}

function Details() {
  const profile = useProfile();
  if (profile.isPending) {
    return (
      <Screen back>
        <LoadingState />
      </Screen>
    );
  }
  if (profile.error || !profile.data) {
    return (
      <Screen back>
        <ErrorState error={profile.error} action="loading your details" onRetry={() => profile.refetch()} />
      </Screen>
    );
  }
  return (
    <DetailsForm
      initialName={profile.data.name ?? ''}
      initialPreferences={profile.data.dietary_preferences as DietaryPreference[]}
    />
  );
}

function DetailsForm({
  initialName,
  initialPreferences,
}: {
  initialName: string;
  initialPreferences: DietaryPreference[];
}) {
  const [name, setName] = useState(initialName);
  const [preferences, setPreferences] = useState(initialPreferences);
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const update = useUpdateProfile();

  const save = () => {
    if (!name.trim()) {
      setFieldError('Please tell us your name.');
      return;
    }
    update.mutate(
      { name: name.trim(), dietary_preferences: preferences },
      {
        onSuccess: () => {
          setSaved(true);
          announce('Your details are saved.');
        },
      },
    );
  };

  return (
    <Screen
      keyboard
      back
      title="Name and food preferences"
      footer={<Button label="Save changes" loading={update.isPending} loadingLabel="Saving…" onPress={save} />}
    >
      {saved ? (
        <Notice tone="success" message="Your details are saved. Your kitchen will see the updated preferences." />
      ) : null}
      {update.error ? (
        <Notice tone="danger" message={describeError(update.error, 'saving your details').message} />
      ) : null}
      <FormField
        label="Your name"
        value={name}
        onChangeText={(text) => {
          setName(text);
          setFieldError(null);
          setSaved(false);
        }}
        error={fieldError}
        autoCapitalize="words"
        maxLength={80}
      />
      <SectionHeader title="Food preferences" />
      <PreferenceChoices
        value={preferences}
        onChange={(next) => {
          setPreferences(next);
          setSaved(false);
        }}
      />
    </Screen>
  );
}
