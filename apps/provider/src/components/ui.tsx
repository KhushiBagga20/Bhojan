'use client';

// The dashboard's design system: the same tokens, voice and accessibility rules
// as the customer app, laid out for a kitchen that's busy.
import {
  Bike,
  CalendarClock,
  CircleCheck,
  CirclePause,
  CircleX,
  Clock,
  CookingPot,
  Flag,
  Info,
  LoaderCircle,
  RefreshCw,
  SkipForward,
  TriangleAlert,
  WifiOff,
  type LucideIcon,
} from 'lucide-react';
import Link from 'next/link';
import { useEffect, useId, useRef, type ReactNode } from 'react';
import {
  describeError,
  MEAL_STATUS,
  SUBSCRIPTION_STATUS,
  WEEKDAY_SHORT,
  WEEKDAY_NAMES,
  type MealStatus,
  type StatusSymbol,
  type SubscriptionStatus,
  type Tone,
} from '@bhojan/shared';

const cx = (...parts: Array<string | false | null | undefined>) => parts.filter(Boolean).join(' ');

// ---------------------------------------------------------------------------
// Buttons
// ---------------------------------------------------------------------------
type Variant = 'primary' | 'secondary' | 'quiet' | 'danger' | 'dangerOutline';

const VARIANT_CLASS: Record<Variant, string> = {
  primary: 'bg-primary text-on-primary border-primary hover:bg-primary-pressed',
  secondary: 'bg-surface text-primary border-primary hover:bg-primary-soft',
  quiet: 'bg-transparent text-primary border-transparent hover:bg-surface-sunken',
  danger: 'bg-danger text-white border-danger hover:brightness-90',
  dangerOutline: 'bg-surface text-danger border-danger hover:bg-danger-soft',
};

interface ButtonBaseProps {
  children: ReactNode;
  variant?: Variant;
  icon?: LucideIcon;
  size?: 'md' | 'lg';
  className?: string;
}

function buttonClass({ variant = 'primary', size = 'md', className }: Omit<ButtonBaseProps, 'children'>) {
  return cx(
    'inline-flex items-center justify-center gap-2 rounded-md border-2 font-bold transition-colors',
    'disabled:cursor-not-allowed disabled:opacity-55',
    size === 'lg' ? 'min-h-14 px-6 text-body' : 'min-h-12 px-4 text-small',
    VARIANT_CLASS[variant],
    className,
  );
}

export interface ButtonProps extends ButtonBaseProps {
  onClick?: () => void;
  type?: 'button' | 'submit';
  loading?: boolean;
  loadingLabel?: string;
  disabled?: boolean;
  'aria-label'?: string;
}

export function Button({
  children,
  icon: Icon,
  loading,
  loadingLabel,
  disabled,
  onClick,
  type = 'button',
  ...rest
}: ButtonProps) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      aria-label={rest['aria-label']}
      className={buttonClass(rest)}
    >
      {loading ? (
        <LoaderCircle aria-hidden className="size-5 animate-spin" />
      ) : Icon ? (
        <Icon aria-hidden className="size-5 shrink-0" />
      ) : null}
      <span className="inline-flex items-center gap-2">{loading && loadingLabel ? loadingLabel : children}</span>
    </button>
  );
}

export function ButtonLink({ href, children, icon: Icon, ...rest }: ButtonBaseProps & { href: string }) {
  return (
    <Link href={href} className={buttonClass(rest)}>
      {Icon ? <Icon aria-hidden className="size-5 shrink-0" /> : null}
      <span>{children}</span>
    </Link>
  );
}

