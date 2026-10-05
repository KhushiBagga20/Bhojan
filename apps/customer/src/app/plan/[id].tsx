import { router, useLocalSearchParams } from 'expo-router';
import { useRef, useState } from 'react';
import { Linking, ScrollView, View } from 'react-native';
import {
  addDays,
  canChangeMeal,
  describeError,
  formatAddress,
  formatDateLong,
  formatDateShort,
  formatDeadline,
  formatDeliveryDays,
  formatRupees,
  formatTimeWindow,
  MEAL_TYPE_LABEL,
  mealChangeDeadline,
  OPEN_MEAL_STATUSES,
  PLAN_PRICE_SUFFIX,
  pluralize,
  relativeDayWithDate,
  spacing,
  telLink,
  todayIST,
} from '@bhojan/shared';
import {
  Button,
  Card,
  ConfirmationDialog,
  ErrorState,
  InfoRow,
  LoadingState,
  MealTimeline,
  Notice,
  Screen,
  SectionHeader,
  StatusBadge,
  Text,
} from '@/components';
import { RequireAuth } from '@/features/RequireAuth';
import { announce, successFeedback } from '@/lib/a11y';
import {
  useCancelPlan,
  usePausePlan,
  useResumePlan,
  useSkipMeal,
  useSubscription,
  useSubscriptionMeals,
} from '@/lib/api';

export default function ManagePlan() {
  return (
    <RequireAuth>
      <PlanScreen />
    </RequireAuth>
  );
}

type Confirm = 'skip' | 'pause' | 'resume' | 'cancel' | null;

function PlanScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const subscription = useSubscription(id);
  const meals = useSubscriptionMeals(id);
  const skip = useSkipMeal();
  const pause = usePausePlan();
  const resume = useResumePlan();
  const cancel = useCancelPlan();
  const [confirm, setConfirm] = useState<Confirm>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const scroll = useRef<ScrollView>(null);

  if (subscription.isPending || meals.isPending) {
    return (
      <Screen back={{ fallback: '/(tabs)/plans' }}>
        <LoadingState message="Loading your plan…" />
      </Screen>
    );
  }
  if (subscription.error || meals.error || !subscription.data) {
    return (
      <Screen back={{ fallback: '/(tabs)/plans' }}>
        <ErrorState
          error={subscription.error ?? meals.error}
          action="loading your plan"
          onRetry={() => {
            subscription.refetch();
            meals.refetch();
          }}
        />
      </Screen>
    );
  }

  const sub = subscription.data;
  const all = meals.data ?? [];
  const today = todayIST();
  const cutoff = sub.provider?.skip_cutoff_hours ?? 3;
  const kitchen = sub.provider?.business_name ?? 'your kitchen';
  const oneTime = sub.plan_type === 'ONE_TIME';
  const mealName = MEAL_TYPE_LABEL[sub.meal_type].toLowerCase();

  const upcoming = all.filter((m) => m.scheduled_date >= today && OPEN_MEAL_STATUSES.includes(m.status));
  const delivered = all.filter((m) => m.status === 'DELIVERED').length;
  const nextMeal = upcoming[0] ?? null;
  const nextSkippable = upcoming.find((m) => m.status === 'SCHEDULED' && canChangeMeal(m, cutoff)) ?? null;
  // Meals already past the cutoff arrive even if the plan is paused or cancelled.
  const locked = upcoming.filter((m) => !canChangeMeal(m, cutoff));
  const changeableCount = upcoming.length - locked.length;
  const lockedDate = locked[0]?.scheduled_date;
  const lockedMeal =
    lockedDate === today
      ? `Today's ${mealName}`
      : lockedDate === addDays(today, 1)
        ? `Tomorrow's ${mealName}`
        : `The ${mealName} on ${lockedDate ? formatDateShort(lockedDate) : ''}`;
  const lockedNote = lockedDate ? ` ${lockedMeal} is already being prepared, so it will still arrive.` : '';
  const resumeFrom = addDays(today, 1);

  const done = (message: string) => {
    setConfirm(null);
    setActionError(null);
    setNotice(message);
    announce(message);
    successFeedback();
    scroll.current?.scrollTo({ y: 0, animated: false });
  };
  const onError = (action: string) => (error: unknown) => setActionError(describeError(error, action).message);
  const closeDialog = () => {
    setConfirm(null);
    setActionError(null);
  };

  return (
    <Screen
      ref={scroll}
      back={{ fallback: '/(tabs)/plans' }}
      title={oneTime ? 'My order' : 'My meal plan'}
      onRefresh={() => Promise.all([subscription.refetch(), meals.refetch()])}
      refreshing={subscription.isRefetching}
    >
      {notice ? <Notice tone="success" message={notice} /> : null}

      <Card tone="accent">
        <Text variant="subheading">{kitchen}</Text>
        <Text variant="bodyStrong">{sub.plan_name}</Text>
        <Text variant="body" color="textSecondary">
          {oneTime
            ? MEAL_TYPE_LABEL[sub.meal_type]
            : `${MEAL_TYPE_LABEL[sub.meal_type]} · ${formatDeliveryDays(sub.delivery_days)}`}
        </Text>
        <Text variant="bodyStrong">{`${formatRupees(sub.price_rupees)} ${PLAN_PRICE_SUFFIX[sub.plan_type]}`}</Text>
        <StatusBadge kind="plan" status={sub.status} size="large" />
      </Card>

      <Card>
        <InfoRow
          icon="calendar"
          label={oneTime ? 'Your meal' : 'Next meal'}
          value={nextMeal ? relativeDayWithDate(nextMeal.scheduled_date, today) : 'No meals coming up'}
        />
        {!oneTime ? (
          <InfoRow
            icon="meals"
            label="Meals"
            value={`${delivered} delivered, ${upcoming.length} to come`}
            detail={
              sub.status === 'PAUSED'
                ? `${pluralize(Math.max(sub.meals_total - delivered - upcoming.length, 0), 'meal')} kept for when you resume`
                : `${pluralize(sub.meals_total, 'meal')} in this plan`
            }
          />
        ) : null}
        {!oneTime && sub.end_date && sub.status === 'ACTIVE' ? (
          <InfoRow icon="flag" label="Last meal" value={formatDateLong(sub.end_date)} />
        ) : null}
        {sub.window_start ? (
          <InfoRow
            icon="clock"
            label="Delivery time"
            value={formatTimeWindow(sub.window_start, sub.window_end) ?? ''}
          />
        ) : null}
        {sub.address ? <InfoRow icon="location" label="Delivered to" value={formatAddress(sub.address)} /> : null}
      </Card>

      {actionError && !confirm ? <Notice tone="danger" message={actionError} /> : null}

      {/* Actions: always visible, never hidden in a menu. */}
      {sub.status === 'ACTIVE' && !oneTime ? (
        <View style={{ gap: spacing.sm }}>
          <SectionHeader title="Change your plan" />
          {nextSkippable ? (
            <Button
              label={`Skip next meal (${formatDateShort(nextSkippable.scheduled_date)})`}
              variant="secondary"
              icon="skip"
              onPress={() => setConfirm('skip')}
            />
          ) : null}
          <Button label="Pause plan" variant="secondary" icon="pause" onPress={() => setConfirm('pause')} />
          <Button label="Cancel plan" variant="dangerOutline" icon="cross" onPress={() => setConfirm('cancel')} />
          <Text variant="secondary" color="textSecondary">
            {`Changes to a meal can be made until ${cutoff} hours before its delivery time.`}
          </Text>
        </View>
      ) : null}

      {sub.status === 'ACTIVE' && oneTime && nextSkippable ? (
        <Button label="Cancel this order" variant="dangerOutline" icon="cross" onPress={() => setConfirm('cancel')} />
      ) : null}

      {sub.status === 'PAUSED' ? (
        <Notice
          tone="highlight"
          title="Your plan is paused"
          message="No meals will come until you resume. Your remaining meals are kept for you."
        >
          <Button label="Resume my plan" icon="play" onPress={() => setConfirm('resume')} />
          <Button label="Cancel plan" variant="dangerOutline" icon="cross" onPress={() => setConfirm('cancel')} />
        </Notice>
      ) : null}

      {sub.status === 'CANCELLED' || sub.status === 'EXPIRED' ? (
        <Notice
          tone="info"
          title={sub.status === 'CANCELLED' ? 'This plan is cancelled' : 'This plan is complete'}
          message={
            sub.status === 'CANCELLED'
              ? `To ask about a refund for meals you won't receive, please call ${kitchen}.`
              : `All meals in this plan have been delivered. We hope you enjoyed them.`
          }
        >
          <Button
            label="Order again"
            icon="refresh"
            onPress={() => router.push({ pathname: '/provider/[id]', params: { id: sub.provider_id } })}
          />
        </Notice>
      ) : null}

      {upcoming.length > 0 ? (
        <View style={{ gap: spacing.sm }}>
          <SectionHeader title="Coming up" />
          <MealTimeline
            meals={upcoming.slice(0, 5)}
            today={today}
            onOpen={(mealId) => router.push({ pathname: '/meal/[id]', params: { id: mealId } })}
          />
          {upcoming.length > 5 ? (
            <Button
              label="See all my meals"
              variant="quiet"
              icon="meals"
              onPress={() => router.navigate('/(tabs)/meals')}
            />
          ) : null}
        </View>
      ) : null}

      {sub.provider ? (
        <Card tone="muted">
          <Text variant="body">{`Questions about your plan? ${kitchen} is happy to help.`}</Text>
          <Button
            label={`Call ${kitchen}`}
            variant="secondary"
            icon="phone"
            onPress={() => Linking.openURL(telLink(sub.provider!.phone))}
          />
        </Card>
      ) : null}

      {nextSkippable ? (
        <ConfirmationDialog
          visible={confirm === 'skip'}
          icon="skip"
          title={`Skip ${mealName} on ${formatDateLong(nextSkippable.scheduled_date)}?`}
          message={`Nothing will be delivered that day. We'll add one extra meal at the end of your plan, so you don't lose it. You can undo this until ${formatDeadline(
            mealChangeDeadline(nextSkippable.scheduled_date, nextSkippable.window_start, cutoff),
          )}.`}
          confirmLabel="Yes, skip this meal"
          cancelLabel="No, keep this meal"
          loading={skip.isPending}
          loadingLabel="Skipping…"
          error={actionError}
          onConfirm={() =>
            skip.mutate(nextSkippable.id, {
              onSuccess: () =>
                done(
                  `Your ${mealName} on ${formatDateLong(nextSkippable.scheduled_date)} is skipped. We've added one extra meal at the end of your plan.`,
                ),
              onError: onError('skipping your meal'),
            })
          }
          onCancel={closeDialog}
        />
      ) : null}

      <ConfirmationDialog
        visible={confirm === 'pause'}
        icon="pause"
        title="Pause your meal plan?"
        message={`No meals will be delivered until you resume. Your ${pluralize(changeableCount, 'remaining meal')} will be kept for you.${lockedNote}`}
        confirmLabel="Yes, pause my plan"
        cancelLabel="No, keep my plan"
        loading={pause.isPending}
        loadingLabel="Pausing…"
        error={actionError}
        onConfirm={() =>
          pause.mutate(sub.id, {
            onSuccess: () =>
              done(
                `Your plan is paused. Your remaining meals are kept for you. Resume any time from this screen.${lockedNote}`,
              ),
            onError: onError('pausing your plan'),
          })
        }
        onCancel={closeDialog}
      />

      <ConfirmationDialog
        visible={confirm === 'resume'}
        icon="play"
        title="Resume your meal plan?"
        message={`Your meals will start again from ${relativeDayWithDate(resumeFrom, today)} (or the next delivery day after that).`}
        confirmLabel="Yes, resume my plan"
        cancelLabel="Not now"
        loading={resume.isPending}
        loadingLabel="Resuming…"
        error={actionError}
        onConfirm={() =>
          resume.mutate(sub.id, {
            onSuccess: () => done('Welcome back! Your plan is active again and your meals are booked.'),
            onError: onError('resuming your plan'),
          })
        }
        onCancel={closeDialog}
      />

      <ConfirmationDialog
        visible={confirm === 'cancel'}
        destructive
        icon="cross"
        title={oneTime ? 'Cancel this order?' : 'Cancel your meal plan?'}
        message={`${
          oneTime
            ? 'Your meal will not be delivered.'
            : `Your ${pluralize(changeableCount, 'remaining meal')} will be cancelled.`
        }${lockedNote} To ask about a refund, please call ${kitchen}. This can't be undone.`}
        confirmLabel={oneTime ? 'Yes, cancel my order' : 'Yes, cancel my plan'}
        cancelLabel={oneTime ? 'No, keep my order' : 'No, keep my plan'}
        loading={cancel.isPending}
        loadingLabel="Cancelling…"
        error={actionError}
        onConfirm={() =>
          cancel.mutate(sub.id, {
            onSuccess: () => done(`${oneTime ? 'Your order' : 'Your plan'} is cancelled.${lockedNote}`),
            onError: onError(oneTime ? 'cancelling your order' : 'cancelling your plan'),
          })
        }
        onCancel={closeDialog}
      />
    </Screen>
  );
}
