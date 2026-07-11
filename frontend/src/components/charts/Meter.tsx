/**
 * Meter — a horizontal magnitude bar (subject mastery, screen-time earned vs spent).
 *
 * Magnitude, not identity: every meter on a screen shares one hue, and the *length* is
 * the whole message. Colouring each subject differently would imply the colour meant
 * something, and it wouldn't.
 */
import { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';

import { Radius } from '@/theme/tokens';
import { Type } from '@/theme/type';
import { useTokens } from '@/theme/theme';

export function Meter({
  label,
  value,
  /** Filled fraction, 0..1. */
  fraction,
  color,
  delay = 0,
  labelWidth = 74,
}: {
  label: string;
  value: string;
  fraction: number;
  color?: string;
  delay?: number;
  labelWidth?: number;
}) {
  const t = useTokens();
  const filled = useSharedValue(0);
  const target = Math.min(1, Math.max(0, fraction));

  useEffect(() => {
    filled.value = withDelay(
      delay,
      withTiming(target, { duration: 700, easing: Easing.out(Easing.cubic) }),
    );
  }, [target, delay, filled]);

  const fill = useAnimatedStyle(() => ({ width: `${filled.value * 100}%` }));

  return (
    <View style={styles.row} accessible accessibilityLabel={`${label}, ${value}`}>
      <Text style={[Type.subheadStrong, { color: t.text, width: labelWidth }]} numberOfLines={1}>
        {label}
      </Text>
      <View style={[styles.track, { backgroundColor: t.fill }]}>
        <Animated.View style={[styles.fill, fill, { backgroundColor: color ?? t.accent }]} />
      </View>
      <Text style={[Type.footnoteStrong, styles.value, { color: t.text2 }]} numberOfLines={1}>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  track: { flex: 1, height: 10, borderRadius: Radius.pill, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: Radius.pill, minWidth: 10 },
  // Wide enough for "2h 33m", not just "88%" — the screen-time ledger shares this row.
  value: { width: 58, textAlign: 'right' },
});
