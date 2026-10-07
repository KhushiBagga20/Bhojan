// Before someone has an account, where they are and the food preferences they
// choose during onboarding are kept on the device. Preferences are saved to
// their account the moment they sign in, so nobody chooses twice.
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useQuery } from '@tanstack/react-query';
import type { DietaryPreference } from '@bhojan/shared';
import { queryClient } from './queryClient';
import { supabase } from './supabase';

const KEY = 'bhojan.onboarding-draft.v2';

/**
 * Where to look for kitchens: a point read from the device with the person's
 * permission, or an area they picked from a list when they would rather not
 * share their location.
 */
export type Place =
  | { kind: 'coords'; latitude: number; longitude: number; accuracy: number | null; capturedAt: string }
  | { kind: 'area'; area: string; city: string };

export interface OnboardingDraft {
  place?: Place;
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

/**
 * Copies the preferences chosen before sign-in into the new account (without
 * overwriting). The place stays on the device: it becomes part of the delivery
 * address when the person adds one.
 */
export async function applyDraftToAccount(userId: string): Promise<void> {
  const draft = await readDraft();
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
  await saveDraft({ preferences: undefined });
  // Screens still mounted underneath may have fetched before the draft was saved.
  await queryClient.invalidateQueries({ queryKey: ['profile'] });
}
