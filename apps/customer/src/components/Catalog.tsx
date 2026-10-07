import { Image, StyleSheet, View } from 'react-native';
import {
  colors,
  DIET_TYPE_LABEL,
  formatDeliveryDays,
  formatDistance,
  formatRupees,
  MEAL_TYPE_LABEL,
  PLAN_PRICE_SUFFIX,
  PLAN_TYPE_LABEL,
  pricePerMeal,
  pluralize,
  radius,
  spacing,
  type DietType,
  type PlanRow,
} from '@bhojan/shared';
import { Button } from './Button';
import { Card } from './Card';
import { ChoiceRow } from './Choice';
import { Icon } from './Icon';
import { DietMark } from './StatusBadge';
import { Text } from './Text';

/** A warm initial tile when a kitchen has no photo yet. */
export function KitchenAvatar({
  name,
  imageUrl,
  size = 64,
}: {
  name: string;
  imageUrl?: string | null;
  size?: number;
}) {
  if (imageUrl) {
    return (
      <Image
        source={{ uri: imageUrl }}
        style={{ width: size, height: size, borderRadius: radius.md }}
        accessibilityIgnoresInvertColors
        accessible={false}
      />
    );
  }
  return (
    <View style={[styles.avatar, { width: size, height: size }]} accessible={false}>
      <Text variant="title" style={{ color: colors.primary }}>
        {name.trim().charAt(0).toUpperCase()}
      </Text>
    </View>
  );
}

export function Rating({ rating, count }: { rating: number | null; count: number }) {
  if (rating === null) {
    return (
      <Text variant="secondary" color="textSecondary">
        New on Bhojan
      </Text>
    );
  }
  return (
    <View style={styles.rating} accessible accessibilityLabel={`Rated ${rating} out of 5 by ${count} customers`}>
      <Icon name="star" size={22} color={colors.highlight} />
      <Text variant="bodyStrong">{rating.toFixed(1)}</Text>
      <Text variant="secondary" color="textSecondary">
        {`(${pluralize(count, 'customer')})`}
      </Text>
    </View>
  );
}

export interface ProviderCardProps {
  name: string;
  tagline: string | null;
  dietType: DietType;
  rating: number | null;
  ratingCount: number;
  imageUrl: string | null;
  /** Lowest price of one meal across the kitchen's plans. */
  fromPrice: number | null;
  /** Roughly how far the kitchen is, when the search was by location. */
  distanceKm?: number | null;
  /** The customer's food preferences this kitchen can make. */
  suits: string[];
  onView: () => void;
}

export function ProviderCard({
  name,
  tagline,
  dietType,
  rating,
  ratingCount,
  imageUrl,
  fromPrice,
  distanceKm,
  suits,
  onView,
}: ProviderCardProps) {
  return (
    <Card>
      <View style={styles.providerTop}>
        <KitchenAvatar name={name} imageUrl={imageUrl} />
        <View style={{ flex: 1, gap: spacing.xxs }}>
          <Text variant="subheading">{name}</Text>
          {tagline ? (
            <Text variant="body" color="textSecondary">
              {tagline}
            </Text>
          ) : null}
        </View>
      </View>
      <View style={styles.meta}>
        <DietMark vegetarian={dietType === 'VEGETARIAN'} label={DIET_TYPE_LABEL[dietType]} />
        <Rating rating={rating} count={ratingCount} />
      </View>
      {fromPrice !== null ? (
        <Text variant="body">
          <Text variant="bodyStrong">{formatRupees(fromPrice)}</Text>
          {' a meal'}
        </Text>
      ) : null}
      {typeof distanceKm === 'number' ? (
        <View style={styles.distance}>
          <Icon name="location" size={22} color={colors.textSecondary} />
          <Text variant="body">{formatDistance(distanceKm)}</Text>
        </View>
      ) : null}
      {suits.length > 0 ? (
        <View style={styles.suits}>
          <Icon name="check" size={22} color={colors.success} />
          <Text variant="secondary" style={{ flex: 1 }}>
            {`Can make: ${suits.join(', ')}`}
          </Text>
        </View>
      ) : null}
      <Button label="View menu" variant="secondary" icon="food" onPress={onView} accessibilityHint={`Opens ${name}`} />
    </Card>
  );
}

export function planSummary(plan: Pick<PlanRow, 'meal_type' | 'delivery_days' | 'meals_count' | 'plan_type'>): string {
  const days = formatDeliveryDays(plan.delivery_days);
  if (plan.plan_type === 'ONE_TIME')
    return `${MEAL_TYPE_LABEL[plan.meal_type]} · delivered ${days === 'Every day' ? 'any day' : days}`;
  return `${MEAL_TYPE_LABEL[plan.meal_type]} · ${days} · ${pluralize(plan.meals_count, 'meal')}`;
}

/** A plan as a radio choice: type, name, schedule, price. */
export function PlanChoice({ plan, selected, onSelect }: { plan: PlanRow; selected: boolean; onSelect: () => void }) {
  const perMeal = pricePerMeal(plan.price_rupees, plan.meals_count);
  return (
    <ChoiceRow
      label={plan.name}
      description={`${PLAN_TYPE_LABEL[plan.plan_type]} · ${planSummary(plan)} · ${formatRupees(plan.price_rupees)} ${PLAN_PRICE_SUFFIX[plan.plan_type]}`}
      selected={selected}
      onPress={onSelect}
    >
      {selected ? (
        <>
          <Text variant="title" style={{ color: colors.primary }}>
            {formatRupees(plan.price_rupees)}
            <Text variant="body" color="textSecondary">{` ${PLAN_PRICE_SUFFIX[plan.plan_type]}`}</Text>
          </Text>
          {plan.plan_type !== 'ONE_TIME' ? (
            <Text variant="secondary" color="textSecondary">{`That's ${formatRupees(perMeal)} a meal.`}</Text>
          ) : null}
          {plan.description ? <Text variant="secondary">{plan.description}</Text> : null}
        </>
      ) : null}
    </ChoiceRow>
  );
}

const styles = StyleSheet.create({
  avatar: {
    borderRadius: radius.md,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rating: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xxs,
  },
  providerTop: {
    flexDirection: 'row',
    gap: spacing.md,
    alignItems: 'flex-start',
  },
  meta: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
    alignItems: 'center',
  },
  distance: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  suits: {
    flexDirection: 'row',
    gap: spacing.xs,
    alignItems: 'flex-start',
    backgroundColor: colors.successSoft,
    borderRadius: radius.sm,
    padding: spacing.sm,
  },
});
