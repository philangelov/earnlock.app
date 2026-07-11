/**
 * BarChart — a compact column chart for one series over a short, fixed span (the week).
 *
 * Design rules it follows (see the dataviz method):
 *  - One series, so no legend: the card's title names it.
 *  - Bars carry magnitude, so they share one hue. Only *today* is accented, because that
 *    is a different fact — where you are — not a bigger number.
 *  - A day with no activity draws a 3px seed rather than nothing. An absent bar and a
 *    zero bar must not look identical.
 *  - Exactly one direct label (today's). A number over every bar is a table, not a chart.
 *  - No gridlines, no y-axis. A single hairline baseline anchors the columns.
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

import { Type } from '@/theme/type';
import { useTokens } from '@/theme/theme';

/** Height of the stub drawn for a genuinely-zero day. */
const ZERO_STUB = 3;
/** Shortest bar a non-zero value may draw, so "a little" never reads as "none". */
const MIN_BAR = 8;

export type BarDatum = {
  label: string;
  value: number;
  /** Marks the column as *now*. At most one should be set. */
  highlight?: boolean;
  /** Screen-reader description; falls back to `${value} on ${label}`. */
  accessibilityLabel?: string;
};

export function BarChart({
  data,
  height = 116,
  formatValue,
}: {
  data: BarDatum[];
  height?: number;
  /** Renders the single direct label above the highlighted column. */
  formatValue?: (value: number) => string;
}) {
  const t = useTokens();
  const max = Math.max(...data.map((d) => d.value), 1);

  return (
    <View>
      <View style={[styles.plot, { height }]}>
        {data.map((d, i) => (
          <Column
            key={`${d.label}-${i}`}
            datum={d}
            index={i}
            fraction={d.value / max}
            plotHeight={height}
            color={d.highlight ? t.accent : t.fillStrong}
            label={d.highlight && formatValue ? formatValue(d.value) : undefined}
            labelColor={t.text2}
          />
        ))}
      </View>
      <View style={[styles.baseline, { backgroundColor: t.separator }]} />
      <View style={styles.labels}>
        {data.map((d, i) => (
          <Text
            key={`${d.label}-${i}`}
            style={[Type.caption, styles.label, { color: d.highlight ? t.text : t.text3 }]}
          >
            {d.label}
          </Text>
        ))}
      </View>
    </View>
  );
}

function Column({
  datum,
  index,
  fraction,
  plotHeight,
  color,
  label,
  labelColor,
}: {
  datum: BarDatum;
  index: number;
  fraction: number;
  plotHeight: number;
  color: string;
  label?: string;
  labelColor: string;
}) {
  const grown = useSharedValue(0);

  // Reserve room for the direct label so the tallest bar can't collide with it.
  const track = plotHeight - 18;
  const target = datum.value === 0 ? ZERO_STUB : Math.max(MIN_BAR, Math.round(fraction * track));

  useEffect(() => {
    grown.value = withDelay(
      index * 45,
      withTiming(target, { duration: 520, easing: Easing.out(Easing.cubic) }),
    );
  }, [target, index, grown]);

  const bar = useAnimatedStyle(() => ({ height: grown.value }));

  return (
    <View
      style={styles.column}
      accessible
      accessibilityLabel={datum.accessibilityLabel ?? `${datum.value} on ${datum.label}`}
    >
      {label != null && (
        <Text style={[Type.captionStrong, { color: labelColor }]} numberOfLines={1}>
          {label}
        </Text>
      )}
      <Animated.View style={[styles.bar, bar, { backgroundColor: color }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  plot: { flexDirection: 'row', alignItems: 'flex-end', gap: 8 },
  column: { flex: 1, alignItems: 'center', justifyContent: 'flex-end', gap: 5, height: '100%' },
  // Rounded data-end, square baseline-end: the bar grows out of the axis, it doesn't float.
  bar: {
    width: '76%',
    borderTopLeftRadius: 5,
    borderTopRightRadius: 5,
    borderCurve: 'continuous',
  },
  baseline: { height: StyleSheet.hairlineWidth, marginTop: 1 },
  labels: { flexDirection: 'row', gap: 8, marginTop: 7 },
  label: { flex: 1, textAlign: 'center' },
});
