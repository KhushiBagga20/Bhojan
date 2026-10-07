import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { describeError, spacing } from '@bhojan/shared';
import { Button, ErrorState, LoadingState, Notice, Screen, SectionHeader, Text } from '@/components';
import { AddressFields, EMPTY_ADDRESS, useAddressForm, type AddressValues } from '@/features/AddressForm';
import { RequireAuth } from '@/features/RequireAuth';
import { useCurrentLocation } from '@/features/useCurrentLocation';
import { announce } from '@/lib/a11y';
import { useAddresses, useSaveAddress } from '@/lib/api';
import { useDraft } from '@/lib/draft';

export default function ProfileAddress() {
  return (
    <RequireAuth>
      <AddressScreen />
    </RequireAuth>
  );
}

type Coords = { latitude: number; longitude: number };

function AddressScreen() {
  const addresses = useAddresses();
  const draft = useDraft();
  if (addresses.isPending || draft.isPending) {
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
  if (current) {
    return (
      <AddressEditor
        id={current.id}
        initial={{
          address_line: current.address_line,
          locality: current.locality,
          city: current.city,
          instructions: current.instructions ?? '',
        }}
        savedCoords={
          current.latitude !== null && current.longitude !== null
            ? { latitude: current.latitude, longitude: current.longitude }
            : null
        }
      />
    );
  }
  // A first address starts from where the person already told us they are.
  const place = draft.data?.place;
  return (
    <AddressEditor
      initial={place?.kind === 'area' ? { ...EMPTY_ADDRESS, locality: place.area, city: place.city } : EMPTY_ADDRESS}
      savedCoords={null}
      suggestedCoords={place?.kind === 'coords' ? { latitude: place.latitude, longitude: place.longitude } : null}
    />
  );
}

function AddressEditor({
  id,
  initial,
  savedCoords,
  suggestedCoords = null,
}: {
  id?: string;
  initial: AddressValues;
  /** The location already stored with this address. */
  savedCoords: Coords | null;
  /** A location read earlier on this device, offered for a new address. */
  suggestedCoords?: Coords | null;
}) {
  const { returnTo } = useLocalSearchParams<{ returnTo?: string }>();
  const form = useAddressForm(initial);
  const save = useSaveAddress();
  const location = useCurrentLocation();
  const [saved, setSaved] = useState(false);
  const [coords, setCoords] = useState<Coords | null>(savedCoords ?? suggestedCoords);
  const coordsAreNew = coords !== savedCoords;

  const setFromDevice = async () => {
    const found = await location.find();
    if (!found) return;
    setCoords({ latitude: found.latitude, longitude: found.longitude });
    announce('Location set for this address. Remember to save.');
  };

  const onSave = () => {
    const values = form.submit();
    if (!values) return;
    save.mutate(
      {
        id,
        ...values,
        instructions: values.instructions || null,
        ...(coords && coordsAreNew ? coords : {}),
      },
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

      <View style={{ gap: spacing.sm }}>
        <SectionHeader title="Where this address is" />
        {coords ? (
          <Notice
            tone="success"
            message={
              coordsAreNew && savedCoords
                ? 'New location set. Tap “Save address” to keep it.'
                : 'Location set. Kitchens use it to check that they can deliver to you.'
            }
          />
        ) : (
          <Notice
            tone="highlight"
            message="No location yet. Without one, only kitchens that list your area can deliver to you."
          />
        )}
        {location.failure ? (
          <Notice tone="highlight" title={location.failure.title} message={location.failure.message} />
        ) : null}
        <Button
          label={coords ? 'Update to where I am now' : 'Use my current location'}
          variant="secondary"
          icon="location"
          loading={location.finding}
          loadingLabel="Finding where you are…"
          onPress={setFromDevice}
        />
        <Text variant="secondary" color="textSecondary">
          Tap this while you are at this address. Your location is only shared with the kitchen that cooks for you.
        </Text>
      </View>
    </Screen>
  );
}
