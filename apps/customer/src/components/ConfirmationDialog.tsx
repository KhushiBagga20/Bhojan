import { Modal, Pressable, StyleSheet, View } from 'react-native';
import { colors, radius, spacing } from '@bhojan/shared';
import { shadow, useTheme } from '@/theme';
import { Button } from './Button';
import { Icon, type IconName } from './Icon';
import { Text } from './Text';

export interface ConfirmationDialogProps {
  visible: boolean;
  title: string;
  message: string;
  /** Specific verb: "Yes, cancel my plan". */
  confirmLabel: string;
  /** The safe choice, worded as what it keeps: "No, keep my plan". */
  cancelLabel: string;
  destructive?: boolean;
  icon?: IconName;
  loading?: boolean;
  loadingLabel?: string;
  /** Shown inside the dialog if the action fails, so the person can try again. */
  error?: string | null;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmationDialog({
  visible,
  title,
  message,
  confirmLabel,
  cancelLabel,
  destructive = false,
  icon,
  loading = false,
  loadingLabel,
  error,
  onConfirm,
  onCancel,
}: ConfirmationDialogProps) {
  const { reduceMotion } = useTheme();
  return (
    <Modal
      visible={visible}
      transparent
      animationType={reduceMotion ? 'none' : 'fade'}
      onRequestClose={onCancel}
      statusBarTranslucent
    >
      <View style={styles.backdrop}>
        {/* Tapping outside does nothing on purpose: choices must be deliberate. */}
        <Pressable style={StyleSheet.absoluteFill} accessible={false} onPress={() => {}} />
        <View style={styles.dialog} accessibilityViewIsModal accessibilityRole="alert">
          {icon ? (
            <View style={[styles.icon, { backgroundColor: destructive ? colors.dangerSoft : colors.primarySoft }]}>
              <Icon name={icon} size={32} color={destructive ? colors.danger : colors.primary} />
            </View>
          ) : null}
          <Text variant="heading">{title}</Text>
          <Text variant="body" color="textSecondary">
            {message}
          </Text>
          {error ? (
            <View style={styles.error} accessibilityRole="alert">
              <Icon name="alert" size={22} color={colors.danger} />
              <Text variant="secondary" color="danger" style={{ flex: 1 }}>
                {error}
              </Text>
            </View>
          ) : null}
          <View style={styles.actions}>
            <Button
              label={confirmLabel}
              variant={destructive ? 'danger' : 'primary'}
              loading={loading}
              loadingLabel={loadingLabel}
              onPress={onConfirm}
            />
            <Button label={cancelLabel} variant="secondary" onPress={onCancel} disabled={loading} />
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(33, 29, 26, 0.55)',
    justifyContent: 'center',
    padding: spacing.lg,
  },
  dialog: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    gap: spacing.md,
    width: '100%',
    maxWidth: 520,
    alignSelf: 'center',
    ...shadow('raised'),
  },
  icon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actions: {
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  error: {
    flexDirection: 'row',
    gap: spacing.xs,
    backgroundColor: colors.dangerSoft,
    padding: spacing.sm,
    borderRadius: radius.sm,
  },
});
