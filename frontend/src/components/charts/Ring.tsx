/**
 * Ring — a single animated progress arc, starting at 12 o'clock and sweeping clockwise.
 *
 * The arc is drawn by animating `strokeDashoffset` from "hidden" to "revealed" on the UI
 * thread, so the sweep never stutters behind a busy JS thread. Centered content (a hero
 * number, an icon) goes in `children`.
 *
 * For the static multi-ring case see `ProgressRing`; this one is for the single figure a
 * card is built around.
 */
import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedProps,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';
import { Circle, G, Svg } from 'react-native-svg';

import type { ReactNode } from 'react';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

export type RingProps = {
  /** Rendered width/height in px. */
  size: number;
  /** Filled fraction, 0..1. Values outside are clamped. */
  progress: number;
  color: string;
  trackColor: string;
  strokeWidth?: number;
  /** Stagger the sweep when several rings animate on one screen. */
  delay?: number;
  duration?: number;
  children?: ReactNode;
};

export function Ring({
  size,
  progress,
  color,
  trackColor,
  strokeWidth = 10,
  delay = 0,
  duration = 900,
  children,
}: RingProps) {
  const swept = useSharedValue(0);

  const target = Math.min(1, Math.max(0, progress));
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const center = size / 2;

  useEffect(() => {
    swept.value = withDelay(
      delay,
      withTiming(target, { duration, easing: Easing.out(Easing.cubic) }),
    );
  }, [target, delay, duration, swept]);

  const arc = useAnimatedProps(() => ({
    strokeDashoffset: circumference * (1 - swept.value),
  }));

  return (
    <View style={{ width: size, height: size }}>
      <Svg width={size} height={size}>
        {/* Rotate the whole ring rather than the arc, so the track's seam hides under it. */}
        <G rotation={-90} origin={`${center}, ${center}`}>
          <Circle
            cx={center}
            cy={center}
            r={radius}
            fill="none"
            stroke={trackColor}
            strokeWidth={strokeWidth}
          />
          <AnimatedCircle
            cx={center}
            cy={center}
            r={radius}
            fill="none"
            stroke={color}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeDasharray={circumference}
            animatedProps={arc}
          />
        </G>
      </Svg>
      {children != null && <View style={[StyleSheet.absoluteFill, styles.center]}>{children}</View>}
    </View>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: 'center', justifyContent: 'center' },
});
