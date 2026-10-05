// Called by the app after Razorpay Checkout succeeds. Verifies the checkout
// signature, then marks the payment paid and activates the plan (which generates
// its meals). Safe to call twice; activation is idempotent.
//
// Secrets: RAZORPAY_KEY_SECRET
import { adminClient, corsHeaders, env, fail, hmacSha256Hex, json, safeEqual, userClient } from '../_shared/http.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return fail('METHOD_NOT_ALLOWED', 405);

  const body = await req.json().catch(() => ({}));
  const { paymentId, razorpay_order_id, razorpay_payment_id, razorpay_signature } = body as Record<string, unknown>;
  if ([paymentId, razorpay_order_id, razorpay_payment_id, razorpay_signature].some((v) => typeof v !== 'string')) {
    return fail('INVALID_REQUEST');
  }

  const { data: payment } = await userClient(req)
    .from('payments')
    .select('*')
    .eq('id', paymentId as string)
    .maybeSingle();
  if (!payment) return fail('PAYMENT_NOT_FOUND', 404);
  if (payment.gateway_order_id !== razorpay_order_id) return fail('ORDER_MISMATCH');

  // Razorpay: signature = HMAC_SHA256(order_id + "|" + payment_id, key_secret)
  const expected = await hmacSha256Hex(env('RAZORPAY_KEY_SECRET'), `${razorpay_order_id}|${razorpay_payment_id}`);
  if (!safeEqual(expected, razorpay_signature as string)) return fail('SIGNATURE_INVALID');

  const { data: subscription, error } = await adminClient().rpc('activate_paid_subscription', {
    p_payment_id: payment.id,
    p_gateway_payment_id: razorpay_payment_id,
  });
  if (error) {
    console.error('Activation failed', error);
    return fail(error.message ?? 'ACTIVATION_FAILED', 500);
  }
  return json({ status: subscription.status, subscriptionId: subscription.id });
});
