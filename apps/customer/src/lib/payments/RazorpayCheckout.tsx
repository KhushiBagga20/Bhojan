// Razorpay Checkout on iOS/Android, shown inside an in-app browser sheet. This
// works in Expo Go; a production build can swap in the native Razorpay SDK
// behind the same props without touching the pay screen.
import { Modal, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';
import { colors } from '@/theme';
import { Button } from '@/components';
import type { RazorpaySuccess } from './index';

export interface RazorpayCheckoutProps {
  /** Options from razorpayCheckoutOptions(); null keeps the sheet closed. */
  options: Record<string, unknown> | null;
  onSuccess: (response: RazorpaySuccess) => void;
  onFailure: (reason: string) => void;
  onDismiss: () => void;
}

function checkoutPage(options: Record<string, unknown>): string {
  return `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1">
<script src="https://checkout.razorpay.com/v1/checkout.js"></script></head>
<body style="background:#FBF7F2"><script>
  const send = (msg) => window.ReactNativeWebView.postMessage(JSON.stringify(msg));
  const options = ${JSON.stringify(options)};
  options.handler = (response) => send({ type: 'success', response });
  options.modal = { ondismiss: () => send({ type: 'dismiss' }) };
  const rzp = new Razorpay(options);
  rzp.on('payment.failed', (e) => send({ type: 'failed', reason: (e.error && e.error.description) || 'Payment failed' }));
  rzp.open();
</script></body></html>`;
}

export function RazorpayCheckout({ options, onSuccess, onFailure, onDismiss }: RazorpayCheckoutProps) {
  return (
    <Modal visible={!!options} animationType="slide" onRequestClose={onDismiss}>
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
        {options ? (
          <WebView
            originWhitelist={['*']}
            source={{ html: checkoutPage(options), baseUrl: 'https://checkout.razorpay.com' }}
            onMessage={(event) => {
              const message = JSON.parse(event.nativeEvent.data) as
                | { type: 'success'; response: RazorpaySuccess }
                | { type: 'failed'; reason: string }
                | { type: 'dismiss' };
              if (message.type === 'success') onSuccess(message.response);
              else if (message.type === 'failed') onFailure(message.reason);
              else onDismiss();
            }}
          />
        ) : null}
        <View style={{ padding: 16 }}>
          <Button label="Close payment" variant="secondary" icon="close" onPress={onDismiss} />
        </View>
      </SafeAreaView>
    </Modal>
  );
}
