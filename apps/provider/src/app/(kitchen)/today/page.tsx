'use client';

import { ChevronLeft, ChevronRight, CookingPot, Phone, Soup } from 'lucide-react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useState } from 'react';
import {
  addDays,
  describeError,
  dietaryLabel,
  firstName,
  formatDateLong,
  formatRupees,
  greeting,
  MEAL_TYPE_LABEL,
  nextProviderStatus,
  PROVIDER_ACTION_LABEL,
  pluralize,
  relativeDayLabel,
  telLink,
  todayIST,
} from '@bhojan/shared';
import { useCurrentKitchen } from '@/components/KitchenShell';
import { SetupChecklist } from '@/components/SetupChecklist';
import { Button, Card, EmptyState, ErrorState, Loading, Notice, StatusBadge } from '@/components/ui';
import { dayStats, groupNextStep, groupOrders, isLive, prepNotes, STATUS_VERB } from '@/lib/kitchen';
import { useOrders, useOwner, useUpdateMealStatus, type Order } from '@/lib/queries';

export default function TodayPage() {
  return (
    <Suspense fallback={<Loading />}>
      <Today />
    </Suspense>
  );
}

function Today() {
  const kitchen = useCurrentKitchen();
  const owner = useOwner();
  const router = useRouter();
  const params = useSearchParams();
  const today = todayIST();
  const date = /^\d{4}-\d{2}-\d{2}$/.test(params.get('date') ?? '') ? params.get('date')! : today;
  const orders = useOrders(kitchen.id, date);
  const update = useUpdateMealStatus();
  const [notice, setNotice] = useState<string | null>(null);

  const goTo = (next: string) => {
    setNotice(null);
    router.replace(next === today ? '/today' : `/today?date=${next}`);
  };
  const name = firstName(owner.data?.name);
  const canCook = date <= today;

  const advance = (ids: string[], to: Order['status'], label: string) =>
    update.mutate({ ids, status: to }, { onSuccess: () => setNotice(`${label} marked as ${STATUS_VERB[to]}.`) });

  return (
    <>
      <header className="flex flex-col gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="font-display text-title">{name ? `${greeting()}, ${name} ji.` : `${greeting()}.`}</h1>
          <p className="text-ink-soft">{kitchen.business_name}</p>
        </div>
        <nav aria-label="Choose a day" className="flex flex-wrap items-center gap-2">
          <Button
            variant="secondary"
            icon={ChevronLeft}
            onClick={() => goTo(addDays(date, -1))}
            aria-label="Previous day"
          >
            Previous day
          </Button>
          {date !== today ? (
            <Button variant="secondary" onClick={() => goTo(today)}>
              Back to today
            </Button>
          ) : null}
          <Button variant="secondary" onClick={() => goTo(addDays(date, 1))} aria-label="Next day">
            Next day
            <ChevronRight aria-hidden className="size-5" />
          </Button>
        </nav>
      </header>

      {!kitchen.is_published ? <SetupChecklist kitchen={kitchen} /> : null}

      {notice ? <Notice tone="success">{notice}</Notice> : null}
      {update.error ? <Notice tone="danger">{describeError(update.error, 'updating the meals').message}</Notice> : null}

      {orders.isPending ? (
        <Loading message="Loading orders…" />
      ) : orders.error ? (
        <ErrorState error={orders.error} action="loading orders" onRetry={() => orders.refetch()} />
      ) : (
        <DayView
          date={date}
          today={today}
          orders={orders.data}
          canCook={canCook}
          pending={new Set(update.isPending ? (update.variables?.ids ?? []) : [])}
          onAdvance={advance}
        />
      )}
    </>
  );
}

