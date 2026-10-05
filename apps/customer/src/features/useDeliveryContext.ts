import type { DietaryPreference } from '@bhojan/shared';
import { useAddresses, useProfile } from '@/lib/api';
import { useDraft } from '@/lib/draft';
import { useSession } from '@/lib/session';

/**
 * Where the person wants food delivered and what they like to eat, from their
 * account when signed in, otherwise from what they entered during onboarding.
 */
export function useDeliveryContext() {
  const { session } = useSession();
  const profile = useProfile();
  const addresses = useAddresses();
  const draft = useDraft();

  const signedIn = !!session;
  const address = signedIn ? (addresses.data?.[0] ?? draft.data?.address) : draft.data?.address;
  const preferences = (
    signedIn && profile.data?.dietary_preferences.length
      ? profile.data.dietary_preferences
      : (draft.data?.preferences ?? [])
  ) as DietaryPreference[];

  return {
    signedIn,
    isPending: draft.isPending || (signedIn && (addresses.isPending || profile.isPending)),
    pincode: address?.pincode,
    locality: address?.locality,
    preferences,
    /** Where "Change address" should go. */
    editAddressHref: signedIn ? ('/profile/address' as const) : ('/onboarding/address' as const),
  };
}
