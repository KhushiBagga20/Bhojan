import { Platform, type ViewStyle } from 'react-native';
import { shadows } from '@bhojan/shared';

export { colors, spacing, radius, touch, motion, typography, toneColors, layout } from '@bhojan/shared';
export { ThemeProvider, useTheme } from './ThemeProvider';
export { fontAssets, fontFamilyFor } from './fonts';

/** Converts a shared shadow token into React Native style props for each platform. */
export function shadow(level: keyof typeof shadows): ViewStyle {
  const s = shadows[level];
  if (Platform.OS === 'web') {
    return { boxShadow: `0px ${s.offsetY}px ${s.radius}px rgba(59, 42, 30, ${s.opacity})` } as ViewStyle;
  }
  return {
    shadowColor: s.color,
    shadowOpacity: s.opacity,
    shadowRadius: s.radius / 2,
    shadowOffset: { width: 0, height: s.offsetY / 2 },
    elevation: s.elevation,
  };
}
