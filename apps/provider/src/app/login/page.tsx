'use client';

import { ArrowRight, Eye, EyeOff, Mail, Smartphone } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { describeError, formatPhone, normalizeIndianMobile } from '@bhojan/shared';
import { Button, Card, cx, Field, Notice } from '@/components/ui';
import { SetupNeeded } from '@/components/KitchenShell';
import { AUTH_METHOD } from '@/lib/auth';
import { isSupabaseConfigured, supabase } from '@/lib/supabase';
import { useSession } from '../providers';

type Method = 'phone' | 'email';

export default function Login() {
  const { session } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (session) router.replace('/today');
  }, [session, router]);

  if (!isSupabaseConfigured) return <SetupNeeded />;
  return AUTH_METHOD === 'otp' ? <CodeLogin /> : <PasswordLogin />;
}

function LoginLayout({ title, intro, children }: { title: string; intro: string; children: ReactNode }) {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-lg flex-col justify-center gap-6 px-4 py-10">
      <div className="flex flex-col gap-2">
        <p className="text-small font-bold uppercase tracking-wide text-primary">Bhojan for Kitchens</p>
        <h1 className="font-display text-title">{title}</h1>
        <p className="text-ink-soft">{intro}</p>
      </div>
      <Card>{children}</Card>
    </main>
  );
}

/** Email + password: sign in, or create a kitchen account. */
function PasswordLogin() {
  const router = useRouter();
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const signup = mode === 'signup';

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const cleanEmail = email.trim().toLowerCase();
    const found: typeof errors = {};
    if (!/^\S+@\S+\.\S+$/.test(cleanEmail)) found.email = 'Please enter your email address, like name@gmail.com.';
    if (password.length < 6) found.password = 'Your password needs at least 6 characters.';
    setErrors(found);
    if (found.email || found.password) return;

    setError(null);
    setNotice(null);
    setBusy(true);
    if (signup) {
      const { data, error: signUpError } = await supabase.auth.signUp({ email: cleanEmail, password });
      setBusy(false);
      if (signUpError) return setError(describeError(signUpError, 'creating your account').message);
      if (!data.session) {
        setMode('signin');
        return setNotice(`Almost done. We've emailed a link to ${cleanEmail}. Open it, then sign in here.`);
      }
    } else {
      const { error: signInError } = await supabase.auth.signInWithPassword({ email: cleanEmail, password });
      setBusy(false);
      if (signInError) return setError(describeError(signInError, 'signing you in').message);
    }
    // New accounts are taken to kitchen set-up from here.
    router.replace('/today');
  };

  return (
    <LoginLayout
      title={signup ? 'Create your kitchen account' : 'Sign in to your kitchen'}
      intro={
        signup
          ? 'Next you will set up your kitchen: name, delivery area, plans and menu.'
          : 'Manage your orders, menu and meal plans.'
      }
    >
      <form onSubmit={submit} className="flex flex-col gap-5" noValidate>
        {notice ? <Notice tone="info">{notice}</Notice> : null}
        <Field label="Email address" error={errors.email}>
          {(props) => (
            <input
              {...props}
              type="email"
              autoComplete="email"
              inputMode="email"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                setErrors((x) => ({ ...x, email: undefined }));
              }}
              placeholder="name@gmail.com"
            />
          )}
        </Field>
        <Field label="Password" hint={signup ? 'At least 6 characters' : undefined} error={errors.password}>
          {(props) => (
            <input
              {...props}
              type={showPassword ? 'text' : 'password'}
              autoComplete={signup ? 'new-password' : 'current-password'}
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                setErrors((x) => ({ ...x, password: undefined }));
              }}
            />
          )}
        </Field>
        <div>
          <Button variant="quiet" icon={showPassword ? EyeOff : Eye} onClick={() => setShowPassword((s) => !s)}>
            {showPassword ? 'Hide password' : 'Show password'}
          </Button>
        </div>
        {error ? <Notice tone="danger">{error}</Notice> : null}
        <Button
          type="submit"
          size="lg"
          icon={ArrowRight}
          loading={busy}
          loadingLabel={signup ? 'Creating your account…' : 'Signing in…'}
        >
          {signup ? 'Create my account' : 'Sign in'}
        </Button>
        <Button
          variant="quiet"
          onClick={() => {
            setMode(signup ? 'signin' : 'signup');
            setErrors({});
            setError(null);
            setNotice(null);
          }}
        >
          {signup ? 'I already have an account' : 'New kitchen? Create an account'}
        </Button>
      </form>
    </LoginLayout>
  );
}