// ---------------------------------------------------------------------------
// Layout
// ---------------------------------------------------------------------------
export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: ReactNode; actions?: ReactNode }) {
  return (
    <header className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
      <div className="flex flex-col gap-1">
        <h1 className="font-display text-title text-ink">{title}</h1>
        {subtitle ? <p className="text-body text-ink-soft">{subtitle}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
    </header>
  );
}

export function Card({
  children,
  className,
  tone = 'default',
}: {
  children: ReactNode;
  className?: string;
  tone?: 'default' | 'muted' | 'accent';
}) {
  return (
    <section
      className={cx(
        'flex flex-col gap-4 rounded-lg border p-5 md:p-6',
        tone === 'muted' ? 'border-line bg-surface-muted' : 'border-line bg-surface shadow-card',
        tone === 'accent' && 'border-2 border-primary',
        className,
      )}
    >
      {children}
    </section>
  );
}

export function SectionTitle({ children, actions }: { children: ReactNode; actions?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2">
      <h2 className="text-heading font-bold">{children}</h2>
      {actions}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Status
// ---------------------------------------------------------------------------
const SYMBOL_ICON: Record<StatusSymbol, LucideIcon> = {
  calendar: CalendarClock,
  cooking: CookingPot,
  delivery: Bike,
  check: CircleCheck,
  skip: SkipForward,
  cross: CircleX,
  pause: CirclePause,
  clock: Clock,
  flag: Flag,
};

const TONE_CLASS: Record<Tone, string> = {
  info: 'bg-info-soft text-info',
  progress: 'bg-progress-soft text-progress',
  success: 'bg-success-soft text-success',
  neutral: 'bg-surface-sunken text-ink-soft',
  danger: 'bg-danger-soft text-danger',
  highlight: 'bg-highlight-soft text-highlight',
};

/** Icon + word + colour; the word carries the meaning on its own. */
export function StatusBadge(
  props: { kind: 'meal'; status: MealStatus } | { kind: 'plan'; status: SubscriptionStatus },
) {
  const meta = props.kind === 'meal' ? MEAL_STATUS[props.status] : SUBSCRIPTION_STATUS[props.status];
  const Icon = SYMBOL_ICON[meta.symbol];
  return (
    <span
      className={cx(
        'inline-flex items-center gap-1.5 rounded-sm px-2.5 py-1 text-small font-bold whitespace-nowrap',
        TONE_CLASS[meta.tone],
      )}
    >
      <Icon aria-hidden className="size-5" />
      {meta.label}
    </span>
  );
}

export function Notice({
  tone,
  title,
  children,
  actions,
}: {
  tone: 'success' | 'info' | 'highlight' | 'danger';
  title?: string;
  children: ReactNode;
  actions?: ReactNode;
}) {
  const Icon = tone === 'success' ? CircleCheck : tone === 'info' ? Info : TriangleAlert;
  return (
    <div
      role={tone === 'danger' ? 'alert' : 'status'}
      className={cx('flex flex-col gap-3 rounded-md border-2 p-4', TONE_CLASS[tone], 'border-current')}
    >
      <div className="flex items-start gap-3">
        <Icon aria-hidden className="mt-0.5 size-6 shrink-0" />
        <div className="flex flex-col gap-1 text-ink">
          {title ? <p className="font-bold">{title}</p> : null}
          <div>{children}</div>
        </div>
      </div>
      {actions ? <div className="flex flex-wrap gap-2 pl-9">{actions}</div> : null}
    </div>
  );
}

// ---------------------------------------------------------------------------
// States
// ---------------------------------------------------------------------------
export function Loading({ message = 'Loading…' }: { message?: string }) {
  return (
    <div role="status" className="flex flex-col items-center gap-3 py-12 text-ink-soft">
      <LoaderCircle aria-hidden className="size-8 animate-spin text-primary" />
      <p>{message}</p>
    </div>
  );
}

export function EmptyState({
  icon: Icon,
  title,
  message,
  action,
}: {
  icon: LucideIcon;
  title: string;
  message?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-lg border border-line bg-surface p-8 text-center">
      <span className="flex size-16 items-center justify-center rounded-full bg-primary-soft text-primary">
        <Icon aria-hidden className="size-8" />
      </span>
      <h2 className="text-heading font-bold">{title}</h2>
      {message ? <p className="max-w-prose text-ink-soft">{message}</p> : null}
      {action}
    </div>
  );
}

export function ErrorState({ error, action, onRetry }: { error: unknown; action?: string; onRetry?: () => void }) {
  const friendly = describeError(error, action);
  const Icon = friendly.offline ? WifiOff : TriangleAlert;
  return (
    <div
      role="alert"
      className="flex flex-col items-center gap-3 rounded-lg border border-line bg-surface p-8 text-center"
    >
      <span className="flex size-16 items-center justify-center rounded-full bg-danger-soft text-danger">
        <Icon aria-hidden className="size-8" />
      </span>
      <h2 className="text-heading font-bold">{friendly.offline ? "You're offline" : 'Something went wrong'}</h2>
      <p className="max-w-prose text-ink-soft">{friendly.message}</p>
      {onRetry ? (
        <Button variant="secondary" icon={RefreshCw} onClick={onRetry}>
          Try again
        </Button>
      ) : null}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Forms
// ---------------------------------------------------------------------------
const INPUT_CLASS =
  'min-h-12 w-full rounded-sm border-2 border-line-strong bg-surface px-3 py-2 text-body text-ink placeholder:text-ink-muted focus:border-primary focus:outline-none aria-[invalid=true]:border-danger';

interface FieldProps {
  label: string;
  hint?: string;
  error?: string | null;
  optional?: boolean;
  children: (props: {
    id: string;
    'aria-describedby'?: string;
    'aria-invalid'?: boolean;
    className: string;
  }) => ReactNode;
}

/** A labelled field with hint and error text wired up for screen readers. */
export function Field({ label, hint, error, optional, children }: FieldProps) {
  const id = useId();
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="font-bold">
        {label}
        {optional ? <span className="font-normal text-ink-soft"> (optional)</span> : null}
      </label>
      {hint ? (
        <p id={hintId} className="text-small text-ink-soft">
          {hint}
        </p>
      ) : null}
      {children({
        id,
        'aria-describedby': [hintId, errorId].filter(Boolean).join(' ') || undefined,
        'aria-invalid': error ? true : undefined,
        className: INPUT_CLASS,
      })}
      {error ? (
        <p id={errorId} className="flex items-center gap-1.5 text-small font-bold text-danger">
          <TriangleAlert aria-hidden className="size-4" />
          {error}
        </p>
      ) : null}
    </div>
  );
}

/** Seven toggle buttons for delivery days. */
export function DayPicker({
  value,
  onChange,
  label,
}: {
  value: number[];
  onChange: (days: number[]) => void;
  label: string;
}) {
  return (
    <fieldset className="flex flex-col gap-1.5">
      <legend className="mb-1.5 font-bold">{label}</legend>
      <div className="flex flex-wrap gap-2">
        {WEEKDAY_SHORT.map((short, i) => {
          const day = i + 1;
          const on = value.includes(day);
          return (
            <button
              key={short}
              type="button"
              aria-pressed={on}
              aria-label={WEEKDAY_NAMES[i]}
              onClick={() => onChange(on ? value.filter((d) => d !== day) : [...value, day].sort((a, b) => a - b))}
              className={cx(
                'min-h-12 min-w-14 rounded-sm border-2 px-3 font-bold',
                on
                  ? 'border-primary bg-primary text-on-primary'
                  : 'border-line-strong bg-surface text-ink hover:bg-surface-sunken',
              )}
            >
              {short}
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}

export function Checkbox({
  label,
  checked,
  onChange,
  description,
}: {
  label: string;
  checked: boolean;
  onChange: (on: boolean) => void;
  description?: string;
}) {
  return (
    <label className="flex min-h-12 cursor-pointer items-start gap-3 rounded-sm border-2 border-line bg-surface p-3 has-checked:border-primary">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-1 size-5 accent-[var(--bh-primary)]"
      />
      <span className="flex flex-col">
        <span className="font-bold">{label}</span>
        {description ? <span className="text-small text-ink-soft">{description}</span> : null}
      </span>
    </label>
  );
}

// ---------------------------------------------------------------------------
// Dialog
// ---------------------------------------------------------------------------
export interface ConfirmDialogProps {
  open: boolean;
  title: string;
  children: ReactNode;
  confirmLabel: string;
  cancelLabel: string;
  destructive?: boolean;
  loading?: boolean;
  error?: string | null;
  onConfirm: () => void;
  onCancel: () => void;
}

/** Native <dialog>: focus is trapped and Escape closes it. */
export function ConfirmDialog({
  open,
  title,
  children,
  confirmLabel,
  cancelLabel,
  destructive,
  loading,
  error,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      onCancel={(e) => {
        e.preventDefault();
        onCancel();
      }}
      aria-labelledby="confirm-title"
      className="m-auto w-[min(92vw,520px)] rounded-lg bg-surface p-0 text-ink shadow-raised"
    >
      <div className="flex flex-col gap-4 p-6">
        <h2 id="confirm-title" className="text-heading font-bold">
          {title}
        </h2>
        <div className="text-ink-soft">{children}</div>
        {error ? <Notice tone="danger">{error}</Notice> : null}
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button variant="secondary" onClick={onCancel} disabled={loading}>
            {cancelLabel}
          </Button>
          <Button variant={destructive ? 'danger' : 'primary'} onClick={onConfirm} loading={loading}>
            {confirmLabel}
          </Button>
        </div>
      </div>
    </dialog>
  );
}

export { cx };
