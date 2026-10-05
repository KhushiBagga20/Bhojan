import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { LayoutAnimation, Linking, View } from 'react-native';
import {
  DIET_TYPE_LABEL,
  dietaryLabel,
  formatDateLong,
  formatRupees,
  formatTimeWindow,
  MEAL_TYPE_LABEL,
  MEAL_TYPES,
  nextMenuDate,
  PLAN_PRICE_SUFFIX,
  pricePerMeal,
  relativeDayLabel,
  resolveMenu,
  spacing,
  telLink,
  todayIST,
  weeklyMenu,
  WEEKDAY_NAMES,
  type MealType,
  type MenuWithItems,
} from '@bhojan/shared';
import {
  Button,
  Card,
  ChoiceGroup,
  DietMark,
  EmptyState,
  ErrorState,
  InfoRow,
  KitchenAvatar,
  LoadingState,
  MenuItemList,
  PlanChoice,
  Rating,
  Screen,
  SectionHeader,
  Text,
} from '@/components';
import { useProvider, type ProviderDetail } from '@/lib/api';
import { useTheme } from '@/theme';

export default function ProviderPage() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const provider = useProvider(id);

  if (provider.isPending) {
    return (
      <Screen back={{ fallback: '/discover' }}>
        <LoadingState message="Loading the menu…" />
      </Screen>
    );
  }
  if (provider.error || !provider.data) {
    return (
      <Screen back={{ fallback: '/discover' }}>
        <ErrorState error={provider.error} action="loading this kitchen" onRetry={() => provider.refetch()} />
      </Screen>
    );
  }
  return <ProviderDetails provider={provider.data} />;
}

function ProviderDetails({ provider }: { provider: ProviderDetail }) {
  const today = todayIST();
  const plans = useMemo(
    () =>
      provider.plans
        .filter((p) => p.is_active)
        .sort((a, b) => a.sort_order - b.sort_order || a.price_rupees - b.price_rupees),
    [provider.plans],
  );
  const [selectedId, setSelectedId] = useState<string | null>(
    () => plans.find((p) => p.plan_type === 'MONTHLY')?.id ?? plans[0]?.id ?? null,
  );
  const selected = plans.find((p) => p.id === selectedId) ?? null;
  const menus = provider.menus as MenuWithItems[];
  const mealTypes = MEAL_TYPES.filter((t) => menus.some((m) => m.meal_type === t && m.menu_items.length));
  const slotsByType = MEAL_TYPES.map((type) => ({
    type,
    windows: provider.delivery_slots
      .filter((s) => s.is_active && s.meal_type === type)
      .sort((a, b) => a.start_time.localeCompare(b.start_time))
      .map((s) => formatTimeWindow(s.start_time, s.end_time)),
  })).filter((g) => g.windows.length);
  const perMealFor = (type: MealType) => {
    const prices = plans.filter((p) => p.meal_type === type).map((p) => pricePerMeal(p.price_rupees, p.meals_count));
    return prices.length ? Math.min(...prices) : null;
  };

  return (
    <Screen
      back={{ fallback: '/discover' }}
      footer={
        selected ? (
          <>
            <Text variant="body" align="center">
              {'Selected: '}
              <Text variant="bodyStrong">{`${selected.name}, ${formatRupees(selected.price_rupees)} ${PLAN_PRICE_SUFFIX[selected.plan_type]}`}</Text>
            </Text>
            <Button
              label={selected.plan_type === 'ONE_TIME' ? 'Order this meal' : 'Subscribe to this plan'}
              icon="forward"
              accessibilityHint="Next you choose your address and start date. Nothing is charged yet."
              onPress={() => router.push({ pathname: '/checkout/[planId]', params: { planId: selected.id } })}
            />
          </>
        ) : null
      }
    >
      <View style={{ flexDirection: 'row', gap: spacing.md, alignItems: 'center' }}>
        <KitchenAvatar name={provider.business_name} imageUrl={provider.cover_image_url} size={88} />
        <View style={{ flex: 1, gap: spacing.xxs }}>
          <Text variant="title">{provider.business_name}</Text>
          <Rating rating={provider.rating} count={provider.rating_count} />
        </View>
      </View>
      {provider.tagline ? <Text variant="body">{provider.tagline}</Text> : null}
      <DietMark vegetarian={provider.diet_type === 'VEGETARIAN'} label={DIET_TYPE_LABEL[provider.diet_type]} />

      <Card>
        <InfoRow icon="location" label="Delivers to" value={provider.service_areas.join(', ') || provider.city} />
        {slotsByType.map((group) => (
          <InfoRow
            key={group.type}
            icon="clock"
            label={`${MEAL_TYPE_LABEL[group.type]} delivery time`}
            value={group.windows.join('\n')}
          />
        ))}
        {provider.dietary_options.length ? (
          <InfoRow icon="leaf" label="Can make" value={provider.dietary_options.map(dietaryLabel).join(', ')} />
        ) : null}
      </Card>

      {provider.description ? (
        <View style={{ gap: spacing.xs }}>
          <SectionHeader title="About this kitchen" />
          <Text variant="body">{provider.description}</Text>
        </View>
      ) : null}

      {mealTypes.map((type) => (
        <MenuSection
          key={type}
          menus={menus}
          providerId={provider.id}
          mealType={type}
          today={today}
          perMeal={perMealFor(type)}
        />
      ))}

      {provider.menu_files.map((file) => (
        <Button
          key={file.id}
          label={file.mime_type === 'application/pdf' ? 'Open the printed menu (PDF)' : 'See the printed menu card'}
          variant="secondary"
          icon="document"
          onPress={() => Linking.openURL(file.public_url)}
        />
      ))}

      <SectionHeader title="Choose your plan" />
      {plans.length === 0 ? (
        <EmptyState
          title="No plans available right now"
          message={`${provider.business_name} isn't taking new orders at the moment. You can call them to ask.`}
        />
      ) : (
        <ChoiceGroup label="Meal plans">
          {plans.map((plan) => (
            <PlanChoice
              key={plan.id}
              plan={plan}
              selected={plan.id === selectedId}
              onSelect={() => setSelectedId(plan.id)}
            />
          ))}
        </ChoiceGroup>
      )}

      <Card tone="muted">
        <Text variant="bodyStrong">Questions about the food?</Text>
        <Button
          label={`Call ${provider.business_name}`}
          variant="secondary"
          icon="phone"
          onPress={() => Linking.openURL(telLink(provider.phone))}
        />
      </Card>
    </Screen>
  );
}

