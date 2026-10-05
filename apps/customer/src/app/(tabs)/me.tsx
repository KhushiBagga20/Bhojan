import Constants from 'expo-constants';
import { router } from 'expo-router';
import { useState } from 'react';
import { Linking, View } from 'react-native';
import { dietaryLabel, formatAddress, formatPhone, spacing, telLink, todayIST } from '@bhojan/shared';
import {
  Button,
  Card,
  ConfirmationDialog,
  Divider,
  KitchenAvatar,
  ListGroup,
  ListRow,
  Screen,
  SectionHeader,
  Text,
} from '@/components';
import { currentPlans } from '@/features/meals';
import { useAddresses, useMyMeals, useMySubscriptions, useProfile } from '@/lib/api';
import { AUTH_METHOD } from '@/lib/auth';
import { useSession } from '@/lib/session';

export default function Me() {
  const { signOut } = useSession();
  const profile = useProfile();
  const addresses = useAddresses();
  const subscriptions = useMySubscriptions();
  const meals = useMyMeals();
  const [confirmLogout, setConfirmLogout] = useState(false);

  const address = addresses.data?.[0];
  const kitchens = [
    ...new Map(
      currentPlans(subscriptions.data, meals.data, todayIST()).map((p) => [p.provider?.id, p.provider]),
    ).values(),
  ].filter((p): p is NonNullable<typeof p> => !!p);
  const preferences = profile.data?.dietary_preferences.map(dietaryLabel).join(', ');

  return (
    <Screen title="My profile">
      <Card>
        <View style={{ flexDirection: 'row', gap: spacing.md, alignItems: 'center' }}>
          <KitchenAvatar name={profile.data?.name || 'You'} size={64} />
          <View style={{ flex: 1, gap: 2 }}>
            <Text variant="subheading">{profile.data?.name ?? ' '}</Text>
            <Text variant="body" color="textSecondary">
              {[formatPhone(profile.data?.phone), profile.data?.email].filter(Boolean).join('\n')}
            </Text>
          </View>
        </View>
      </Card>

      <ListGroup>
        <ListRow
          icon="person"
          title="Name and food preferences"
          subtitle={preferences || 'No preferences chosen'}
          onPress={() => router.push('/profile/details')}
        />
        <Divider />
        <ListRow
          icon="location"
          title="Delivery address"
          subtitle={address ? formatAddress(address) : 'Add your address'}
          onPress={() => router.push('/profile/address')}
        />
        <Divider />
        <ListRow
          icon="receipt"
          title="Payments"
          subtitle="Your payment history"
          onPress={() => router.push('/profile/payments')}
        />
      </ListGroup>

      <SectionHeader title="Help" />
      {kitchens.length > 0 ? (
        <Card tone="muted">
          <Text variant="body">For anything about your food or delivery, call your kitchen directly.</Text>
          {kitchens.map((kitchen) => (
            <Button
              key={kitchen.id}
              label={`Call ${kitchen.business_name}`}
              variant="secondary"
              icon="phone"
              onPress={() => Linking.openURL(telLink(kitchen.phone))}
            />
          ))}
        </Card>
      ) : null}
      <ListGroup>
        <ListRow
          icon="help"
          title="Help and questions"
          subtitle="How skipping, pausing and payments work"
          onPress={() => router.push('/help')}
        />
      </ListGroup>

      <SectionHeader title="Settings" />
      <ListGroup>
        <ListRow
          icon="textSize"
          title="Accessibility"
          subtitle="Text size and motion"
          onPress={() => router.push('/profile/accessibility')}
        />
      </ListGroup>

      <Button label="Log out" variant="dangerOutline" icon="logout" onPress={() => setConfirmLogout(true)} />
      <Text variant="secondary" color="textSecondary" align="center">
        {`Bhojan version ${Constants.expoConfig?.version ?? '1.0.0'}`}
      </Text>

      <ConfirmationDialog
        visible={confirmLogout}
        icon="logout"
        title="Log out of Bhojan?"
        message={
          AUTH_METHOD === 'otp'
            ? "Your meal plans keep running. To log back in, you'll need a code sent to your phone."
            : "Your meal plans keep running. To log back in, you'll need your email and password."
        }
        confirmLabel="Yes, log out"
        cancelLabel="No, stay logged in"
        onConfirm={async () => {
          setConfirmLogout(false);
          await signOut();
          router.replace('/welcome');
        }}
        onCancel={() => setConfirmLogout(false)}
      />
    </Screen>
  );
}
