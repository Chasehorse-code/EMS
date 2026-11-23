import React from 'react';

export interface ChaseHorseLogoProps {
  className?: string;
  theme?: 'dark' | 'light' | 'auto'; // 'dark' = for dark bg (cream/white glyphs), 'light' = for light bg (ink glyphs)
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'hero';
  withSubtitle?: boolean;
  animated?: boolean;
  pulseInnerSquare?: boolean;
  style?: React.CSSProperties;
}

/**
 * Pixel-accurate vector representation of the blocky CHASEHORSE wordmark
 * featuring the signature square-inside-O mark and the official tagline:
 * "Growth Enabling Logiworkx Partner".
 */
export function ChaseHorseLogo({
  className = '',
  theme = 'auto',
  size = 'md',
  withSubtitle = true,
  animated = false,
  pulseInnerSquare = false,
  style,
}: ChaseHorseLogoProps) {
  // Height / width dimensions for different sizes
  const dimensions: Record<string, { width: number; height: number }> = {
    sm: { width: 140, height: withSubtitle ? 32 : 20 },
    md: { width: 190, height: withSubtitle ? 44 : 26 },
    lg: { width: 250, height: withSubtitle ? 56 : 34 },
    xl: { width: 320, height: withSubtitle ? 72 : 44 },
    hero: { width: 440, height: withSubtitle ? 98 : 60 },
  };

  const dim = dimensions[size] || dimensions.md;

  const glyphColor =
    theme === 'dark'
      ? '#F3F1EB'
      : theme === 'light'
      ? '#151515'
      : 'var(--ink, #151515)';

  const subColor =
    theme === 'dark'
      ? '#A8A49A'
      : theme === 'light'
      ? '#5E5B53'
      : 'var(--muted, #5E5B53)';

  const innerSquareColor =
    pulseInnerSquare
      ? '#D9531E'
      : glyphColor;

  return (
    <div
      className={`chasehorse-logo-wrap ${className}`}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        userSelect: 'none',
        lineHeight: 1,
        ...style,
      }}
    >
      <svg
        viewBox={withSubtitle ? '0 0 476 74' : '0 0 476 48'}
        width={dim.width}
        height={dim.height}
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-label="ChaseHorse — Growth Enabling Logiworkx Partner"
        role="img"
        style={{ overflow: 'visible' }}
      >
        <g
          className={animated ? 'chasehorse-animated-glyphs' : ''}
          fill={glyphColor}
        >
          {/* C (x: 0, w: 38, h: 48) */}
          <path
            d="M 0,0 L 38,0 L 38,10 L 11,10 L 11,38 L 38,38 L 38,48 L 0,48 Z"
            className="chase-char char-c"
          />

          {/* H (x: 48, w: 38, h: 48) */}
          <path
            d="M 48,0 L 59,0 L 59,19 L 75,19 L 75,0 L 86,0 L 86,48 L 75,48 L 75,29 L 59,29 L 59,48 L 48,48 Z"
            className="chase-char char-h1"
          />

          {/* A (Chevron Peak Stylized Glyph) (x: 96, w: 38, h: 48) */}
          <path
            d="M 96,48 L 107,48 L 115,16 L 123,48 L 134,48 L 121,0 L 109,0 Z"
            className="chase-char char-a"
          />

          {/* S (x: 144, w: 38, h: 48) */}
          <path
            d="M 144,0 L 182,0 L 182,10 L 155,10 L 155,19 L 182,19 L 182,48 L 144,48 L 144,38 L 171,38 L 171,29 L 144,29 Z"
            className="chase-char char-s1"
          />

          {/* E (x: 192, w: 36, h: 48) */}
          <path
            d="M 192,0 L 228,0 L 228,10 L 203,10 L 203,19 L 226,19 L 226,29 L 203,29 L 203,38 L 228,38 L 228,48 L 192,48 Z"
            className="chase-char char-e1"
          />

          {/* H (x: 238, w: 38, h: 48) */}
          <path
            d="M 238,0 L 249,0 L 249,19 L 265,19 L 265,0 L 276,0 L 276,48 L 265,48 L 265,29 L 249,29 L 249,48 L 238,48 Z"
            className="chase-char char-h2"
          />

          {/* O (Signature Square-Inside-O Mark) (x: 286, w: 46, h: 48) */}
          {/* Outer rectangular frame with hollow opening */}
          <path
            fillRule="evenodd"
            clipRule="evenodd"
            d="M 286,0 L 332,0 L 332,48 L 286,48 Z M 297,10 L 321,10 L 321,38 L 297,38 Z"
            className="chase-char char-o-frame"
          />

          {/* R (x: 342, w: 38, h: 48) */}
          <path
            fillRule="evenodd"
            clipRule="evenodd"
            d="M 342,0 L 380,0 L 380,26 L 368,26 L 380,48 L 367,48 L 355,27 L 353,27 L 353,48 L 342,48 Z M 353,9 L 369,9 L 369,18 L 353,18 Z"
            className="chase-char char-r"
          />

          {/* S (x: 390, w: 38, h: 48) */}
          <path
            d="M 390,0 L 428,0 L 428,10 L 401,10 L 401,19 L 428,19 L 428,48 L 390,48 L 390,38 L 417,38 L 417,29 L 390,29 Z"
            className="chase-char char-s2"
          />

          {/* E (x: 438, w: 36, h: 48) */}
          <path
            d="M 438,0 L 474,0 L 474,10 L 449,10 L 449,19 L 472,19 L 472,29 L 449,29 L 449,38 L 474,38 L 474,48 L 438,48 Z"
            className="chase-char char-e2"
          />
        </g>

        {/* The Signature Square Inside O (Pulsing / Hero Target) */}
        <rect
          x="303.5"
          y="18.5"
          width="11"
          height="11"
          rx="1"
          fill={innerSquareColor}
          className={`chasehorse-o-inner-square ${pulseInnerSquare ? 'chasehorse-pulse-square' : ''}`}
        />

        {/* Tagline: Growth Enabling Logiworkx Partner */}
        {withSubtitle && (
          <text
            x="237"
            y="68"
            textAnchor="middle"
            fill={subColor}
            fontFamily="'Inter', 'Plus Jakarta Sans', -apple-system, sans-serif"
            fontWeight="500"
            fontSize="14.5"
            letterSpacing="0.22em"
            className="chasehorse-tagline-text"
          >
            Growth Enabling Logiworkx Partner
          </text>
        )}
      </svg>
    </div>
  );
}

/**
 * Compact square-inside-O favicon / brandmark for small buttons and mobile topbars
 */
export function ChaseHorseMark({
  size = 28,
  theme = 'auto',
  className = '',
  style,
}: {
  size?: number;
  theme?: 'dark' | 'light' | 'auto';
  className?: string;
  style?: React.CSSProperties;
}) {
  const glyphColor =
    theme === 'dark'
      ? '#F3F1EB'
      : theme === 'light'
      ? '#151515'
      : 'var(--ink, #151515)';

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 46 48"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`chasehorse-compact-mark ${className}`}
      style={style}
      aria-label="ChaseHorse Logo Mark"
    >
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M 0,0 L 46,0 L 46,48 L 0,48 Z M 11,10 L 35,10 L 35,38 L 11,38 Z"
        fill={glyphColor}
      />
      <rect x="17.5" y="18.5" width="11" height="11" rx="1" fill={glyphColor} />
    </svg>
  );
}

export function ChaseHorseWordmark(props: ChaseHorseLogoProps) {
  return <ChaseHorseLogo {...props} />;
}
