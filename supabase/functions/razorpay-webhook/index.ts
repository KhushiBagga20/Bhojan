// Razorpay → Supabase webhook. The reliable path: if the customer closes the app
// right after paying, Razorpay still tells us and the plan is activated.
// Configure in Razorpay Dashboard → Webhooks with events payment.captured and
// payment.failed. Deploy with --no-verify-jwt (Razorpay can't send a Supabase JWT;
// the webhook signature is checked instead).
//
// Secrets: RAZORPAY_WEBHOOK_SECRET
import { adminClient, env, fail, hmacSha256Hex, json, safeEqual } from '../_shared/http.ts';

Deno.serve(async (req) => {
  if (req.method !== 'POST') return fail('METHOD_NOT_ALLOWED', 405);

  const raw = await req.text();
  const signature = req.headers.get('X-Razorpay-Signature') ?? '';
  const expected = await hmacSha256Hex(env('RAZORPAY_WEBHOOK_SECRET'), raw);
  if (!safeEqual(expected, signature)) return fail('SIGNATURE_INVALID', 401);

  const event = JSON.parse(raw);
  const entity = event?.payload?.payment?.entity;
  const paymentId: string | undefined = entity?.notes?.payment_id;
  if (!entity || !paymentId) return json({ ignored: true });

  const admin = adminClient();
  const { data: payment } = await admin.from('payments').select('*').eq('id', paymentId).maybeSingle();
  if (!payment || payment.gateway_order_id !== entity.order_id) return json({ ignored: true });

  if (event.event === 'payment.captured') {
    const { error } = await admin.rpc('activate_paid_subscription', {
      p_payment_id: payment.id,
      p_gateway_payment_id: entity.id,
    });
    if (error) {
      console.error('Activation failed', error);
      return fail('ACTIVATION_FAILED', 500); // Razorpay retries on non-2xx.
    }
  } else if (event.event === 'payment.failed' && payment.status === 'CREATED') {
    await admin
      .from('payments')
      .update({ status: 'FAILED', failure_reason: String(entity.error_description ?? 'Payment failed').slice(0, 200) })
      .eq('id', payment.id);
  }
  return json({ ok: true });
});
