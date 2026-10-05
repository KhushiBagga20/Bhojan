// Payment gateway abstraction.
//
// The server decides which gateway a payment uses (app_settings.payment_mode):
//  * TEST      no money moves; confirm_test_payment() activates the plan. For
//              development and demos only; the server refuses it in production.
//  * RAZORPAY  the razorpay-create-order edge function creates an order, the
//              Razorpay checkout collects payment (card/UPI details never touch
//              our servers), and razorpay-verify-payment checks the signature
//              before activating the plan.
//
// Adding another gateway means: a value in the payment_gateway enum, an edge
// function pair like the Razorpay ones, and a branch in the pay screen.
import { unwrap } from '@bhojan/shared';
import { supabase } from '../supabase';

export type PaymentOutcome = { status: 'paid' } | { status: 'failed'; reason: string } | { status: 'dismissed' };

export async function payWithTestGateway(paymentId: string, succeed: boolean): Promise<PaymentOutcome> {
  const subscription = unwrap(
    await supabase.rpc('confirm_test_payment', { p_payment_id: paymentId, p_succeed: succeed }),
  );
  return subscription?.status === 'ACTIVE'
    ? { status: 'paid' }
    : { status: 'failed', reason: 'This was a test of a declined payment.' };
}

export interface RazorpayOrder {
  keyId: string;
  orderId: string;
  amountPaise: number;
  currency: string;
}

export interface RazorpaySuccess {
  razorpay_payment_id: string;
  razorpay_order_id: string;
  razorpay_signature: string;
}

export async function createRazorpayOrder(paymentId: string): Promise<RazorpayOrder> {
  const { data, error } = await supabase.functions.invoke<RazorpayOrder>('razorpay-create-order', {
    body: { paymentId },
  });
  if (error || !data) throw error ?? new Error('ORDER_FAILED');
  return data;
}

export async function verifyRazorpayPayment(paymentId: string, response: RazorpaySuccess): Promise<PaymentOutcome> {
  const { data, error } = await supabase.functions.invoke<{ status: string }>('razorpay-verify-payment', {
    body: { paymentId, ...response },
  });
  if (error || data?.status !== 'ACTIVE') {
    return { status: 'failed', reason: 'We could not confirm the payment with Razorpay.' };
  }
  return { status: 'paid' };
}

/** Records a gateway failure so the payment is never left in an unclear state. */
export async function recordPaymentFailure(paymentId: string, reason: string): Promise<void> {
  await supabase.rpc('record_payment_failure', { p_payment_id: paymentId, p_reason: reason });
}

/** Options passed to Razorpay Checkout (same shape on web and in the in-app browser). */
export function razorpayCheckoutOptions(
  order: RazorpayOrder,
  details: { description: string; name?: string | null; phone?: string | null },
) {
  return {
    key: order.keyId,
    order_id: order.orderId,
    amount: order.amountPaise,
    currency: order.currency,
    name: 'Bhojan',
    description: details.description,
    prefill: { name: details.name ?? undefined, contact: details.phone ?? undefined },
    theme: { color: '#A8431F' },
  };
}
