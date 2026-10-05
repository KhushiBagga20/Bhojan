import { Pressable, StyleSheet, View } from 'react-native';
import {
  colors,
  dayOfMonth,
  formatTimeWindow,
  MEAL_STATUS,
  MEAL_TYPE_LABEL,
  monthKey,
  monthName,
  radius,
  relativeDayLabel,
  spacing,
  touch,
  weekdayShort,
  type MealStatus,
  type MealType,
} from '@bhojan/shared';
import { Button } from './Button';
import { Card } from './Card';
import { Icon } from './Icon';
import { StatusBadge } from './StatusBadge';
import { Text } from './Text';

/** One dish per line: easier to scan than a comma-separated sentence. */
export function MenuItemList({
  items,
  emptyText = 'The menu for this day will be shared by the kitchen.',
}: {
  items: string[];
  emptyText?: string;
}) {
  if (items.length === 0) {
    return (
      <Text variant="body" color="textSecondary">
        {emptyText}
      </Text>
    );
  }
  return (
    <View style={styles.menu} accessible accessibilityLabel={`Menu: ${items.join(', ')}`}>
      {items.map((item, index) => (
        <View key={`${item}-${index}`} style={styles.menuItem}>
          <View style={styles.menuDot} />
          <Text variant="bodyStrong" style={{ flex: 1 }}>
            {item}
          </Text>
        </View>
      ))}
    </View>
  );
}

export interface MealCardProps {
  date: string;
  today: string;
  mealType: MealType;
  status: MealStatus;
  windowStart: string | null;
  windowEnd: string | null;
  providerName: string;
  items: string[];
  onView?: () => void;
}

/** The answer to "What am I eating, and when is it coming?" */
export function MealCard({
  date,
  today,
  mealType,
  status,
  windowStart,
  windowEnd,
  providerName,
  items,
  onView,
}: MealCardProps) {
  const window = formatTimeWindow(windowStart, windowEnd);
  const isToday = date === today;
  return (
    <Card tone={isToday ? 'accent' : 'default'}>
      <View style={styles.cardHeader}>
        <Text variant="label" color="primary">
          {`${MEAL_TYPE_LABEL[mealType]} · ${relativeDayLabel(date, today)}`}
        </Text>
      </View>
      <MenuItemList items={items} />
      {window ? (
        <View style={styles.inline}>
          <Icon name="clock" size={24} color={colors.textSecondary} />
          <Text variant="body">
            {status === 'DELIVERED' ? 'Delivery time ' : 'Expected '}
            <Text variant="bodyStrong">{window}</Text>
          </Text>
        </View>
      ) : null}
      <Text variant="secondary" color="textSecondary">
        {`From ${providerName}`}
      </Text>
      <StatusBadge kind="meal" status={status} size="large" />
      {onView ? <Button label="View meal" variant="secondary" icon="food" onPress={onView} /> : null}
    </Card>
  );
}

export interface TimelineMeal {
  id: string;
  scheduled_date: string;
  meal_type: MealType;
  status: MealStatus;
  window_start: string | null;
  window_end: string | null;
  provider: { business_name: string } | null;
}

/** "Delivery not confirmed" instead of a stale "Scheduled" for past days. */
export function displayStatusLabel(
  meal: Pick<TimelineMeal, 'status' | 'scheduled_date'>,
  today: string,
): string | undefined {
  const open = meal.status === 'SCHEDULED' || meal.status === 'PREPARING' || meal.status === 'OUT_FOR_DELIVERY';
  return open && meal.scheduled_date < today ? 'Not confirmed yet' : undefined;
}

/** Meals as a calendar-like list, grouped by month, with today clearly marked. */
export function MealTimeline({
  meals,
  today,
  onOpen,
}: {
  meals: TimelineMeal[];
  today: string;
  onOpen: (id: string) => void;
}) {
  const months = new Map<string, TimelineMeal[]>();
  for (const meal of meals) {
    const key = monthKey(meal.scheduled_date);
    months.set(key, [...(months.get(key) ?? []), meal]);
  }

  return (
    <View style={{ gap: spacing.lg }}>
      {[...months.entries()].map(([key, monthMeals]) => (
        <View key={key} style={{ gap: spacing.sm }}>
          <Text variant="heading">{`${monthName(monthMeals[0].scheduled_date)} ${key.slice(0, 4)}`}</Text>
          {monthMeals.map((meal) => {
            const isToday = meal.scheduled_date === today;
            const statusLabel = displayStatusLabel(meal, today);
            const window = formatTimeWindow(meal.window_start, meal.window_end);
            return (
              <Pressable
                key={meal.id}
                accessibilityRole="button"
                accessibilityLabel={`${relativeDayLabel(meal.scheduled_date, today)}. ${MEAL_TYPE_LABEL[meal.meal_type]} from ${
                  meal.provider?.business_name ?? 'your kitchen'
                }. ${statusLabel ?? MEAL_STATUS[meal.status].label}.`}
                accessibilityHint="Opens the meal details"
                onPress={() => onOpen(meal.id)}
                style={({ pressed }) => [
                  styles.row,
                  isToday && styles.todayRow,
                  (meal.status === 'SKIPPED' || meal.status === 'CANCELLED') && styles.mutedRow,
                  pressed && { backgroundColor: colors.surfaceMuted },
                ]}
              >
                <View style={[styles.dateBlock, isToday && styles.todayDateBlock]}>
                  <Text variant="label" style={{ color: isToday ? colors.onPrimary : colors.textSecondary }}>
                    {weekdayShort(meal.scheduled_date).toUpperCase()}
                  </Text>
                  <Text variant="heading" style={{ color: isToday ? colors.onPrimary : colors.text }}>
                    {String(dayOfMonth(meal.scheduled_date))}
                  </Text>
                </View>
                <View style={{ flex: 1, gap: spacing.xxs }}>
                  <Text variant="bodyStrong">
                    {isToday ? `Today · ${MEAL_TYPE_LABEL[meal.meal_type]}` : MEAL_TYPE_LABEL[meal.meal_type]}
                  </Text>
                  {window ? (
                    <Text variant="secondary" color="textSecondary">
                      {window}
                    </Text>
                  ) : null}
                  <StatusBadge kind="meal" status={meal.status} label={statusLabel} />
                </View>
                <Icon name="forward" size={28} color={colors.textMuted} />
              </Pressable>
            );
          })}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  menu: {
    gap: spacing.xs,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  menuDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.highlight,
  },
  inline: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    flexWrap: 'wrap',
  },
  row: {
    minHeight: touch.comfortable + 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  todayRow: {
    borderColor: colors.primary,
    borderWidth: 2,
  },
  mutedRow: {
    backgroundColor: colors.surfaceMuted,
  },
  dateBlock: {
    width: 64,
    paddingVertical: spacing.xs,
    borderRadius: radius.sm,
    backgroundColor: colors.surfaceSunken,
    alignItems: 'center',
  },
  todayDateBlock: {
    backgroundColor: colors.primary,
  },
});
