/**
 * How kitchens sign in. "password" (email + password) works without an SMS
 * provider and is the default for testing. Set NEXT_PUBLIC_AUTH_METHOD=otp to use
 * one-time codes by SMS or email instead.
 */
export const AUTH_METHOD: 'password' | 'otp' = process.env.NEXT_PUBLIC_AUTH_METHOD === 'otp' ? 'otp' : 'password';
