import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { View } from 'react-native';
import {
  describeError,
  formatDateShort,
  formatRupees,
  formatTimeWindow,
  MEAL_TYPE_LABEL,
  PLAN_PRICE_SUFFIX,
  previewMealDates,
  relativeDayWithDate,
  spacing,
  startDateOptions,
  todayIST,
} from '@bhojan/shared';
import {
  AddressCard,
  Button,
  Card,
  ChoiceGroup,
  ChoiceRow,
  EmptyState,
  ErrorState,
  InfoRow,
  LoadingState,
  Notice,
  planSummary,
  Screen,
  SectionHeader,
  Text,
} from '@/components';
import { RequireAuth } from '@/features/RequireAuth';
import { useAddresses, useAppSettings, useCreateSubscription, useDeliveryCheck, usePlan } from '@/lib/api';

export default function CheckoutSetup() {
  return (
    <RequireAuth>
      <Setup />
    </RequireAuth>
  );
}

function Setup() {
  const { planId } = useLocalSearchParams<{ planId: string }>();
  const plan = usePlan(planId);
  const addresses = useAddresses();

  if (plan.isPending || addresses.isPending) {
    return (
      <Screen back>
        <LoadingState message="Getting your plan ready…" />
      </Screen>
    );
  }
  if (plan.error || addresses.error || !plan.data) {
    return (
      <Screen back>
        <ErrorState
          error={plan.error ?? addresses.error}
          action="loading this plan"
          onRetry={() => {
            plan.refetch();
            addresses.refetch();
          }}
        />
      </Screen>
    );
  }
  return <SetupForm plan={plan.data} address={addresses.data?.[0] ?? null} />;
}

type PlanData = NonNullable<ReturnType<typeof usePlan>['data']>;
type AddressData = NonNullable<ReturnType<typeof useAddresses>['data']>[number];

