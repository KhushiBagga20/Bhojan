import { router, type Href } from 'expo-router';
import { announce } from './a11y';
import { applyDraftToAccount } from './draft';
import { supabase } from './supabase';

/**
 * How people sign in. "password" (email + password) works without an SMS
 * provider and is the default for testing. Set EXPO_PUBLIC_AUTH_METHOD=otp once
 * phone codes are set up in Supabase: no password to remember is kinder for
 * older customers.
 */
export const AUTH_METHOD: 'password' | 'otp' = process.env.EXPO_PUBLIC_AUTH_METHOD === 'otp' ? 'otp' : 'password';

/** After any successful sign-in: save what was entered during onboarding, ask for a name if missing, then continue. */
export async function finishSignIn(userId: string, returnTo?: string): Promise<void> {
  announce('Signed in.');
  try {
    await applyDraftToAccount(userId);
  } catch {
    // Not fatal: checkout asks for the address again if it didn't save.
  }
  const { data: profile } = await supabase.from('users').select('name').eq('id', userId).single();
  if (!profile?.name) {
    router.replace({ pathname: '/sign-in/name', params: { returnTo } });
  } else {
    router.replace((returnTo || '/') as Href);
  }
}
