/**
 * DragTrack — the lime slider shared by the hours dial and the pace slider. The thumb follows the
 * finger continuously (the fraction is a shared value written straight from the responder
 * handlers) while the reported value snaps to `step`, ticking the haptic engine at each crossing.
 * On release the thumb eases onto the exact value it landed on.
 *
 * Two things fight a horizontal drag on iOS, and both are handled:
 *
 *  - The enclosing vertical ScrollView asks for the responder the moment the finger drifts off
 *    axis. `onResponderTerminationRequest` refuses, so a sloppy drag keeps sliding instead of
 *    scrolling the page out from under it.
 *  - The stack's interactive-pop recogniser owns the left screen edge and is *not* part of the
 *    responder system, so it cannot be refused from here. Screens that host a DragTrack turn
 *    `gestureEnabled` off in the onboarding layout; the back chevron is the way back from them.
 *
 * Timing curves only: a spring would overshoot the thumb past the value it just committed to.
 * Built on the View responder props rather than a native slider so the track can carry the app's
 * geometry, and so it adds no native dependency to the project.
 */
import { useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { haptic } from '@/lib/haptics';
import { Radius } from '@/theme/tokens';
import { useTokens } from '@/theme/theme';

/** Thumb diameter — marks that label positions on the track must inset by half of this. */
export const DRAG_THUMB = 28;

const SETTLE = { duration: 180, easing: Easing.out(Easing.cubic) } as const;
const GRAB = { duration: 120, easing: Easing.out(Easing.quad) } as const;

export function DragTrack({
  value,
  min,
  max,
  step = 1,
  onChange,
  accessibilityLabel,
}: {
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (value: number) => void;
  accessibilityLabel: string;
}) {
  const t = useTokens();
  const [width, setWidth] = useState(0);

  const fraction = useSharedValue((value - min) / (max - min));
  const grabbed = useSharedValue(0);
  const dragging = useRef(false);

  const snap = (raw: number) => Math.min(max, Math.max(min, Math.round(raw / step) * step));

  const seek = (x: number) => {
    if (width <= 0) return;
    // The thumb's centre travels between DRAG_THUMB/2 and width - DRAG_THUMB/2, so map the touch
    // onto that span — otherwise the value lags the finger by half a thumb at each end.
    const travel = Math.max(1, width - DRAG_THUMB);
    const f = Math.min(1, Math.max(0, (x - DRAG_THUMB / 2) / travel));
    fraction.value = f;
    const next = snap(min + f * (max - min));
    if (next !== value) {
      haptic.select();
      onChange(next);
    }
  };

  const grant = (x: number) => {
    dragging.current = true;
    grabbed.value = withTiming(1, GRAB);
    seek(x);
  };

  const settle = () => {
    dragging.current = false;
    grabbed.value = withTiming(0, SETTLE);
    fraction.value = withTiming((value - min) / (max - min), SETTLE);
  };

  const nudge = (direction: 1 | -1) => {
    const next = snap(value + direction * step);
    if (next === value) return;
    haptic.select();
    onChange(next);
  };

  // Ease onto the exact value whenever it changes from outside a drag (the stepper buttons).
  useEffect(() => {
    if (!dragging.current) fraction.value = withTiming((value - min) / (max - min), SETTLE);
  }, [fraction, value, min, max]);

  const travel = Math.max(0, width - DRAG_THUMB);
  const barFill = useAnimatedStyle(() => ({ width: DRAG_THUMB / 2 + fraction.value * travel }));
  const thumb = useAnimatedStyle(() => ({
    transform: [
      { translateX: fraction.value * travel },
      // A circle, not text — scaling it costs nothing in sharpness.
      { scale: 1 + grabbed.value * 0.14 },
    ],
  }));

  return (
    <View
      style={styles.area}
      onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
      onStartShouldSetResponder={() => true}
      onMoveShouldSetResponder={() => true}
      // Once the drag is ours, nothing takes it — least of all the page trying to scroll.
      onResponderTerminationRequest={() => false}
      onResponderGrant={(e) => grant(e.nativeEvent.locationX)}
      onResponderMove={(e) => seek(e.nativeEvent.locationX)}
      onResponderRelease={settle}
      onResponderTerminate={settle}
      accessibilityRole="adjustable"
      accessibilityLabel={accessibilityLabel}
      accessibilityValue={{ min, max, now: value }}
      accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
      onAccessibilityAction={(e) => nudge(e.nativeEvent.actionName === 'increment' ? 1 : -1)}
    >
      {/* Non-interactive children keep `locationX` measured against the track itself. */}
      <View pointerEvents="none" style={[styles.bar, { backgroundColor: t.fill }]}>
        <Animated.View style={[styles.barFill, barFill, { backgroundColor: t.accent }]} />
      </View>
      <Animated.View
        pointerEvents="none"
        style={[styles.thumb, thumb, { backgroundColor: t.surface, borderColor: t.border }]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  // Tall enough to grab comfortably; `locationX` inside it maps 1:1 onto the bar below.
  area: { flex: 1, height: 44, justifyContent: 'center' },
  bar: { height: 6, borderRadius: Radius.pill, overflow: 'hidden' },
  barFill: { height: '100%', borderRadius: Radius.pill },
  thumb: {
    position: 'absolute',
    width: DRAG_THUMB,
    height: DRAG_THUMB,
    borderRadius: Radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
    boxShadow: '0px 2px 6px rgba(12,12,20,0.16)',
  },
});
