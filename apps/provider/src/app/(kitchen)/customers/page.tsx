'use client';

import { Users } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import {
  daysBetween,
  dietaryLabel,
  formatDateShort,
  formatPhone,
  todayIST,
  type SubscriptionStatus,
} from '@bhojan/shared';
import { useCurrentKitchen } from '@/components/KitchenShell';
import { cx, EmptyState, ErrorState, Loading, PageHeader, StatusBadge } from '@/components/ui';
import { useCustomers, type CustomerSubscription } from '@/lib/queries';

const FILTERS: Array<{ key: string; label: string; statuses: SubscriptionStatus[] }> = [
  { key: 'active', label: 'Active', statuses: ['ACTIVE'] },
  { key: 'paused', label: 'Paused', statuses: ['PAUSED'] },
  { key: 'finished', label: 'Finished or cancelled', statuses: ['EXPIRED', 'CANCELLED'] },
];

export default function CustomersPage() {
  const kitchen = useCurrentKitchen();
  const customers = useCustomers(kitchen.id);
  const [filter, setFilter] = useState('active');
  const current = FILTERS.find((f) => f.key === filter)!;
  const list = (customers.data ?? []).filter((s) => current.statuses.includes(s.status));

  return (
    <>
      <PageHeader
        title="Customers"
        subtitle="Everyone who has bought a plan from your kitchen. New customers appear at the top."
      />
      <div role="group" aria-label="Show customers" className="flex flex-wrap gap-2">
        {FILTERS.map((f) => {
          const count = (customers.data ?? []).filter((s) => f.statuses.includes(s.status)).length;
          return (
            <button
              key={f.key}
              type="button"
              aria-pressed={filter === f.key}
              onClick={() => setFilter(f.key)}
              className={cx(
                'min-h-12 rounded-md border-2 px-4 font-bold',
                filter === f.key
                  ? 'border-primary bg-primary-soft text-primary'
                  : 'border-line bg-surface text-ink-soft hover:bg-surface-sunken',
              )}
            >
              {`${f.label} (${count})`}
            </button>
          );
        })}
      </div>

      {customers.isPending ? (
        <Loading message="Loading customers…" />
      ) : customers.error ? (
        <ErrorState error={customers.error} action="loading customers" onRetry={() => customers.refetch()} />
      ) : list.length === 0 ? (
        <EmptyState
          icon={Users}
          title={filter === 'active' ? 'No active customers yet' : 'Nobody here'}
          message={filter === 'active' ? 'When someone subscribes to one of your plans, they appear here.' : undefined}
        />
      ) : (
        <ul className="flex flex-col gap-3">
          {list.map((sub) => (
            <CustomerRow key={sub.id} sub={sub} />
          ))}
        </ul>
      )}
    </>
  );
}

function CustomerRow({ sub }: { sub: CustomerSubscription }) {
  const delivered = sub.meal_orders.filter((m) => m.status === 'DELIVERED').length;
  const isNew = sub.activated_at && daysBetween(todayIST(new Date(sub.activated_at)), todayIST()) <= 3;
  const prefs = (sub.customer?.dietary_preferences ?? []).filter((p) => p !== 'VEGETARIAN');
  return (
    <li>
      <Link
        href={`/customers/${sub.id}`}
        className="flex flex-col gap-3 rounded-md border border-line bg-surface p-4 shadow-card hover:border-primary md:flex-row md:items-center"
      >
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <p className="flex flex-wrap items-center gap-2 text-body font-bold text-primary">
            {sub.customer?.name ?? 'Customer'}
            {isNew ? <span className="rounded-sm bg-success-soft px-2 py-0.5 text-small text-success">New</span> : null}
          </p>
          <p className="text-small text-ink-soft">
            {[formatPhone(sub.customer?.phone), sub.address?.locality].filter(Boolean).join(' · ')}
          </p>
          <p className="text-small">
            {`${sub.plan_name} · started ${formatDateShort(sub.start_date)}`}
            {prefs.length ? ` · ${prefs.map(dietaryLabel).join(', ')}` : ''}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <p className="text-small text-ink-soft">{`${delivered} of ${sub.meals_total} delivered`}</p>
          <StatusBadge kind="plan" status={sub.status} />
        </div>
      </Link>
    </li>
  );
}
