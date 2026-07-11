/**
 * TrendLine — a sparkline of accuracy across recent quizzes, with a soft area under it.
 *
 * The draw-on animation is a growing rectangular **mask**, not an animated dash offset.
 * Dashes need the path's true arc length, which react-native-svg won't tell us; guessing
 * it makes the line either finish early or repeat itself. A mask wipes left-to-right in
 * exact step with the x-axis, and it reveals the area fill at the same time.
 *
 * One series, so no legend. One direct label, on the newest point — the value the reader
 * came for. The rest are read off the shape.
 */
import { useEffect, useId } from 'react';
import { View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedProps,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';
import { Circle, Defs, G, LinearGradient, Mask, Path, Rect, Stop, Svg } from 'react-native-svg';

const AnimatedRect = Animated.createAnimatedComponent(Rect);

const STROKE = 2;
/** Radius of the marker on the newest point. ≥8px diameter stays tappable-looking. */
const DOT = 4.5;

/**
 * A smooth curve through the points, using horizontal control handles at each segment's
 * midpoint. Tangents stay level at the knots, so the line reads as a trend rather than a
 * connect-the-dots zigzag, and it never overshoots past a data point.
 */
function smoothPath(points: { x: number; y: number }[]): string {
  if (points.length === 0) return '';
  if (points.length === 1) return `M ${points[0].x} ${points[0].y}`;

  let d = `M ${points[0].x} ${points[0].y}`;
  for (let i = 1; i < points.length; i++) {
    const p0 = points[i - 1];
    const p1 = points[i];
    const midX = (p0.x + p1.x) / 2;
    d += ` C ${midX} ${p0.y}, ${midX} ${p1.y}, ${p1.x} ${p1.y}`;
  }
  return d;
}

export function TrendLine({
  /** One value per quiz, 0..1, oldest first. */
  values,
  width,
  height = 84,
  color,
  delay = 120,
}: {
  values: number[];
  width: number;
  height?: number;
  color: string;
  delay?: number;
}) {
  const revealed = useSharedValue(0);
  // Unique per instance: two charts on one screen would otherwise share a mask id. React's
  // ids carry colons (`:r3:`), which have no business inside an SVG `url(#…)` reference.
  const instanceId = useId().replace(/[^a-zA-Z0-9]/g, '');
  const maskId = `trend-mask-${instanceId}`;
  const gradientId = `trend-fill-${instanceId}`;

  useEffect(() => {
    revealed.value = 0;
    revealed.value = withDelay(
      delay,
      withTiming(width, { duration: 760, easing: Easing.out(Easing.cubic) }),
    );
  }, [width, delay, values.length, revealed]);

  const wipe = useAnimatedProps(() => ({ width: revealed.value }));

  if (width <= 0 || values.length < 2) return <View style={{ height }} />;

  // Inset by the stroke and the marker so neither is clipped at the edges.
  const padY = DOT + STROKE;
  const padX = DOT + STROKE;
  const plotW = width - padX * 2;
  const plotH = height - padY * 2;

  const points = values.map((v, i) => ({
    x: padX + (i / (values.length - 1)) * plotW,
    // Accuracy is a fraction of a fixed whole, so the axis is pinned to 0..1. A
    // min/max-scaled axis would turn 96% vs 98% into a dramatic climb.
    y: padY + (1 - Math.min(1, Math.max(0, v))) * plotH,
  }));

  const line = smoothPath(points);
  const last = points[points.length - 1];
  const area = `${line} L ${last.x} ${height} L ${points[0].x} ${height} Z`;

  return (
    <Svg width={width} height={height}>
      <Defs>
        <LinearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={color} stopOpacity={0.22} />
          <Stop offset="1" stopColor={color} stopOpacity={0} />
        </LinearGradient>
        <Mask id={maskId} maskUnits="userSpaceOnUse" x={0} y={0} width={width} height={height}>
          <AnimatedRect x={0} y={0} height={height} fill="#fff" animatedProps={wipe} />
        </Mask>
      </Defs>

      <G mask={`url(#${maskId})`}>
        <Path d={area} fill={`url(#${gradientId})`} />
        <Path
          d={line}
          stroke={color}
          strokeWidth={STROKE}
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <Circle cx={last.x} cy={last.y} r={DOT} fill={color} />
      </G>
    </Svg>
  );
}
