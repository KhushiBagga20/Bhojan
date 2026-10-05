import { Fraunces_600SemiBold } from '@expo-google-fonts/fraunces/600SemiBold';
import { AtkinsonHyperlegibleNext_400Regular } from '@expo-google-fonts/atkinson-hyperlegible-next/400Regular';
import { AtkinsonHyperlegibleNext_700Bold } from '@expo-google-fonts/atkinson-hyperlegible-next/700Bold';
import type { TypeStyle } from '@bhojan/shared';

/** Loaded once in the root layout. */
export const fontAssets = {
  Fraunces_600SemiBold,
  AtkinsonHyperlegibleNext_400Regular,
  AtkinsonHyperlegibleNext_700Bold,
};

/** Each weight is its own font file, so we pick the family instead of setting fontWeight. */
export function fontFamilyFor(style: Pick<TypeStyle, 'font' | 'weight'>): string {
  if (style.font === 'display') return 'Fraunces_600SemiBold';
  return style.weight === '400' ? 'AtkinsonHyperlegibleNext_400Regular' : 'AtkinsonHyperlegibleNext_700Bold';
}
