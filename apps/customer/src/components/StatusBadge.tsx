import { StyleSheet, View } from 'react-native';
import {
  colors,
  MEAL_STATUS,
  radius,
  spacing,
  SUBSCRIPTION_STATUS,
  toneColors,
  type MealStatus,
  type StatusMeta,
  type SubscriptionStatus,
} from '@bhojan/shared';
import { Icon } from './Icon';
import { Text } from './Text';

export type StatusBadgeProps =
  | { kind: 'meal'; status: MealStatus; label?: string; size?: 'regular' | 'large' }
  | { kind: 'plan'; status: SubscriptionStatus; label?: string; size?: 'regular' | 'large' };

/** Icon + word + colour. The word alone is enough; colour only reinforces it. */
export function StatusBadge(props: StatusBadgeProps) {
  const meta: StatusMeta = props.kind === 'meal' ? MEAL_STATUS[props.status] : SUBSCRIPTION_STATUS[props.status];
  const c = toneColors[meta.tone];
  const large = props.size === 'large';
  const label = props.label ?? meta.label;
  return (
    <View
      accessible
      accessibilityLabel={`Status: ${label}`}
      style={[styles.badge, { backgroundColor: c.bg }, large && styles.large]}
    >
      <Icon name={meta.symbol} size={large ? 26 : 22} color={c.fg} />
      <Text variant={large ? 'bodyStrong' : 'label'} style={{ color: c.fg }}>
        {label}
      </Text>
    </View>
  );
}

/** The green-square veg mark / brown-triangle non-veg mark Indian customers know, plus words. */
export function DietMark({ vegetarian, label }: { vegetarian: boolean; label: string }) {
  const color = vegetarian ? colors.vegMark : colors.nonVegMark;
  return (
    <View style={styles.diet} accessible accessibilityLabel={label}>
      <View style={[styles.dietBox, { borderColor: color }]}>
        {vegetarian ? (
          <View style={[styles.dietDot, { backgroundColor: color }]} />
        ) : (
          <View style={[styles.dietTriangle, { borderBottomColor: color }]} />
        )}
      </View>
      <Text variant="secondary" color="textSecondary">
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: spacing.xs,
    paddingVertical: spacing.xxs + 2,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.sm,
  },
  large: {
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
  },
  diet: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  dietBox: {
    width: 18,
    height: 18,
    borderWidth: 2,
    borderRadius: 3,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dietDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  dietTriangle: {
    width: 0,
    height: 0,
    borderLeftWidth: 5,
    borderRightWidth: 5,
    borderBottomWidth: 8,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
  },
});
