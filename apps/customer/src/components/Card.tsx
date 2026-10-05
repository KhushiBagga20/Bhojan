import type { ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { colors, radius, spacing, toneColors, type Tone } from '@bhojan/shared';
import { shadow } from '@/theme';
import { Icon, type IconName } from './Icon';
import { Text } from './Text';

export interface CardProps {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  /** Tinted background for highlighted content (e.g. today's meal). */
  tone?: 'default' | 'muted' | 'accent';
}

/** A content container. Cards are never buttons themselves: actions inside are explicit Buttons. */
export function Card({ children, style, tone = 'default' }: CardProps) {
  const toneStyle =
    tone === 'accent'
      ? { backgroundColor: colors.surface, borderColor: colors.primary, borderWidth: 2 }
      : tone === 'muted'
        ? { backgroundColor: colors.surfaceMuted, borderColor: colors.border }
        : null;
  return <View style={[styles.card, toneStyle, style]}>{children}</View>;
}

export function SectionHeader({ title, action }: { title: string; action?: ReactNode }) {
  return (
    <View style={styles.section}>
      <Text variant="heading" style={{ flex: 1 }}>
        {title}
      </Text>
      {action}
    </View>
  );
}

export function Divider() {
  return <View style={styles.divider} />;
}

export interface InfoRowProps {
  icon: IconName;
  label: string;
  value: string;
  /** Extra lines under the value. */
  detail?: string;
}

/** An icon + a label + a value, e.g. "Delivery time: 12:30 – 1:00 PM". */
export function InfoRow({ icon, label, value, detail }: InfoRowProps) {
  return (
    <View style={styles.infoRow} accessible accessibilityLabel={`${label}: ${value}${detail ? `. ${detail}` : ''}`}>
      <View style={styles.infoIcon}>
        <Icon name={icon} size={24} color={colors.primary} />
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <Text variant="secondary" color="textSecondary">
          {label}
        </Text>
        <Text variant="bodyStrong">{value}</Text>
        {detail ? (
          <Text variant="secondary" color="textSecondary">
            {detail}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

export interface NoticeProps {
  tone: Extract<Tone, 'success' | 'info' | 'highlight' | 'danger'>;
  title?: string;
  message: string;
  children?: ReactNode;
}

const NOTICE_ICON: Record<NoticeProps['tone'], IconName> = {
  success: 'check',
  info: 'info',
  highlight: 'alert',
  danger: 'alert',
};

/** Inline banner for confirmations ("Lunch on Wed is skipped") and warnings. */
export function Notice({ tone, title, message, children }: NoticeProps) {
  const c = toneColors[tone];
  return (
    <View
      accessibilityRole={tone === 'danger' ? 'alert' : 'summary'}
      style={[styles.notice, { backgroundColor: c.bg, borderColor: c.fg }]}
    >
      <View style={styles.noticeRow}>
        <Icon name={NOTICE_ICON[tone]} size={28} color={c.fg} />
        <View style={{ flex: 1, gap: spacing.xxs }}>
          {title ? (
            <Text variant="bodyStrong" style={{ color: c.fg }}>
              {title}
            </Text>
          ) : null}
          <Text variant="body">{message}</Text>
        </View>
      </View>
      {children ? <View style={{ gap: spacing.sm }}>{children}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    gap: spacing.md,
    ...shadow('card'),
  },
  section: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  divider: {
    height: 1,
    backgroundColor: colors.border,
  },
  infoRow: {
    flexDirection: 'row',
    gap: spacing.md,
    alignItems: 'flex-start',
  },
  infoIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  notice: {
    borderRadius: radius.md,
    borderWidth: 2,
    padding: spacing.md,
    gap: spacing.md,
  },
  noticeRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    alignItems: 'flex-start',
  },
});
