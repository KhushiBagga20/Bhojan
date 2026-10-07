'use client';

import { Check } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { DIET_TYPE_LABEL, KITCHEN_DIETARY_OPTIONS, normalizeIndianMobile, type DietType } from '@bhojan/shared';
import { Button, Checkbox, Field, Notice, cx } from './ui';

export interface KitchenProfileValues {
  /** The cook's own name, used to greet them. Only asked during setup. */
  owner_name?: string;
  business_name: string;
  tagline: string;
  description: string;
  phone: string;
  city: string;
  service_areas: string;
  diet_type: DietType;
  dietary_options: string[];
  skip_cutoff_hours: number;
}

export interface CleanKitchenProfile {
  owner_name?: string;
  business_name: string;
  tagline: string | null;
  description: string | null;
  phone: string;
  city: string;
  service_areas: string[];
  diet_type: DietType;
  dietary_options: string[];
  skip_cutoff_hours: number;
}

type Errors = Partial<Record<keyof KitchenProfileValues, string>>;

const splitList = (text: string) =>
  text
    .split(/[\n,]+/)
    .map((s) => s.trim())
    .filter(Boolean);

function validate(v: KitchenProfileValues): { errors: Errors; clean?: CleanKitchenProfile } {
  const errors: Errors = {};
  if (v.business_name.trim().length < 2) errors.business_name = 'Please enter your kitchen’s name.';
  const phone = normalizeIndianMobile(v.phone);
  if (!phone) errors.phone = 'Please enter a 10-digit mobile number customers can call.';
  if (!v.city.trim()) errors.city = 'Please enter your city.';
  if (Object.keys(errors).length) return { errors };
  return {
    errors,
    clean: {
      ...(v.owner_name?.trim() ? { owner_name: v.owner_name.trim() } : {}),
      business_name: v.business_name.trim(),
      tagline: v.tagline.trim() || null,
      description: v.description.trim() || null,
      phone: phone!.replace('+', ''),
      city: v.city.trim(),
      service_areas: splitList(v.service_areas),
      diet_type: v.diet_type,
      dietary_options: v.dietary_options,
      skip_cutoff_hours: v.skip_cutoff_hours,
    },
  };
}

export function KitchenProfileForm({
  initial,
  submitLabel,
  saving,
  error,
  saved,
  full,
  onSubmit,
}: {
  initial: KitchenProfileValues;
  submitLabel: string;
  saving: boolean;
  error?: string | null;
  saved?: boolean;
  /** Show every field (settings) or only what's needed to start (onboarding). */
  full?: boolean;
  onSubmit: (values: CleanKitchenProfile) => void;
}) {
  const [values, setValues] = useState(initial);
  const [errors, setErrors] = useState<Errors>({});
  const set = <K extends keyof KitchenProfileValues>(key: K, value: KitchenProfileValues[K]) => {
    setValues((v) => ({ ...v, [key]: value }));
    setErrors((e) => ({ ...e, [key]: undefined }));
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const result = validate(values);
    setErrors(result.errors);
    if (result.clean) onSubmit(result.clean);
  };

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-5">
      {values.owner_name !== undefined ? (
        <Field label="Your name" optional hint="So we can greet you, e.g. Sunita Sharma">
          {(p) => (
            <input
              {...p}
              autoComplete="name"
              value={values.owner_name}
              onChange={(e) => set('owner_name', e.target.value)}
              maxLength={80}
            />
          )}
        </Field>
      ) : null}
      <Field label="Kitchen name" hint="What customers will see, e.g. Sharma Home Tiffin" error={errors.business_name}>
        {(p) => (
          <input
            {...p}
            value={values.business_name}
            onChange={(e) => set('business_name', e.target.value)}
            maxLength={80}
          />
        )}
      </Field>
      <Field label="One-line description" optional hint="Shown under your name, e.g. Home-style vegetarian meals">
        {(p) => (
          <input {...p} value={values.tagline} onChange={(e) => set('tagline', e.target.value)} maxLength={120} />
        )}
      </Field>
      {full ? (
        <Field label="About your kitchen" optional hint="Who cooks, what makes your food special">
          {(p) => (
            <textarea
              {...p}
              rows={4}
              value={values.description}
              onChange={(e) => set('description', e.target.value)}
              maxLength={1000}
            />
          )}
        </Field>
      ) : null}
      <Field label="Phone number for customers" hint="Customers call this number with questions" error={errors.phone}>
        {(p) => (
          <input
            {...p}
            type="tel"
            inputMode="tel"
            value={values.phone}
            onChange={(e) => set('phone', e.target.value)}
          />
        )}
      </Field>

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1.5 font-bold">Food you cook</legend>
        <div className="grid gap-2 sm:grid-cols-3">
          {(Object.keys(DIET_TYPE_LABEL) as DietType[]).map((type) => (
            <label
              key={type}
              className={cx(
                'flex min-h-12 cursor-pointer items-center gap-3 rounded-sm border-2 p-3 font-bold',
                values.diet_type === type ? 'border-primary bg-primary-soft' : 'border-line bg-surface',
              )}
            >
              <input
                type="radio"
                name="diet_type"
                checked={values.diet_type === type}
                onChange={() => set('diet_type', type)}
                className="size-5 accent-[var(--bh-primary)]"
              />
              {DIET_TYPE_LABEL[type]}
            </label>
          ))}
        </div>
      </fieldset>

      <Field label="City" error={errors.city}>
        {(p) => <input {...p} value={values.city} onChange={(e) => set('city', e.target.value)} />}
      </Field>
      <Field
        label="Areas you deliver to"
        optional
        hint="Shown to customers, and how customers who don’t share their location find you. Separate with commas, e.g. Malviya Nagar, Saket"
      >
        {(p) => <input {...p} value={values.service_areas} onChange={(e) => set('service_areas', e.target.value)} />}
      </Field>

      {full ? (
        <>
          <fieldset className="flex flex-col gap-2">
            <legend className="mb-1.5 font-bold">You can also make</legend>
            <div className="grid gap-2 sm:grid-cols-2">
              {KITCHEN_DIETARY_OPTIONS.map((option) => (
                <Checkbox
                  key={option.value}
                  label={option.label}
                  checked={values.dietary_options.includes(option.value)}
                  onChange={(on) =>
                    set(
                      'dietary_options',
                      on
                        ? [...values.dietary_options, option.value]
                        : values.dietary_options.filter((v) => v !== option.value),
                    )
                  }
                />
              ))}
            </div>
          </fieldset>
          <Field
            label="Last change before delivery"
            hint="Customers can skip or cancel a meal until this many hours before its delivery time."
          >
            {(p) => (
              <select
                {...p}
                value={values.skip_cutoff_hours}
                onChange={(e) => set('skip_cutoff_hours', Number(e.target.value))}
              >
                {[1, 2, 3, 4, 5, 6, 8, 12, 24].map((h) => (
                  <option key={h} value={h}>{`${h} ${h === 1 ? 'hour' : 'hours'} before`}</option>
                ))}
              </select>
            )}
          </Field>
        </>
      ) : null}

      {error ? <Notice tone="danger">{error}</Notice> : null}
      {saved ? <Notice tone="success">Your kitchen details are saved.</Notice> : null}
      <Button type="submit" size="lg" icon={Check} loading={saving} loadingLabel="Saving…">
        {submitLabel}
      </Button>
    </form>
  );
}
