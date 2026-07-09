/**
 * WheelPicker — an iOS-style picker wheel built from a snapping `Animated.ScrollView`, so the
 * scroll itself runs natively and the per-item depth (fade, shrink, rotate away from the centre)
 * is derived from the live scroll offset on the UI thread.
 *
 * The selected value is reported as the wheel passes each row — with a selection tick — rather
 * than only when it settles, which is how the system pickers feel.
 */
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  Extrapolation,
  interpolate,
  runOnJS,
  useAnimatedReaction,
  useAnimatedRef,
  useAnimatedStyle,
  useScrollOffset,
  useSharedValue,
  type SharedValue,
} from 'react-native-reanimated';

import { haptic } from '@/lib/haptics';
import { Radius } from '@/theme/tokens';
import { Type } from '@/theme/type';
import { useTokens } from '@/theme/theme';

export function WheelPicker({
  values,
  value,
  onChange,
  itemHeight = 54,
  visible = 5,
  format,
}: {
  values: number[];
  value: number;
  onChange: (value: number) => void;
  itemHeight?: number;
  /** Rows shown at once — must be odd so one sits on the centre line. */
  visible?: number;
  format?: (value: number) => string;
}) {
  const t = useTokens();
  const ref = useAnimatedRef<Animated.ScrollView>();

  const pad = (itemHeight * (visible - 1)) / 2;

  // Captured once. `contentOffset` is a live prop on iOS, so recomputing it from `value` would
  // yank the wheel back under the finger on every reported change.
  const [initialOffset] = useState(() => Math.max(0, values.indexOf(value)) * itemHeight);

  // `useScrollOffset` only writes on scroll EVENTS — it never reads the starting `contentOffset`.
  // Left to its own shared value it would sit at 0 until first touch, so every visible row would
  // measure five rows from the centre and render faded and rotated flat. Seed it instead.
  const seed = useSharedValue(initialOffset);
  const offset = useScrollOffset(ref, seed);

  const commit = (index: number) => {
    haptic.select();
    onChange(values[index]);
  };

  useAnimatedReaction(
    () => Math.round(offset.value / itemHeight),
    (index, previous) => {
      // `previous` is null on the first run — don't fire for the value we started on.
      if (previous == null || index === previous) return;
      if (index < 0 || index >= values.length) return;
      runOnJS(commit)(index);
    },
  );

  return (
    <View style={{ height: visible * itemHeight }}>
      <View
        pointerEvents="none"
        style={[styles.selection, { top: pad, height: itemHeight, backgroundColor: t.fill }]}
      />

      <Animated.ScrollView
        ref={ref}
        showsVerticalScrollIndicator={false}
        snapToInterval={itemHeight}
        snapToAlignment="start"
        decelerationRate="fast"
        scrollEventThrottle={16}
        contentOffset={{ x: 0, y: initialOffset }}
        contentContainerStyle={{ paddingVertical: pad }}
      >
        {values.map((v, i) => (
          <WheelItem
            key={v}
            index={i}
            offset={offset}
            itemHeight={itemHeight}
            label={format ? format(v) : String(v)}
            color={t.text}
          />
        ))}
      </Animated.ScrollView>
    </View>
  );
}

function WheelItem({
  index,
  offset,
  itemHeight,
  label,
  color,
}: {
  index: number;
  offset: SharedValue<number>;
  itemHeight: number;
  label: string;
  color: string;
}) {
  const style = useAnimatedStyle(() => {
    // Signed distance from the centre line, in rows.
    const d = offset.value / itemHeight - index;
    const abs = Math.abs(d);
    return {
      opacity: interpolate(abs, [0, 1, 2, 3], [1, 0.45, 0.2, 0.08], Extrapolation.CLAMP),
      transform: [
        { perspective: 700 },
        { rotateX: `${interpolate(d, [-2, 0, 2], [45, 0, -45], Extrapolation.CLAMP)}deg` },
        { scale: interpolate(abs, [0, 1, 2], [1, 0.88, 0.78], Extrapolation.CLAMP) },
      ],
    };
  });

  return (
    <Animated.View style={[{ height: itemHeight }, styles.item, style]}>
      <Text style={[Type.title1, styles.label, { color }]}>{label}</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  selection: {
    position: 'absolute',
    left: 0,
    right: 0,
    borderRadius: Radius.control,
    borderCurve: 'continuous',
  },
  item: { alignItems: 'center', justifyContent: 'center' },
  // `title1` tracks positively for headlines and the numeric presets carry tabular-nums — both
  // wrong here. Every row is independently centred, so nothing needs fixed-width digits, and
  // "11" reads as two separate glyphs unless the tracking pulls back in.
  label: { letterSpacing: -0.5 },
});
