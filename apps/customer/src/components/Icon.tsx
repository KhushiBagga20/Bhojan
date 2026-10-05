import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import type { ComponentProps } from 'react';
import type { StatusSymbol } from '@bhojan/shared';

type GlyphName = ComponentProps<typeof MaterialCommunityIcons>['name'];

/** Every icon in the app, by meaning. Status symbols come from the shared package. */
const ICONS = {
  home: 'home-outline',
  meals: 'calendar-month-outline',
  plans: 'clipboard-text-outline',
  me: 'account-circle-outline',
  back: 'chevron-left',
  forward: 'chevron-right',
  expand: 'chevron-down',
  collapse: 'chevron-up',
  phone: 'phone-outline',
  location: 'map-marker-outline',
  clock: 'clock-outline',
  calendar: 'calendar-clock-outline',
  check: 'check-circle',
  cooking: 'pot-steam-outline',
  delivery: 'moped-outline',
  skip: 'skip-next-circle-outline',
  cross: 'close-circle-outline',
  pause: 'pause-circle-outline',
  play: 'play-circle-outline',
  flag: 'flag-checkered',
  star: 'star',
  info: 'information-outline',
  alert: 'alert-circle-outline',
  offline: 'wifi-off',
  edit: 'pencil-outline',
  plus: 'plus',
  leaf: 'leaf',
  help: 'help-circle-outline',
  textSize: 'format-size',
  motion: 'motion-pause-outline',
  logout: 'logout',
  card: 'credit-card-outline',
  receipt: 'receipt-text-outline',
  food: 'silverware-fork-knife',
  search: 'magnify',
  refresh: 'refresh',
  close: 'close',
  checkboxOn: 'checkbox-marked',
  checkboxOff: 'checkbox-blank-outline',
  radioOn: 'radiobox-marked',
  radioOff: 'radiobox-blank',
  shield: 'shield-check-outline',
  document: 'file-document-outline',
  person: 'account-outline',
  heart: 'hand-heart-outline',
  undo: 'undo-variant',
  eye: 'eye-outline',
  eyeOff: 'eye-off-outline',
  email: 'email-outline',
} as const satisfies Record<string, GlyphName>;

export type IconName = keyof typeof ICONS | StatusSymbol;

export interface IconProps {
  name: IconName;
  size?: number;
  color: string;
}

/** Icons are decorative: the words next to them carry the meaning for screen readers. */
export function Icon({ name, size = 24, color }: IconProps) {
  return (
    <MaterialCommunityIcons
      name={ICONS[name as keyof typeof ICONS] ?? 'circle-outline'}
      size={size}
      color={color}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    />
  );
}
