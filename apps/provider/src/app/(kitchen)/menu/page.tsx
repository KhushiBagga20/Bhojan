'use client';

import { FileText, Plus, Trash2, Upload } from 'lucide-react';
import { useRef, useState, type FormEvent } from 'react';
import {
  describeError,
  MEAL_TYPE_LABEL,
  MEAL_TYPES,
  WEEKDAY_NAMES,
  type MealType,
  type MenuFileRow,
  type MenuWithItems,
} from '@bhojan/shared';
import { useCurrentKitchen } from '@/components/KitchenShell';
import { Button, Card, ConfirmDialog, cx, ErrorState, Loading, Notice, PageHeader } from '@/components/ui';
import {
  MAX_UPLOAD_BYTES,
  useAddMenuItem,
  useDeleteMenuFile,
  useDeleteMenuItem,
  useMenuFiles,
  useMenus,
  usePlans,
  useRenameMenuItem,
  useSlots,
  useUploadMenuFile,
} from '@/lib/queries';

export default function MenuPage() {
  const kitchen = useCurrentKitchen();
  const menus = useMenus(kitchen.id);
  const plans = usePlans(kitchen.id);
  const slots = useSlots(kitchen.id);
  const offered = MEAL_TYPES.filter(
    (t) =>
      plans.data?.some((p) => p.meal_type === t) ||
      slots.data?.some((s) => s.meal_type === t) ||
      menus.data?.some((m) => m.meal_type === t),
  );
  const types = offered.length ? offered : (['LUNCH'] as MealType[]);
  const [chosen, setChosen] = useState<MealType | null>(null);
  const mealType = chosen && types.includes(chosen) ? chosen : types.includes('LUNCH') ? 'LUNCH' : types[0];

  return (
    <>
      <PageHeader
        title="Weekly menu"
        subtitle="What you cook on each day of the week. Customers see this on your page and on every meal they’ve booked."
      />

      {types.length > 1 ? (
        <div role="group" aria-label="Meal" className="flex flex-wrap gap-2">
          {types.map((t) => (
            <button
              key={t}
              type="button"
              aria-pressed={mealType === t}
              onClick={() => setChosen(t)}
              className={cx(
                'min-h-12 rounded-md border-2 px-5 font-bold',
                mealType === t ? 'border-primary bg-primary-soft text-primary' : 'border-line bg-surface text-ink-soft',
              )}
            >
              {MEAL_TYPE_LABEL[t]}
            </button>
          ))}
        </div>
      ) : null}

      {menus.isPending ? (
        <Loading message="Loading your menu…" />
      ) : menus.error ? (
        <ErrorState error={menus.error} action="loading your menu" onRetry={() => menus.refetch()} />
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {WEEKDAY_NAMES.map((dayName, i) => (
            <DayMenu
              key={`${mealType}-${dayName}`}
              providerId={kitchen.id}
              mealType={mealType}
              day={i + 1}
              dayName={dayName}
              menu={menus.data.find((m) => m.meal_type === mealType && m.menu_date === null && m.day_of_week === i + 1)}
            />
          ))}
        </div>
      )}

      <MenuFiles providerId={kitchen.id} />
    </>
  );
}

