// Plain-language labels and status metadata. Every status is shown with a word,
// an icon (symbol) and a colour tone, so meaning never depends on colour alone.
import type { Enums, Tables } from './database.types.ts';
import type { Tone } from './tokens.ts';

export type MealStatus = Enums<'meal_status'>;
export type SubscriptionStatus = Enums<'subscription_status'>;
export type MealType = Enums<'meal_type'>;
export type PlanType = Enums<'plan_type'>;
export type DietType = Enums<'diet_type'>;
export type PaymentStatus = Enums<'payment_status'>;
export type PaymentGateway = Enums<'payment_gateway'>;

export type UserRow = Tables<'users'>;
export type AddressRow = Tables<'addresses'>;
export type ProviderRow = Tables<'provider_profiles'>;
export type DeliverySlotRow = Tables<'delivery_slots'>;
export type PlanRow = Tables<'plans'>;
export type MenuRow = Tables<'menus'>;
export type MenuItemRow = Tables<'menu_items'>;
export type MenuFileRow = Tables<'menu_files'>;
export type SubscriptionRow = Tables<'subscriptions'>;
export type MealOrderRow = Tables<'meal_orders'>;
export type PaymentRow = Tables<'payments'>;

/**
 * Semantic icon names. Each app maps these to its icon set, so the same status
 * always has the same picture everywhere.
 */
export type StatusSymbol =
  'calendar' | 'cooking' | 'delivery' | 'check' | 'skip' | 'cross' | 'pause' | 'clock' | 'flag';

export interface StatusMeta {
  label: string;
  description: string;
  tone: Tone;
  symbol: StatusSymbol;
}

export const MEAL_STATUS: Record<MealStatus, StatusMeta> = {
  SCHEDULED: {
    label: 'Scheduled',
    description: 'Your meal is planned for this day.',
    tone: 'info',
    symbol: 'calendar',
  },
  PREPARING: {
    label: 'Being prepared',
    description: 'The kitchen is cooking your meal now.',
    tone: 'progress',
    symbol: 'cooking',
  },
  OUT_FOR_DELIVERY: {
    label: 'On the way',
    description: 'Your meal has left the kitchen and is coming to you.',
    tone: 'progress',
    symbol: 'delivery',
  },
  DELIVERED: {
    label: 'Delivered',
    description: 'Your meal was delivered.',
    tone: 'success',
    symbol: 'check',
  },
  SKIPPED: {
    label: 'Skipped',
    description: 'You skipped this meal. One extra meal was added to the end of your plan.',
    tone: 'neutral',
    symbol: 'skip',
  },
  CANCELLED: {
    label: 'Cancelled',
    description: 'This meal was cancelled and will not be delivered.',
    tone: 'danger',
    symbol: 'cross',
  },
};

/** Statuses that still end with food at the door. */
export const LIVE_MEAL_STATUSES: readonly MealStatus[] = ['SCHEDULED', 'PREPARING', 'OUT_FOR_DELIVERY', 'DELIVERED'];
/** Statuses where the meal is not yet delivered and still on its way to happening. */
export const OPEN_MEAL_STATUSES: readonly MealStatus[] = ['SCHEDULED', 'PREPARING', 'OUT_FOR_DELIVERY'];

/** The provider's forward path through a meal's day. */
export const PROVIDER_STATUS_FLOW: readonly MealStatus[] = ['SCHEDULED', 'PREPARING', 'OUT_FOR_DELIVERY', 'DELIVERED'];

export function nextProviderStatus(status: MealStatus): MealStatus | null {
  const i = PROVIDER_STATUS_FLOW.indexOf(status);
  return i >= 0 && i < PROVIDER_STATUS_FLOW.length - 1 ? PROVIDER_STATUS_FLOW[i + 1] : null;
}

/** Provider-facing action verbs for moving a meal forward. */
export const PROVIDER_ACTION_LABEL: Partial<Record<MealStatus, string>> = {
  PREPARING: 'Mark as preparing',
  OUT_FOR_DELIVERY: 'Mark as on the way',
  DELIVERED: 'Mark as delivered',
};

export const SUBSCRIPTION_STATUS: Record<SubscriptionStatus, StatusMeta> = {
  PENDING_PAYMENT: {
    label: 'Waiting for payment',
    description: 'This plan starts once payment is complete.',
    tone: 'highlight',
    symbol: 'clock',
  },
  ACTIVE: {
    label: 'Active',
    description: 'Meals are being delivered.',
    tone: 'success',
    symbol: 'check',
  },
  PAUSED: {
    label: 'Paused',
    description: 'No meals are being delivered until you resume.',
    tone: 'highlight',
    symbol: 'pause',
  },
  CANCELLED: {
    label: 'Cancelled',
    description: 'This plan was cancelled.',
    tone: 'danger',
    symbol: 'cross',
  },
  EXPIRED: {
    label: 'Completed',
    description: 'All meals in this plan have been delivered.',
    tone: 'neutral',
    symbol: 'flag',
  },
};

export const MEAL_TYPE_LABEL: Record<MealType, string> = {
  BREAKFAST: 'Breakfast',
  LUNCH: 'Lunch',
  DINNER: 'Dinner',
};

export const PLAN_TYPE_LABEL: Record<PlanType, string> = {
  ONE_TIME: 'One-time',
  WEEKLY: 'Weekly',
  MONTHLY: 'Monthly',
};

/** How the price reads: "₹80 for one meal", "₹480 / week", "₹2,080 / month". */
export const PLAN_PRICE_SUFFIX: Record<PlanType, string> = {
  ONE_TIME: 'for one meal',
  WEEKLY: '/ week',
  MONTHLY: '/ month',
};

export const DIET_TYPE_LABEL: Record<DietType, string> = {
  VEGETARIAN: 'Vegetarian',
  NON_VEGETARIAN: 'Non-vegetarian',
  BOTH: 'Vegetarian and non-vegetarian',
};

export const DIETARY_PREFERENCES = [
  { value: 'VEGETARIAN', label: 'Vegetarian' },
  { value: 'JAIN', label: 'Jain' },
  { value: 'NO_ONION_GARLIC', label: 'No onion or garlic' },
  { value: 'LOW_SPICE', label: 'Low spice' },
  { value: 'LESS_OIL', label: 'Less oil' },
  { value: 'LESS_SALT', label: 'Less salt' },
] as const;

export type DietaryPreference = (typeof DIETARY_PREFERENCES)[number]['value'];

/** What a kitchen can accommodate (vegetarian is expressed by diet_type instead). */
export const KITCHEN_DIETARY_OPTIONS = DIETARY_PREFERENCES.filter((p) => p.value !== 'VEGETARIAN');

export function dietaryLabel(value: string): string {
  return DIETARY_PREFERENCES.find((p) => p.value === value)?.label ?? value;
}

export const MEAL_TYPES: readonly MealType[] = ['BREAKFAST', 'LUNCH', 'DINNER'];
export const PLAN_TYPES: readonly PlanType[] = ['ONE_TIME', 'WEEKLY', 'MONTHLY'];
