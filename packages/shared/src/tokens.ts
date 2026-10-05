// Bhojan design tokens: the single source of truth for colour, type, spacing,
// shape, touch targets and motion in both the customer app and the provider
// dashboard. Change a value here and both apps follow.
//
// Every text/background pairing below has been checked for WCAG contrast:
// body text pairs are ≥ 7:1, secondary text ≥ 4.5:1, borders on inputs ≥ 3:1.

/** Raw palette. Named after kitchen things so the roles stay distinct from the hues. */
export const palette = {
  rice: '#FBF7F2', // warm off-white page background
  white: '#FFFFFF',
  flour: '#F4EEE6', // muted surface
  sand: '#EFE9E2',
  husk: '#E6DDD2', // hairline borders
  stone: '#8F8479', // input borders (3.7:1 on white)
  ink: '#211D1A', // charcoal text (15.7:1 on rice)
  inkSoft: '#5B524A', // secondary text (7.2:1 on rice)
  inkMuted: '#766C62', // tertiary text, large sizes only (4.8:1)
  clay: '#A8431F', // primary accent: terracotta (6.0:1 with white text)
  clayDeep: '#8A3517', // pressed primary
  claySoft: '#F6E4DA',
  leaf: '#2D6A43', // success / delivered
  leafSoft: '#E4F0E7',
  turmeric: '#7A5200', // highlights, "today"
  turmericSoft: '#FCEFCB',
  amber: '#855400', // in progress
  amberSoft: '#FBEFD6',
  indigo: '#3D4E7A', // scheduled / informational
  indigoSoft: '#E7EBF5',
  chilli: '#A12B25', // destructive / cancelled
  chilliSoft: '#F9E3E0',
  focus: '#1F5FAD', // keyboard focus ring
} as const;

/** Semantic colours. Components use these, never the raw palette. */
export const colors = {
  background: palette.rice,
  surface: palette.white,
  surfaceMuted: palette.flour,
  surfaceSunken: palette.sand,
  border: palette.husk,
  borderStrong: palette.stone,
  text: palette.ink,
  textSecondary: palette.inkSoft,
  textMuted: palette.inkMuted,
  primary: palette.clay,
  primaryPressed: palette.clayDeep,
  primarySoft: palette.claySoft,
  onPrimary: palette.white,
  highlight: palette.turmeric,
  highlightSoft: palette.turmericSoft,
  success: palette.leaf,
  successSoft: palette.leafSoft,
  progress: palette.amber,
  progressSoft: palette.amberSoft,
  info: palette.indigo,
  infoSoft: palette.indigoSoft,
  danger: palette.chilli,
  dangerSoft: palette.chilliSoft,
  onDanger: palette.white,
  focus: palette.focus,
  vegMark: palette.leaf,
  nonVegMark: '#8B2E1F',
} as const;

export type ColorToken = keyof typeof colors;

/** Tone = the colour story of a status. Always paired with an icon and words. */
export type Tone = 'info' | 'progress' | 'success' | 'neutral' | 'danger' | 'highlight';

export const toneColors: Record<Tone, { fg: string; bg: string }> = {
  info: { fg: colors.info, bg: colors.infoSoft },
  progress: { fg: colors.progress, bg: colors.progressSoft },
  success: { fg: colors.success, bg: colors.successSoft },
  neutral: { fg: colors.textSecondary, bg: colors.surfaceSunken },
  danger: { fg: colors.danger, bg: colors.dangerSoft },
  highlight: { fg: colors.highlight, bg: colors.highlightSoft },
};

/** 4-point spacing scale. */
export const spacing = {
  xxs: 4,
  xs: 8,
  sm: 12,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
} as const;

export const radius = {
  sm: 12,
  md: 16,
  lg: 24,
  pill: 999,
} as const;

export type FontRole = 'display' | 'text';

export interface TypeStyle {
  size: number;
  lineHeight: number;
  weight: '400' | '600' | '700';
  font: FontRole;
  letterSpacing?: number;
}

/**
 * Type scale (base sizes before the user's text-size preference and OS font
 * scaling are applied). "display" is a warm serif for page titles; "text" is
 * Atkinson Hyperlegible, designed for low-vision readers.
 */
export const typography = {
  display: { size: 32, lineHeight: 40, weight: '600', font: 'display' },
  title: { size: 28, lineHeight: 36, weight: '600', font: 'display' },
  heading: { size: 22, lineHeight: 30, weight: '700', font: 'text' },
  subheading: { size: 20, lineHeight: 28, weight: '700', font: 'text' },
  body: { size: 19, lineHeight: 28, weight: '400', font: 'text' },
  bodyStrong: { size: 19, lineHeight: 28, weight: '700', font: 'text' },
  secondary: { size: 17, lineHeight: 25, weight: '400', font: 'text' },
  label: { size: 16, lineHeight: 22, weight: '700', font: 'text', letterSpacing: 0.2 },
  button: { size: 19, lineHeight: 24, weight: '700', font: 'text' },
  numeral: { size: 40, lineHeight: 46, weight: '600', font: 'display' },
} as const satisfies Record<string, TypeStyle>;

export type TypeVariant = keyof typeof typography;

/** Text-size preference offered in Me → Accessibility, on top of OS scaling. */
export const textSizes = {
  standard: 1,
  large: 1.15,
  extraLarge: 1.3,
} as const;
export type TextSizePreference = keyof typeof textSizes;

/** Touch targets. Well above the 44/48pt platform minimums. */
export const touch = {
  min: 56,
  comfortable: 64,
  tabBar: 72,
  iconButton: 56,
} as const;

/** Motion. Short and calm; disabled entirely when the user prefers reduced motion. */
export const motion = {
  fast: 120,
  base: 220,
  slow: 320,
  pressScale: 0.98,
} as const;

/** Platform-neutral shadow definitions (converted per app). */
export const shadows = {
  card: { color: '#3B2A1E', opacity: 0.06, radius: 12, offsetY: 4, elevation: 2 },
  raised: { color: '#3B2A1E', opacity: 0.1, radius: 20, offsetY: 8, elevation: 6 },
} as const;

export const layout = {
  /** Readable content width on tablets / wide browsers. */
  maxContentWidth: 640,
  screenGutter: spacing.lg,
} as const;
