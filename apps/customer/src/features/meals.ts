import { OPEN_MEAL_STATUSES, relativeDayWithDate, type MealStatus } from '@bhojan/shared';
import type { MealWithDetails, SubscriptionWithDetails } from '@/lib/api';

const isOpen = (status: MealStatus) => OPEN_MEAL_STATUSES.includes(status);

/** The next meal still to come for a plan (today's counts if not yet delivered). */
export function nextMealFor(meals: MealWithDetails[] | undefined, subscriptionId: string, today: string) {
  return (
    (meals ?? []).find((m) => m.subscription_id === subscriptionId && m.scheduled_date >= today && isOpen(m.status)) ??
    null
  );
}

export function nextMealLabel(meal: { scheduled_date: string } | null, today: string): string | null {
  return meal ? relativeDayWithDate(meal.scheduled_date, today) : null;
}

/** Plans the person still has meals from: active, paused, or a one-time order still to arrive. */
export function currentPlans(
  subscriptions: SubscriptionWithDetails[] | undefined,
  meals: MealWithDetails[] | undefined,
  today: string,
) {
  return (subscriptions ?? []).filter((s) => {
    if (s.status === 'PAUSED') return true;
    if (s.status !== 'ACTIVE' && s.status !== 'CANCELLED') return false;
    // A cancelled plan can still have a meal on its way (past the change cutoff).
    return s.status === 'ACTIVE' || !!nextMealFor(meals, s.id, today);
  });
}

export function pastPlans(subscriptions: SubscriptionWithDetails[] | undefined, current: SubscriptionWithDetails[]) {
  const currentIds = new Set(current.map((s) => s.id));
  return (subscriptions ?? []).filter(
    (s) => !currentIds.has(s.id) && (s.status === 'EXPIRED' || s.status === 'CANCELLED'),
  );
}

export function openMealsLeft(meals: MealWithDetails[] | undefined, subscriptionId: string, today: string): number {
  return (meals ?? []).filter(
    (m) => m.subscription_id === subscriptionId && m.scheduled_date >= today && isOpen(m.status),
  ).length;
}
