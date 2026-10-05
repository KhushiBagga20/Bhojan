import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  addDays,
  formatDateLong,
  formatDeliveryDays,
  formatTimeWindow,
  greeting,
  isoWeekday,
  relativeDayLabel,
  relativeDayWithDate,
  todayIST,
} from './dates.ts';
import { formatAddress, formatPhone, formatRupees, normalizeIndianMobile, pricePerMeal, telLink } from './format.ts';
import { canChangeMeal, formatDeadline, mealChangeDeadline, previewMealDates, startDateOptions } from './schedule.ts';
import { nextMenuDate, resolveMenu, weeklyMenu, type MenuWithItems } from './menu.ts';
import { describeError, OFFLINE_MESSAGE } from './errors.ts';
import { MEAL_STATUS, nextProviderStatus } from './domain.ts';

test('rupees use Indian digit grouping', () => {
  assert.equal(formatRupees(80), '₹80');
  assert.equal(formatRupees(2080), '₹2,080');
  assert.equal(formatRupees(100000), '₹1,00,000');
  assert.equal(formatRupees(2080.5), '₹2,080.50');
  assert.equal(pricePerMeal(2080, 26), 80);
});

test('phone numbers are forgiving on input and consistent on output', () => {
  for (const input of ['9810000001', '98100 00001', '+91 98100-00001', '919810000001', '09810000001']) {
    assert.equal(normalizeIndianMobile(input), '+919810000001', input);
  }
  assert.equal(normalizeIndianMobile('12345'), null);
  assert.equal(normalizeIndianMobile('5810000001'), null, 'Indian mobiles start with 6-9');
  assert.equal(formatPhone('919810000001'), '+91 98100 00001');
  assert.equal(telLink('919810000001'), 'tel:+919810000001');
});

test('calendar dates', () => {
  assert.equal(isoWeekday('2026-09-29'), 2, '29 Sep 2026 is a Tuesday');
  assert.equal(isoWeekday('2026-10-04'), 7, 'Sunday is 7');
  assert.equal(addDays('2026-09-30', 1), '2026-10-01');
  assert.equal(addDays('2026-12-31', 1), '2027-01-01');
  assert.equal(formatDateLong('2026-10-01'), 'Thursday, 1 October');
  assert.equal(relativeDayLabel('2026-09-30', '2026-09-29'), 'Tomorrow');
  assert.equal(relativeDayLabel('2026-10-02', '2026-09-29'), 'Friday, 2 October');
  assert.equal(relativeDayWithDate('2026-09-30', '2026-09-29'), 'Tomorrow (Wednesday, 30 September)');
  assert.equal(relativeDayWithDate('2026-10-02', '2026-09-29'), 'Friday, 2 October');
});

test('today is computed in India, whatever the device timezone', () => {
  assert.equal(todayIST(new Date('2026-09-29T19:00:00Z')), '2026-09-30', '00:30 IST is already the next day');
  assert.equal(todayIST(new Date('2026-09-29T18:00:00Z')), '2026-09-29', '23:30 IST');
  assert.equal(greeting(new Date('2026-09-29T03:00:00Z')), 'Good morning');
  assert.equal(greeting(new Date('2026-09-29T14:00:00Z')), 'Good evening');
});

test('time windows read naturally', () => {
  assert.equal(formatTimeWindow('12:30:00', '13:00:00'), '12:30 – 1:00 PM');
  assert.equal(formatTimeWindow('11:30', '12:00'), '11:30 AM – 12:00 PM');
  assert.equal(formatTimeWindow(null, null), null);
});

test('delivery days summary', () => {
  assert.equal(formatDeliveryDays([1, 2, 3, 4, 5, 6]), 'Monday – Saturday');
  assert.equal(formatDeliveryDays([1, 2, 3, 4, 5, 6, 7]), 'Every day');
  assert.equal(formatDeliveryDays([1, 3, 5]), 'Monday, Wednesday and Friday');
  assert.equal(formatDeliveryDays([6, 7]), 'Saturday and Sunday');
  assert.equal(formatDeliveryDays([7]), 'Sundays only');
});

test('meal previews match the database meal engine', () => {
  const dates = previewMealDates('2026-09-30', [1, 2, 3, 4, 5, 6], 26);
  assert.equal(dates.length, 26);
  assert.equal(dates[0], '2026-09-30');
  assert.equal(dates[25], '2026-10-29', 'same end date as the SQL test');
  assert.ok(dates.every((d) => isoWeekday(d) !== 7));
});

test('start date options skip non-delivery days and respect notice', () => {
  const plan = { plan_type: 'MONTHLY' as const, delivery_days: [1, 2, 3, 4, 5, 6], min_notice_days: 1 };
  assert.deepEqual(startDateOptions('2026-09-29', plan), [
    '2026-09-30',
    '2026-10-01',
    '2026-10-02',
    '2026-10-03',
    '2026-10-05',
  ]);
  assert.deepEqual(startDateOptions('2026-09-29', { ...plan, min_notice_days: 2 }, 2), ['2026-10-01', '2026-10-02']);
});

