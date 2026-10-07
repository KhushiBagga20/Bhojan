import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { colors, spacing } from '@bhojan/shared';
import { Button, Icon, Screen, Text, TiffinIllustration, type IconName } from '@/components';
import { useDraft } from '@/lib/draft';

const PROMISES: Array<{ icon: IconName; text: string }> = [
  { icon: 'heart', text: 'Cooked fresh in home kitchens near you' },
  { icon: 'calendar', text: 'Skip or pause any day. Skipped meals are added to the end of your plan' },
  { icon: 'phone', text: 'Call your cook directly whenever you need to' },
];

export default function Welcome() {
  const draft = useDraft();
  const hasPlace = !!draft.data?.place;

  return (
    <Screen
      footer={
        <>
          <Button
            label="Find meals near me"
            icon="search"
            onPress={() => router.push(hasPlace ? '/discover' : '/onboarding/location')}
          />
          <Button
            label="I already have an account"
            variant="secondary"
            onPress={() => router.push({ pathname: '/sign-in/phone', params: { mode: 'signin' } })}
          />
        </>
      }
    >
      <View style={styles.hero}>
        <TiffinIllustration size={188} />
        <View style={{ gap: spacing.sm }}>
          <Text variant="display" align="center">
            Welcome to Bhojan
          </Text>
          <Text variant="body" color="textSecondary" align="center" style={{ fontSize: 22, lineHeight: 32 }}>
            Home-style meals, delivered to your door.
          </Text>
        </View>
      </View>
      <View style={styles.promises}>
        {PROMISES.map((promise) => (
          <View key={promise.text} style={styles.promise}>
            <View style={styles.promiseIcon}>
              <Icon name={promise.icon} size={26} color={colors.primary} />
            </View>
            <Text variant="body" style={{ flex: 1 }}>
              {promise.text}
            </Text>
          </View>
        ))}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: {
    alignItems: 'center',
    gap: spacing.lg,
    paddingTop: spacing.xl,
  },
  promises: {
    gap: spacing.md,
  },
  promise: {
    flexDirection: 'row',
    gap: spacing.md,
    alignItems: 'center',
  },
  promiseIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
