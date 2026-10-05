import { router } from 'expo-router';
import { Linking, View } from 'react-native';
import {
  formatDateLong,
  greeting,
  MEAL_TYPE_LABEL,
  menuItemNames,
  resolveMenu,
  spacing,
  telLink,
  todayIST,
} from '@bhojan/shared';
import {
  Button,
  Card,
  EmptyState,
  ErrorState,
  LoadingState,
  MealCard,
  Notice,
  Screen,
  SectionHeader,
  SubscriptionCard,
  Text,
} from '@/components';
import { currentPlans, nextMealFor, nextMealLabel, openMealsLeft } from '@/features/meals';
import { useMenusFor, useMyMeals, useMySubscriptions, useProfile, type MealWithDetails } from '@/lib/api';

export default function Home() {
  const today = todayIST();
  const profile = useProfile();
  const subscriptions = useMySubscriptions();
  const meals = useMyMeals();
  const menus = useMenusFor((meals.data ?? []).map((m) => m.provider_id));

  const refresh = () => Promise.all([subscriptions.refetch(), meals.refetch(), profile.refetch()]);
  const name = profile.data?.name;
  const header = (
    <View style={{ gap: spacing.xxs, paddingTop: spacing.lg }}>
      <Text variant="title">{name ? `${greeting()}, ${name}` : greeting()}</Text>
      <Text variant="body" color="textSecondary">
        {formatDateLong(today)}
      </Text>
    </View>
  );

  if (subscriptions.isPending || meals.isPending) {
    return (
      <Screen>
        {header}
        <LoadingState message="Checking today's meal…" />
      </Screen>
    );
  }
  if (subscriptions.error || meals.error) {
    return (
      <Screen>
        {header}
        <ErrorState error={subscriptions.error ?? meals.error} action="loading your meals" onRetry={refresh} />
      </Screen>
    );
  }

  const plans = currentPlans(subscriptions.data, meals.data, today);
  const todays = (meals.data ?? []).filter((m) => m.scheduled_date === today && m.status !== 'CANCELLED');
  const upcoming = (meals.data ?? []).find(
    (m) => m.scheduled_date > today && (m.status === 'SCHEDULED' || m.status === 'PREPARING'),
  );
  const itemsFor = (meal: MealWithDetails) =>
    menuItemNames(resolveMenu(menus.data ?? [], meal.provider_id, meal.scheduled_date, meal.meal_type));

  if (plans.length === 0 && todays.length === 0) {
    return (
      <Screen onRefresh={refresh} refreshing={subscriptions.isRefetching}>
        {header}
        <EmptyState
          icon="food"
          title="You don't have a meal plan yet"
          message="Find a home-style tiffin service near you. You can try a single meal first."
          actionLabel="Find meals"
          onAction={() => router.push('/discover')}
        />
      </Screen>
    );
  }

  const paused = plans.filter((p) => p.status === 'PAUSED');
  const endingSoon = plans.filter(
    (p) => p.status === 'ACTIVE' && p.plan_type !== 'ONE_TIME' && openMealsLeft(meals.data, p.id, today) <= 3,
  );
  const providers = [...new Map(plans.map((p) => [p.provider?.id, p.provider])).values()].filter(Boolean);

  return (
    <Screen onRefresh={refresh} refreshing={subscriptions.isRefetching || meals.isRefetching}>
      {header}

      <SectionHeader title={todays.length > 1 ? "Today's meals" : "Today's meal"} />
      {todays.length > 0 ? (
        todays.map((meal) => (
          <MealCard
            key={meal.id}
            date={meal.scheduled_date}
            today={today}
            mealType={meal.meal_type}
            status={meal.status}
            windowStart={meal.window_start}
            windowEnd={meal.window_end}
            providerName={meal.provider?.business_name ?? 'Your kitchen'}
            items={meal.status === 'SKIPPED' ? [] : itemsFor(meal)}
            onView={() => router.push({ pathname: '/meal/[id]', params: { id: meal.id } })}
          />
        ))
      ) : (
        <Card>
          <Text variant="subheading">No meal today</Text>
          {upcoming ? (
            <>
              <View style={{ gap: 2 }}>
                <Text variant="secondary" color="textSecondary">
                  {`Your next ${MEAL_TYPE_LABEL[upcoming.meal_type].toLowerCase()}`}
                </Text>
                <Text variant="bodyStrong">{nextMealLabel(upcoming, today)}</Text>
              </View>
              <Button
                label="View next meal"
                variant="secondary"
                icon="food"
                onPress={() => router.push({ pathname: '/meal/[id]', params: { id: upcoming.id } })}
              />
            </>
          ) : (
            <Text variant="body" color="textSecondary">
              There are no meals booked right now.
            </Text>
          )}
        </Card>
      )}

      <SectionHeader title="Anything to do?" />
      {paused.map((plan) => (
        <Notice
          key={plan.id}
          tone="highlight"
          title="Your plan is paused"
          message={`No meals from ${plan.provider?.business_name} will come until you resume.`}
        >
          <Button
            label="Resume my plan"
            icon="play"
            onPress={() => router.push({ pathname: '/plan/[id]', params: { id: plan.id } })}
          />
        </Notice>
      ))}
      {endingSoon.map((plan) => {
        const left = openMealsLeft(meals.data, plan.id, today);
        return (
          <Notice
            key={plan.id}
            tone="info"
            title="Your plan ends soon"
            message={`${left === 0 ? 'No meals are' : left === 1 ? 'Only 1 meal is' : `Only ${left} meals are`} left in your ${plan.plan_name.toLowerCase()} from ${plan.provider?.business_name}.`}
          >
            <Button
              label="Order again"
              variant="secondary"
              icon="refresh"
              onPress={() => router.push({ pathname: '/provider/[id]', params: { id: plan.provider_id } })}
            />
          </Notice>
        );
      })}
      {paused.length === 0 && endingSoon.length === 0 ? (
        <Notice tone="success" message="Nothing to do. Your meals are on schedule." />
      ) : null}

      <SectionHeader title={plans.length > 1 ? 'Your meal plans' : 'Your meal plan'} />
      {plans.map((plan) => (
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
      ))}

      <SectionHeader title="Need help?" />
      <Card tone="muted">
        <Text variant="body">Questions about a meal or a delivery? Your kitchen is happy to help.</Text>
        {providers.map((provider) => (
          <Button
            key={provider!.id}
            label={`Call ${provider!.business_name}`}
            variant="secondary"
            icon="phone"
            onPress={() => Linking.openURL(telLink(provider!.phone))}
          />
        ))}
      </Card>
    </Screen>
  );
}
