import { Redirect, router, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { View } from 'react-native';
import { colors, describeError, formatDateLong, formatPaise, spacing } from '@bhojan/shared';
import { Button, Card, ErrorState, Icon, LoadingState, Notice, Screen, Text } from '@/components';
import { RequireAuth } from '@/features/RequireAuth';
import { announce } from '@/lib/a11y';
import { useInvalidateAfterPayment, usePayment, useProfile, type PaymentWithSubscription } from '@/lib/api';
import {
  createRazorpayOrder,
  payWithTestGateway,
  razorpayCheckoutOptions,
  recordPaymentFailure,
  verifyRazorpayPayment,
  type PaymentOutcome,
  type RazorpaySuccess,
} from '@/lib/payments';
import { RazorpayCheckout } from '@/lib/payments/RazorpayCheckout';

export default function Pay() {
  return (
    <RequireAuth>
      <PayScreen />
    </RequireAuth>
  );
}

function PayScreen() {
  const { paymentId } = useLocalSearchParams<{ paymentId: string }>();
  const payment = usePayment(paymentId);

  if (payment.isPending) {
    return (
      <Screen back>
        <LoadingState message="Getting payment ready…" />
      </Screen>
    );
  }
  if (payment.error || !payment.data) {
    return (
      <Screen back>
        <ErrorState error={payment.error} action="loading your payment" onRetry={() => payment.refetch()} />
      </Screen>
    );
  }
  if (payment.data.status === 'PAID' && payment.data.subscription) {
    return <Redirect href={{ pathname: '/checkout/done', params: { subscriptionId: payment.data.subscription.id } }} />;
  }
  return <Checkout payment={payment.data} />;
}

type Stage = { kind: 'ready' } | { kind: 'processing' } | { kind: 'failed'; message: string } | { kind: 'dismissed' };

function Checkout({ payment }: { payment: PaymentWithSubscription }) {
  const profile = useProfile();
  const invalidate = useInvalidateAfterPayment();
  const [stage, setStage] = useState<Stage>({ kind: 'ready' });
  const [razorpayOptions, setRazorpayOptions] = useState<Record<string, unknown> | null>(null);
  const subscription = payment.subscription;
  const providerName = subscription?.provider?.business_name ?? 'your kitchen';
  const amount = formatPaise(payment.amount_paise);
  const description = `${subscription?.plan_name ?? 'Meal plan'} from ${providerName}`;

  const handleOutcome = useCallback(
    async (outcome: PaymentOutcome) => {
      if (outcome.status === 'paid') {
        announce('Payment successful. Your meal plan has started.');
        await invalidate();
        router.replace({ pathname: '/checkout/done', params: { subscriptionId: payment.subscription_id } });
      } else if (outcome.status === 'failed') {
        announce("Your payment didn't go through.");
        setStage({ kind: 'failed', message: outcome.reason });
      } else {
        setStage({ kind: 'dismissed' });
      }
    },
    [invalidate, payment.subscription_id],
  );

  const run = async (task: () => Promise<PaymentOutcome>) => {
    setStage({ kind: 'processing' });
    try {
      await handleOutcome(await task());
    } catch (error) {
      setStage({ kind: 'failed', message: describeError(error, 'taking your payment').message });
    }
  };

  const payTest = (succeed: boolean) => run(() => payWithTestGateway(payment.id, succeed));

  // Opens Razorpay Checkout; its callbacks below report the outcome.
  const payRazorpay = async () => {
    setStage({ kind: 'processing' });
    try {
      const order = await createRazorpayOrder(payment.id);
      setRazorpayOptions(
        razorpayCheckoutOptions(order, { description, name: profile.data?.name, phone: profile.data?.phone }),
      );
    } catch (error) {
      setStage({ kind: 'failed', message: describeError(error, 'starting your payment').message });
    }
  };

  const onRazorpaySuccess = useCallback(
    (response: RazorpaySuccess) => {
      setRazorpayOptions(null);
      verifyRazorpayPayment(payment.id, response).then(handleOutcome, () =>
        setStage({ kind: 'failed', message: describeError(null, 'confirming your payment').message }),
      );
    },
    [payment.id, handleOutcome],
  );
  const onRazorpayFailure = useCallback(
    (reason: string) => {
      setRazorpayOptions(null);
      recordPaymentFailure(payment.id, reason).finally(() => handleOutcome({ status: 'failed', reason }));
    },
    [payment.id, handleOutcome],
  );
  const onRazorpayDismiss = useCallback(() => {
    setRazorpayOptions(null);
    handleOutcome({ status: 'dismissed' });
  }, [handleOutcome]);

  const isTest = payment.gateway === 'TEST';
  const processing = stage.kind === 'processing';
  const payLabel = stage.kind === 'failed' || stage.kind === 'dismissed' ? `Try again: pay ${amount}` : `Pay ${amount}`;

  return (
    <Screen
      back
      title="Payment"
      footer={
        <Button
          label={isTest ? payLabel : `${payLabel} securely`}
          icon="shield"
          loading={processing}
          loadingLabel="Confirming your payment…"
          onPress={() => (isTest ? payTest(true) : payRazorpay())}
        />
      }
    >
      <Card tone="accent">
        <Text variant="secondary" color="textSecondary">
          Amount to pay
        </Text>
        <Text variant="numeral">{amount}</Text>
        <Text variant="bodyStrong">{description}</Text>
        {subscription ? (
          <Text variant="body" color="textSecondary">
            {subscription.plan_type === 'ONE_TIME'
              ? `Delivered on ${formatDateLong(subscription.start_date)}`
              : `Starts ${formatDateLong(subscription.start_date)}`}
          </Text>
        ) : null}
      </Card>

      {processing ? (
        <Notice tone="info" message="Please wait while we confirm your payment. Don't close the app." />
      ) : null}

      {stage.kind === 'failed' ? (
        <Notice
          tone="danger"
          title="Your payment didn't go through"
          message={`Your meal plan has not been activated, and no meals are booked. ${stage.message}`}
        />
      ) : null}

      {stage.kind === 'dismissed' ? (
        <Notice
          tone="highlight"
          title="Payment not finished"
          message="Your meal plan has not started yet. When you're ready, tap the button below to pay."
        />
      ) : null}

      <View style={{ flexDirection: 'row', gap: spacing.sm, alignItems: 'flex-start' }}>
        <Icon name="shield" size={26} color={colors.success} />
        <Text variant="secondary" color="textSecondary" style={{ flex: 1 }}>
          {isTest
            ? 'Payments are handled by our payment partner. Bhojan never sees or stores your card or UPI details.'
            : 'Your card or UPI details go straight to Razorpay, our payment partner. Bhojan never sees or stores them.'}
        </Text>
      </View>

      {isTest ? (
        <Card tone="muted">
          <Text variant="bodyStrong">Test mode</Text>
          <Text variant="secondary" color="textSecondary">
            This app is in test mode, so no real money is taken. You can also check what happens when a payment fails.
          </Text>
          <Button
            label="Try a failed payment"
            variant="secondary"
            disabled={processing}
            onPress={() => payTest(false)}
          />
        </Card>
      ) : null}

      <Button label="Go back and change details" variant="quiet" icon="back" onPress={() => router.back()} />

      {!isTest ? (
        <RazorpayCheckout
          options={razorpayOptions}
          onSuccess={onRazorpaySuccess}
          onFailure={onRazorpayFailure}
          onDismiss={onRazorpayDismiss}
        />
      ) : null}
    </Screen>
  );
}
