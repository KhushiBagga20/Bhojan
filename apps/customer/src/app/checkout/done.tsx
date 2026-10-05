import { useLocalSearchParams } from 'expo-router';
import { useEffect, useRef } from 'react';
import { Animated, StyleSheet, View } from 'react-native';
import {
  colors,
  formatTimeWindow,
  MEAL_TYPE_LABEL,
  motion,
  pluralize,
  relativeDayWithDate,
  spacing,
  todayIST,
} from '@bhojan/shared';
import { Button, Card, ErrorState, Icon, LoadingState, Screen, Text } from '@/components';
import { RequireAuth } from '@/features/RequireAuth';
import { successFeedback } from '@/lib/a11y';
import { useSubscription } from '@/lib/api';
import { finishFlowAt } from '@/lib/navigation';
import { useTheme } from '@/theme';

export default function CheckoutDone() {
  return (
    <RequireAuth>
      <Done />
    </RequireAuth>
  );
}

function Done() {
  const { subscriptionId } = useLocalSearchParams<{ subscriptionId: string }>();
  const subscription = useSubscription(subscriptionId);
  const { reduceMotion } = useTheme();
  const scale = useRef(new Animated.Value(reduceMotion ? 1 : 0.6)).current;
  const opacity = useRef(new Animated.Value(reduceMotion ? 1 : 0)).current;

  useEffect(() => {
    successFeedback();
    if (reduceMotion) return;
    Animated.parallel([
      Animated.timing(scale, { toValue: 1, duration: motion.slow, useNativeDriver: true }),
      Animated.timing(opacity, { toValue: 1, duration: motion.base, useNativeDriver: true }),
    ]).start();
  }, [reduceMotion, scale, opacity]);

  if (subscription.isPending) {
    return (
      <Screen>
        <LoadingState />
      </Screen>
    );
  }
  if (subscription.error || !subscription.data) {
    return (
      <Screen>
        <ErrorState error={subscription.error} action="loading your plan" onRetry={() => subscription.refetch()} />
        <Button label="Go to my meals" onPress={() => finishFlowAt('/(tabs)/meals')} />
      </Screen>
    );
  }

  const sub = subscription.data;
  const oneTime = sub.plan_type === 'ONE_TIME';
  const meal = MEAL_TYPE_LABEL[sub.meal_type].toLowerCase();
  const window = formatTimeWindow(sub.window_start, sub.window_end);

  return (
    <Screen
      footer={
        <>
          <Button label="See my meals" icon="meals" onPress={() => finishFlowAt('/(tabs)/meals')} />
          <Button label="Go to home" variant="secondary" icon="home" onPress={() => finishFlowAt('/(tabs)')} />
        </>
      }
    >
      <View style={styles.hero}>
        <Animated.View
          style={[styles.check, { opacity, transform: [{ scale }] }]}
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
        >
          <Icon name="check" size={72} color={colors.success} />
        </Animated.View>
        <Text variant="display" align="center">
          {oneTime ? 'Your meal is booked' : "You're all set"}
        </Text>
        <Text variant="body" color="textSecondary" align="center">
          {oneTime ? 'Payment received.' : 'Payment received. Your meal plan has started.'}
        </Text>
      </View>

      <Card tone="accent">
        <Text variant="secondary" color="textSecondary">
          {oneTime ? `Your ${meal}` : `Your first ${meal}`}
        </Text>
        <Text variant="subheading">{relativeDayWithDate(sub.start_date, todayIST())}</Text>
        {window ? <Text variant="body">{`Between ${window}`}</Text> : null}
        <Text variant="body" color="textSecondary">{`From ${sub.provider?.business_name ?? 'your kitchen'}`}</Text>
      </Card>

      {!oneTime ? (
        <Card tone="muted">
          <Text variant="body">{`${pluralize(sub.meals_total, 'meal')} are booked for you.`}</Text>
          <Text variant="secondary" color="textSecondary">
            To skip a meal or pause your plan, go to the Plans tab at the bottom of the screen.
          </Text>
        </Card>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: {
    alignItems: 'center',
    gap: spacing.md,
    paddingTop: spacing.xl,
  },
  check: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: colors.successSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
