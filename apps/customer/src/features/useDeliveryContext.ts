import type { DietaryPreference } from '@bhojan/shared';
import { useAddresses, useProfile } from '@/lib/api';
import { useDraft, type Place } from '@/lib/draft';
import { useSession } from '@/lib/session';

/**
 * Where to look for kitchens and what the person likes to eat.
 *
 * Someone with a saved delivery address is shown kitchens near that address,
 * because that is where the food has to go. Everyone else is shown kitchens
 * near the place they chose on this device (their location, or an area).
 */
export function useDeliveryContext() {
  const { session } = useSession();
  const profile = useProfile();
  const addresses = useAddresses();
  const draft = useDraft();

  const signedIn = !!session;
  const address = signedIn ? addresses.data?.[0] : undefined;
  const place: Place | undefined = address
    ? address.latitude !== null && address.longitude !== null
      ? {
          kind: 'coords',
          latitude: address.latitude,
          longitude: address.longitude,
          accuracy: null,
          capturedAt: address.updated_at,
        }
      : { kind: 'area', area: address.locality, city: address.city }
    : draft.data?.place;
  const preferences = (
    signedIn && profile.data?.dietary_preferences.length
      ? profile.data.dietary_preferences
      : (draft.data?.preferences ?? [])
  ) as DietaryPreference[];

  return {
    signedIn,
    isPending: draft.isPending || (signedIn && (addresses.isPending || profile.isPending)),
    place,
    /** The saved delivery address the place comes from, if there is one. */
    address,
    preferences,
  };
}
