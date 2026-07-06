/**
 * Icon — every SVG glyph from EarnLock.dc.html, transcribed 1:1 into react-native-svg.
 * All paths use a 24x24 viewBox (matching the design) unless noted. Fill-based glyphs paint
 * with `color`; outline glyphs stroke with `color`. Two-tone glyphs (coin, logo, filled
 * check/x circles) take a `holeColor` for the inner mark (defaults to white as in the design).
 */
import { Circle, Ellipse, Path, Rect, Svg } from 'react-native-svg';

export type IconName =
  | 'logo'
  | 'lockRound'
  | 'lockSolid'
  | 'star'
  | 'flame'
  | 'bolt'
  | 'coin'
  | 'plus'
  | 'minus'
  | 'check'
  | 'checkCircle'
  | 'xCircle'
  | 'close'
  | 'chevronLeft'
  | 'chevronRight'
  | 'calc'
  | 'globe'
  | 'leaf'
  | 'chat'
  | 'atom'
  | 'flask'
  | 'pin'
  | 'code'
  | 'music'
  | 'camera'
  | 'game'
  | 'play'
  | 'book'
  | 'bookmark'
  | 'upload'
  | 'share'
  | 'shield'
  | 'shieldAlert'
  | 'alertCircle'
  | 'sun'
  | 'moon'
  | 'tabHome'
  | 'tabMap'
  | 'tabChart'
  | 'tabUser';

export type IconProps = {
  name: IconName;
  size?: number;
  color?: string;
  /** Inner mark color for two-tone glyphs (coin, logo keyhole, filled check/x circles). */
  holeColor?: string;
  /** Override the glyph's default stroke width (used by `check`, which varies by context). */
  strokeWidth?: number;
};

