import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { describeError, normalizeIndianMobile } from '@bhojan/shared';
import { Button, FormField, Notice, Screen, Text } from '@/components';
import { PasswordSignIn } from '@/features/PasswordSignIn';
import { AUTH_METHOD } from '@/lib/auth';
import { supabase } from '@/lib/supabase';

/** Sign in or create an account: email + password, or a code sent by SMS (AUTH_METHOD). */
export default function SignIn() {
  return AUTH_METHOD === 'otp' ? <PhoneCodeSignIn /> : <PasswordSignIn />;
}

function PhoneCodeSignIn() {
  const { returnTo } = useLocalSearchParams<{ returnTo?: string }>();
  const [phone, setPhone] = useState('');
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const forCheckout = returnTo?.startsWith('/checkout');

  const sendCode = async () => {
    const e164 = normalizeIndianMobile(phone);
    if (!e164) {
      setFieldError('Please enter your 10-digit mobile number, like 98100 00001.');
      return;
    }
    setFieldError(null);
    setError(null);
    setSending(true);
    const { error: sendError } = await supabase.auth.signInWithOtp({ phone: e164 });
    setSending(false);
    if (sendError) {
      setError(describeError(sendError, 'sending your code').message);
      return;
    }
    router.push({ pathname: '/sign-in/verify', params: { phone: e164, returnTo } });
  };

  return (
    <Screen
      keyboard
      back
      title="Your mobile number"
      subtitle={
        forCheckout
          ? 'To start your meal plan, we need to confirm your number. We will text you a 6-digit code.'
          : 'We will text you a 6-digit code. There is no password to remember.'
      }
      footer={
        <Button label="Send code" icon="forward" loading={sending} loadingLabel="Sending code…" onPress={sendCode} />
      }
    >
      <FormField
        label="Mobile number"
        prefix="+91"
        value={phone}
        onChangeText={(text) => {
          setPhone(text);
          if (fieldError) setFieldError(null);
        }}
        error={fieldError}
        keyboardType="phone-pad"
        textContentType="telephoneNumber"
        autoComplete="tel"
        maxLength={16}
        returnKeyType="done"
        onSubmitEditing={sendCode}
      />
      {error ? <Notice tone="danger" message={error} /> : null}
      <Text variant="secondary" color="textSecondary">
        Your number is used to sign you in and so your kitchen can call you about deliveries. We never share it with
        anyone else.
      </Text>
    </Screen>
  );
}
