// Email + password sign-in and sign-up (see AUTH_METHOD in lib/auth.ts).
// Creating an account also asks for the mobile number, so the kitchen can call
// about deliveries.
import { useLocalSearchParams } from 'expo-router';
import { useRef, useState } from 'react';
import { TextInput, View } from 'react-native';
import { describeError, normalizeIndianMobile, spacing } from '@bhojan/shared';
import { Button, FormField, Notice, Screen, Text } from '@/components';
import { finishSignIn } from '@/lib/auth';
import { supabase } from '@/lib/supabase';

type Mode = 'signup' | 'signin';
type Errors = Partial<Record<'email' | 'phone' | 'password', string>>;

const MIN_PASSWORD = 6;

export function PasswordSignIn() {
  const { returnTo, mode: modeParam } = useLocalSearchParams<{ returnTo?: string; mode?: Mode }>();
  const forCheckout = returnTo?.startsWith('/checkout');
  const [mode, setMode] = useState<Mode>(modeParam ?? (forCheckout ? 'signup' : 'signin'));
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState<Errors>({});
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const phoneRef = useRef<TextInput>(null);
  const passwordRef = useRef<TextInput>(null);
  const signup = mode === 'signup';

  const switchMode = () => {
    setMode(signup ? 'signin' : 'signup');
    setErrors({});
    setError(null);
    setNotice(null);
  };

  const submit = async () => {
    const cleanEmail = email.trim().toLowerCase();
    const e164 = normalizeIndianMobile(phone);
    const found: Errors = {};
    if (!/^\S+@\S+\.\S+$/.test(cleanEmail)) found.email = 'Please enter your email address, like name@gmail.com.';
    if (signup && !e164) found.phone = 'Please enter your 10-digit mobile number, like 98100 00001.';
    if (password.length < MIN_PASSWORD) found.password = `Your password needs at least ${MIN_PASSWORD} characters.`;
    setErrors(found);
    if (Object.keys(found).length) return;

    setError(null);
    setNotice(null);
    setBusy(true);
    if (signup) {
      const { data, error: signUpError } = await supabase.auth.signUp({
        email: cleanEmail,
        password,
        options: { data: { phone: e164 } },
      });
      if (signUpError) {
        setBusy(false);
        return setError(describeError(signUpError, 'creating your account').message);
      }
      if (!data.session || !data.user) {
        // The Supabase project asks people to confirm their email first.
        setBusy(false);
        setMode('signin');
        return setNotice(
          `Almost done. We've emailed a link to ${cleanEmail}. Open it, then come back here and sign in.`,
        );
      }
      await finishSignIn(data.user.id, returnTo);
    } else {
      const { data, error: signInError } = await supabase.auth.signInWithPassword({ email: cleanEmail, password });
      if (signInError || !data.user) {
        setBusy(false);
        return setError(describeError(signInError, 'signing you in').message);
      }
      await finishSignIn(data.user.id, returnTo);
    }
    setBusy(false);
  };

  return (
    <Screen
      keyboard
      back
      title={signup ? 'Create your account' : 'Sign in'}
      subtitle={
        signup
          ? forCheckout
            ? 'To start your meal plan, create an account. You will use your email and password to sign in.'
            : 'You will use your email and password to sign in.'
          : 'Welcome back. Enter the email and password you used when you joined.'
      }
      footer={
        <>
          <Button
            label={signup ? 'Create my account' : 'Sign in'}
            icon="forward"
            loading={busy}
            loadingLabel={signup ? 'Creating your account…' : 'Signing you in…'}
            onPress={submit}
          />
          <Button
            label={signup ? 'I already have an account' : "I'm new: create an account"}
            variant="quiet"
            onPress={switchMode}
          />
        </>
      }
    >
      {notice ? <Notice tone="info" message={notice} /> : null}
      <FormField
        label="Email address"
        value={email}
        onChangeText={(text) => {
          setEmail(text);
          setErrors((e) => ({ ...e, email: undefined }));
        }}
        error={errors.email}
        keyboardType="email-address"
        autoCapitalize="none"
        autoCorrect={false}
        textContentType="emailAddress"
        autoComplete="email"
        returnKeyType="next"
        onSubmitEditing={() => (signup ? phoneRef.current?.focus() : passwordRef.current?.focus())}
      />
      {signup ? (
        <FormField
          ref={phoneRef}
          label="Mobile number"
          hint="So your kitchen can call you about deliveries"
          prefix="+91"
          value={phone}
          onChangeText={(text) => {
            setPhone(text);
            setErrors((e) => ({ ...e, phone: undefined }));
          }}
          error={errors.phone}
          keyboardType="phone-pad"
          textContentType="telephoneNumber"
          autoComplete="tel"
          maxLength={16}
          returnKeyType="next"
          onSubmitEditing={() => passwordRef.current?.focus()}
        />
      ) : null}
      <View style={{ gap: spacing.xs }}>
        <FormField
          ref={passwordRef}
          label="Password"
          hint={signup ? `At least ${MIN_PASSWORD} characters` : undefined}
          value={password}
          onChangeText={(text) => {
            setPassword(text);
            setErrors((e) => ({ ...e, password: undefined }));
          }}
          error={errors.password}
          secureTextEntry={!showPassword}
          autoCapitalize="none"
          autoCorrect={false}
          textContentType={signup ? 'newPassword' : 'password'}
          autoComplete={signup ? 'new-password' : 'current-password'}
          returnKeyType="done"
          onSubmitEditing={submit}
        />
        <Button
          label={showPassword ? 'Hide password' : 'Show password'}
          variant="quiet"
          icon={showPassword ? 'eyeOff' : 'eye'}
          onPress={() => setShowPassword((s) => !s)}
        />
      </View>
      {error ? <Notice tone="danger" message={error} /> : null}
      {signup ? (
        <Text variant="secondary" color="textSecondary">
          Your number is only shared with the kitchen that cooks for you.
        </Text>
      ) : null}
    </Screen>
  );
}
