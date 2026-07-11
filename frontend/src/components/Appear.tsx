/**
 * Appear — fade (and optionally rise or grow) a view in on mount.
 *
 * Why not Reanimated's `entering={FadeIn}`? Because a layout animation that fails to run
 * does not degrade to "shown without animation" — it leaves the view at its opening
 * frame, `opacity: 0`, forever. On this app that was observed intermittently on a cold
 * launch: the same build, same route, would sometimes render the Today dial's countdown
 * and sometimes render an empty ring. Content that must be on screen cannot depend on an
 * animation completing.
 *
 * A shared value driven by `withTiming` runs on the same UI runtime that powers the
 * dial's sweep and the chart bars, which never missed. If it is ever interrupted, the
 * worst case is a view that snaps in rather than one that never arrives.
 */
import { useEffect, type ReactNode } from 'react';
import type { ViewProps, ViewStyle } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';

export type AppearProps = Omit<ViewProps, 'style' | 'children'> & {
  children: ReactNode;
  delay?: number;
  duration?: number;
  /** Pixels to rise from. 0 disables the translation. */
  from?: number;
  /** Scale to grow from. 1 disables the scale. */
  scaleFrom?: number;
  style?: ViewStyle | ViewStyle[];
};

export function Appear({
  children,
  delay = 0,
  duration = 320,
  from = 0,
  scaleFrom = 1,
  style,
  ...rest
}: AppearProps) {
  const shown = useSharedValue(0);

  useEffect(() => {
    shown.value = withDelay(delay, withTiming(1, { duration, easing: Easing.out(Easing.cubic) }));
  }, [delay, duration, shown]);

  const animated = useAnimatedStyle(() => ({
    opacity: shown.value,
    transform: [
      { translateY: from * (1 - shown.value) },
      { scale: scaleFrom + (1 - scaleFrom) * shown.value },
    ],
  }));

  return (
    <Animated.View style={[style, animated]} {...rest}>
      {children}
    </Animated.View>
  );
}
