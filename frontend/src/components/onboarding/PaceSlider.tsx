/**
 * PaceSlider — how many minutes of daily screen time to give up each week. Three marks (tortoise,
 * hare, flame) name the ends and the middle, and the pill below reads the value back as a
 * judgement: Gentle, Recommended, Ambitious.
 *
 * The marks are positioned from the measured track geometry rather than spaced evenly, because the
 * thumb's centre only travels between `DRAG_THUMB/2` and `width - DRAG_THUMB/2`. Spacing them with
 * `space-between` would leave each end mark half a thumb wide of the value it names.
 */
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';

import { Sym } from '@/components/Sym';
import { PACE_MAX, PACE_MIN, PACE_STEP, PACE_STOPS, PACE_TONE, paceTone } from '@/store/onboarding';
import { Radius, Space } from '@/theme/tokens';
import { Type } from '@/theme/type';
import { useTokens } from '@/theme/theme';

import { DRAG_THUMB, DragTrack } from './DragTrack';

/** Wide enough for "10 min" — each mark is centred on its position. */
const MARK = 64;

export function PaceSlider({
  value,
  onChange,
}: {
  value: number;
  onChange: (value: number) => void;
}) {
  const t = useTokens();
  const [width, setWidth] = useState(0);

  const tone = paceTone(value);
  const recommended = tone === 'recommended';

  const last = PACE_STOPS.length - 1;
  const travel = Math.max(0, width - DRAG_THUMB);
  /** Centre of mark `i`, in the same coordinates as the thumb. */
  const markX = (i: number) => DRAG_THUMB / 2 + (i / last) * travel - MARK / 2;

  // Which of the three marks the value currently sits closest to.
  const nearest = Math.round(((value - PACE_MIN) / (PACE_MAX - PACE_MIN)) * last);

  return (
    <View>
      <Text style={[Type.overline, styles.caption, { color: t.text3 }]}>
        SCREEN TIME GIVEN UP PER WEEK
      </Text>

      <View style={styles.value}>
        <Text style={[Type.display, { color: t.text }]}>{value}</Text>
        <Text style={[Type.title2, styles.unit, { color: t.text2 }]}>min</Text>
      </View>

      <View style={styles.slider} onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
        <View style={styles.marks} pointerEvents="none">
          {width > 0 &&
            PACE_STOPS.map((stop, i) => (
              // `SymName` allows a per-platform object, so it isn't a valid key — the labels are.
              <View key={stop.label} style={[styles.mark, { left: markX(i) }]}>
                <Sym
                  name={stop.icon}
                  size={i === nearest ? 26 : 22}
                  color={i === nearest ? t.text : t.text3}
                />
              </View>
            ))}
        </View>

        {/* DragTrack fills a row (it's `flex:1`); in a column it would stretch vertically. */}
        <View style={styles.trackRow}>
          <DragTrack
            value={value}
            min={PACE_MIN}
            max={PACE_MAX}
            step={PACE_STEP}
            onChange={onChange}
            accessibilityLabel="Screen time given up per week, in minutes"
          />
        </View>

        <View style={styles.labels} pointerEvents="none">
          {width > 0 &&
            PACE_STOPS.map((stop, i) => (
              <View key={stop.label} style={[styles.mark, { left: markX(i) }]}>
                <Text style={[Type.footnote, { color: t.text3 }]}>{stop.label}</Text>
              </View>
            ))}
        </View>
      </View>

      <Animated.View
        key={tone}
        entering={FadeIn.duration(180)}
        style={[styles.pill, { backgroundColor: recommended ? t.accentSoft : t.fill }]}
      >
        <Text
          style={[
            Type.calloutStrong,
            styles.centered,
            { color: recommended ? t.accentText : t.text },
          ]}
        >
          {PACE_TONE[tone].label}
        </Text>
        <Text style={[Type.caption, styles.centered, { color: t.text3 }]}>
          {PACE_TONE[tone].note}
        </Text>
      </Animated.View>
    </View>
  );
}

const MARKS_H = 30;
const LABELS_H = 20;

const styles = StyleSheet.create({
  caption: { textAlign: 'center' },
  value: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'center', gap: 6 },
  unit: { paddingBottom: 10 },

  // The track sits between the two mark bands, which reserve their own height so nothing shifts
  // when the icons resize.
  slider: { marginTop: Space.xl, paddingTop: MARKS_H, paddingBottom: LABELS_H },
  trackRow: { flexDirection: 'row' },
  marks: { position: 'absolute', top: 0, left: 0, right: 0, height: MARKS_H },
  labels: { position: 'absolute', bottom: 0, left: 0, right: 0, height: LABELS_H },
  mark: {
    position: 'absolute',
    bottom: 0,
    width: MARK,
    alignItems: 'center',
    justifyContent: 'flex-end',
  },

  pill: {
    alignItems: 'center',
    gap: 2,
    marginTop: Space.xxl,
    paddingVertical: Space.md,
    paddingHorizontal: Space.lg,
    borderRadius: Radius.control,
    borderCurve: 'continuous',
  },
  centered: { textAlign: 'center' },
});