function DayView({
  date,
  today,
  orders,
  canCook,
  pending,
  onAdvance,
}: {
  date: string;
  today: string;
  orders: Order[];
  canCook: boolean;
  pending: Set<string>;
  onAdvance: (ids: string[], to: Order['status'], label: string) => void;
}) {
  const stats = dayStats(orders);
  const groups = groupOrders(orders);
  const notes = prepNotes(orders);
  const notDelivering = orders.filter((o) => !isLive(o));
  const relative = relativeDayLabel(date, today);
  const dayLabel = relative === formatDateLong(date) ? relative : `${relative}, ${formatDateLong(date)}`;
  const mealsByType = groups.reduce<Record<string, number>>((acc, g) => {
    acc[g.mealType] = (acc[g.mealType] ?? 0) + g.orders.length;
    return acc;
  }, {});

  return (
    <>
      <Card>
        <p className="text-small font-bold uppercase tracking-wide text-primary">{dayLabel}</p>
        <div className="flex flex-wrap items-end gap-x-10 gap-y-2">
          <p>
            <span className="font-display text-numeral">{stats.total}</span>{' '}
            <span className="text-heading font-bold">{stats.total === 1 ? 'meal' : 'meals'}</span>
          </p>
          <p>
            <span className="font-display text-numeral">{formatRupees(stats.expectedRupees)}</span>{' '}
            <span className="text-ink-soft">expected</span>
          </p>
        </div>
        <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            ['Orders', stats.total],
            ['Being prepared', stats.preparing],
            ['On the way', stats.onTheWay],
            ['Delivered', stats.delivered],
          ].map(([label, value]) => (
            <div key={label} className="rounded-md bg-surface-muted p-3">
              <dt className="text-small text-ink-soft">{label}</dt>
              <dd className="text-heading font-bold">{value}</dd>
            </div>
          ))}
        </dl>
        {stats.total > 0 ? (
          <div className="flex items-start gap-3 rounded-md bg-highlight-soft p-3">
            <CookingPot aria-hidden className="mt-0.5 size-6 shrink-0 text-highlight" />
            <p>
              <span className="font-bold">
                {'To cook: '}
                {Object.entries(mealsByType)
                  .map(
                    ([type, n]) =>
                      `${n} ${MEAL_TYPE_LABEL[type as Order['meal_type']].toLowerCase()}${n === 1 ? '' : 's'}`,
                  )
                  .join(', ')}
              </span>
              {notes.length ? ` · ${notes.join(' · ')}` : ''}
              {stats.skipped ? ` · ${pluralize(stats.skipped, 'customer')} skipped` : ''}
            </p>
          </div>
        ) : null}
      </Card>

      {!canCook && stats.total > 0 ? (
        <Notice tone="info">You can mark meals as being prepared, on the way or delivered on the day itself.</Notice>
      ) : null}

      {stats.total === 0 && notDelivering.length === 0 ? (
        <EmptyState
          icon={Soup}
          title={`No meals booked for ${relative === 'Today' ? 'today' : relative === 'Tomorrow' ? 'tomorrow' : formatDateLong(date)}`}
          message="When customers subscribe to your plans, their meals appear here day by day."
        />
      ) : null}

      {groups.map((group) => {
        const step = canCook ? groupNextStep(group.orders) : null;
        return (
          <section key={group.key} className="flex flex-col gap-3" aria-labelledby={`group-${group.key}`}>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 id={`group-${group.key}`} className="text-heading font-bold">
                {group.title}
                <span className="ml-2 font-normal text-ink-soft">{`· ${pluralize(group.orders.length, 'meal')}`}</span>
              </h2>
              {step ? (
                <Button
                  loading={step.ids.some((id) => pending.has(id))}
                  disabled={pending.size > 0}
                  onClick={() => onAdvance(step.ids, step.to, `${pluralize(step.ids.length, 'meal')}`)}
                >
                  {`${PROVIDER_ACTION_LABEL[step.to]} (${step.ids.length})`}
                </Button>
              ) : null}
            </div>
            <ul className="flex flex-col gap-2">
              {group.orders.map((order) => (
                <OrderRow
                  key={order.id}
                  order={order}
                  canCook={canCook}
                  pending={pending}
                  onAdvance={onAdvance}
                  date={date}
                />
              ))}
            </ul>
          </section>
        );
      })}

      {notDelivering.length > 0 ? (
        <section className="flex flex-col gap-3">
          <h2 className="text-heading font-bold">Not delivering</h2>
          <p className="text-ink-soft">
            These customers skipped this day or the meal was cancelled. Don’t cook for them.
          </p>
          <ul className="flex flex-col gap-2">
            {notDelivering.map((order) => (
              <li
                key={order.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-line bg-surface-muted p-4"
              >
                <Link href={`/orders/${order.id}`} className="font-bold underline-offset-4 hover:underline">
                  {order.customer?.name ?? 'Customer'}
                </Link>
                <StatusBadge kind="meal" status={order.status} />
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </>
  );
}

function OrderRow({
  order,
  canCook,
  pending,
  onAdvance,
  date,
}: {
  order: Order;
  canCook: boolean;
  pending: Set<string>;
  onAdvance: (ids: string[], to: Order['status'], label: string) => void;
  date: string;
}) {
  const next = nextProviderStatus(order.status);
  const prefs = (order.customer?.dietary_preferences ?? []).filter((p) => p !== 'VEGETARIAN');
  return (
    <li className="flex flex-col gap-3 rounded-md border border-line bg-surface p-4 shadow-card md:flex-row md:items-center">
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <Link
          href={`/orders/${order.id}?date=${date}`}
          className="text-body font-bold text-primary underline-offset-4 hover:underline"
        >
          {order.customer?.name ?? 'Customer'}
        </Link>
        <p className="text-small text-ink-soft">
          {order.address ? `${order.address.address_line}, ${order.address.locality}` : ''}
          {order.address?.instructions ? ` · Note: ${order.address.instructions}` : ''}
        </p>
        {prefs.length ? (
          <p className="flex flex-wrap gap-1.5">
            {prefs.map((p) => (
              <span key={p} className="rounded-sm bg-highlight-soft px-2 py-0.5 text-small font-bold text-highlight">
                {dietaryLabel(p)}
              </span>
            ))}
          </p>
        ) : null}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <StatusBadge kind="meal" status={order.status} />
        {order.customer?.phone ? (
          <a
            href={telLink(order.customer.phone)}
            className="inline-flex min-h-12 items-center gap-2 rounded-md border-2 border-line px-3 text-small font-bold text-ink hover:bg-surface-sunken"
          >
            <Phone aria-hidden className="size-5" />
            Call
          </a>
        ) : null}
        {canCook && next ? (
          <Button
            variant="secondary"
            loading={pending.has(order.id)}
            disabled={pending.size > 0}
            onClick={() => onAdvance([order.id], next, `${order.customer?.name ?? 'The'}'s meal`)}
          >
            {PROVIDER_ACTION_LABEL[next]}
          </Button>
        ) : null}
      </div>
    </li>
  );
}
