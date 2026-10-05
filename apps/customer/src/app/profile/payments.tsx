import { View } from 'react-native';
import { colors, formatDateLong, formatPaise, spacing, todayIST, toneColors, type PaymentStatus } from '@bhojan/shared';
import { Card, EmptyState, ErrorState, Icon, LoadingState, Screen, Text, type IconName } from '@/components';
import { RequireAuth } from '@/features/RequireAuth';
import { useMyPayments } from '@/lib/api';

const STATUS: Record<PaymentStatus, { label: string; icon: IconName; tone: keyof typeof toneColors }> = {
  PAID: { label: 'Paid', icon: 'check', tone: 'success' },
  FAILED: { label: "Didn't go through (no plan started)", icon: 'cross', tone: 'danger' },
  REFUNDED: { label: 'Refunded', icon: 'undo', tone: 'info' },
  CREATED: { label: 'Not finished', icon: 'clock', tone: 'highlight' },
};

export default function Payments() {
  return (
    <RequireAuth>
      <PaymentList />
    </RequireAuth>
  );
}

function PaymentList() {
  const payments = useMyPayments();
  return (
    <Screen
      back
      title="Payments"
      subtitle="You pay once when you start each plan. Bhojan never stores your card or UPI details."
    >
      {payments.isPending ? (
        <LoadingState message="Loading your payments…" />
      ) : payments.error ? (
        <ErrorState error={payments.error} action="loading your payments" onRetry={() => payments.refetch()} />
      ) : payments.data.length === 0 ? (
        <EmptyState
          icon="receipt"
          title="No payments yet"
          message="When you start a meal plan, the payment will show here."
        />
      ) : (
        payments.data.map((payment) => {
          const status = STATUS[payment.status];
          const c = toneColors[status.tone];
          return (
            <Card key={payment.id}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: spacing.sm }}>
                <Text variant="bodyStrong" style={{ flex: 1 }}>
                  {payment.subscription?.plan_name ?? 'Meal plan'}
                </Text>
                <Text variant="bodyStrong">{formatPaise(payment.amount_paise)}</Text>
              </View>
              <Text variant="secondary" color="textSecondary">
                {`${payment.subscription?.provider?.business_name ?? ''} · ${formatDateLong(todayIST(new Date(payment.created_at)))}`}
              </Text>
              <View style={{ flexDirection: 'row', gap: spacing.xs, alignItems: 'center' }}>
                <Icon name={status.icon} size={22} color={c.fg} />
                <Text variant="secondary" style={{ color: c.fg === colors.textSecondary ? colors.text : c.fg }}>
                  {status.label}
                </Text>
              </View>
            </Card>
          );
        })
      )}
    </Screen>
  );
}
