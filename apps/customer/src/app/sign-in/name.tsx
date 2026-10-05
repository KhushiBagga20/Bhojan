import { router, useLocalSearchParams, type Href } from 'expo-router';
import { useState } from 'react';
import { describeError } from '@bhojan/shared';
import { Button, FormField, Notice, Screen } from '@/components';
import { RequireAuth } from '@/features/RequireAuth';
import { useUpdateProfile } from '@/lib/api';

export default function SignInName() {
  return (
    <RequireAuth>
      <NameStep />
    </RequireAuth>
  );
}

function NameStep() {
  const { returnTo } = useLocalSearchParams<{ returnTo?: string }>();
  const [name, setName] = useState('');
  const [fieldError, setFieldError] = useState<string | null>(null);
  const update = useUpdateProfile();

  const save = () => {
    const trimmed = name.trim();
    if (!trimmed) {
      setFieldError('Please tell us your name.');
      return;
    }
    update.mutate({ name: trimmed }, { onSuccess: () => router.replace((returnTo || '/(tabs)') as Href) });
  };

  return (
    <Screen
      keyboard
      title="What should we call you?"
      subtitle="This is how we'll greet you, and the name your kitchen will see."
      footer={
        <Button label="Continue" icon="forward" loading={update.isPending} loadingLabel="Saving…" onPress={save} />
      }
    >
      <FormField
        label="Your name"
        hint="For example: Mrs. Sharma, or Ramesh"
        value={name}
        onChangeText={(text) => {
          setName(text);
          setFieldError(null);
        }}
        error={fieldError}
        textContentType="name"
        autoComplete="name"
        autoCapitalize="words"
        maxLength={80}
        returnKeyType="done"
        onSubmitEditing={save}
      />
      {update.error ? <Notice tone="danger" message={describeError(update.error, 'saving your name').message} /> : null}
    </Screen>
  );
}