/** "Today's lunch", "Tomorrow's lunch" or "Lunch on Monday, 5 October". */
function menuHeading(date: string | null, today: string, mealType: MealType): string {
  const meal = MEAL_TYPE_LABEL[mealType];
  if (!date) return `${meal} menu`;
  const relative = relativeDayLabel(date, today);
  if (relative === 'Today') return `Today's ${meal.toLowerCase()}`;
  if (relative === 'Tomorrow') return `Tomorrow's ${meal.toLowerCase()}`;
  return `${meal} on ${formatDateLong(date)}`;
}

function MenuSection({
  menus,
  providerId,
  mealType,
  today,
  perMeal,
}: {
  menus: MenuWithItems[];
  providerId: string;
  mealType: MealType;
  today: string;
  perMeal: number | null;
}) {
  const { reduceMotion } = useTheme();
  const [expanded, setExpanded] = useState(false);
  const date = nextMenuDate(menus, providerId, today, mealType);
  const menu = date ? resolveMenu(menus, providerId, date, mealType) : null;
  const week = weeklyMenu(menus, providerId, mealType);
  const heading = menuHeading(date, today, mealType);

  const toggle = () => {
    if (!reduceMotion) LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpanded((e) => !e);
  };

  return (
    <View style={{ gap: spacing.sm }}>
      <SectionHeader title={heading} />
      <Card>
        <MenuItemList items={menu?.menu_items.map((i) => i.name) ?? []} />
        {perMeal !== null ? (
          <Text variant="subheading" color="primary">
            {`${formatRupees(perMeal)} a meal`}
          </Text>
        ) : null}
      </Card>
      {week.length > 1 ? (
        <>
          <Button
            label={expanded ? "Hide this week's menu" : "See this week's menu"}
            variant="quiet"
            icon={expanded ? 'collapse' : 'expand'}
            onPress={toggle}
          />
          {expanded ? (
            <Card tone="muted">
              {week.map((day) => (
                <View key={day.day} style={{ gap: 2 }}>
                  <Text variant="bodyStrong">{WEEKDAY_NAMES[day.day - 1]}</Text>
                  <Text variant="body" color="textSecondary">
                    {day.items.join(', ')}
                  </Text>
                </View>
              ))}
            </Card>
          ) : null}
        </>
      ) : null}
    </View>
  );
}
