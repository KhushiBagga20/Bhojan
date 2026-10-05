// Razorpay Checkout in the browser: loads the official checkout.js and opens it.
import { useEffect } from 'react';
import type { RazorpayCheckoutProps } from './RazorpayCheckout';

declare global {
  interface Window {
    Razorpay?: new (options: Record<string, unknown>) => {
      open: () => void;
      on: (event: string, cb: (e: { error?: { description?: string } }) => void) => void;
    };
  }
}

function loadScript(): Promise<void> {
  if (window.Razorpay) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Network request failed'));
    document.body.appendChild(script);
  });
}

export function RazorpayCheckout({ options, onSuccess, onFailure, onDismiss }: RazorpayCheckoutProps) {
  useEffect(() => {
    if (!options) return;
    let cancelled = false;
    loadScript()
      .then(() => {
        if (cancelled || !window.Razorpay) return;
        const rzp = new window.Razorpay({
          ...options,
          handler: onSuccess,
          modal: { ondismiss: onDismiss },
        });
        rzp.on('payment.failed', (e) => onFailure(e.error?.description ?? 'Payment failed'));
        rzp.open();
      })
      .catch(() => onFailure('Could not load the payment page. Please check your internet connection.'));
    return () => {
      cancelled = true;
    };
  }, [options, onSuccess, onFailure, onDismiss]);

  return null;
}
