// Loading, empty and error states. Every screen uses these so no screen is ever
// blank, and every problem comes with a next step.
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { colors, describeError, radius, spacing } from '@bhojan/shared';
import { Button } from './Button';
import { Icon, type IconName } from './Icon';
import { Text } from './Text';

export function LoadingState({ message = 'Loading…' }: { message?: string }) {
  return (
    <View style={styles.centered} accessible accessibilityRole="progressbar" accessibilityLabel={message}>
      <ActivityIndicator size="large" color={colors.primary} />
      <Text variant="body" color="textSecondary" align="center">
        {message}
      </Text>
    </View>
  );
}

export interface EmptyStateProps {
  icon?: IconName;
  title: string;
  message?: string;
  actionLabel?: string;
  onAction?: () => void;
}

export function EmptyState({ icon = 'food', title, message, actionLabel, onAction }: EmptyStateProps) {
  return (
    <View style={styles.panel}>
      <View style={styles.iconCircle}>
        <Icon name={icon} size={36} color={colors.primary} />
      </View>
      <Text variant="heading" align="center">
        {title}
      </Text>
      {message ? (
        <Text variant="body" color="textSecondary" align="center">
          {message}
        </Text>
      ) : null}
      {actionLabel && onAction ? <Button label={actionLabel} onPress={onAction} /> : null}
    </View>
  );
}

export interface ErrorStateProps {
  error: unknown;
  /** What was happening, for the fallback sentence: "loading your meals". */
  action?: string;
  onRetry?: () => void;
}

export function ErrorState({ error, action, onRetry }: ErrorStateProps) {
  const friendly = describeError(error, action);
  return (
    <View style={styles.panel} accessibilityRole="alert">
      <View style={[styles.iconCircle, { backgroundColor: colors.dangerSoft }]}>
        <Icon name={friendly.offline ? 'offline' : 'alert'} size={36} color={colors.danger} />
      </View>
      <Text variant="heading" align="center">
        {friendly.offline ? "You're offline" : 'Something went wrong'}
      </Text>
      <Text variant="body" color="textSecondary" align="center">
        {friendly.message}
      </Text>
      {onRetry ? <Button label="Try again" icon="refresh" variant="secondary" onPress={onRetry} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  centered: {
    paddingVertical: spacing.xxl,
    alignItems: 'center',
    gap: spacing.md,
  },
  panel: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    alignItems: 'center',
    gap: spacing.md,
  },
  iconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
