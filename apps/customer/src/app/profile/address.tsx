import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { describeError } from '@bhojan/shared';
import { Button, ErrorState, LoadingState, Notice, Screen, Text } from '@/components';
import { AddressFields, EMPTY_ADDRESS, useAddressForm, type AddressValues } from '@/features/AddressForm';
import { RequireAuth } from '@/features/RequireAuth';
import { announce } from '@/lib/a11y';
import { useAddresses, useSaveAddress } from '@/lib/api';

export default function ProfileAddress() {
  return (
    <RequireAuth>
      <AddressScreen />
    </RequireAuth>
  );
}

function AddressScreen() {
  const addresses = useAddresses();
  if (addresses.isPending) {
    return (
      <Screen back>
        <LoadingState />
      </Screen>
    );
  }
  if (addresses.error) {
    return (
      <Screen back>
        <ErrorState error={addresses.error} action="loading your address" onRetry={() => addresses.refetch()} />
      </Screen>
    );
  }
  const current = addresses.data?.[0];
  return (
    <AddressEditor
      id={current?.id}
      initial={
        current
          ? {
              address_line: current.address_line,
              locality: current.locality,
              city: current.city,
              pincode: current.pincode,
              instructions: current.instructions ?? '',
            }
          : EMPTY_ADDRESS
      }
    />
  );
}

function AddressEditor({ id, initial }: { id?: string; initial: AddressValues }) {
  const { returnTo } = useLocalSearchParams<{ returnTo?: string }>();
  const form = useAddressForm(initial);
  const save = useSaveAddress();
  const [saved, setSaved] = useState(false);

  const onSave = () => {
    const values = form.submit();
    if (!values) return;
    save.mutate(
      { id, ...values, instructions: values.instructions || null },
      {
        onSuccess: () => {
          announce('Your address is saved.');
          if (returnTo) router.back();
          else setSaved(true);
        },
      },
    );
  };

  return (
    <Screen
      keyboard
      back
      title={id ? 'Delivery address' : 'Add your address'}
      footer={<Button label="Save address" loading={save.isPending} loadingLabel="Saving…" onPress={onSave} />}
    >
      {saved ? (
        <Notice tone="success" message="Your address is saved. Upcoming meals will come to this address." />
      ) : null}
      {save.error ? <Notice tone="danger" message={describeError(save.error, 'saving your address').message} /> : null}
      {id ? (
        <Text variant="body" color="textSecondary">
          Changes apply to all your upcoming meals.
        </Text>
      ) : null}
      <AddressFields form={form} />
    </Screen>
  );
}
