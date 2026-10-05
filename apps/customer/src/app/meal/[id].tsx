import { useLocalSearchParams } from 'expo-router';
import { useRef, useState } from 'react';
import { Linking, ScrollView, View } from 'react-native';
import {
  canChangeMeal,
  describeError,
  formatAddress,
  formatDateLong,
  formatDeadline,
  formatTimeWindow,
  MEAL_STATUS,
  MEAL_TYPE_LABEL,
  mealChangeDeadline,
  menuItemNames,
  relativeDayLabel,
  resolveMenu,
  spacing,
  telLink,
  todayIST,
} from '@bhojan/shared';
import {
  Button,
  Card,
  ConfirmationDialog,
  displayStatusLabel,
  ErrorState,
  InfoRow,
  LoadingState,
  MenuItemList,
  Notice,
  Screen,
  SectionHeader,
  StatusBadge,
  Text,
} from '@/components';
import { RequireAuth } from '@/features/RequireAuth';
import { announce, successFeedback } from '@/lib/a11y';
import { useCancelPlan, useMeal, useMenusFor, useSkipMeal, useUnskipMeal } from '@/lib/api';

export default function MealDetail() {
  return (
    <RequireAuth>
      <MealScreen />
    </RequireAuth>
  );
}

type Confirm = 'skip' | 'cancelOrder' | null;

function MealScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const meal = useMeal(id);
  const menus = useMenusFor(meal.data ? [meal.data.provider_id] : []);
  const skip = useSkipMeal();
  const unskip = useUnskipMeal();
  const cancelOrder = useCancelPlan();
  const [confirm, setConfirm] = useState<Confirm>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const scroll = useRef<ScrollView>(null);

  if (meal.isPending) {
    return (
      <Screen back={{ fallback: '/(tabs)/meals' }}>
        <LoadingState message="Loading your meal…" />
      </Screen>
    );
  }
  if (meal.error || !meal.data) {
    return (
      <Screen back={{ fallback: '/(tabs)/meals' }}>
        <ErrorState error={meal.error} action="loading this meal" onRetry={() => meal.refetch()} />
      </Screen>
    );
  }

  const m = meal.data;
  const today = todayIST();
  const mealName = MEAL_TYPE_LABEL[m.meal_type];
  const dateLong = formatDateLong(m.scheduled_date);
  const cutoff = m.provider?.skip_cutoff_hours ?? 3;
  const deadline = formatDeadline(mealChangeDeadline(m.scheduled_date, m.window_start, cutoff));
  const changeable = canChangeMeal(m, cutoff) && m.subscription?.status === 'ACTIVE';
  const oneTime = m.subscription?.plan_type === 'ONE_TIME';
  const items = menuItemNames(resolveMenu(menus.data ?? [], m.provider_id, m.scheduled_date, m.meal_type));
  const window = formatTimeWindow(m.window_start, m.window_end);
  const staleLabel = displayStatusLabel(m, today);
  const kitchen = m.provider?.business_name ?? 'your kitchen';

  const done = (message: string) => {
    setConfirm(null);
    setActionError(null);
    setNotice(message);
    announce(message);
    successFeedback();
    scroll.current?.scrollTo({ y: 0, animated: false });
  };
  const failed = (error: unknown, action: string) => setActionError(describeError(error, action).message);

  return (
    <Screen
      ref={scroll}
      back={{ fallback: '/(tabs)/meals' }}
      title={dateLong}
      subtitle={`${relativeDayLabel(m.scheduled_date, today) === dateLong ? '' : `${relativeDayLabel(m.scheduled_date, today)} · `}${mealName}`}
    >
      {notice ? <Notice tone="success" message={notice} /> : null}

      <Card>
        <StatusBadge kind="meal" status={m.status} label={staleLabel} size="large" />
        <Text variant="body">
          {staleLabel ? 'The kitchen has not confirmed this delivery yet.' : MEAL_STATUS[m.status].description}
        </Text>
      </Card>

      <SectionHeader title="On the menu" />
      <Card>
        {m.status === 'SKIPPED' || m.status === 'CANCELLED' ? (
          <Text variant="body" color="textSecondary">
            {m.status === 'SKIPPED'
              ? 'You skipped this meal, so nothing will be delivered.'
              : 'This meal will not be delivered.'}
          </Text>
        ) : menus.isPending ? (
          <LoadingState message="Loading the menu…" />
        ) : (
          <MenuItemList items={items} />
        )}
      </Card>

      <Card>
        {window ? <InfoRow icon="clock" label="Delivery time" value={window} /> : null}
        <InfoRow icon="food" label="Cooked by" value={kitchen} />
        {m.address ? <InfoRow icon="location" label="Delivered to" value={formatAddress(m.address)} /> : null}
      </Card>

      {actionError ? <Notice tone="danger" message={actionError} /> : null}

      {!oneTime && m.status === 'SCHEDULED' ? (
        changeable ? (
          <View style={{ gap: spacing.sm }}>
            <Button label="Skip this meal" variant="secondary" icon="skip" onPress={() => setConfirm('skip')} />
            <Text
              variant="secondary"
              color="textSecondary"
            >{`You can skip this meal until ${deadline}. We'll add an extra meal at the end of your plan.`}</Text>
          </View>
        ) : m.scheduled_date >= today && m.subscription?.status === 'ACTIVE' ? (
          <Notice
            tone="info"
            message={`It's too late to skip this meal: changes closed at ${deadline}. If you need help, please call ${kitchen}.`}
          />
        ) : null
      ) : null}

      {!oneTime && m.status === 'SKIPPED' && changeable ? (
        <View style={{ gap: spacing.sm }}>
          <Button
            label="I want this meal after all"
            icon="undo"
            loading={unskip.isPending}
            loadingLabel="Bringing your meal back…"
            onPress={() =>
              unskip.mutate(m.id, {
                onSuccess: () =>
                  done(
                    `Your ${mealName.toLowerCase()} on ${dateLong} is back on. The extra meal at the end of your plan has been removed.`,
                  ),
                onError: (e) => failed(e, 'bringing your meal back'),
              })
            }
          />
          <Text variant="secondary" color="textSecondary">{`You can change your mind until ${deadline}.`}</Text>
        </View>
      ) : null}

      {oneTime && m.status === 'SCHEDULED' && changeable ? (
        <View style={{ gap: spacing.sm }}>
          <Button
            label="Cancel this order"
            variant="dangerOutline"
            icon="cross"
            onPress={() => setConfirm('cancelOrder')}
          />
          <Text variant="secondary" color="textSecondary">{`You can cancel until ${deadline}.`}</Text>
        </View>
      ) : null}

      {m.provider ? (
        <Button
          label={`Call ${kitchen}`}
          variant="secondary"
          icon="phone"
          onPress={() => Linking.openURL(telLink(m.provider!.phone))}
        />
      ) : null}

      <ConfirmationDialog
        visible={confirm === 'skip'}
        icon="skip"
        title={`Skip ${mealName.toLowerCase()} on ${dateLong}?`}
        message={`Nothing will be delivered that day. We'll add one extra meal at the end of your plan, so you don't lose it. You can undo this until ${deadline}.`}
        confirmLabel="Yes, skip this meal"
        cancelLabel="No, keep this meal"
        loading={skip.isPending}
        loadingLabel="Skipping…"
        error={actionError}
        onConfirm={() =>
          skip.mutate(m.id, {
            onSuccess: () =>
              done(`${mealName} on ${dateLong} is skipped. We've added one extra meal at the end of your plan.`),
            onError: (e) => failed(e, 'skipping your meal'),
          })
        }
        onCancel={() => {
          setConfirm(null);
          setActionError(null);
        }}
      />
      <ConfirmationDialog
        visible={confirm === 'cancelOrder'}
        destructive
        icon="cross"
        title="Cancel this order?"
        message={`Your ${mealName.toLowerCase()} on ${dateLong} will not be delivered. To ask about a refund, please call ${kitchen}.`}
        confirmLabel="Yes, cancel my order"
        cancelLabel="No, keep my order"
        loading={cancelOrder.isPending}
        loadingLabel="Cancelling…"
        error={actionError}
        onConfirm={() =>
          cancelOrder.mutate(m.subscription_id, {
            onSuccess: () => done(`Your order for ${dateLong} is cancelled.`),
            onError: (e) => failed(e, 'cancelling your order'),
          })
        }
        onCancel={() => {
          setConfirm(null);
          setActionError(null);
        }}
      />
    </Screen>
  );
}
