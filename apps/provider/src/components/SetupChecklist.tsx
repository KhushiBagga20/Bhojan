'use client';

import { CircleCheck, CircleDot } from 'lucide-react';
import Link from 'next/link';
import { useMenus, usePlans, useSlots, type Kitchen } from '@/lib/queries';
import { Card, cx } from './ui';

/** Shown until the kitchen is live: the four steps, in order, with links. */
export function SetupChecklist({ kitchen }: { kitchen: Kitchen }) {
  const slots = useSlots(kitchen.id);
  const plans = usePlans(kitchen.id);
  const menus = useMenus(kitchen.id);

  const steps = [
    {
      done: !!slots.data?.some((s) => s.is_active),
      label: 'Add your delivery times',
      href: '/settings#delivery-times',
    },
    { done: !!plans.data?.some((p) => p.is_active), label: 'Create a meal plan (with its price)', href: '/plans' },
    { done: !!menus.data?.some((m) => m.menu_items.length > 0), label: 'Add your weekly menu', href: '/menu' },
    { done: kitchen.is_published, label: 'Go live so customers can find you', href: '/settings#go-live' },
  ];
  const next = steps.find((s) => !s.done);

  return (
    <Card tone="accent">
      <div className="flex flex-col gap-1">
        <h2 className="text-heading font-bold">Finish setting up your kitchen</h2>
        <p className="text-ink-soft">Customers can find you once these steps are done.</p>
      </div>
      <ol className="flex flex-col gap-2">
        {steps.map((step, i) => (
          <li key={step.label}>
            <Link
              href={step.href}
              className={cx(
                'flex min-h-12 items-center gap-3 rounded-md border-2 px-3 py-2 font-bold',
                step === next ? 'border-primary bg-primary-soft' : 'border-line bg-surface',
              )}
            >
              {step.done ? (
                <CircleCheck aria-hidden className="size-6 shrink-0 text-success" />
              ) : (
                <CircleDot aria-hidden className="size-6 shrink-0 text-ink-muted" />
              )}
              <span className="flex-1">{`${i + 1}. ${step.label}`}</span>
              <span className={cx('text-small', step.done ? 'text-success' : 'text-ink-soft')}>
                {step.done ? 'Done' : step === next ? 'Do this next' : 'To do'}
              </span>
            </Link>
          </li>
        ))}
      </ol>
    </Card>
  );
}
