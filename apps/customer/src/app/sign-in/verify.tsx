import { useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { View } from 'react-native';
import { describeError, formatPhone, spacing } from '@bhojan/shared';
import { Button, FormField, Notice, Screen, Text } from '@/components';
import { announce } from '@/lib/a11y';
import { finishSignIn } from '@/lib/auth';
import { supabase } from '@/lib/supabase';

const RESEND_AFTER_SECONDS = 30;

export default function SignInVerify() {
  const { phone, returnTo } = useLocalSearchParams<{ phone: string; returnTo?: string }>();
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(RESEND_AFTER_SECONDS);
  const [resent, setResent] = useState(false);
  const submitted = useRef<string | null>(null);

  useEffect(() => {
    if (secondsLeft <= 0) return;
    const timer = setTimeout(() => setSecondsLeft((s) => s - 1), 1000);
    return () => clearTimeout(timer);
  }, [secondsLeft]);

  const verify = async (token: string) => {
    if (token.length !== 6) {
      setError('The code has 6 digits. Please check the text message.');
      return;
    }
    submitted.current = token;
    setError(null);
    setChecking(true);
    const { data, error: verifyError } = await supabase.auth.verifyOtp({ phone, token, type: 'sms' });
    if (verifyError || !data.user) {
      setChecking(false);
      setError(describeError(verifyError, 'checking your code').message);
      return;
    }
    await finishSignIn(data.user.id, returnTo);
    setChecking(false);
  };

  const resend = async () => {
    setError(null);
    const { error: sendError } = await supabase.auth.signInWithOtp({ phone });
    if (sendError) {
      setError(describeError(sendError, 'sending a new code').message);
      return;
    }
    setResent(true);
    setSecondsLeft(RESEND_AFTER_SECONDS);
    announce('A new code has been sent.');
  };

  return (
    <Screen
      keyboard
      back={{ label: 'Change number' }}
      title="Enter the 6-digit code"
      subtitle={`We sent it by text message to ${formatPhone(phone)}.`}
      footer={
        <Button
          label="Confirm code"
          loading={checking}
          loadingLabel="Checking your code…"
          onPress={() => verify(code)}
        />
      }
    >
      <FormField
        label="Code"
        large
        value={code}
        onChangeText={(text) => {
          const digits = text.replace(/\D/g, '').slice(0, 6);
          setCode(digits);
          setError(null);
          // Submit automatically once all 6 digits are in (once per code).
          if (digits.length === 6 && submitted.current !== digits && !checking) verify(digits);
        }}
        keyboardType="number-pad"
        textContentType="oneTimeCode"
        autoComplete="sms-otp"
        maxLength={6}
        autoFocus
      />
      {error ? <Notice tone="danger" message={error} /> : null}
      {resent && !error ? <Notice tone="success" message="A new code is on its way." /> : null}
      <View style={{ gap: spacing.sm }}>
        {secondsLeft > 0 ? (
          <Text variant="body" color="textSecondary" accessibilityLiveRegion="polite">
            {`Didn't get it? You can ask for a new code in ${secondsLeft} seconds.`}
          </Text>
        ) : (
          <Button label="Send me a new code" variant="secondary" icon="refresh" onPress={resend} />
        )}
      </View>
    </Screen>
  );
}