/** One-time code by SMS or email (needs an SMS provider for phone numbers). */
function CodeLogin() {
  const router = useRouter();
  const [method, setMethod] = useState<Method>('phone');
  const [contact, setContact] = useState('');
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const sendCode = async (e?: FormEvent) => {
    e?.preventDefault();
    setError(null);
    let target: string | null;
    if (method === 'phone') {
      target = normalizeIndianMobile(contact);
      if (!target) return setFieldError('Please enter a 10-digit mobile number, like 98100 00001.');
    } else {
      target = contact.trim().toLowerCase();
      if (!/^\S+@\S+\.\S+$/.test(target)) return setFieldError('Please enter an email address, like name@example.com.');
    }
    setFieldError(null);
    setBusy(true);
    const { error: sendError } =
      method === 'phone'
        ? await supabase.auth.signInWithOtp({ phone: target })
        : await supabase.auth.signInWithOtp({ email: target });
    setBusy(false);
    if (sendError) return setError(describeError(sendError, 'sending your code').message);
    setSentTo(target);
  };

  const verify = async (e: FormEvent) => {
    e.preventDefault();
    if (!sentTo) return;
    if (!/^\d{6}$/.test(code.trim())) return setFieldError('The code has 6 digits.');
    setFieldError(null);
    setError(null);
    setBusy(true);
    const { error: verifyError } =
      method === 'phone'
        ? await supabase.auth.verifyOtp({ phone: sentTo, token: code.trim(), type: 'sms' })
        : await supabase.auth.verifyOtp({ email: sentTo, token: code.trim(), type: 'email' });
    setBusy(false);
    if (verifyError) return setError(describeError(verifyError, 'checking your code').message);
    router.replace('/today');
  };

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-lg flex-col justify-center gap-6 px-4 py-10">
      <div className="flex flex-col gap-2">
        <p className="text-small font-bold uppercase tracking-wide text-primary">Bhojan for Kitchens</p>
        <h1 className="font-display text-title">{sentTo ? 'Enter your code' : 'Sign in to your kitchen'}</h1>
        <p className="text-ink-soft">
          {sentTo
            ? `We sent a 6-digit code to ${method === 'phone' ? formatPhone(sentTo) : sentTo}.`
            : 'Manage your orders, menu and meal plans. No password needed: we send you a code.'}
        </p>
      </div>

      <Card>
        {!sentTo ? (
          <form onSubmit={sendCode} className="flex flex-col gap-5" noValidate>
            <div role="group" aria-label="Sign in with" className="grid grid-cols-2 gap-2">
              {(['phone', 'email'] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  aria-pressed={method === m}
                  onClick={() => {
                    setMethod(m);
                    setContact('');
                    setFieldError(null);
                  }}
                  className={cx(
                    'flex min-h-12 items-center justify-center gap-2 rounded-md border-2 font-bold',
                    method === m
                      ? 'border-primary bg-primary-soft text-primary'
                      : 'border-line bg-surface text-ink-soft',
                  )}
                >
                  {m === 'phone' ? (
                    <Smartphone aria-hidden className="size-5" />
                  ) : (
                    <Mail aria-hidden className="size-5" />
                  )}
                  {m === 'phone' ? 'Mobile number' : 'Email'}
                </button>
              ))}
            </div>
            <Field
              label={method === 'phone' ? 'Mobile number' : 'Email address'}
              hint={method === 'phone' ? 'We will text you a code' : 'We will email you a code'}
              error={fieldError}
            >
              {(props) => (
                <input
                  {...props}
                  type={method === 'phone' ? 'tel' : 'email'}
                  autoComplete={method === 'phone' ? 'tel' : 'email'}
                  inputMode={method === 'phone' ? 'tel' : 'email'}
                  value={contact}
                  onChange={(e) => setContact(e.target.value)}
                  placeholder={method === 'phone' ? '98100 00001' : 'name@example.com'}
                />
              )}
            </Field>
            {error ? <Notice tone="danger">{error}</Notice> : null}
            <Button type="submit" size="lg" icon={ArrowRight} loading={busy} loadingLabel="Sending code…">
              Send code
            </Button>
          </form>
        ) : (
          <form onSubmit={verify} className="flex flex-col gap-5" noValidate>
            <Field label="6-digit code" error={fieldError}>
              {(props) => (
                <input
                  {...props}
                  className={`${props.className} font-display text-title tracking-[0.4em]`}
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={6}
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
                  autoFocus
                />
              )}
            </Field>
            {error ? <Notice tone="danger">{error}</Notice> : null}
            <Button type="submit" size="lg" loading={busy} loadingLabel="Checking…">
              Sign in
            </Button>
            <div className="flex flex-wrap gap-2">
              <Button variant="quiet" onClick={() => sendCode()}>
                Send a new code
              </Button>
              <Button
                variant="quiet"
                onClick={() => {
                  setSentTo(null);
                  setCode('');
                  setError(null);
                }}
              >
                {method === 'phone' ? 'Use a different number' : 'Use a different email'}
              </Button>
            </div>
          </form>
        )}
      </Card>
    </main>
  );
}
