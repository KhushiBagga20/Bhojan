import { router, type Href } from 'expo-router';
import { forwardRef, type ReactNode } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  useWindowDimensions,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, layout, spacing, touch } from '@bhojan/shared';
import { shadow } from '@/theme';
import { Icon } from './Icon';
import { Text } from './Text';

export interface BackButtonProps {
  /** Where to go if there is no previous screen (e.g. opened from a link). */
  fallback?: Href;
  label?: string;
}

export function BackButton({ fallback = '/', label = 'Back' }: BackButtonProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label === 'Back' ? 'Go back' : label}
      hitSlop={8}
      onPress={() => (router.canGoBack() ? router.back() : router.replace(fallback))}
      style={({ pressed }) => [styles.back, pressed && { backgroundColor: colors.surfaceSunken }]}
    >
      <Icon name="back" size={30} color={colors.primary} />
      <Text variant="bodyStrong" color="primary">
        {label}
      </Text>
    </Pressable>
  );
}

export interface ScreenProps {
  children: ReactNode;
  /** Large page title (serif). */
  title?: string;
  /** Supporting line under the title. */
  subtitle?: string;
  /** Show a labelled Back button above the title. */
  back?: boolean | BackButtonProps;
  /** Pinned to the bottom of the screen: the one main action. */
  footer?: ReactNode;
  onRefresh?: () => void;
  refreshing?: boolean;
  /** Screens with text fields lift their content above the keyboard. */
  keyboard?: boolean;
}

export const Screen = forwardRef<ScrollView, ScreenProps>(function Screen(
  { children, title, subtitle, back, footer, onRefresh, refreshing = false, keyboard = false },
  ref,
) {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const gutter = width < 380 ? spacing.md : layout.screenGutter;

  const content = (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <ScrollView
        ref={ref}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={[
          styles.scroll,
          { paddingHorizontal: gutter, paddingBottom: footer ? spacing.lg : spacing.xxl },
        ]}
        refreshControl={
          onRefresh ? (
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={colors.primary}
              colors={[colors.primary]}
            />
          ) : undefined
        }
      >
        <View style={styles.column}>
          {back ? (
            <View style={styles.backRow}>
              <BackButton {...(typeof back === 'object' ? back : {})} />
            </View>
          ) : null}
          {title ? (
            <View style={[styles.header, !back && { paddingTop: spacing.lg }]}>
              <Text variant="title">{title}</Text>
              {subtitle ? (
                <Text variant="body" color="textSecondary">
                  {subtitle}
                </Text>
              ) : null}
            </View>
          ) : null}
          {children}
        </View>
      </ScrollView>
      {footer ? (
        <View
          style={[styles.footer, { paddingBottom: Math.max(insets.bottom, spacing.md), paddingHorizontal: gutter }]}
        >
          <View style={[styles.column, styles.footerInner]}>{footer}</View>
        </View>
      ) : null}
    </View>
  );

  if (!keyboard) return content;
  return (
    <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      {content}
    </KeyboardAvoidingView>
  );
});

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scroll: {
    flexGrow: 1,
  },
  column: {
    width: '100%',
    maxWidth: layout.maxContentWidth,
    alignSelf: 'center',
    gap: spacing.lg,
  },
  backRow: {
    marginTop: spacing.xs,
    marginLeft: -spacing.xs,
    alignItems: 'flex-start',
  },
  back: {
    minHeight: touch.min,
    flexDirection: 'row',
    alignItems: 'center',
    paddingRight: spacing.md,
    paddingLeft: spacing.xxs,
    borderRadius: 12,
  },
  header: {
    gap: spacing.xs,
  },
  footer: {
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: spacing.md,
    ...shadow('raised'),
  },
  footerInner: {
    gap: spacing.sm,
  },
});
