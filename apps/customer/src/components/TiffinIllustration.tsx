import { View } from 'react-native';
import Svg, { Circle, Ellipse, Path, Rect } from 'react-native-svg';
import { colors, palette } from '@bhojan/shared';

/** A three-tier steel tiffin with a sprig of curry leaves. Decorative only. */
export function TiffinIllustration({ size = 200 }: { size?: number }) {
  const steel = '#D9D2C8';
  const steelDark = '#B9AFA3';
  return (
    <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" aria-hidden>
      <Svg width={size} height={size} viewBox="0 0 200 200">
        <Circle cx={100} cy={108} r={86} fill={palette.claySoft} />
        <Ellipse cx={100} cy={176} rx={58} ry={8} fill={palette.sand} />
        {/* Handle */}
        <Path d="M62 58 C62 22, 138 22, 138 58" stroke={steelDark} strokeWidth={8} fill="none" strokeLinecap="round" />
        <Rect x={56} y={52} width={12} height={112} rx={6} fill={steelDark} />
        <Rect x={132} y={52} width={12} height={112} rx={6} fill={steelDark} />
        {/* Lid */}
        <Rect x={64} y={56} width={72} height={14} rx={7} fill={steel} />
        <Rect x={92} y={48} width={16} height={10} rx={4} fill={steelDark} />
        {/* Three tiers */}
        <Rect x={66} y={72} width={68} height={30} rx={8} fill={steel} />
        <Rect x={66} y={104} width={68} height={30} rx={8} fill={steel} />
        <Rect x={66} y={136} width={68} height={32} rx={8} fill={steel} />
        {/* Clay bands */}
        <Rect x={66} y={84} width={68} height={6} fill={colors.primary} />
        <Rect x={66} y={116} width={68} height={6} fill={palette.turmeric} />
        <Rect x={66} y={148} width={68} height={6} fill={colors.primary} />
        {/* Steam */}
        <Path
          d="M86 40 C80 32, 92 26, 86 16"
          stroke={palette.stone}
          strokeWidth={3}
          fill="none"
          strokeLinecap="round"
        />
        <Path
          d="M114 40 C108 32, 120 26, 114 16"
          stroke={palette.stone}
          strokeWidth={3}
          fill="none"
          strokeLinecap="round"
        />
        {/* Curry leaves */}
        <Path
          d="M150 170 C156 150, 168 140, 180 138"
          stroke={palette.leaf}
          strokeWidth={3}
          fill="none"
          strokeLinecap="round"
        />
        <Path d="M160 152 C150 146, 148 136, 152 128 C160 134, 164 144, 160 152 Z" fill={palette.leaf} />
        <Path d="M170 143 C166 132, 170 122, 178 118 C182 128, 178 138, 170 143 Z" fill={palette.leaf} />
        <Path d="M156 162 C144 162, 138 154, 138 146 C148 148, 154 154, 156 162 Z" fill={palette.leaf} />
      </Svg>
    </View>
  );
}