test('change deadline mirrors meal_change_deadline()', () => {
  const deadline = mealChangeDeadline('2026-09-30', '12:00:00', 3);
  assert.equal(deadline.toISOString(), '2026-09-30T03:30:00.000Z', '09:00 IST');
  const meal = { scheduled_date: '2026-09-30', window_start: '12:00:00', status: 'SCHEDULED' as const };
  assert.equal(canChangeMeal(meal, 3, new Date('2026-09-30T03:00:00Z')), true, '08:30 IST');
  assert.equal(canChangeMeal(meal, 3, new Date('2026-09-30T04:00:00Z')), false, '09:30 IST');
  assert.equal(canChangeMeal({ ...meal, status: 'PREPARING' }, 3, new Date('2026-09-29T00:00:00Z')), false);
  assert.equal(formatDeadline(deadline, new Date('2026-09-29T06:00:00Z')), '9:00 AM tomorrow');
});

const menu = (over: Partial<MenuWithItems>, items: string[]): MenuWithItems => ({
  id: crypto.randomUUID(),
  provider_id: 'p',
  meal_type: 'LUNCH',
  day_of_week: null,
  menu_date: null,
  title: null,
  description: null,
  image_url: null,
  created_at: '',
  updated_at: '',
  ...over,
  menu_items: items.map((name, i) => ({
    id: String(i),
    menu_id: '',
    provider_id: over.provider_id ?? 'p',
    name,
    description: null,
    sort_order: items.length - i,
    created_at: '',
  })),
});

test('menus: scoped to one kitchen; dated menus override the weekly one; items keep their order', () => {
  const menus = [
    menu({ day_of_week: 4 }, ['Roti', 'Dal']),
    menu({ menu_date: '2026-10-01' }, ['Festival thali']),
    menu({ day_of_week: 5 }, ['Chole']),
    menu({ day_of_week: 2, provider_id: 'other' }, ['Someone else’s rajma']),
  ];
  assert.deepEqual(
    resolveMenu(menus, 'p', '2026-10-01', 'LUNCH')?.menu_items.map((i) => i.name),
    ['Festival thali'],
  );
  assert.deepEqual(
    resolveMenu(menus, 'p', '2026-10-08', 'LUNCH')?.menu_items.map((i) => i.name),
    ['Dal', 'Roti'],
    'sorted by sort_order',
  );
  assert.equal(resolveMenu(menus, 'p', '2026-10-08', 'DINNER'), null);
  assert.equal(resolveMenu(menus, 'p', '2026-09-29', 'LUNCH'), null, 'another kitchen’s Tuesday menu is never used');
  assert.equal(nextMenuDate(menus, 'p', '2026-10-03', 'LUNCH'), '2026-10-08', 'Saturday has no menu; next is Thursday');
  assert.deepEqual(
    weeklyMenu(menus, 'p', 'LUNCH').map((d) => d.day),
    [4, 5],
  );
});

test('errors become plain sentences', () => {
  assert.deepEqual(describeError(new TypeError('Network request failed')), { message: OFFLINE_MESSAGE, offline: true });
  assert.match(
    describeError({ message: 'AREA_NOT_SERVED', code: 'P0001' }).message,
    /doesn't deliver to your PIN code/,
  );
  assert.match(describeError({ message: 'Token has expired or is invalid' }).message, /code didn't work/);
  assert.match(
    describeError({ code: 'invalid_credentials', message: 'Invalid login credentials' }).message,
    /email or password/,
  );
  assert.match(describeError({ message: 'User already registered' }).message, /sign in instead/);
  assert.match(
    describeError({ code: 'weak_password', message: 'Password should be at least 6 characters.' }).message,
    /6 characters/,
  );
  assert.equal(
    describeError({ message: 'weird', code: 'XX000' }, 'creating your meal plan').message,
    'Something went wrong while creating your meal plan. Please try again.',
  );
  assert.equal(describeError({ code: '23505', message: 'duplicate key' }).message, 'This already exists.');
});

test('status metadata never relies on colour alone', () => {
  for (const meta of Object.values(MEAL_STATUS)) {
    assert.ok(meta.label && meta.symbol && meta.description);
  }
  assert.equal(nextProviderStatus('SCHEDULED'), 'PREPARING');
  assert.equal(nextProviderStatus('DELIVERED'), null);
  assert.equal(
    formatAddress({ address_line: 'B-42', locality: 'Malviya Nagar', city: 'New Delhi', pincode: '110017' }),
    'B-42, Malviya Nagar, New Delhi 110017',
  );
});