function SetupForm({ plan, address }: { plan: PlanData; address: AddressData | null }) {
  const today = todayIST();
  const oneTime = plan.plan_type === 'ONE_TIME';
  const provider = plan.provider;
  const slots = useMemo(
    () =>
      (provider?.delivery_slots ?? [])
        .filter((s) => s.is_active && s.meal_type === plan.meal_type)
        .sort((a, b) => a.start_time.localeCompare(b.start_time)),
    [provider, plan.meal_type],
  );
  const dates = useMemo(() => startDateOptions(today, plan), [today, plan]);
  const [slotId, setSlotId] = useState(slots[0]?.id);
  const [startDate, setStartDate] = useState(dates[0]);
  const create = useCreateSubscription();

  const slot = slots.find((s) => s.id === slotId);
  const window = slot ? formatTimeWindow(slot.start_time, slot.end_time) : null;
  // The server decides whether this kitchen delivers to this address.
  const settings = useAppSettings();
  const delivery = useDeliveryCheck(provider?.id, address?.id);
  const served = delivery.data === 'OK';
  const radius = settings.data?.delivery_radius_km ?? 10;
  const mealDates = startDate ? previewMealDates(startDate, plan.delivery_days, plan.meals_count) : [];
  const returnHere = `/checkout/${plan.id}`;

  const continueToPayment = () => {
    if (!address || !startDate) return;
    create.mutate(
      { planId: plan.id, addressId: address.id, startDate, slotId },
      { onSuccess: (payment) => router.push({ pathname: '/checkout/pay', params: { paymentId: payment.id } }) },
    );
  };

  return (
    <Screen
      back
      title={oneTime ? 'Your order' : 'Your meal plan'}
      subtitle="Check the details below. Nothing is charged until you pay on the next screen."
      footer={
        address && served && startDate ? (
          <>
            <Text variant="bodyStrong" align="center">{`Total: ${formatRupees(plan.price_rupees)}`}</Text>
            <Button
              label="Continue to payment"
              icon="card"
              loading={create.isPending}
              loadingLabel="Getting payment ready…"
              onPress={continueToPayment}
            />
          </>
        ) : null
      }
    >
      <Card tone="accent">
        <Text variant="subheading">{provider?.business_name}</Text>
        <Text variant="bodyStrong">{plan.name}</Text>
        <Text variant="body" color="textSecondary">
          {planSummary(plan)}
        </Text>
        <Text variant="title" color="primary">
          {formatRupees(plan.price_rupees)}
          <Text variant="body" color="textSecondary">{` ${PLAN_PRICE_SUFFIX[plan.plan_type]}`}</Text>
        </Text>
      </Card>

      <SectionHeader title="Delivery address" />
      {address ? (
        <>
          <AddressCard
            address={address}
            onChange={() => router.push({ pathname: '/profile/address', params: { returnTo: returnHere } })}
          />
          {delivery.error ? (
            <Notice tone="danger" message={describeError(delivery.error, 'checking your address').message}>
              <Button label="Try again" variant="secondary" icon="refresh" onPress={() => delivery.refetch()} />
            </Notice>
          ) : delivery.data === 'AREA_NOT_SERVED' ? (
            <Notice
              tone="danger"
              title="This kitchen doesn't deliver here"
              message={`${provider?.business_name} is more than ${radius} km from this address. Please change your address, or choose a kitchen closer to you.`}
            >
              <Button label="See kitchens near me" variant="secondary" onPress={() => router.push('/discover')} />
            </Notice>
          ) : delivery.data === 'ADDRESS_NEEDS_LOCATION' ? (
            <Notice
              tone="highlight"
              title="We need to know where this address is"
              message="Tap “Change address”, then “Use my current location” while you are there. The kitchen can then check that it delivers to you."
            />
          ) : null}
        </>
      ) : (
        <EmptyState
          icon="location"
          title="Where should we deliver?"
          message="Add your address so the kitchen knows where to bring your meals."
          actionLabel="Add delivery address"
          onAction={() => router.push({ pathname: '/profile/address', params: { returnTo: returnHere } })}
        />
      )}

      <SectionHeader title="Delivery time" />
      {slots.length > 1 ? (
        <ChoiceGroup label="Delivery time">
          {slots.map((s) => (
            <ChoiceRow
              key={s.id}
              label={formatTimeWindow(s.start_time, s.end_time) ?? ''}
              selected={s.id === slotId}
              onPress={() => setSlotId(s.id)}
            />
          ))}
        </ChoiceGroup>
      ) : (
        <Card>
          <InfoRow
            icon="clock"
            label={`${MEAL_TYPE_LABEL[plan.meal_type]} arrives`}
            value={window ?? 'Around lunchtime'}
          />
        </Card>
      )}

      <SectionHeader title={oneTime ? 'Delivery date' : 'Start date'} />
      {dates.length === 0 ? (
        <Notice
          tone="highlight"
          message="This kitchen has no delivery dates available soon. Please call them to ask."
        />
      ) : (
        <ChoiceGroup label={oneTime ? 'Delivery date' : 'Start date'}>
          {dates.map((date) => (
            <ChoiceRow
              key={date}
              label={relativeDayWithDate(date, today)}
              selected={date === startDate}
              onPress={() => setStartDate(date)}
            />
          ))}
        </ChoiceGroup>
      )}

      {startDate && mealDates.length ? (
        <Card tone="muted">
          <Text variant="bodyStrong">What happens next</Text>
          {oneTime ? (
            <Text variant="body">{`Your ${MEAL_TYPE_LABEL[plan.meal_type].toLowerCase()} arrives on ${relativeDayWithDate(startDate, today)}${window ? `, between ${window}` : ''}.`}</Text>
          ) : (
            <>
              <Text variant="body">
                {`Your ${plan.meals_count} meals arrive from ${formatDateShort(mealDates[0])} to ${formatDateShort(mealDates[mealDates.length - 1])}${window ? `, between ${window}` : ''}.`}
              </Text>
              <View style={{ gap: spacing.xxs }}>
                <Text variant="secondary" color="textSecondary">
                  You can skip any meal or pause your plan from the Plans tab. Skipped meals are added to the end of
                  your plan, so you never lose a meal you paid for.
                </Text>
              </View>
            </>
          )}
        </Card>
      ) : null}

      {create.error ? (
        <Notice tone="danger" message={describeError(create.error, 'creating your meal plan').message} />
      ) : null}
    </Screen>
  );
}
