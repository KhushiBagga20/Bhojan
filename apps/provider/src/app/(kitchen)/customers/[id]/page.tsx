'use client';

import { ChevronLeft, Phone } from 'lucide-react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import {
  dietaryLabel,
  formatAddress,
  formatDateLong,
  formatDateShort,
  formatDeliveryDays,
  formatPhone,
  formatRupees,
  formatTimeWindow,
  MEAL_TYPE_LABEL,
  PLAN_PRICE_SUFFIX,
  telLink,
  todayIST,
  type MealOrderRow,
} from '@bhojan/shared';
import { Card, ErrorState, Loading, StatusBadge } from '@/components/ui';
import { useCustomerSubscription } from '@/lib/queries';

export default function CustomerDetail() {
  const { id } = useParams<{ id: string }>();
  const sub = useCustomerSubscription(id);

  if (sub.isPending) return <Loading message="Loading customer…" />;
  if (sub.error || !sub.data)
    return <ErrorState error={sub.error} action="loading this customer" onRetry={() => sub.refetch()} />;

  const s = sub.data;
  const today = todayIST();
  const meals = [...s.meal_orders].sort((a, b) => a.scheduled_date.localeCompare(b.scheduled_date));
  const upcoming = meals.filter((m) => m.scheduled_date >= today);
  const past = meals.filter((m) => m.scheduled_date < today).reverse();

  return (
    <>
      <Link href="/customers" className="inline-flex min-h-12 items-center gap-1 self-start font-bold text-primary">
        <ChevronLeft aria-hidden className="size-6" />
        All customers
      </Link>
      <header className="flex flex-wrap items-center gap-3">
        <h1 className="font-display text-title">{s.customer?.name ?? 'Customer'}</h1>
        <StatusBadge kind="plan" status={s.status} />
      </header>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <h2 className="text-heading font-bold">Contact and delivery</h2>
          <p>
            <span className="text-ink-soft">Phone: </span>
            <span className="font-bold">{formatPhone(s.customer?.phone)}</span>
          </p>
          {s.address ? (
            <p>
              <span className="text-ink-soft">Address: </span>
              <span className="font-bold">{formatAddress(s.address)}</span>
            </p>
          ) : null}
          {s.address?.instructions ? (
            <p className="rounded-md bg-highlight-soft p-3">{`Delivery note: ${s.address.instructions}`}</p>
          ) : null}
          <p>
            <span className="text-ink-soft">Food preferences: </span>
            <span className="font-bold">
              {s.customer?.dietary_preferences.length
                ? s.customer.dietary_preferences.map(dietaryLabel).join(', ')
                : 'None given'}
            </span>
          </p>
          {s.customer?.phone ? (
            <a
              href={telLink(s.customer.phone)}
              className="inline-flex min-h-12 items-center gap-2 self-start rounded-md border-2 border-primary px-4 font-bold text-primary hover:bg-primary-soft"
            >
              <Phone aria-hidden className="size-5" />
              Call
            </a>
          ) : null}
        </Card>
        <Card>
          <h2 className="text-heading font-bold">Plan</h2>
          <p className="font-bold">{s.plan_name}</p>
          <p className="text-ink-soft">
            {`${MEAL_TYPE_LABEL[s.meal_type]} · ${formatDeliveryDays(s.delivery_days)}`}
            {s.window_start ? ` · ${formatTimeWindow(s.window_start, s.window_end)}` : ''}
          </p>
          <p>{`${formatRupees(s.price_rupees)} ${PLAN_PRICE_SUFFIX[s.plan_type]} · ${s.meals_total} meals`}</p>
          <p className="text-ink-soft">
            {`From ${formatDateLong(s.start_date)}`}
            {s.end_date ? ` to ${formatDateLong(s.end_date)}` : ''}
          </p>
        </Card>
      </div>

      <MealList title={`Coming up (${upcoming.length})`} meals={upcoming} empty="No upcoming meals." />
      {past.length ? <MealList title={`Earlier (${past.length})`} meals={past} empty="" /> : null}
    </>
  );
}

function MealList({
  title,
  meals,
  empty,
}: {
  title: string;
  meals: Array<Pick<MealOrderRow, 'id' | 'scheduled_date' | 'meal_type' | 'status'>>;
  empty: string;
}) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-heading font-bold">{title}</h2>
      {meals.length === 0 ? <p className="text-ink-soft">{empty}</p> : null}
      <ul className="grid gap-2 sm:grid-cols-2">
        {meals.map((m) => (
          <li key={m.id}>
            <Link
              href={`/orders/${m.id}?date=${m.scheduled_date}`}
              className="flex min-h-14 items-center justify-between gap-3 rounded-md border border-line bg-surface px-4 py-2 hover:border-primary"
            >
              <span className="font-bold">{`${formatDateShort(m.scheduled_date)} · ${MEAL_TYPE_LABEL[m.meal_type]}`}</span>
              <StatusBadge kind="meal" status={m.status} />
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
