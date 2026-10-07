import { router, useLocalSearchParams } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { colors, spacing } from '@bhojan/shared';
import { Button, Icon, Notice, Screen, StepIndicator, Text, type IconName } from '@/components';
import { useCurrentLocation } from '@/features/useCurrentLocation';
import { announce } from '@/lib/a11y';
import { useAppSettings } from '@/lib/api';
import { saveDraft } from '@/lib/draft';
import { afterPlaceChosen } from '@/lib/navigation';

const STEPS: Array<{ icon: IconName; text: string }> = [
  { icon: 'location', text: 'Tap “Use my current location” below.' },
  { icon: 'check', text: 'When your phone asks, choose Allow.' },
  { icon: 'food', text: 'See the home kitchens that can deliver to you.' },
];

/**
 * Where should we look for kitchens? Step 1 of first-time setup, and also where
 * the kitchen list sends people who want to look somewhere else.
 */
export default function ChooseLocation() {
  const { then } = useLocalSearchParams<{ then?: string }>();
  const settings = useAppSettings();
  const location = useCurrentLocation();
  const radius = settings.data?.delivery_radius_km ?? 10;

  const useMyLocation = async () => {
    const found = await location.find();
    if (!found) return;
    await saveDraft({ place: { kind: 'coords', ...found, capturedAt: new Date().toISOString() } });
    announce('Found where you are.');
    afterPlaceChosen(then);
  };

  return (
    <Screen
      back={{ fallback: '/welcome' }}
      title="Find kitchens near you"
      subtitle={`Bhojan shows you the home kitchens within ${radius} km of where you are.`}
      footer={
        <>
          <Button
            label={location.failure ? 'Try again' : 'Use my current location'}
            icon="location"
            loading={location.finding}
            loadingLabel="Finding where you are…"
            onPress={useMyLocation}
          />
          <Button
            label="Choose my area instead"
            variant={location.failure ? 'secondary' : 'quiet'}
            disabled={location.finding}
            onPress={() => router.push({ pathname: '/onboarding/area', params: then ? { then } : {} })}
          />
        </>
      }
    >
      {then === 'discover' ? null : <StepIndicator step={1} total={2} />}
      {location.failure ? (
        <Notice tone="highlight" title={location.failure.title} message={location.failure.message} />
      ) : null}
      <View style={styles.steps}>
        {STEPS.map((step, index) => (
          <View key={step.text} style={styles.step}>
            <View style={styles.stepIcon}>
              <Icon name={step.icon} size={26} color={colors.primary} />
            </View>
            <Text variant="body" style={{ flex: 1 }} accessibilityLabel={`Step ${index + 1}. ${step.text}`}>
              {step.text}
            </Text>
          </View>
        ))}
      </View>
      <View style={styles.privacy}>
        <Icon name="shield" size={26} color={colors.success} />
        <Text variant="secondary" color="textSecondary" style={{ flex: 1 }}>
          Your location is only used to find kitchens near you. It is not shown to kitchens or to anyone else.
        </Text>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  steps: {
    gap: spacing.md,
  },
  step: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  stepIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  privacy: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
});
