import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import {
  colors,
  formatAddress,
  formatDeliveryDays,
  formatRupees,
  MEAL_TYPE_LABEL,
  PLAN_PRICE_SUFFIX,
  radius,
  spacing,
  touch,
  type AddressRow,
  type MealType,
  type PlanType,
  type SubscriptionStatus,
} from '@bhojan/shared';
import { Button } from './Button';
import { Card } from './Card';
import { Icon, type IconName } from './Icon';
import { StatusBadge } from './StatusBadge';
import { Text } from './Text';

export interface SubscriptionCardProps {
  providerName: string;
  planName: string;
  planType: PlanType;
  mealType: MealType;
  deliveryDays: number[];
  priceRupees: number;
  status: SubscriptionStatus;
  /** e.g. "Tomorrow, Wednesday 30 September" */
  nextMealLabel?: string | null;
  onManage: () => void;
}

export function SubscriptionCard({
  providerName,
  planName,
  planType,
  mealType,
  deliveryDays,
  priceRupees,
  status,
  nextMealLabel,
  onManage,
}: SubscriptionCardProps) {
  const oneTime = planType === 'ONE_TIME';
  return (
    <Card>
      <View style={{ gap: spacing.xxs }}>
        <Text variant="subheading">{providerName}</Text>
        <Text variant="body">{planName}</Text>
        <Text variant="body" color="textSecondary">
          {oneTime ? MEAL_TYPE_LABEL[mealType] : `${MEAL_TYPE_LABEL[mealType]} · ${formatDeliveryDays(deliveryDays)}`}
        </Text>
        <Text variant="bodyStrong">{`${formatRupees(priceRupees)} ${PLAN_PRICE_SUFFIX[planType]}`}</Text>
      </View>
      <StatusBadge kind="plan" status={status} />
      {nextMealLabel ? (
        <View style={styles.next}>
          <Text variant="secondary" color="textSecondary">
            {oneTime ? 'Your meal' : 'Next meal'}
          </Text>
          <Text variant="bodyStrong">{nextMealLabel}</Text>
        </View>
      ) : null}
      <Button label={oneTime ? 'Manage order' : 'Manage plan'} variant="secondary" icon="plans" onPress={onManage} />
    </Card>
  );
}

export function AddressCard({
  address,
  onChange,
  changeLabel = 'Change address',
}: {
  address: Pick<AddressRow, 'label' | 'address_line' | 'locality' | 'city' | 'pincode' | 'instructions'>;
  onChange?: () => void;
  changeLabel?: string;
}) {
  return (
    <Card>
      <View style={styles.addressTop}>
        <Icon name="location" size={28} color={colors.primary} />
        <View style={{ flex: 1, gap: spacing.xxs }}>
          <Text variant="bodyStrong">{address.label}</Text>
          <Text variant="body">{formatAddress(address)}</Text>
          {address.instructions ? (
            <Text variant="secondary" color="textSecondary">{`Note for delivery: ${address.instructions}`}</Text>
          ) : null}
        </View>
      </View>
      {onChange ? <Button label={changeLabel} variant="secondary" icon="edit" onPress={onChange} /> : null}
    </Card>
  );
}

export interface ListRowProps {
  icon: IconName;
  title: string;
  subtitle?: string;
  onPress: () => void;
  tone?: 'default' | 'danger';
}

/** A full-width row that opens another screen. */
export function ListRow({ icon, title, subtitle, onPress, tone = 'default' }: ListRowProps) {
  const color = tone === 'danger' ? colors.danger : colors.primary;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={subtitle ? `${title}. ${subtitle}` : title}
      onPress={onPress}
      style={({ pressed }) => [styles.listRow, pressed && { backgroundColor: colors.surfaceMuted }]}
    >
      <Icon name={icon} size={28} color={color} />
      <View style={{ flex: 1, gap: 2 }}>
        <Text variant="bodyStrong" style={tone === 'danger' ? { color: colors.danger } : undefined}>
          {title}
        </Text>
        {subtitle ? (
          <Text variant="secondary" color="textSecondary">
            {subtitle}
          </Text>
        ) : null}
      </View>
      <Icon name="forward" size={28} color={colors.textMuted} />
    </Pressable>
  );
}

export function ListGroup({ children }: { children: ReactNode }) {
  return <View style={styles.group}>{children}</View>;
}

export function StepIndicator({ step, total }: { step: number; total: number }) {
  return (
    <View style={{ gap: spacing.xs }} accessible accessibilityLabel={`Step ${step} of ${total}`}>
      <Text variant="label" color="textSecondary">{`Step ${step} of ${total}`}</Text>
      <View style={styles.progressTrack}>
        <View style={[styles.progressFill, { width: `${(step / total) * 100}%` }]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  next: {
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.sm,
    padding: spacing.sm,
    gap: 2,
  },
  addressTop: {
    flexDirection: 'row',
    gap: spacing.sm,
    alignItems: 'flex-start',
  },
  listRow: {
    minHeight: touch.comfortable + 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.surface,
  },
  group: {
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
    backgroundColor: colors.surface,
  },
  progressTrack: {
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.surfaceSunken,
    overflow: 'hidden',
  },
  progressFill: {
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.primary,
  },
});
