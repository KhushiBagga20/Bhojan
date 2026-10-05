import * as Haptics from 'expo-haptics';
import { AccessibilityInfo, Platform } from 'react-native';

/** Reads a confirmation aloud for VoiceOver / TalkBack users after an action. */
export function announce(message: string): void {
  AccessibilityInfo.announceForAccessibility(message);
}

/** A gentle tap on success. Skipped on web and never used for errors alone. */
export function successFeedback(): void {
  if (Platform.OS === 'web') return;
  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
}

export function pressFeedback(): void {
  if (Platform.OS === 'web') return;
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
}
