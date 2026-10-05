// Creates a Razorpay order for one of the caller's pending payments.
// The amount always comes from the payments row (set by create_subscription from
// the plan price), never from the client.
//
// Secrets: RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET  (supabase secrets set ...)
import { adminClient, corsHeaders, env, fail, json, userClient } from '../_shared/http.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return fail('METHOD_NOT_ALLOWED', 405);

  const { paymentId } = await req.json().catch(() => ({}));
  if (typeof paymentId !== 'string') return fail('PAYMENT_NOT_FOUND');

  // RLS guarantees callers can only read their own payments.
  const { data: payment } = await userClient(req).from('payments').select('*').eq('id', paymentId).maybeSingle();
  if (!payment) return fail('PAYMENT_NOT_FOUND', 404);
  if (payment.gateway !== 'RAZORPAY') return fail('WRONG_GATEWAY');
  if (payment.status === 'PAID') return fail('PAYMENT_NOT_PENDING');

  const keyId = env('RAZORPAY_KEY_ID');
  const response = await fetch('https://api.razorpay.com/v1/orders', {
    method: 'POST',
    headers: {
      Authorization: `Basic ${btoa(`${keyId}:${env('RAZORPAY_KEY_SECRET')}`)}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      amount: payment.amount_paise,
      currency: payment.currency,
      receipt: payment.id.slice(0, 40),
      notes: { payment_id: payment.id, subscription_id: payment.subscription_id },
    }),
  });
  if (!response.ok) {
    console.error('Razorpay order failed', response.status, await response.text());
    return fail('ORDER_FAILED', 502);
  }
  const order = await response.json();

  // A retry after a failure reuses the same payments row with a fresh order.
  const { error } = await adminClient()
    .from('payments')
    .update({ gateway_order_id: order.id, status: 'CREATED', failure_reason: null })
    .eq('id', payment.id);
  if (error) return fail('ORDER_FAILED', 500);

  return json({ keyId, orderId: order.id, amountPaise: payment.amount_paise, currency: payment.currency });
});
