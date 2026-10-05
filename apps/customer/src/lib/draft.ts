// Before someone has an account, the address and food preferences they enter
// during onboarding are kept on the device. They are saved to their account the
// moment they sign in, so nobody types their address twice.
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useQuery } from '@tanstack/react-query';
import type { DietaryPreference } from '@bhojan/shared';
import { queryClient } from './queryClient';
import { supabase } from './supabase';

const KEY = 'bhojan.onboarding-draft.v1';

export interface AddressDraft {
  address_line: string;
  locality: string;
  city: string;
  pincode: string;
  instructions?: string;
}

export interface OnboardingDraft {
  address?: AddressDraft;
  preferences?: DietaryPreference[];
}

async function readDraft(): Promise<OnboardingDraft> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as OnboardingDraft) : {};
  } catch {
    return {};
  }
}

export function useDraft() {
  return useQuery({ queryKey: ['draft'], queryFn: readDraft, staleTime: Infinity });
}

export async function saveDraft(patch: Partial<OnboardingDraft>): Promise<void> {
  const next = { ...(await readDraft()), ...patch };
  queryClient.setQueryData(['draft'], next);
  await AsyncStorage.setItem(KEY, JSON.stringify(next));
}

export async function clearDraft(): Promise<void> {
  queryClient.setQueryData(['draft'], {});
  await AsyncStorage.removeItem(KEY);
}

/** Copies anything entered before sign-in into the new account (without overwriting). */
export async function applyDraftToAccount(userId: string): Promise<void> {
  const draft = await readDraft();
  if (draft.address) {
    const { count } = await supabase
      .from('addresses')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId);
    if (!count) {
      const { error } = await supabase.from('addresses').insert({
        user_id: userId,
        label: 'Home',
        is_default: true,
        address_line: draft.address.address_line,
        locality: draft.address.locality,
        city: draft.address.city,
        pincode: draft.address.pincode,
        instructions: draft.address.instructions || null,
      });
      if (error) throw error;
    }
  }
  if (draft.preferences?.length) {
    const { data } = await supabase.from('users').select('dietary_preferences').eq('id', userId).single();
    if (!data?.dietary_preferences.length) {
      const { error } = await supabase
        .from('users')
        .update({ dietary_preferences: draft.preferences })
        .eq('id', userId);
      if (error) throw error;
    }
  }
  await clearDraft();
  // Screens still mounted underneath may have fetched before the draft was saved.
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: ['addresses'] }),
    queryClient.invalidateQueries({ queryKey: ['profile'] }),
  ]);
}
