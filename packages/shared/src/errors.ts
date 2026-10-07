// Turns any failure (network, database, auth, app rule) into one calm sentence
// that says what happened and what to do next. Never show raw codes to people.

export interface FriendlyError {
  message: string;
  /** True when the device appears to be offline; screens can offer "Try again". */
  offline: boolean;
  /** The underlying app/database code, for logging only. */
  code?: string;
}

export const OFFLINE_MESSAGE = "You're offline right now. Please check your internet connection and try again.";

/** Messages for the stable codes raised by the database functions. */
const APP_ERRORS: Record<string, string> = {
  NOT_SIGNED_IN: 'Please sign in again to continue.',
  PLAN_UNAVAILABLE: 'This meal plan is no longer available. Please choose another plan.',
  ADDRESS_NOT_FOUND: "We couldn't find your delivery address. Please add it again.",
  AREA_NOT_SERVED:
    "This kitchen doesn't deliver as far as your address. Please choose a kitchen closer to you, or check your address.",
  ADDRESS_NEEDS_LOCATION:
    'We don’t know where this address is yet. Open your delivery address and tap “Use my current location” while you are there.',
  LOCATION_INVALID: "We couldn't read your location. Please try again.",
  START_DATE_TOO_SOON: 'That start date is too soon for this kitchen. Please choose a later date.',
  START_DATE_TOO_FAR: 'Please choose a start date within the next two months.',
  NOT_A_DELIVERY_DAY: "The kitchen doesn't deliver on that day. Please choose another date.",
  SLOT_UNAVAILABLE: 'That delivery time is no longer available. Please choose another time.',
  PAYMENT_NOT_FOUND: "We couldn't find this payment. Please start again.",
  PAYMENT_NOT_PENDING: 'This payment has already been handled. Please check your meal plans.',
  TEST_PAYMENTS_DISABLED: 'Test payments are switched off. Please pay with a real payment method.',
  MEAL_NOT_FOUND: "We couldn't find this meal. It may have changed. Please go back and try again.",
  ONE_TIME_USE_CANCEL: 'This is a one-time order, so it can be cancelled but not skipped.',
  PLAN_NOT_ACTIVE: "This meal plan isn't active right now, so it can't be changed.",
  MEAL_ALREADY_STARTED: "The kitchen has already started on this meal, so it can't be changed now.",
  TOO_LATE_TO_CHANGE:
    "It's too late to change this meal because the kitchen has started cooking. Please call your tiffin provider if you need help.",
  MEAL_NOT_SKIPPED: "This meal isn't skipped.",
  PLAN_NOT_PAUSED: "This meal plan isn't paused.",
  RESUME_DATE_INVALID: 'Please choose a date from tomorrow onwards.',
  SUBSCRIPTION_NOT_FOUND: "We couldn't find this meal plan.",
  NOT_A_PROVIDER: 'Please finish setting up your kitchen first.',
  MEAL_IS_IN_FUTURE: "Only today's meals can be marked as preparing, on the way or delivered.",
  INVALID_STATUS: "That status can't be used here.",
  PROFILE_NEEDS_LOCATION: 'Set your kitchen’s location before going live, so customers nearby can find you.',
  PROFILE_NEEDS_PLAN: 'Add at least one active meal plan before going live.',
  PROFILE_NEEDS_DELIVERY_TIME: 'Add at least one delivery time before going live.',
};