function DayMenu({
  providerId,
  mealType,
  day,
  dayName,
  menu,
}: {
  providerId: string;
  mealType: MealType;
  day: number;
  dayName: string;
  menu?: MenuWithItems;
}) {
  const items = [...(menu?.menu_items ?? [])].sort((a, b) => a.sort_order - b.sort_order);
  const add = useAddMenuItem();
  const rename = useRenameMenuItem();
  const remove = useDeleteMenuItem();
  const [draft, setDraft] = useState('');
  const [editing, setEditing] = useState<{ id: string; name: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const addDish = (e: FormEvent) => {
    e.preventDefault();
    const name = draft.trim();
    if (!name) return setError('Type the name of a dish first, e.g. Dal tadka.');
    setError(null);
    add.mutate(
      { providerId, mealType, dayOfWeek: day, name, menuId: menu?.id, sortOrder: (items.at(-1)?.sort_order ?? 0) + 1 },
      {
        onSuccess: () => {
          setDraft('');
          inputRef.current?.focus();
        },
        onError: (err) => setError(describeError(err, 'adding the dish').message),
      },
    );
  };

  const saveEdit = (e: FormEvent) => {
    e.preventDefault();
    if (!editing || !editing.name.trim()) return;
    rename.mutate(
      { id: editing.id, name: editing.name.trim() },
      { onSuccess: () => setEditing(null), onError: (err) => setError(describeError(err, 'saving the dish').message) },
    );
  };

  return (
    <Card className={items.length === 0 ? 'border-dashed' : undefined}>
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="text-heading font-bold">{dayName}</h2>
        <span className="text-small text-ink-soft">
          {items.length ? `${items.length} ${items.length === 1 ? 'dish' : 'dishes'}` : 'No menu yet'}
        </span>
      </div>

      {items.length ? (
        <ul className="flex flex-col gap-2">
          {items.map((item) => (
            <li key={item.id} className="flex flex-wrap items-center gap-2 rounded-md bg-surface-muted px-3 py-2">
              {editing?.id === item.id ? (
                <form onSubmit={saveEdit} className="flex flex-1 flex-wrap items-center gap-2">
                  <label className="sr-only" htmlFor={`edit-${item.id}`}>{`Dish name for ${dayName}`}</label>
                  <input
                    id={`edit-${item.id}`}
                    autoFocus
                    onFocus={(e) => e.currentTarget.select()}
                    value={editing.name}
                    onChange={(e) => setEditing({ id: item.id, name: e.target.value })}
                    maxLength={60}
                    className="min-h-12 flex-1 rounded-sm border-2 border-primary bg-surface px-3"
                  />
                  <Button type="submit" loading={rename.isPending}>
                    Save
                  </Button>
                  <Button variant="quiet" onClick={() => setEditing(null)}>
                    Cancel
                  </Button>
                </form>
              ) : (
                <>
                  <span className="flex-1 font-bold">{item.name}</span>
                  <Button
                    variant="quiet"
                    onClick={() => setEditing({ id: item.id, name: item.name })}
                    aria-label={`Edit ${item.name}`}
                  >
                    Edit
                  </Button>
                  <Button
                    variant="quiet"
                    icon={Trash2}
                    loading={remove.isPending && remove.variables === item.id}
                    onClick={() => remove.mutate(item.id)}
                    aria-label={`Remove ${item.name} from ${dayName}`}
                  >
                    Remove
                  </Button>
                </>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-ink-soft">{`Add what you cook on ${dayName}s. If you don’t deliver on ${dayName}s, leave this empty.`}</p>
      )}

      <form onSubmit={addDish} className="flex flex-wrap gap-2" noValidate>
        <label className="sr-only" htmlFor={`add-${mealType}-${day}`}>{`Add a dish for ${dayName}`}</label>
        <input
          ref={inputRef}
          id={`add-${mealType}-${day}`}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="e.g. Aloo gobhi"
          maxLength={60}
          className="min-h-12 min-w-0 flex-1 rounded-sm border-2 border-line-strong bg-surface px-3 focus:border-primary focus:outline-none"
        />
        <Button type="submit" variant="secondary" icon={Plus} loading={add.isPending}>
          Add dish
        </Button>
      </form>
      {error ? <Notice tone="danger">{error}</Notice> : null}
    </Card>
  );
}

function MenuFiles({ providerId }: { providerId: string }) {
  const files = useMenuFiles(providerId);
  const upload = useUploadMenuFileWithMessages(providerId);
  const remove = useDeleteMenuFile();
  const [toRemove, setToRemove] = useState<MenuFileRow | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <Card>
      <div className="flex flex-col gap-1">
        <h2 className="text-heading font-bold">Printed menu card</h2>
        <p className="text-ink-soft">
          Already have a menu card? Upload a photo or PDF and customers can open it from your page. (It won’t fill in
          the weekly menu above.)
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,application/pdf"
          className="sr-only"
          id="menu-file"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) upload.start(file);
            e.target.value = '';
          }}
        />
        <Button
          variant="secondary"
          icon={Upload}
          loading={upload.isPending}
          loadingLabel="Uploading…"
          onClick={() => inputRef.current?.click()}
        >
          Upload a photo or PDF
        </Button>
        <span className="text-small text-ink-soft">{`JPG, PNG, WEBP or PDF, up to ${MAX_UPLOAD_BYTES / 1024 / 1024} MB`}</span>
      </div>
      {upload.message ? <Notice tone={upload.message.tone}>{upload.message.text}</Notice> : null}
      {files.data?.length ? (
        <ul className="flex flex-col gap-2">
          {files.data.map((file) => (
            <li key={file.id} className="flex flex-wrap items-center gap-3 rounded-md border border-line p-3">
              {file.mime_type.startsWith('image/') ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={file.public_url} alt="" className="size-16 rounded-sm object-cover" />
              ) : (
                <FileText aria-hidden className="size-10 text-primary" />
              )}
              <a
                href={file.public_url}
                target="_blank"
                rel="noreferrer"
                className="flex-1 font-bold text-primary underline-offset-4 hover:underline"
              >
                {file.file_name}
              </a>
              <Button
                variant="quiet"
                icon={Trash2}
                onClick={() => setToRemove(file)}
                aria-label={`Remove ${file.file_name}`}
              >
                Remove
              </Button>
            </li>
          ))}
        </ul>
      ) : null}
      <ConfirmDialog
        open={!!toRemove}
        title="Remove this menu card?"
        confirmLabel="Yes, remove it"
        cancelLabel="No, keep it"
        destructive
        loading={remove.isPending}
        error={remove.error ? describeError(remove.error, 'removing the file').message : null}
        onConfirm={() =>
          toRemove &&
          remove.mutate({ id: toRemove.id, storagePath: toRemove.storage_path }, { onSuccess: () => setToRemove(null) })
        }
        onCancel={() => setToRemove(null)}
      >
        <p>{`Customers will no longer be able to open “${toRemove?.file_name}”.`}</p>
      </ConfirmDialog>
    </Card>
  );
}

/** Upload with plain-language success and error messages. */
function useUploadMenuFileWithMessages(providerId: string) {
  const upload = useUploadMenuFile();
  const [message, setMessage] = useState<{ tone: 'success' | 'danger'; text: string } | null>(null);
  return {
    isPending: upload.isPending,
    message,
    start: (file: File) => {
      setMessage(null);
      upload.mutate(
        { providerId, file },
        {
          onSuccess: () =>
            setMessage({
              tone: 'success',
              text: `“${file.name}” is uploaded. Customers can now open it from your page.`,
            }),
          onError: (err) =>
            setMessage({
              tone: 'danger',
              text:
                err instanceof Error && err.message === 'UNSUPPORTED_FILE'
                  ? 'Please choose a photo (JPG, PNG, WEBP) or a PDF.'
                  : err instanceof Error && err.message === 'FILE_TOO_LARGE'
                    ? 'That file is too large. Please choose one under 10 MB.'
                    : describeError(err, 'uploading your menu card').message,
            }),
        },
      );
    },
  };
}
