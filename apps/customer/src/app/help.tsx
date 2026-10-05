import { Linking } from 'react-native';
import { telLink } from '@bhojan/shared';
import { Button, Card, Screen, Text } from '@/components';
import { useAppSettings } from '@/lib/api';

// Every answer is visible: nothing is hidden behind taps.
const QUESTIONS = [
  {
    q: 'How do I skip a meal?',
    a: 'Go to the Meals tab, tap the day, then tap "Skip this meal". Or go to the Plans tab and tap "Skip next meal".',
  },
  {
    q: 'What happens to a meal I skip?',
    a: 'Nothing is delivered that day, and one extra meal is added to the end of your plan. You never lose a meal you paid for.',
  },
  {
    q: 'How late can I change a meal?',
    a: 'Each kitchen needs a few hours to cook. The meal screen always tells you the exact time until which you can skip.',
  },
  {
    q: 'How do I pause or stop my plan?',
    a: 'Go to the Plans tab and tap "Manage plan". You can pause, resume or cancel from there. Paused plans keep your remaining meals.',
  },
  {
    q: 'Is paying safe?',
    a: 'Yes. Payments are handled by Razorpay, a trusted Indian payment company. Bhojan never sees or stores your card or UPI details.',
  },
  {
    q: 'My food is late. Who do I call?',
    a: 'Call your kitchen directly. Their number is on the Home screen under "Need help?".',
  },
];

export default function Help() {
  const settings = useAppSettings();
  const supportPhone = settings.data?.support_phone;
  return (
    <Screen back title="Help and questions">
      {QUESTIONS.map((item) => (
        <Card key={item.q}>
          <Text variant="subheading">{item.q}</Text>
          <Text variant="body">{item.a}</Text>
        </Card>
      ))}
      {supportPhone ? (
        <Card tone="muted">
          <Text variant="body">Still need help? Call the Bhojan team.</Text>
          <Button
            label="Call Bhojan support"
            variant="secondary"
            icon="phone"
            onPress={() => Linking.openURL(telLink(supportPhone))}
          />
        </Card>
      ) : null}
    </Screen>
  );
}
