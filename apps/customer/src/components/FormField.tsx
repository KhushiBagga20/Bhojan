import { forwardRef, useState } from 'react';
import { Platform, StyleSheet, TextInput, View, type TextInputProps } from 'react-native';
import { colors, radius, spacing, touch, typography } from '@bhojan/shared';
import { fontFamilyFor, useTheme } from '@/theme';
import { Icon } from './Icon';
import { Text } from './Text';

export interface FormFieldProps extends Omit<TextInputProps, 'style'> {
  /** Always visible above the field (never only a placeholder). */
  label: string;
  /** Example or guidance under the label, e.g. "6 digits, like 110017". */
  hint?: string;
  error?: string | null;
  optional?: boolean;
  /** Text shown inside the field before the input, e.g. "+91". */
  prefix?: string;
  large?: boolean;
}

export const FormField = forwardRef<TextInput, FormFieldProps>(function FormField(
  { label, hint, error, optional, prefix, large, ...inputProps },
  ref,
) {
  const { textScale } = useTheme();
  const [focused, setFocused] = useState(false);
  const type = large ? typography.title : typography.body;
  const borderColor = error ? colors.danger : focused ? colors.primary : colors.borderStrong;

  return (
    <View style={styles.wrap}>
      <Text variant="bodyStrong" nativeID={`${label}-label`}>
        {label}
        {optional ? (
          <Text variant="body" color="textSecondary">
            {' '}
            (optional)
          </Text>
        ) : null}
      </Text>
      {hint ? (
        <Text variant="secondary" color="textSecondary">
          {hint}
        </Text>
      ) : null}
      <View style={[styles.field, { borderColor, borderWidth: focused || error ? 3 : 2 }]}>
        {prefix ? (
          <Text variant={large ? 'title' : 'bodyStrong'} color="textSecondary" style={styles.prefix}>
            {prefix}
          </Text>
        ) : null}
        <TextInput
          ref={ref}
          accessibilityLabel={label}
          accessibilityHint={error ?? hint}
          placeholderTextColor={colors.textMuted}
          maxFontSizeMultiplier={2}
          {...inputProps}
          onFocus={(e) => {
            setFocused(true);
            inputProps.onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocused(false);
            inputProps.onBlur?.(e);
          }}
          style={[
            styles.input,
            {
              fontFamily: fontFamilyFor(type),
              fontSize: type.size * textScale,
              letterSpacing: large ? 4 : undefined,
            },
          ]}
        />
      </View>
      {error ? (
        <View style={styles.error} accessibilityRole="alert" accessibilityLiveRegion="polite">
          <Icon name="alert" size={22} color={colors.danger} />
          <Text variant="secondary" color="danger" style={{ flex: 1 }}>
            {error}
          </Text>
        </View>
      ) : null}
    </View>
  );
});

const styles = StyleSheet.create({
  wrap: {
    gap: spacing.xs,
  },
  field: {
    minHeight: touch.min + 4,
    borderRadius: radius.sm,
    backgroundColor: colors.surface,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
  },
  prefix: {
    marginRight: spacing.xs,
  },
  input: {
    flex: 1,
    color: colors.text,
    paddingVertical: spacing.sm,
    minHeight: touch.min,
    // The field's own thick border shows focus; hide the browser's second ring on web.
    ...(Platform.OS === 'web' ? ({ outlineStyle: 'none' } as object) : null),
  },
  error: {
    flexDirection: 'row',
    gap: spacing.xs,
    alignItems: 'flex-start',
  },
});
