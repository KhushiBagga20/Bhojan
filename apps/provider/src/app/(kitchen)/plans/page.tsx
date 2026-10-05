'use client';

import { ClipboardList, Pencil, Plus } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import {
  describeError,
  formatDeliveryDays,
  formatRupees,
  MEAL_TYPE_LABEL,
  MEAL_TYPES,
  PLAN_PRICE_SUFFIX,
  PLAN_TYPE_LABEL,
  PLAN_TYPES,
  pluralize,
  pricePerMeal,
  type MealType,
  type PlanRow,
  type PlanType,
} from '@bhojan/shared';
import { useCurrentKitchen } from '@/components/KitchenShell';
import {
  Button,
  Card,
  cx,
  DayPicker,
  EmptyState,
  ErrorState,
  Field,
  Loading,
  Notice,
  PageHeader,
} from '@/components/ui';
import { usePlans, useSavePlan, useSetPlanActive } from '@/lib/queries';

type PlanWithCount = PlanRow & { subscriptions: Array<{ count: number }> };

export default function PlansPage() {
  const kitchen = useCurrentKitchen();
  const plans = usePlans(kitchen.id);
  const setActive = useSetPlanActive();
  const [editing, setEditing] = useState<PlanRow | 'new' | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const toggle = (plan: PlanRow) =>
    setActive.mutate(
      { id: plan.id, isActive: !plan.is_active },
      {
        onSuccess: () =>
          setNotice(
            plan.is_active
              ? `“${plan.name}” is no longer on sale. Existing customers are not affected.`
              : `“${plan.name}” is on sale again.`,
          ),
      },
    );

  return (
    <>
      <PageHeader
        title="Meal plans"
        subtitle="What customers can buy from you. Customers choose a plan; you decide what’s in it."
        actions={
          editing ? null : (
            <Button icon={Plus} onClick={() => setEditing('new')}>
              New plan
            </Button>
          )
        }
      />
      {notice ? <Notice tone="success">{notice}</Notice> : null}
      {setActive.error ? (
        <Notice tone="danger">{describeError(setActive.error, 'updating the plan').message}</Notice>
      ) : null}

      {editing ? (
        <PlanForm
          providerId={kitchen.id}
          plan={editing === 'new' ? null : editing}
          onDone={(message) => {
            setEditing(null);
            if (message) setNotice(message);
          }}
        />
      ) : null}

      {plans.isPending ? (
        <Loading message="Loading your plans…" />
      ) : plans.error ? (
        <ErrorState error={plans.error} action="loading your plans" onRetry={() => plans.refetch()} />
      ) : plans.data.length === 0 && !editing ? (
        <EmptyState
          icon={ClipboardList}
          title="No meal plans yet"
          message="Create at least one plan so customers can order. Most kitchens offer a single meal, a weekly plan and a monthly plan."
          action={
            <Button icon={Plus} onClick={() => setEditing('new')}>
              Create your first plan
            </Button>
          }
        />
      ) : (
        <ul className="grid gap-4 md:grid-cols-2">
          {(plans.data as PlanWithCount[]).map((plan) => {
            const customers = plan.subscriptions[0]?.count ?? 0;
            return (
              <li key={plan.id}>
                <Card className={cx(!plan.is_active && 'opacity-80')}>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-small font-bold uppercase tracking-wide text-primary">
                      {PLAN_TYPE_LABEL[plan.plan_type]}
                    </p>
                    <span
                      className={cx(
                        'rounded-sm px-2.5 py-1 text-small font-bold',
                        plan.is_active ? 'bg-success-soft text-success' : 'bg-surface-sunken text-ink-soft',
                      )}
                    >
                      {plan.is_active ? '● On sale' : '○ Not on sale'}
                    </span>
                  </div>
                  <h2 className="text-heading font-bold">{plan.name}</h2>
                  <p className="text-ink-soft">
                    {`${MEAL_TYPE_LABEL[plan.meal_type]} · ${formatDeliveryDays(plan.delivery_days)} · ${pluralize(plan.meals_count, 'meal')}`}
                  </p>
                  <p>
                    <span className="font-display text-heading">{formatRupees(plan.price_rupees)}</span>
                    <span className="text-ink-soft">{` ${PLAN_PRICE_SUFFIX[plan.plan_type]}`}</span>
                    {plan.meals_count > 1 ? (
                      <span className="text-ink-soft">{` · ${formatRupees(pricePerMeal(plan.price_rupees, plan.meals_count))} a meal`}</span>
                    ) : null}
                  </p>
                  <p className="text-small text-ink-soft">{`${pluralize(customers, 'customer')} bought this plan`}</p>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      variant="secondary"
                      icon={Pencil}
                      onClick={() => setEditing(plan)}
                      aria-label={`Edit ${plan.name}`}
                    >
                      Edit
                    </Button>
                    <Button
                      variant="quiet"
                      onClick={() => toggle(plan)}
                      loading={setActive.isPending && setActive.variables?.id === plan.id}
                    >
                      {plan.is_active ? 'Stop selling' : 'Start selling again'}
                    </Button>
                  </div>
                </Card>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}

const suggestMeals = (type: PlanType, days: number[]) =>
  type === 'ONE_TIME' ? 1 : type === 'WEEKLY' ? days.length : Math.round((days.length * 52) / 12);

function PlanForm({
  providerId,
  plan,
  onDone,
}: {
  providerId: string;
  plan: PlanRow | null;
  onDone: (message?: string) => void;
}) {
  const save = useSavePlan();
  const [type, setType] = useState<PlanType>(plan?.plan_type ?? 'MONTHLY');
  const [mealType, setMealType] = useState<MealType>(plan?.meal_type ?? 'LUNCH');
  const [name, setName] = useState(plan?.name ?? '');
  const [price, setPrice] = useState(plan ? String(plan.price_rupees) : '');
  const [days, setDays] = useState<number[]>(plan?.delivery_days ?? [1, 2, 3, 4, 5, 6]);
  const [meals, setMeals] = useState(
    plan ? String(plan.meals_count) : String(suggestMeals('MONTHLY', [1, 2, 3, 4, 5, 6])),
  );
  const [mealsTouched, setMealsTouched] = useState(!!plan);
  const [notice, setNotice] = useState(plan?.min_notice_days ?? 1);
  const [description, setDescription] = useState(plan?.description ?? '');
  const [errors, setErrors] = useState<Record<string, string>>({});

  const suggestedName = `${PLAN_TYPE_LABEL[type] === 'One-time' ? 'Single' : PLAN_TYPE_LABEL[type]} ${MEAL_TYPE_LABEL[mealType].toLowerCase()}`;
  const mealsCount = type === 'ONE_TIME' ? 1 : Number(meals);
  const priceNumber = Number(price);

  const changeType = (next: PlanType) => {
    setType(next);
    if (!mealsTouched || next === 'ONE_TIME') setMeals(String(suggestMeals(next, days)));
  };
  const changeDays = (next: number[]) => {
    setDays(next);
    if (!mealsTouched) setMeals(String(suggestMeals(type, next)));
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const found: Record<string, string> = {};
    if (!Number.isInteger(priceNumber) || priceNumber < 1) found.price = 'Enter the price in whole rupees, e.g. 2080.';
    if (days.length === 0) found.days = 'Choose at least one delivery day.';
    if (!Number.isInteger(mealsCount) || mealsCount < 1 || mealsCount > 62)
      found.meals = 'Enter a number of meals between 1 and 62.';
    setErrors(found);
    if (Object.keys(found).length) return;
    save.mutate(
      {
        ...(plan ? { id: plan.id } : {}),
        provider_id: providerId,
        name: name.trim() || suggestedName,
        description: description.trim() || null,
        plan_type: type,
        meal_type: mealType,
        price_rupees: priceNumber,
        meals_count: mealsCount,
        delivery_days: days,
        min_notice_days: notice,
      },
      {
        onSuccess: (saved) => onDone(plan ? `“${saved.name}” is updated.` : `“${saved.name}” is created and on sale.`),
      },
    );
  };

  return (
    <Card tone="accent">
      <h2 className="text-heading font-bold">{plan ? `Edit “${plan.name}”` : 'New meal plan'}</h2>
      {plan ? (
        <Notice tone="info">
          Changes apply to new customers. Anyone who already bought this plan keeps what they paid for.
        </Notice>
      ) : null}
      <form onSubmit={submit} noValidate className="flex flex-col gap-5">
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-1.5 font-bold">Type of plan</legend>
          <div className="grid gap-2 sm:grid-cols-3">
            {PLAN_TYPES.map((t) => (
              <label
                key={t}
                className={cx(
                  'flex min-h-12 cursor-pointer items-center gap-3 rounded-sm border-2 p-3 font-bold',
                  type === t ? 'border-primary bg-primary-soft' : 'border-line bg-surface',
                )}
              >
                <input
                  type="radio"
                  name="plan_type"
                  checked={type === t}
                  onChange={() => changeType(t)}
                  className="size-5 accent-[var(--bh-primary)]"
                />
                {PLAN_TYPE_LABEL[t]}
              </label>
            ))}
          </div>
        </fieldset>

        <fieldset className="flex flex-col gap-2">
          <legend className="mb-1.5 font-bold">Meal</legend>
          <div className="grid gap-2 sm:grid-cols-3">
            {MEAL_TYPES.map((t) => (
              <label
                key={t}
                className={cx(
                  'flex min-h-12 cursor-pointer items-center gap-3 rounded-sm border-2 p-3 font-bold',
                  mealType === t ? 'border-primary bg-primary-soft' : 'border-line bg-surface',
                )}
              >
                <input
                  type="radio"
                  name="meal_type"
                  checked={mealType === t}
                  onChange={() => setMealType(t)}
                  className="size-5 accent-[var(--bh-primary)]"
                />
                {MEAL_TYPE_LABEL[t]}
              </label>
            ))}
          </div>
        </fieldset>

        <Field label="Plan name" optional hint={`If left empty: “${suggestedName}”`}>
          {(p) => (
            <input
              {...p}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={suggestedName}
              maxLength={60}
            />
          )}
        </Field>

        <Field
          label="Price (₹)"
          hint={type === 'ONE_TIME' ? 'For one meal' : `For the whole ${type === 'WEEKLY' ? 'week' : 'month'}`}
          error={errors.price}
        >
          {(p) => (
            <input
              {...p}
              inputMode="numeric"
              value={price}
              onChange={(e) => setPrice(e.target.value.replace(/[^\d]/g, ''))}
              placeholder="2080"
            />
          )}
        </Field>

        <div className="flex flex-col gap-1">
          <DayPicker
            label={type === 'ONE_TIME' ? 'Days customers can order for' : 'Delivery days'}
            value={days}
            onChange={changeDays}
          />
          {errors.days ? <p className="text-small font-bold text-danger">{errors.days}</p> : null}
        </div>

        {type !== 'ONE_TIME' ? (
          <Field
            label="Number of meals"
            hint={`Suggested for ${formatDeliveryDays(days)}: ${suggestMeals(type, days)}. Skipped meals are added at the end, so customers always get this many.`}
            error={errors.meals}
          >
            {(p) => (
              <input
                {...p}
                inputMode="numeric"
                value={meals}
                onChange={(e) => {
                  setMealsTouched(true);
                  setMeals(e.target.value.replace(/[^\d]/g, ''));
                }}
              />
            )}
          </Field>
        ) : null}

        {priceNumber > 0 && mealsCount > 1 ? (
          <p className="rounded-md bg-surface-muted p-3">{`That’s ${formatRupees(pricePerMeal(priceNumber, mealsCount))} a meal.`}</p>
        ) : null}

        <Field label="Earliest start" hint="How much notice you need before the first meal">
          {(p) => (
            <select {...p} value={notice} onChange={(e) => setNotice(Number(e.target.value))}>
              <option value={0}>Same day</option>
              <option value={1}>Next day</option>
              <option value={2}>2 days later</option>
              <option value={3}>3 days later</option>
              <option value={7}>1 week later</option>
            </select>
          )}
        </Field>

        <Field label="Short description" optional hint="e.g. Our most popular plan">
          {(p) => <input {...p} value={description} onChange={(e) => setDescription(e.target.value)} maxLength={300} />}
        </Field>

        {save.error ? <Notice tone="danger">{describeError(save.error, 'saving the plan').message}</Notice> : null}
        <div className="flex flex-wrap gap-2">
          <Button type="submit" size="lg" loading={save.isPending} loadingLabel="Saving…">
            {plan ? 'Save changes' : 'Create plan'}
          </Button>
          <Button variant="secondary" size="lg" onClick={() => onDone()}>
            Cancel
          </Button>
        </div>
      </form>
    </Card>
  );
}