/** Supabase Auth error codes (one-time codes and email + password). */
const AUTH_ERRORS: Record<string, string> = {
  otp_expired: "That code didn't work or has expired. Please check the 6 digits, or ask for a new code.",
  invalid_credentials: "The email or password isn't right. Please check them and try again.",
  user_already_exists: 'There is already an account with this email. Please sign in instead.',
  email_exists: 'There is already an account with this email. Please sign in instead.',
  weak_password: 'Please choose a longer password, with at least 6 characters.',
  email_not_confirmed: 'Please confirm your email first: open the link we sent you, then sign in.',
  email_address_invalid: 'Please check the email address. It should look like name@gmail.com.',
  signup_disabled: 'New accounts are switched off right now. Please contact support.',
  over_sms_send_rate_limit: 'Too many codes have been sent. Please wait a minute, then try again.',
  over_email_send_rate_limit: 'Too many codes have been sent. Please wait a minute, then try again.',
  over_request_rate_limit: 'Too many attempts. Please wait a minute, then try again.',
  sms_send_failed: "We couldn't send the text message. Please check the number and try again.",
  phone_provider_disabled: 'Signing in with a phone number is not switched on yet. Please contact support.',
  email_provider_disabled: 'Signing in with email is not switched on yet. Please contact support.',
  otp_disabled: 'Sign-in codes are not switched on yet. Please contact support.',
  validation_failed: 'Please check the number or email address and try again.',
  session_not_found: 'Please sign in again to continue.',
  refresh_token_not_found: 'Please sign in again to continue.',
};

const POSTGRES_ERRORS: Record<string, string> = {
  '23505': 'This already exists.',
  '23503': "This is still being used, so it can't be removed.",
  '23001': "This is still being used, so it can't be removed.",
  '23514': "Some details don't look right. Please check them and try again.",
  '23502': 'Some required details are missing. Please fill them in and try again.',
  '42501': "You don't have permission to do that.",
  PGRST301: 'Please sign in again to continue.',
  PGRST303: 'Please sign in again to continue.',
};

function readField(error: unknown, field: string): string | undefined {
  if (error && typeof error === 'object' && field in error) {
    const value = (error as Record<string, unknown>)[field];
    return typeof value === 'string' || typeof value === 'number' ? String(value) : undefined;
  }
  return undefined;
}

export function isOfflineError(error: unknown): boolean {
  const name = readField(error, 'name') ?? '';
  const message = readField(error, 'message') ?? (typeof error === 'string' ? error : '');
  return (
    name === 'AuthRetryableFetchError' ||
    name === 'FunctionsFetchError' ||
    /network request failed|failed to fetch|networkerror|load failed|fetch failed|internet connection appears to be offline/i.test(
      message,
    )
  );
}

/**
 * @param action what the person was doing, e.g. "creating your meal plan".
 *   Used for the fallback: "Something went wrong while creating your meal plan."
 */
export function describeError(error: unknown, action?: string): FriendlyError {
  if (isOfflineError(error)) return { message: OFFLINE_MESSAGE, offline: true };

  const message = readField(error, 'message');
  const code = readField(error, 'code');

  if (message && APP_ERRORS[message]) return { message: APP_ERRORS[message], offline: false, code: message };
  if (code && AUTH_ERRORS[code]) return { message: AUTH_ERRORS[code], offline: false, code };
  // Older Auth servers send only a message, without a code.
  const authByMessage: Array<[RegExp, string]> = [
    [/token has expired or is invalid/i, 'otp_expired'],
    [/invalid login credentials/i, 'invalid_credentials'],
    [/user already registered/i, 'user_already_exists'],
    [/email not confirmed/i, 'email_not_confirmed'],
    [/password should be at least/i, 'weak_password'],
  ];
  const matched = message ? authByMessage.find(([pattern]) => pattern.test(message)) : undefined;
  if (matched) return { message: AUTH_ERRORS[matched[1]], offline: false, code: matched[1] };
  if (code && POSTGRES_ERRORS[code]) return { message: POSTGRES_ERRORS[code], offline: false, code };

  const fallback = action
    ? `Something went wrong while ${action}. Please try again.`
    : 'Something went wrong. Please try again.';
  return { message: fallback, offline: false, code: code ?? message };
}

/**
 * Returns the data of a successful Supabase result, or throws its error as-is so
 * callers can `describeError` it. (Supabase types `data` as nullable because it
 * is null on failure; after the error check it is present.)
 */
export function unwrap<R extends { data: unknown; error: unknown }>(result: R): NonNullable<R['data']> {
  if (result.error) throw result.error;
  return result.data as NonNullable<R['data']>;
}
