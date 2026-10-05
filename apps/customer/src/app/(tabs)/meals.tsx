import { router } from 'expo-router';
import { useState } from 'react';
import { addDays, OPEN_MEAL_STATUSES, pluralize, todayIST } from '@bhojan/shared';
import { Button, EmptyState, ErrorState, LoadingState, MealTimeline, Screen, Text } from '@/components';
import { useMyMeals } from '@/lib/api';

export default function Meals() {
  const today = todayIST();
  const meals = useMyMeals();
  const [showEarlier, setShowEarlier] = useState(false);

  const all = meals.data ?? [];
  const from = showEarlier ? addDays(today, -7) : addDays(today, -1);
  const visible = all.filter((m) => m.scheduled_date >= from);
  const hiddenEarlier = all.length - visible.length;
  const coming = all.filter((m) => m.scheduled_date >= today && OPEN_MEAL_STATUSES.includes(m.status)).length;

  return (
    <Screen
      title="My meals"
      subtitle={
        meals.data && coming > 0
          ? `${pluralize(coming, 'meal')} coming up. Tap a meal to see the menu or skip it.`
          : undefined
      }
      onRefresh={() => meals.refetch()}
      refreshing={meals.isRefetching}
    >
      {meals.isPending ? (
        <LoadingState message="Loading your meals…" />
      ) : meals.error ? (
        <ErrorState error={meals.error} action="loading your meals" onRetry={() => meals.refetch()} />
      ) : visible.length === 0 && hiddenEarlier === 0 ? (
        <EmptyState
          icon="meals"
          title="No meals scheduled yet"
          message="When you start a meal plan, every meal will appear here, day by day."
          actionLabel="Explore meal plans"
          onAction={() => router.push('/discover')}
        />
      ) : (
        <>
          {hiddenEarlier > 0 ? (
            <Button
              label={`Show earlier meals (${hiddenEarlier})`}
              variant="quiet"
              icon="collapse"
              onPress={() => setShowEarlier(true)}
            />
          ) : null}
          <MealTimeline
            meals={visible}
            today={today}
            onOpen={(id) => router.push({ pathname: '/meal/[id]', params: { id } })}
          />
          {coming === 0 ? (
            <Text variant="body" color="textSecondary">
              No more meals are booked after these.
            </Text>
          ) : null}
        </>
      )}
    </Screen>
  );
}
