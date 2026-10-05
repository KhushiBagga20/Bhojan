import { Text as RNText, type TextProps as RNTextProps } from 'react-native';
import { colors, typography, type ColorToken, type TypeVariant } from '@bhojan/shared';
import { fontFamilyFor, useTheme } from '@/theme';

/**
 * Upper bound on the phone's own font scaling per style, on top of our already
 * large base sizes. Body text can double; titles grow less so they still fit.
 */
const MAX_FONT_MULTIPLIER: Record<TypeVariant, number> = {
  display: 1.5,
  title: 1.6,
  numeral: 1.4,
  heading: 1.8,
  subheading: 1.8,
  body: 2,
  bodyStrong: 2,
  secondary: 2,
  label: 2,
  button: 1.8,
};

const HEADER_VARIANTS: ReadonlySet<TypeVariant> = new Set(['display', 'title', 'heading', 'subheading']);

export interface TextProps extends RNTextProps {
  variant?: TypeVariant;
  color?: ColorToken;
  align?: 'left' | 'center' | 'right';
}

export function Text({ variant = 'body', color = 'text', align, style, accessibilityRole, ...rest }: TextProps) {
  const { textScale } = useTheme();
  const type = typography[variant];
  return (
    <RNText
      accessibilityRole={accessibilityRole ?? (HEADER_VARIANTS.has(variant) ? 'header' : undefined)}
      maxFontSizeMultiplier={MAX_FONT_MULTIPLIER[variant]}
      style={[
        {
          fontFamily: fontFamilyFor(type),
          fontSize: type.size * textScale,
          lineHeight: type.lineHeight * textScale,
          letterSpacing: 'letterSpacing' in type ? type.letterSpacing : undefined,
          color: colors[color],
          textAlign: align,
        },
        style,
      ]}
      {...rest}
    />
  );
}
