import React from 'react';
import { View, StyleSheet, Text } from 'react-native';
import Svg, { Path, Rect, G } from 'react-native-svg';

export interface ChaseHorseLogoProps {
  size?: 'sm' | 'md' | 'lg' | 'hero';
  theme?: 'light' | 'dark';
  withSubtitle?: boolean;
}

export const ChaseHorseLogo: React.FC<ChaseHorseLogoProps> = ({
  size = 'md',
  theme = 'light',
  withSubtitle = true,
}) => {
  const isDark = theme === 'dark';
  const strokeColor = isDark ? '#F3F1EB' : '#151515';
  const subtitleColor = isDark ? '#DDD8CC' : '#151515';

  const dimensions = {
    sm: { width: 140, height: withSubtitle ? 28 : 18 },
    md: { width: 190, height: withSubtitle ? 38 : 24 },
    lg: { width: 250, height: withSubtitle ? 50 : 32 },
    hero: { width: 310, height: withSubtitle ? 62 : 40 },
  }[size];

  return (
    <View style={[styles.container, { width: dimensions.width }]}>
      <Svg
        viewBox="0 0 540 100"
        width={dimensions.width}
        height={dimensions.height}
      >
        <G fill={strokeColor}>
          {/* C */}
          <Path d="M 44,0 L 4,0 L 4,48 L 44,48 L 44,36 L 16,36 L 16,12 L 44,12 Z" />

          {/* H */}
          <Path d="M 56,0 L 68,0 L 68,18 L 84,18 L 84,0 L 96,0 L 96,48 L 84,48 L 84,30 L 68,30 L 68,48 L 56,48 Z" />

          {/* A (Angled blocky chevron) */}
          <Path d="M 124,0 L 138,0 L 152,48 L 140,48 L 131,16 L 122,48 L 110,48 Z" />

          {/* S */}
          <Path d="M 164,0 L 204,0 L 204,22 L 176,22 L 176,36 L 204,36 L 204,48 L 164,48 L 164,26 L 192,26 L 192,12 L 164,12 Z" />

          {/* E */}
          <Path d="M 216,0 L 256,0 L 256,12 L 228,12 L 228,18 L 252,18 L 252,30 L 228,30 L 228,36 L 256,36 L 256,48 L 216,48 Z" />

          {/* H */}
          <Path d="M 268,0 L 280,0 L 280,18 L 296,18 L 296,0 L 308,0 L 308,48 L 296,48 L 296,30 L 280,30 L 280,48 L 268,48 Z" />

          {/* O (Outer blocky rectangle with hollow cutout) */}
          <Path d="M 320,0 L 366,0 L 366,48 L 320,48 Z M 332,12 L 332,36 L 354,36 L 354,12 Z" />

          {/* Iconic Inner Square inside O */}
          <Rect x={337.5} y={18.5} width={11} height={11} fill="#D9531E" />

          {/* R */}
          <Path d="M 378,0 L 418,0 L 418,24 L 396,24 L 418,48 L 404,48 L 388,28 L 390,28 L 390,12 L 378,12 L 378,48 L 366,48 L 366,0 Z" />

          {/* S */}
          <Path d="M 430,0 L 470,0 L 470,22 L 442,22 L 442,36 L 470,36 L 470,48 L 430,48 L 430,26 L 458,26 L 458,12 L 430,12 Z" />

          {/* E */}
          <Path d="M 482,0 L 522,0 L 522,12 L 494,12 L 494,18 L 518,18 L 518,30 L 494,30 L 494,36 L 522,36 L 522,48 L 482,48 Z" />
        </G>
      </Svg>

      {withSubtitle && (
        <Text
          style={[
            styles.tagline,
            {
              color: subtitleColor,
              fontSize: size === 'sm' ? 8 : size === 'hero' ? 12 : 9.5,
            },
          ]}
        >
          Growth Enabling Logiworkx Partner
        </Text>
      )}
    </View>
  );
};

export const ChaseHorseMark: React.FC<{
  size?: number;
  theme?: 'light' | 'dark';
}> = ({ size = 32, theme = 'light' }) => {
  const isDark = theme === 'dark';
  const color = isDark ? '#F3F1EB' : '#151515';

  return (
    <Svg viewBox="0 0 46 48" width={size} height={(size * 48) / 46}>
      <Path
        d="M 0,0 L 46,0 L 46,48 L 0,48 Z M 12,12 L 12,36 L 34,36 L 34,12 Z"
        fill={color}
      />
      <Rect x={17.5} y={18.5} width={11} height={11} fill={color} />
    </Svg>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  tagline: {
    fontWeight: '600',
    letterSpacing: 2,
    marginTop: 4,
    textAlign: 'center',
    fontFamily: 'System',
  },
});
