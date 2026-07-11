/**
 * EarnDial — the one thing on the Today screen.
 *
 * A single ring standing free on the page rather than boxed inside a card: the screen's
 * whole job is to answer "am I locked, and for how long", and a card around the answer
 * only adds an edge to look at. Locked, the ring is an empty monochrome track around a
 * lock — restraint reads as calm, and red would read as punishment. Unlocked, the arc
 * fills with the accent, a soft aura breathes just outside it, and the numerals count
 * down in tabular figures so nothing jitters.
 *
 * The aura is an SVG radial gradient that is transparent everywhere inside the ring and
 * peaks just beyond its outer edge. Two earlier attempts got this wrong in ways worth
 * remembering: a CSS `radial-gradient` behind the ring filled the dial's interior with a
 * flat pale disc (its stops are measured to the box's farthest *corner*, not to the
 * ring), and a hairline circle drawn to "give the ring an edge" simply read as a stray
 * mark floating around it. The inside of the dial belongs to the number.
 */
import { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedProps,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { Circle, Defs, G, RadialGradient, Stop, Svg } from 'react-native-svg';

import { Sym } from '@/components/Sym';
import { Type } from '@/theme/type';
import { useTokens } from '@/theme/theme';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

/** Diameter of the ring itself. */
const SIZE = 244;
const STROKE = 14;
/** Slack around the ring for the aura to fade into. Not part of the ring's geometry. */
const BLEED = 36;

const CANVAS = SIZE + BLEED * 2;
const CENTER = CANVAS / 2;
const RADIUS = (SIZE - STROKE) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;
/** Where the ring's outer edge falls, as a fraction of the canvas's radius. */
const RING_EDGE = SIZE / 2 / CENTER;

export function EarnDial({
  locked,
  /** `M:SS` while unlocked; ignored when locked. */
  timeLabel,
  /** 0..1 — how much of a full lesson's reward is still in the bank. */
  progress,
}: {
  locked: boolean;
  timeLabel: string;
  progress: number;
}) {
  const t = useTokens();

  const swept = useSharedValue(0);
  const breath = useSharedValue(0);

  const target = locked ? 0 : Math.min(1, Math.max(0, progress));

  useEffect(() => {
    swept.value = withDelay(
      120,
      withTiming(target, { duration: 1000, easing: Easing.out(Easing.cubic) }),
    );
  }, [target, swept]);

  // The aura breathes only while time is actually running out. A locked screen is still.
  useEffect(() => {
    if (locked) {
      breath.value = withTiming(0, { duration: 400 });
      return;
    }
    breath.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 2200, easing: Easing.inOut(Easing.quad) }),
        withTiming(0, { duration: 2200, easing: Easing.inOut(Easing.quad) }),
      ),
      -1,
      false,
    );
  }, [locked, breath]);

  const arc = useAnimatedProps(() => ({
    strokeDashoffset: CIRCUMFERENCE * (1 - swept.value),
  }));

  const aura = useAnimatedProps(() => ({ opacity: 0.5 + breath.value * 0.5 }));

  return (
    <View style={styles.root}>
      <Svg width={CANVAS} height={CANVAS}>
        <Defs>
          <RadialGradient id="earnDialAura" cx="50%" cy="50%" r="50%">
            {/* Nothing at all inside the ring… */}
            <Stop offset={RING_EDGE * 0.9} stopColor={t.accent} stopOpacity={0} />
            {/* …a soft bloom hugging its outer edge… */}
            <Stop offset={RING_EDGE * 1.06} stopColor={t.accent} stopOpacity={0.22} />
            {/* …fading out well before the canvas ends, so there is no visible boundary. */}
            <Stop offset={1} stopColor={t.accent} stopOpacity={0} />
          </RadialGradient>
        </Defs>

        {!locked && (
          <AnimatedCircle
            cx={CENTER}
            cy={CENTER}
            r={CENTER}
            fill="url(#earnDialAura)"
            animatedProps={aura}
          />
        )}

        {/* Rotate the whole ring rather than the arc, so the track's seam hides under it. */}
        <G rotation={-90} origin={`${CENTER}, ${CENTER}`}>
          <Circle
            cx={CENTER}
            cy={CENTER}
            r={RADIUS}
            fill="none"
            stroke={t.fill}
            strokeWidth={STROKE}
          />
          {!locked && (
            <AnimatedCircle
              cx={CENTER}
              cy={CENTER}
              r={RADIUS}
              fill="none"
              stroke={t.accent}
              strokeWidth={STROKE}
              strokeLinecap="round"
              strokeDasharray={CIRCUMFERENCE}
              animatedProps={arc}
            />
          )}
        </G>
      </Svg>

      {/* Deliberately not animated in. The ring's sweep and the aura carry the motion;
          the number itself is the whole reason for the screen and must never depend on
          an animation having finished. See `Appear` for the longer version of that. */}
      <View style={[StyleSheet.absoluteFill, styles.center]} pointerEvents="none">
        {locked ? (
          <View style={styles.center}>
            <View style={[styles.lockWell, { backgroundColor: t.fill }]}>
              <Sym name="lock.fill" size={24} color={t.text2} />
            </View>
            <Text style={[Type.title2, { color: t.text, marginTop: 14 }]}>Locked</Text>
            <Text style={[Type.footnote, { color: t.text3, marginTop: 1 }]}>
              Nothing earned yet
            </Text>
          </View>
        ) : (
          <View style={styles.center}>
            <Text style={[Type.dial, { color: t.text }]}>{timeLabel}</Text>
            <Text style={[Type.footnote, { color: t.text3, marginTop: 2 }]}>left today</Text>
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  // The canvas is larger than the ring, so pull the extra back in: the dial must occupy
  // exactly the ring's footprint in the page's layout, not the aura's.
  root: {
    width: SIZE,
    height: SIZE,
    alignSelf: 'center',
    alignItems: 'center',
    justifyContent: 'center',
  },
  center: { alignItems: 'center', justifyContent: 'center' },
  lockWell: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
