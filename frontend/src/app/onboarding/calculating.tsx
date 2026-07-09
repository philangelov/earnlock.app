/**
 * The interstitial between the questions and the payoff. Nothing is really being computed — but
 * the steps are the user's own answers read back, and each one checks itself off as the bar
 * crosses it, so the pause states what the plan is made of instead of miming progress over
 * nothing.
 *
 * The percentage, the bar and the active step all read from a single shared value, so they can
 * never disagree by a frame.
 */
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  FadeIn,
  runOnJS,
  useAnimatedReaction,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { Screen } from '@/components/Screen';
import { Sym } from '@/components/Sym';
import { SUBJECT_DEFS } from '@/store/content';
import { CALCULATING_MS, calculatingSteps } from '@/store/onboarding';
import { useEarnLock } from '@/store/useEarnLock';
import { Radius, Space } from '@/theme/tokens';
import { Type } from '@/theme/type';
import { useTokens } from '@/theme/theme';

export default function CalculatingStep() {
  const t = useTokens();
  const router = useRouter();
  const [percent, setPercent] = useState(0);

  const habits = useEarnLock((s) => s.habits);
  const grade = useEarnLock((s) => s.grade);
  const subj = useEarnLock((s) => s.subj);
  const commitment = useEarnLock((s) => s.commitment);

  const steps = calculatingSteps({
    habits,
    grade,
    subjectCount: SUBJECT_DEFS.filter((s) => subj[s.key]).length,
    commitment,
  });

  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withTiming(1, { duration: CALCULATING_MS, easing: Easing.inOut(Easing.quad) });
  }, [progress]);

  useAnimatedReaction(
    () => Math.round(progress.value * 100),
    (next, previous) => {
      if (next !== previous) runOnJS(setPercent)(next);
    },
  );

  useEffect(() => {
    // A short beat after the bar fills, so the last step is seen ticking off.
    const done = setTimeout(() => router.replace('/onboarding/reveal'), CALCULATING_MS + 420);
    return () => clearTimeout(done);
  }, [router]);

  const fill = useAnimatedStyle(() => ({ width: `${progress.value * 100}%` }));

  // The step the bar is currently inside; everything before it is finished.
  const active = Math.min(steps.length - 1, Math.floor((percent / 100) * steps.length));

  return (
    <Screen>
      <View style={styles.root}>
        <Text style={[Type.overline, styles.eyebrow, { color: t.text3 }]}>BUILDING YOUR PLAN</Text>

        <Text style={[Type.display, styles.percent, { color: t.text }]}>{percent}%</Text>

        <View
          style={[styles.track, { backgroundColor: t.fill }]}
          accessibilityRole="progressbar"
          accessibilityLabel="Building your plan"
          accessibilityValue={{ min: 0, max: 100, now: percent }}
        >
          <Animated.View style={[styles.fill, fill, { backgroundColor: t.accent }]} />
        </View>

        <View style={styles.steps}>
          {steps.map((label, i) => {
            const done = i < active || percent >= 100;
            const current = i === active && percent < 100;
            return (
              <Animated.View
                key={label}
                entering={FadeIn.duration(360).delay(i * 90)}
                style={styles.step}
              >
                <View
                  style={[
                    styles.dot,
                    done
                      ? { backgroundColor: t.accent, borderColor: t.accent }
                      : { borderColor: current ? t.accent : t.separator },
                  ]}
                >
                  {done && (
                    <Animated.View entering={FadeIn.duration(140)}>
                      <Sym name="checkmark" size={10} color={t.onAccent} weight="bold" />
                    </Animated.View>
                  )}
                </View>
                <Text
                  style={[Type.subhead, { color: done ? t.text2 : current ? t.text : t.text3 }]}
                  numberOfLines={1}
                >
                  {label}
                </Text>
              </Animated.View>
            );
          })}
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: 'center', paddingHorizontal: Space.xxl },
  eyebrow: { textAlign: 'center' },
  percent: { textAlign: 'center', marginTop: Space.xs },

  track: { height: 4, borderRadius: Radius.pill, overflow: 'hidden', marginTop: Space.xl },
  fill: { height: '100%', borderRadius: Radius.pill },

  steps: { gap: Space.lg, marginTop: Space.xxxl },
  step: { flexDirection: 'row', alignItems: 'center', gap: Space.md },
  dot: {
    width: 20,
    height: 20,
    borderRadius: Radius.pill,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
