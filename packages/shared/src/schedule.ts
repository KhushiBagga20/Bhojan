// Scheduling rules. These mirror the SQL functions (meal_change_deadline,
// top_up_meals, create_subscription) so the apps can explain what will happen
// before asking the server to do it. The server remains the authority.
import {
  addDays,
  daysBetween,
  formatDateShort,
  istInstant,
  istParts,
  isoWeekday,
  formatTime,
  type ISODate,
} from './dates.ts';
import type { MealStatus, PlanType } from './domain.ts';

/** Mirrors public.meal_change_deadline(): changes close `cutoffHours` before the delivery window. */
export function mealChangeDeadline(date: ISODate, windowStart: string | null | undefined, cutoffHours: number): Date {
  const start = istInstant(date, windowStart ?? '12:00');
  return new Date(start.getTime() - cutoffHours * 3_600_000);
}

export interface ChangeableMeal {
  scheduled_date: ISODate;
  window_start: string | null;
  status: MealStatus;
}

/** Whether a scheduled meal can still be skipped (or a skipped one restored). */
export function canChangeMeal(meal: ChangeableMeal, cutoffHours: number, now: Date = new Date()): boolean {
  if (meal.status !== 'SCHEDULED' && meal.status !== 'SKIPPED') return false;
  return mealChangeDeadline(meal.scheduled_date, meal.window_start, cutoffHours).getTime() > now.getTime();
}

/** "9:00 AM today", "9:00 AM tomorrow" or "9:00 AM on Thu, 1 Oct". */
export function formatDeadline(deadline: Date, now: Date = new Date()): string {
  const at = istParts(deadline);
  const today = istParts(now).date;
  const time = formatTime(`${at.hours}:${at.minutes}`);
  const diff = daysBetween(today, at.date);
  if (diff === 0) return `${time} today`;
  if (diff === 1) return `${time} tomorrow`;
  return `${time} on ${formatDateShort(at.date)}`;
}

/** The first `count` delivery days from `start` (how a new plan's meals are laid out). */
export function previewMealDates(start: ISODate, deliveryDays: readonly number[], count: number): ISODate[] {
  const dates: ISODate[] = [];
  let day = start;
  for (let guard = 0; dates.length < count && guard < 400; guard++) {
    if (deliveryDays.includes(isoWeekday(day))) dates.push(day);
    day = addDays(day, 1);
  }
  return dates;
}

export interface PlanScheduleRules {
  plan_type: PlanType;
  delivery_days: readonly number[];
  min_notice_days: number;
}

/**
 * Start dates to offer as a short list of buttons (easier than a calendar).
 * Only delivery days are offered, so the first meal always arrives on the date
 * the customer picked. Mirrors the checks in create_subscription.
 */
export function startDateOptions(today: ISODate, plan: PlanScheduleRules, count = 5): ISODate[] {
  const options: ISODate[] = [];
  let day = addDays(today, plan.min_notice_days);
  while (options.length < count && daysBetween(today, day) <= 60) {
    if (plan.delivery_days.includes(isoWeekday(day))) options.push(day);
    day = addDays(day, 1);
  }
  return options;
}
