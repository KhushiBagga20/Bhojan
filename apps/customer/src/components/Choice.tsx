import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { colors, radius, spacing, touch } from '@bhojan/shared';
import { Icon } from './Icon';
import { Text } from './Text';

export interface ChoiceRowProps {
  label: string;
  description?: string;
  selected: boolean;
  onPress: () => void;
  /** radio = pick one; checkbox = pick any. */
  kind?: 'radio' | 'checkbox';
  /** Extra content shown on the right (e.g. a price). */
  aside?: ReactNode;
  /** Content shown under the label when selected (e.g. plan details). */
  children?: ReactNode;
}

/** A whole-row radio button or checkbox: the entire row is the touch target. */
export function ChoiceRow({ label, description, selected, onPress, kind = 'radio', aside, children }: ChoiceRowProps) {
  const icon = kind === 'radio' ? (selected ? 'radioOn' : 'radioOff') : selected ? 'checkboxOn' : 'checkboxOff';
  return (
    <Pressable
      accessibilityRole={kind === 'radio' ? 'radio' : 'checkbox'}
      accessibilityState={kind === 'radio' ? { selected } : { checked: selected }}
      accessibilityLabel={description ? `${label}. ${description}` : label}
      onPress={onPress}
      style={({ pressed }) => [
        styles.row,
        selected && styles.selected,
        pressed && { backgroundColor: selected ? colors.primarySoft : colors.surfaceMuted },
      ]}
    >
      <View style={styles.top}>
        <Icon name={icon} size={30} color={selected ? colors.primary : colors.borderStrong} />
        <View style={{ flex: 1, gap: 2 }}>
          <Text variant="bodyStrong">{label}</Text>
          {description ? (
            <Text variant="secondary" color="textSecondary">
              {description}
            </Text>
          ) : null}
        </View>
        {aside}
      </View>
      {children ? <View style={styles.children}>{children}</View> : null}
    </Pressable>
  );
}

export function ChoiceGroup({ label, children }: { label?: string; children: ReactNode }) {
  return (
    <View accessibilityRole="radiogroup" accessibilityLabel={label} style={styles.group}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    minHeight: touch.comfortable,
    borderRadius: radius.md,
    borderWidth: 2,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    gap: spacing.sm,
  },
  selected: {
    borderColor: colors.primary,
    backgroundColor: '#FFFBF8',
  },
  top: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  children: {
    paddingLeft: 30 + spacing.sm,
    gap: spacing.xs,
  },
  group: {
    gap: spacing.sm,
  },
});
