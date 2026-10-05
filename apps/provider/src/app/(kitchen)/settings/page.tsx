'use client';

import { Eye, EyeOff, Image as ImageIcon, Plus, Rocket } from 'lucide-react';
import { useRef, useState, type FormEvent } from 'react';
import { describeError, formatTimeWindow, MEAL_TYPE_LABEL, MEAL_TYPES, type MealType } from '@bhojan/shared';
import { KitchenProfileForm } from '@/components/KitchenProfileForm';
import { useCurrentKitchen } from '@/components/KitchenShell';
import { Button, Card, ConfirmDialog, Field, Notice, PageHeader, SectionTitle } from '@/components/ui';
import { uploadKitchenFile, useSaveSlot, useSlots, useUpdateKitchen, type Kitchen } from '@/lib/queries';

export default function SettingsPage() {
  const kitchen = useCurrentKitchen();
  return (
    <>
      <PageHeader
        title="Settings"
        subtitle="Your kitchen’s details, delivery times, and whether customers can find you."
      />
      <GoLive kitchen={kitchen} />
      <DeliveryTimes kitchen={kitchen} />
      <Details kitchen={kitchen} />
      <CoverPhoto kitchen={kitchen} />
    </>
  );
}

function Details({ kitchen }: { kitchen: Kitchen }) {
  const update = useUpdateKitchen();
  const [saved, setSaved] = useState(false);
  return (
    <Card>
      <SectionTitle>Kitchen details</SectionTitle>
      <KitchenProfileForm
        full
        initial={{
          business_name: kitchen.business_name,
          tagline: kitchen.tagline ?? '',
          description: kitchen.description ?? '',
          phone: kitchen.phone.slice(-10),
          city: kitchen.city,
          service_areas: kitchen.service_areas.join(', '),
          service_pincodes: kitchen.service_pincodes.join(', '),
          diet_type: kitchen.diet_type,
          dietary_options: kitchen.dietary_options,
          skip_cutoff_hours: kitchen.skip_cutoff_hours,
        }}
        submitLabel="Save kitchen details"
        saving={update.isPending}
        saved={saved && !update.isPending}
        error={update.error ? describeError(update.error, 'saving your details').message : null}
        onSubmit={(values) => {
          setSaved(false);
          update.mutate({ id: kitchen.id, ...values }, { onSuccess: () => setSaved(true) });
        }}
      />
    </Card>
  );
}

