import { router } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { spacing, todayIST } from '@bhojan/shared';
import {
  Button,
  Card,
  EmptyState,
  ErrorState,
  LoadingState,
  Screen,
  SectionHeader,
  StatusBadge,
  SubscriptionCard,
  Text,
} from '@/components';
import { currentPlans, nextMealFor, nextMealLabel, pastPlans } from '@/features/meals';
import { useMyMeals, useMySubscriptions } from '@/lib/api';

export default function Plans() {
  const today = todayIST();
  const subscriptions = useMySubscriptions();
  const meals = useMyMeals();
  const [showPast, setShowPast] = useState(false);
  const refresh = () => Promise.all([subscriptions.refetch(), meals.refetch()]);

  if (subscriptions.isPending || meals.isPending) {
    return (
      <Screen title="My meal plans">
        <LoadingState message="Loading your plans…" />
      </Screen>
    );
  }
  if (subscriptions.error || meals.error) {
    return (
      <Screen title="My meal plans">
        <ErrorState error={subscriptions.error ?? meals.error} action="loading your plans" onRetry={refresh} />
      </Screen>
    );
  }

  const current = currentPlans(subscriptions.data, meals.data, today);
  const past = pastPlans(subscriptions.data, current);

  return (
    <Screen title="My meal plans" onRefresh={refresh} refreshing={subscriptions.isRefetching}>
      {current.length === 0 ? (
        <EmptyState
          icon="plans"
          title="You don't have a meal plan yet"
          message="Find a home-style tiffin service near you."
          actionLabel="Find meals"
          onAction={() => router.push('/discover')}
        />
      ) : (
        current.map((plan) => (
          <SubscriptionCard
            key={plan.id}
            providerName={plan.provider?.business_name ?? ''}
            planName={plan.plan_name}
            planType={plan.plan_type}
            mealType={plan.meal_type}
            deliveryDays={plan.delivery_days}
            priceRupees={plan.price_rupees}
            status={plan.status}
            nextMealLabel={nextMealLabel(nextMealFor(meals.data, plan.id, today), today)}
            onManage={() => router.push({ pathname: '/plan/[id]', params: { id: plan.id } })}
          />
        ))
      )}

      {current.length > 0 ? (
        <Card tone="muted">
          <Text variant="bodyStrong">Want to try another kitchen, or add dinner?</Text>
          <Button
            label="Find a tiffin service"
            variant="secondary"
            icon="search"
            onPress={() => router.push('/discover')}
          />
        </Card>
      ) : null}

      {past.length > 0 ? (
        <View style={{ gap: spacing.sm }}>
          <SectionHeader title="Past plans" />
          {!showPast ? (
            <Button
              label={`Show past plans (${past.length})`}
              variant="quiet"
              icon="expand"
              onPress={() => setShowPast(true)}
            />
          ) : (
            past.map((plan) => (
              <Card key={plan.id}>
                <Text variant="bodyStrong">{`${plan.plan_name} · ${plan.provider?.business_name ?? ''}`}</Text>
                <StatusBadge kind="plan" status={plan.status} />
                <Button
                  label="Order again"
                  variant="secondary"
                  icon="refresh"
                  onPress={() => router.push({ pathname: '/provider/[id]', params: { id: plan.provider_id } })}
                />
              </Card>
            ))
          )}
        </View>
      ) : null}
    </Screen>
  );
}
