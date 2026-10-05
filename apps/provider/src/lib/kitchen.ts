import {
  dietaryLabel,
  formatTimeWindow,
  MEAL_TYPE_LABEL,
  nextProviderStatus,
  PROVIDER_STATUS_FLOW,
  type MealStatus,
  type MealType,
} from '@bhojan/shared';
import type { Order } from './queries';

export const isLive = (o: Pick<Order, 'status'>) => o.status !== 'SKIPPED' && o.status !== 'CANCELLED';

export interface OrderGroup {
  key: string;
  mealType: MealType;
  title: string;
  orders: Order[];
}

/** Groups a day's live orders by meal and delivery window, in delivery order. */
export function groupOrders(orders: Order[]): OrderGroup[] {
  const groups = new Map<string, OrderGroup>();
  for (const order of orders.filter(isLive)) {
    const key = `${order.meal_type}|${order.window_start ?? ''}|${order.window_end ?? ''}`;
    if (!groups.has(key)) {
      const window = formatTimeWindow(order.window_start, order.window_end);
      groups.set(key, {
        key,
        mealType: order.meal_type,
        title: window ? `${MEAL_TYPE_LABEL[order.meal_type]} · ${window}` : MEAL_TYPE_LABEL[order.meal_type],
        orders: [],
      });
    }
    groups.get(key)!.orders.push(order);
  }
  return [...groups.values()].sort((a, b) => a.key.localeCompare(b.key));
}

export function dayStats(orders: Order[]) {
  const live = orders.filter(isLive);
  const count = (status: MealStatus) => live.filter((o) => o.status === status).length;
  const expected = live.reduce(
    (sum, o) => sum + (o.subscription ? o.subscription.price_rupees / o.subscription.meals_total : 0),
    0,
  );
  return {
    total: live.length,
    scheduled: count('SCHEDULED'),
    preparing: count('PREPARING'),
    onTheWay: count('OUT_FOR_DELIVERY'),
    delivered: count('DELIVERED'),
    skipped: orders.filter((o) => o.status === 'SKIPPED').length,
    cancelled: orders.filter((o) => o.status === 'CANCELLED').length,
    expectedRupees: Math.round(expected),
  };
}

/** "5 low spice · 2 Jain" for the cook. Vegetarian is left out (it's the default). */
export function prepNotes(orders: Order[]): string[] {
  const counts = new Map<string, number>();
  for (const order of orders.filter(isLive)) {
    for (const pref of order.customer?.dietary_preferences ?? []) {
      if (pref === 'VEGETARIAN') continue;
      counts.set(pref, (counts.get(pref) ?? 0) + 1);
    }
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([pref, n]) => `${n} ${dietaryLabel(pref).toLowerCase()}`);
}

/**
 * The one bulk step that makes sense for a group: move everyone who is at the
 * earliest status to the next one.
 */
export function groupNextStep(orders: Order[]): { from: MealStatus; to: MealStatus; ids: string[] } | null {
  for (const status of PROVIDER_STATUS_FLOW) {
    const at = orders.filter((o) => o.status === status);
    const to = nextProviderStatus(status);
    if (at.length && to) return { from: status, to, ids: at.map((o) => o.id) };
  }
  return null;
}

export function previousProviderStatus(status: MealStatus): MealStatus | null {
  const i = PROVIDER_STATUS_FLOW.indexOf(status);
  return i > 0 ? PROVIDER_STATUS_FLOW[i - 1] : null;
}

export const STATUS_VERB: Partial<Record<MealStatus, string>> = {
  SCHEDULED: 'scheduled',
  PREPARING: 'being prepared',
  OUT_FOR_DELIVERY: 'on the way',
  DELIVERED: 'delivered',
  CANCELLED: 'cancelled',
};

/** What each status means, worded for the kitchen. */
export const PROVIDER_STATUS_NOTE: Record<MealStatus, string> = {
  SCHEDULED: 'Booked. Cooking hasn’t started yet.',
  PREPARING: 'Being cooked now.',
  OUT_FOR_DELIVERY: 'Left the kitchen and on its way.',
  DELIVERED: 'Delivered to the customer.',
  SKIPPED: 'The customer skipped this meal, so don’t cook it. They get one extra meal at the end of their plan.',
  CANCELLED: 'Cancelled. It won’t be delivered.',
};
