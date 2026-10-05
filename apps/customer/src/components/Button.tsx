import { ActivityIndicator, Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { colors, motion, radius, spacing, touch } from '@bhojan/shared';
import { pressFeedback } from '@/lib/a11y';
import { useTheme } from '@/theme';
import { Icon, type IconName } from './Icon';
import { Text } from './Text';

export type ButtonVariant = 'primary' | 'secondary' | 'quiet' | 'danger' | 'dangerOutline';

export interface ButtonProps {
  /** Always a clear, specific verb phrase: "Skip this meal", not "OK". */
  label: string;
  onPress: () => void;
  variant?: ButtonVariant;
  icon?: IconName;
  /** Shows a spinner and this text (e.g. "Saving…") while an action runs. */
  loading?: boolean;
  loadingLabel?: string;
  disabled?: boolean;
  accessibilityHint?: string;
  style?: StyleProp<ViewStyle>;
}

const VARIANTS: Record<ButtonVariant, { bg: string; pressed: string; fg: string; border: string }> = {
  primary: { bg: colors.primary, pressed: colors.primaryPressed, fg: colors.onPrimary, border: colors.primary },
  secondary: { bg: colors.surface, pressed: colors.primarySoft, fg: colors.primary, border: colors.primary },
  quiet: { bg: 'transparent', pressed: colors.surfaceSunken, fg: colors.primary, border: 'transparent' },
  danger: { bg: colors.danger, pressed: '#861F1A', fg: colors.onDanger, border: colors.danger },
  dangerOutline: { bg: colors.surface, pressed: colors.dangerSoft, fg: colors.danger, border: colors.danger },
};

export function Button({
  label,
  onPress,
  variant = 'primary',
  icon,
  loading = false,
  loadingLabel,
  disabled = false,
  accessibilityHint,
  style,
}: ButtonProps) {
  const { reduceMotion } = useTheme();
  const v = VARIANTS[variant];
  const inactive = disabled || loading;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={loading && loadingLabel ? loadingLabel : label}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: inactive, busy: loading }}
      disabled={inactive}
      onPress={() => {
        pressFeedback();
        onPress();
      }}
      style={({ pressed }) => [
        styles.base,
        {
          backgroundColor: pressed ? v.pressed : v.bg,
          borderColor: v.border,
          opacity: disabled ? 0.55 : 1,
          transform: [{ scale: pressed && !reduceMotion ? motion.pressScale : 1 }],
        },
        style,
      ]}
    >
      {loading ? <ActivityIndicator color={v.fg} /> : icon ? <Icon name={icon} size={24} color={v.fg} /> : null}
      <View style={styles.labelWrap}>
        <Text variant="button" style={{ color: v.fg }} align="center">
          {loading && loadingLabel ? loadingLabel : label}
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: touch.min,
    borderRadius: radius.md,
    borderWidth: 2,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    alignSelf: 'stretch',
  },
  labelWrap: {
    flexShrink: 1,
  },
});