export function Icon({ name, size = 24, color = '#000', holeColor = '#fff', strokeWidth }: IconProps) {
  const svg = (children: React.ReactNode) => (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      {children}
    </Svg>
  );

  switch (name) {
    case 'logo':
      return svg(
        <>
          <Rect x={4.5} y={10.3} width={15} height={10.2} rx={3.2} fill={color} />
          <Path d="M7.6 10.3V7.7a4.4 4.4 0 0 1 8.8 0v2.6" stroke={color} strokeWidth={2.3} strokeLinecap="round" />
          <Circle cx={12} cy={14.6} r={1.7} fill={holeColor} />
          <Path d="M12 15.6v2.4" stroke={holeColor} strokeWidth={2.2} strokeLinecap="round" />
        </>,
      );
    case 'lockRound':
      return svg(
        <>
          <Rect x={4.5} y={10.5} width={15} height={10} rx={3} fill={color} />
          <Path d="M7.6 10.5V7.8a4.4 4.4 0 0 1 8.8 0v2.7" stroke={color} strokeWidth={2.2} strokeLinecap="round" />
        </>,
      );
    case 'lockSolid':
      return svg(
        <>
          <Rect x={5} y={11} width={14} height={9} rx={2.5} fill={color} />
          <Path d="M8 11V8a4 4 0 0 1 8 0v3" stroke={color} strokeWidth={2} />
        </>,
      );
    case 'star':
      return svg(<Path d="M12 2.5l2.1 5.4 5.8.3-4.5 3.7 1.5 5.6L12 19.9l-4.9 3.1 1.5-5.6-4.5-3.7 5.8-.3z" fill={color} />);
    case 'flame':
      return svg(
        <Path
          d="M13 2c.5 3-1.5 4.5-3 6.5C8.2 10.9 7 13 7 15.4A5 5 0 0 0 17 16c0-2-1-3.6-2-5 0 1-.6 1.8-1.5 2 .8-3-1-6-.5-11z"
          fill={color}
        />,
      );
    case 'bolt':
      return svg(<Path d="M13 2 4 14h6l-1 8 10-13h-7z" fill={color} />);
    case 'coin':
      return svg(
        <>
          <Circle cx={12} cy={12} r={9} fill={color} />
          <Path d="M12 7v10M9.5 9h4a2 2 0 0 1 0 4h-4" stroke={holeColor} strokeWidth={1.6} strokeLinecap="round" />
        </>,
      );
    case 'plus':
      return svg(<Path d="M12 5v14M5 12h14" stroke={color} strokeWidth={strokeWidth ?? 3} strokeLinecap="round" />);
    case 'minus':
      return svg(<Path d="M5 12h14" stroke={color} strokeWidth={strokeWidth ?? 3} strokeLinecap="round" />);
    case 'check':
      return svg(
        <Path d="M5 13l4 4L19 7" stroke={color} strokeWidth={strokeWidth ?? 3.2} strokeLinecap="round" strokeLinejoin="round" />,
      );
    case 'checkCircle':
      return svg(
        <>
          <Circle cx={12} cy={12} r={11} fill={color} />
          <Path d="M7 12.5l3.2 3.2L17 9" stroke={holeColor} strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" />
        </>,
      );
    case 'xCircle':
      return svg(
        <>
          <Circle cx={12} cy={12} r={11} fill={color} />
          <Path d="M8.5 8.5l7 7M15.5 8.5l-7 7" stroke={holeColor} strokeWidth={2.4} strokeLinecap="round" />
        </>,
      );
    case 'close':
      return svg(<Path d="M6 6l12 12M18 6L6 18" stroke={color} strokeWidth={strokeWidth ?? 2.4} strokeLinecap="round" />);
    case 'chevronLeft':
      return svg(
        <Path d="M15 5l-7 7 7 7" stroke={color} strokeWidth={strokeWidth ?? 2.4} strokeLinecap="round" strokeLinejoin="round" />,
      );
    case 'chevronRight':
      return svg(
        <Path d="M9 6l6 6-6 6" stroke={color} strokeWidth={strokeWidth ?? 2.4} strokeLinecap="round" strokeLinejoin="round" />,
      );
    case 'calc':
      return svg(
        <>
          <Rect x={5} y={3} width={14} height={18} rx={3} stroke={color} strokeWidth={2} strokeLinecap="round" />
          <Path
            d="M8.5 7.5h7M9 12h.01M12 12h.01M15 12h.01M9 16h.01M12 16h.01M15 16h.01"
            stroke={color}
            strokeWidth={2}
            strokeLinecap="round"
          />
        </>,
      );
    case 'globe':
      return svg(
        <>
          <Circle cx={12} cy={12} r={9} stroke={color} strokeWidth={2} />
          <Path d="M3 12h18M12 3c2.6 2.7 2.6 15.3 0 18M12 3c-2.6 2.7-2.6 15.3 0 18" stroke={color} strokeWidth={2} />
        </>,
      );
    case 'leaf':
      return svg(
        <>
          <Path d="M5 20c-1-7 4-14 14-15 0 10-7 15-14 15z" stroke={color} strokeWidth={2} strokeLinecap="round" />
          <Path d="M5 20c3.5-4 6.5-6 11-8" stroke={color} strokeWidth={2} strokeLinecap="round" />
        </>,
      );
    case 'chat':
      return svg(
        <>
          <Path d="M4 5h16v11H9l-4 4z" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
          <Path d="M8 9h8M8 12h5" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
        </>,
      );
    case 'atom':
      return svg(
        <>
          <Circle cx={12} cy={12} r={1.6} fill={color} />
          <Ellipse cx={12} cy={12} rx={9} ry={3.6} stroke={color} strokeWidth={2} />
          <Ellipse cx={12} cy={12} rx={9} ry={3.6} stroke={color} strokeWidth={2} rotation={60} originX={12} originY={12} />
          <Ellipse cx={12} cy={12} rx={9} ry={3.6} stroke={color} strokeWidth={2} rotation={120} originX={12} originY={12} />
        </>,
      );
    case 'flask':
      return svg(
        <>
          <Path
            d="M9 3h6M10 3v6l-5 8.5A2 2 0 0 0 6.7 21h10.6a2 2 0 0 0 1.7-3.5L14 9V3"
            stroke={color}
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <Path d="M7.5 15h9" stroke={color} strokeWidth={2} strokeLinecap="round" />
        </>,
      );
    case 'pin':
      return svg(
        <>
          <Path
            d="M12 21c5-5 7-8.5 7-12a7 7 0 0 0-14 0c0 3.5 2 7 7 12z"
            stroke={color}
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <Circle cx={12} cy={9} r={2.5} stroke={color} strokeWidth={2} />
        </>,
      );
    case 'code':
      return svg(
        <Path
          d="M9 8l-4 4 4 4M15 8l4 4-4 4"
          stroke={color}
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
        />,
      );
    case 'music':
      return svg(
        <>
          <Path d="M9 17V5l10-2v12" stroke={color} strokeWidth={2} strokeLinecap="round" />
          <Circle cx={6.5} cy={17.5} r={2.6} fill={color} />
          <Circle cx={16.5} cy={15.5} r={2.6} fill={color} />
        </>,
      );
    case 'camera':
      return svg(
        <>
          <Rect x={3} y={7} width={18} height={13} rx={3.5} stroke={color} strokeWidth={2} />
          <Circle cx={12} cy={13.5} r={3.4} stroke={color} strokeWidth={2} />
          <Path d="M8 7l1.4-2h5.2L16 7" stroke={color} strokeWidth={2} />
        </>,
      );
    case 'game':
      return svg(
        <>
          <Rect x={2.5} y={8} width={19} height={9.5} rx={4.5} stroke={color} strokeWidth={2} strokeLinecap="round" />
          <Path d="M7 11.5v3M5.5 13h3" stroke={color} strokeWidth={2} strokeLinecap="round" />
          <Circle cx={16} cy={12} r={1} stroke={color} strokeWidth={2} />
          <Circle cx={18} cy={14.5} r={1} stroke={color} strokeWidth={2} />
        </>,
      );
    case 'play':
      return svg(<Path d="M8 5.5v13l11-6.5z" fill={color} />);
    case 'book':
      return svg(
        <>
          <Path
            d="M4 5.5A2 2 0 0 1 6 4h13v14.5H6.5A2.5 2.5 0 0 0 4 21z"
            stroke={color}
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <Path d="M8 8.5h7" stroke={color} strokeWidth={2} strokeLinecap="round" />
        </>,
      );
    case 'bookmark':
      return svg(
        <Path d="M6 4h12v16l-6-4-6 4z" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />,
      );
    case 'upload':
      return svg(
        <>
          <Path d="M12 16V4M8 8l4-4 4 4" stroke={color} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" />
          <Path
            d="M4 15v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3"
            stroke={color}
            strokeWidth={2.2}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </>,
      );
    case 'share':
      return svg(
        <>
          <Path d="M12 15V4M8 8l4-4 4 4" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
          <Path d="M5 12v7h14v-7" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
        </>,
      );
    case 'shield':
      return svg(
        <Path
          d="M12 3l7.5 3.2v5.3c0 4.3-3.2 7.4-7.5 9.2-4.3-1.8-7.5-4.9-7.5-9.2V6.2z"
          stroke={color}
          strokeWidth={2.2}
          strokeLinecap="round"
          strokeLinejoin="round"
        />,
      );
    case 'shieldAlert':
      return svg(
        <>
          <Path
            d="M12 3l7.5 3.2v5.3c0 4.3-3.2 7.4-7.5 9.2-4.3-1.8-7.5-4.9-7.5-9.2V6.2z"
            stroke={color}
            strokeWidth={2.1}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <Path d="M12 9v4M12 16.5v.01" stroke={color} strokeWidth={2.1} strokeLinecap="round" strokeLinejoin="round" />
        </>,
      );
    case 'alertCircle':
      return svg(
        <>
          <Circle cx={12} cy={12} r={9} stroke={color} strokeWidth={2.2} strokeLinecap="round" />
          <Path d="M12 8v5M12 16.4v.01" stroke={color} strokeWidth={2.2} strokeLinecap="round" />
        </>,
      );
    case 'sun':
      return svg(
        <>
          <Circle cx={12} cy={12} r={4.5} stroke={color} strokeWidth={2.2} strokeLinecap="round" />
          <Path
            d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5 5l1.4 1.4M17.6 17.6L19 19M19 5l-1.4 1.4M6.4 17.6L5 19"
            stroke={color}
            strokeWidth={2.2}
            strokeLinecap="round"
          />
        </>,
      );
    case 'moon':
      return svg(<Path d="M20.5 14.3A8.2 8.2 0 0 1 9.7 3.5 8.5 8.5 0 1 0 20.5 14.3z" fill={color} />);
    case 'tabHome':
      return svg(
        <>
          <Path d="M4 11l8-7 8 7" stroke={color} strokeWidth={2.1} strokeLinecap="round" strokeLinejoin="round" />
          <Path d="M6 10v9h12v-9" stroke={color} strokeWidth={2.1} strokeLinecap="round" strokeLinejoin="round" />
        </>,
      );
    case 'tabMap':
      return svg(
        <>
          <Path
            d="M9 4L3.5 6v14L9 18l6 2 5.5-2V4L15 6 9 4z"
            stroke={color}
            strokeWidth={2.1}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <Path d="M9 4v14M15 6v14" stroke={color} strokeWidth={2.1} strokeLinecap="round" strokeLinejoin="round" />
        </>,
      );
    case 'tabChart':
      return svg(
        <Path d="M5 20V10M12 20V4M19 20v-7" stroke={color} strokeWidth={2.1} strokeLinecap="round" strokeLinejoin="round" />,
      );
    case 'tabUser':
      return svg(
        <>
          <Circle cx={12} cy={8} r={4} stroke={color} strokeWidth={2.1} strokeLinecap="round" strokeLinejoin="round" />
          <Path d="M4 21c1-4 4.5-6 8-6s7 2 8 6" stroke={color} strokeWidth={2.1} strokeLinecap="round" strokeLinejoin="round" />
        </>,
      );
    default:
      return null;
  }
}
