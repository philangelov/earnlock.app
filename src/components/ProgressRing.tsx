/**
 * ProgressRing — an SVG donut (track + progress arc) rotated so the arc starts at 12 o'clock,
 * matching the `<circle stroke-dasharray/stroke-dashoffset>` rings in the design. Supports one
 * or more concentric rings (Stats uses three) plus centered overlay content.
 */
import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { Circle, G, Svg } from 'react-native-svg';

export type Ring = {
  r: number;
  strokeWidth: number;
  trackColor: string;
  color: string;
  /** Full circumference (2·π·r) — the design's `stroke-dasharray`. */
  circumference: number;
  /** The design's `stroke-dashoffset`. */
  offset: number;
  rounded?: boolean;
};

export type ProgressRingProps = {
  /** Rendered size in px (width = height). */
  size: number;
  /** SVG coordinate box (square), e.g. 130 for Home. */
  viewBox: number;
  rings: Ring[];
  children?: ReactNode;
};

export function ProgressRing({ size, viewBox, rings, children }: ProgressRingProps) {
  const c = viewBox / 2;
  return (
    <View style={{ width: size, height: size }}>
      <Svg width={size} height={size} viewBox={`0 0 ${viewBox} ${viewBox}`}>
        <G rotation={-90} origin={`${c}, ${c}`}>
          {rings.map((ring, i) => (
            <G key={i}>
              <Circle cx={c} cy={c} r={ring.r} fill="none" stroke={ring.trackColor} strokeWidth={ring.strokeWidth} />
              <Circle
                cx={c}
                cy={c}
                r={ring.r}
                fill="none"
                stroke={ring.color}
                strokeWidth={ring.strokeWidth}
                strokeLinecap={ring.rounded === false ? 'butt' : 'round'}
                strokeDasharray={ring.circumference}
                strokeDashoffset={ring.offset}
              />
            </G>
          ))}
        </G>
      </Svg>
      {children != null && <View style={[StyleSheet.absoluteFill, styles.center]}>{children}</View>}
    </View>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: 'center', justifyContent: 'center' },
});