function DeliveryTimes({ kitchen }: { kitchen: Kitchen }) {
  const slots = useSlots(kitchen.id);
  const save = useSaveSlot();
  const [mealType, setMealType] = useState<MealType>('LUNCH');
  const [start, setStart] = useState('12:30');
  const [end, setEnd] = useState('13:00');
  const [error, setError] = useState<string | null>(null);

  const add = (e: FormEvent) => {
    e.preventDefault();
    if (!start || !end || end <= start) return setError('The end time must be after the start time.');
    setError(null);
    save.mutate({ provider_id: kitchen.id, meal_type: mealType, start_time: start, end_time: end });
  };

  return (
    <section id="delivery-times" className="scroll-mt-6">
      <Card>
        <SectionTitle>Delivery times</SectionTitle>
        <p className="text-ink-soft">
          When your meals reach customers. If you have more than one time for a meal, customers choose one when they
          subscribe.
        </p>
        {slots.data?.length ? (
          <ul className="flex flex-col gap-2">
            {slots.data.map((slot) => (
              <li
                key={slot.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-line p-3"
              >
                <span className={slot.is_active ? 'font-bold' : 'font-bold text-ink-muted line-through'}>
                  {`${MEAL_TYPE_LABEL[slot.meal_type]} · ${formatTimeWindow(slot.start_time, slot.end_time)}`}
                </span>
                <span className="flex items-center gap-3">
                  <span className="text-small text-ink-soft">{slot.is_active ? 'In use' : 'Not in use'}</span>
                  <Button variant="quiet" onClick={() => save.mutate({ ...slot, is_active: !slot.is_active })}>
                    {slot.is_active ? 'Stop using' : 'Use again'}
                  </Button>
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <Notice tone="highlight">Add at least one delivery time before going live.</Notice>
        )}
        <form
          onSubmit={add}
          noValidate
          className="grid gap-3 rounded-md bg-surface-muted p-4 sm:grid-cols-[1fr_1fr_1fr_auto] sm:items-end"
        >
          <Field label="Meal">
            {(p) => (
              <select {...p} value={mealType} onChange={(e) => setMealType(e.target.value as MealType)}>
                {MEAL_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {MEAL_TYPE_LABEL[t]}
                  </option>
                ))}
              </select>
            )}
          </Field>
          <Field label="From">
            {(p) => <input {...p} type="time" value={start} onChange={(e) => setStart(e.target.value)} />}
          </Field>
          <Field label="To">
            {(p) => <input {...p} type="time" value={end} onChange={(e) => setEnd(e.target.value)} />}
          </Field>
          <Button type="submit" icon={Plus} loading={save.isPending}>
            Add time
          </Button>
        </form>
        {error ? <Notice tone="danger">{error}</Notice> : null}
        {save.error ? (
          <Notice tone="danger">{describeError(save.error, 'saving the delivery time').message}</Notice>
        ) : null}
      </Card>
    </section>
  );
}

function GoLive({ kitchen }: { kitchen: Kitchen }) {
  const update = useUpdateKitchen();
  const [confirmOffline, setConfirmOffline] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const setPublished = (isPublished: boolean) =>
    update.mutate(
      { id: kitchen.id, is_published: isPublished },
      {
        onSuccess: () => {
          setConfirmOffline(false);
          setMessage(
            isPublished
              ? 'Your kitchen is live. Customers in your PIN codes can now find you and order.'
              : 'Your kitchen is offline. Existing customers still get their meals.',
          );
        },
      },
    );

  return (
    <section id="go-live" className="scroll-mt-6">
      <Card tone={kitchen.is_published ? 'default' : 'accent'}>
        <SectionTitle>{kitchen.is_published ? 'Your kitchen is live' : 'Go live'}</SectionTitle>
        <p className="text-ink-soft">
          {kitchen.is_published
            ? `Customers with PIN codes ${kitchen.service_pincodes.join(', ')} can find you and order.`
            : 'Customers can’t see your kitchen yet. Go live once you have a delivery time, a meal plan and your menu.'}
        </p>
        {message ? <Notice tone="success">{message}</Notice> : null}
        {update.error && !confirmOffline ? (
          <Notice tone="danger">{describeError(update.error, 'updating your kitchen').message}</Notice>
        ) : null}
        <div>
          {kitchen.is_published ? (
            <Button variant="dangerOutline" icon={EyeOff} onClick={() => setConfirmOffline(true)}>
              Take my kitchen offline
            </Button>
          ) : (
            <Button size="lg" icon={Rocket} loading={update.isPending} onClick={() => setPublished(true)}>
              Go live now
            </Button>
          )}
        </div>
      </Card>
      <ConfirmDialog
        open={confirmOffline}
        title="Take your kitchen offline?"
        confirmLabel="Yes, take it offline"
        cancelLabel="No, stay live"
        destructive
        loading={update.isPending}
        onConfirm={() => setPublished(false)}
        onCancel={() => setConfirmOffline(false)}
      >
        <p>New customers won’t be able to find you. Everyone who already has a plan keeps getting their meals.</p>
      </ConfirmDialog>
      {!kitchen.is_published ? null : (
        <p className="mt-2 flex items-center gap-2 text-small text-ink-soft">
          <Eye aria-hidden className="size-4" />
          Tip: check your page the way customers see it in the Bhojan app.
        </p>
      )}
    </section>
  );
}

function CoverPhoto({ kitchen }: { kitchen: Kitchen }) {
  const update = useUpdateKitchen();
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onFile = async (file: File) => {
    if (!file.type.startsWith('image/')) return setError('Please choose a photo (JPG, PNG or WEBP).');
    setError(null);
    setUploading(true);
    try {
      const { url } = await uploadKitchenFile(kitchen.id, 'cover', file);
      await update.mutateAsync({ id: kitchen.id, cover_image_url: url });
    } catch (err) {
      setError(
        err instanceof Error && err.message === 'FILE_TOO_LARGE'
          ? 'That photo is too large. Please choose one under 10 MB.'
          : describeError(err, 'uploading your photo').message,
      );
    } finally {
      setUploading(false);
    }
  };

  return (
    <Card>
      <SectionTitle>Kitchen photo</SectionTitle>
      <p className="text-ink-soft">A warm photo of your food or kitchen. It appears next to your name.</p>
      <div className="flex flex-wrap items-center gap-4">
        {kitchen.cover_image_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={kitchen.cover_image_url}
            alt={`Photo for ${kitchen.business_name}`}
            className="size-24 rounded-md object-cover"
          />
        ) : (
          <span className="flex size-24 items-center justify-center rounded-md bg-primary-soft text-primary">
            <ImageIcon aria-hidden className="size-10" />
          </span>
        )}
        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="sr-only"
          id="cover-file"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) onFile(file);
            e.target.value = '';
          }}
        />
        <Button
          variant="secondary"
          loading={uploading}
          loadingLabel="Uploading…"
          onClick={() => inputRef.current?.click()}
        >
          {kitchen.cover_image_url ? 'Change photo' : 'Upload a photo'}
        </Button>
      </div>
      {error ? <Notice tone="danger">{error}</Notice> : null}
    </Card>
  );
}
