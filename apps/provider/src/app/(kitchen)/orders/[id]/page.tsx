'use client';

import { ArrowRight, ChevronLeft, CircleX, MapPin, Phone, Undo2 } from 'lucide-react';
import Link from 'next/link';
import { useParams, useSearchParams } from 'next/navigation';
import { Suspense, useState } from 'react';
import {
  describeError,
  dietaryLabel,
  formatAddress,
  formatDateLong,
  formatPhone,
  formatTimeWindow,
  MEAL_STATUS,
  MEAL_TYPE_LABEL,
  nextProviderStatus,
  PROVIDER_ACTION_LABEL,
  PROVIDER_STATUS_FLOW,
  telLink,
  todayIST,
} from '@bhojan/shared';
import { Button, ButtonLink, Card, ConfirmDialog, cx, ErrorState, Loading, Notice, StatusBadge } from '@/components/ui';
import { previousProviderStatus, PROVIDER_STATUS_NOTE, STATUS_VERB } from '@/lib/kitchen';
import { useOrder, useUpdateMealStatus } from '@/lib/queries';

export default function OrderPage() {
  return (
    <Suspense fallback={<Loading />}>
      <OrderDetail />
    </Suspense>
  );
}

function OrderDetail() {
  const { id } = useParams<{ id: string }>();
  const params = useSearchParams();
  const order = useOrder(id);
  const update = useUpdateMealStatus();
  const [notice, setNotice] = useState<string | null>(null);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const backHref = params.get('date') ? `/today?date=${params.get('date')}` : '/today';

  if (order.isPending) return <Loading message="Loading order…" />;
  if (order.error || !order.data)
    return <ErrorState error={order.error} action="loading this order" onRetry={() => order.refetch()} />;

  const o = order.data;
  const today = todayIST();
  const canCook = o.scheduled_date <= today;
  const live = o.status !== 'SKIPPED' && o.status !== 'CANCELLED';
  const next = live ? nextProviderStatus(o.status) : null;
  const previous = live ? previousProviderStatus(o.status) : null;
  const customerName = o.customer?.name ?? 'This customer';
  const mealName = MEAL_TYPE_LABEL[o.meal_type].toLowerCase();

  const setStatus = (status: typeof o.status, message: string) =>
    update.mutate(
      { ids: [o.id], status },
      {
        onSuccess: () => {
          setNotice(message);
          setConfirmCancel(false);
        },
      },
    );

  return (
    <>
      <Link href={backHref} className="inline-flex min-h-12 items-center gap-1 self-start font-bold text-primary">
        <ChevronLeft aria-hidden className="size-6" />
        Back to orders
      </Link>

      <header className="flex flex-col gap-1">
        <h1 className="font-display text-title">{customerName}</h1>
        <p className="text-body text-ink-soft">
          {`${MEAL_TYPE_LABEL[o.meal_type]} · ${formatDateLong(o.scheduled_date)}`}
          {o.window_start ? ` · ${formatTimeWindow(o.window_start, o.window_end)}` : ''}
        </p>
      </header>

      {notice ? <Notice tone="success">{notice}</Notice> : null}
      {update.error && !confirmCancel ? (
        <Notice tone="danger">{describeError(update.error, 'updating this meal').message}</Notice>
      ) : null}

      <Card>
        <div className="flex flex-wrap items-center gap-3">
          <StatusBadge kind="meal" status={o.status} />
          <p className="text-ink-soft">{PROVIDER_STATUS_NOTE[o.status]}</p>
        </div>

        {live ? (
          <ol className="grid grid-cols-2 gap-2 sm:grid-cols-4" aria-label="Meal progress">
            {PROVIDER_STATUS_FLOW.map((status) => {
              const reached = PROVIDER_STATUS_FLOW.indexOf(status) <= PROVIDER_STATUS_FLOW.indexOf(o.status);
              return (
                <li
                  key={status}
                  aria-current={status === o.status ? 'step' : undefined}
                  className={cx(
                    'rounded-md border-2 p-3 text-small font-bold',
                    status === o.status
                      ? 'border-primary bg-primary-soft text-primary'
                      : reached
                        ? 'border-line bg-surface-muted text-ink'
                        : 'border-line bg-surface text-ink-muted',
                  )}
                >
                  {reached ? '✓ ' : ''}
                  {MEAL_STATUS[status].label}
                </li>
              );
            })}
          </ol>
        ) : null}

        {live && !canCook ? (
          <Notice tone="info">You can update this meal on {formatDateLong(o.scheduled_date)}.</Notice>
        ) : null}

        <div className="flex flex-wrap gap-2">
          {next && canCook ? (
            <Button
              size="lg"
              icon={ArrowRight}
              loading={update.isPending}
              onClick={() => setStatus(next, `Marked as ${STATUS_VERB[next]}.`)}
            >
              {PROVIDER_ACTION_LABEL[next]}
            </Button>
          ) : null}
          {previous && canCook ? (
            <Button
              variant="quiet"
              icon={Undo2}
              disabled={update.isPending}
              onClick={() => setStatus(previous, `Moved back to ${STATUS_VERB[previous]}.`)}
            >
              {`Undo: back to “${MEAL_STATUS[previous].label}”`}
            </Button>
          ) : null}
        </div>
        {live && o.status !== 'DELIVERED' ? (
          <div>
            <Button variant="dangerOutline" icon={CircleX} onClick={() => setConfirmCancel(true)}>
              Kitchen can’t deliver this meal
            </Button>
          </div>
        ) : null}
      </Card>

      <Card>
        <h2 className="text-heading font-bold">Customer</h2>
        <dl className="grid gap-4 sm:grid-cols-2">
          <div>
            <dt className="text-small text-ink-soft">Phone</dt>
            <dd className="font-bold">{formatPhone(o.customer?.phone) || 'Not shared'}</dd>
          </div>
          <div>
            <dt className="text-small text-ink-soft">Plan</dt>
            <dd className="font-bold">{o.subscription?.plan_name}</dd>
          </div>
          <div className="sm:col-span-2">
            <dt className="text-small text-ink-soft">Food preferences</dt>
            <dd className="font-bold">
              {o.customer?.dietary_preferences.length
                ? o.customer.dietary_preferences.map(dietaryLabel).join(', ')
                : 'None given'}
            </dd>
          </div>
          {o.address ? (
            <div className="sm:col-span-2">
              <dt className="text-small text-ink-soft">Deliver to</dt>
              <dd className="flex items-start gap-2 font-bold">
                <MapPin aria-hidden className="mt-1 size-5 shrink-0 text-primary" />
                {formatAddress(o.address)}
              </dd>
              {o.address.instructions ? (
                <dd className="mt-2 rounded-md bg-highlight-soft p-3">
                  <span className="font-bold">Delivery note: </span>
                  {o.address.instructions}
                </dd>
              ) : null}
            </div>
          ) : null}
        </dl>
        <div className="flex flex-wrap gap-2">
          {o.customer?.phone ? (
            <a
              href={telLink(o.customer.phone)}
              className="inline-flex min-h-12 items-center gap-2 rounded-md border-2 border-primary bg-surface px-4 font-bold text-primary hover:bg-primary-soft"
            >
              <Phone aria-hidden className="size-5" />
              {`Call ${customerName}`}
            </a>
          ) : null}
          {o.subscription ? (
            <ButtonLink href={`/customers/${o.subscription.id}`} variant="quiet">
              See all their meals
            </ButtonLink>
          ) : null}
        </div>
      </Card>

      <ConfirmDialog
        open={confirmCancel}
        title={`Cancel ${customerName}’s ${mealName}?`}
        confirmLabel="Yes, cancel this meal"
        cancelLabel="No, keep it"
        destructive
        loading={update.isPending}
        error={update.error ? describeError(update.error, 'cancelling this meal').message : null}
        onConfirm={() =>
          setStatus('CANCELLED', 'Meal cancelled. One extra meal was added to the end of the customer’s plan.')
        }
        onCancel={() => setConfirmCancel(false)}
      >
        <p>
          {`The ${mealName} on ${formatDateLong(o.scheduled_date)} won’t be delivered. The customer keeps what they paid for: one extra meal is added to the end of their plan.`}
        </p>
        <p className="mt-2 font-bold text-ink">Please call them to let them know.</p>
      </ConfirmDialog>
    </>
  );
}
