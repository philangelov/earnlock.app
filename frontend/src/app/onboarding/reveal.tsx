/**
 * The payoff. Two beats: the framing line lands alone, then fades out under the number it was
 * setting up. Both figures are computed from the answer given on the screen-time step, and the
 * footnote says whether that answer was theirs or our average — the claim is checkable, not magic.
 */
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn, FadeInDown, FadeOut } from 'react-native-reanimated';

import { CountUp } from '@/components/onboarding/CountUp';
import { OnboardingStep } from '@/components/onboarding/OnboardingStep';
import { daysLostPerYear, hoursReclaimedPerYear, voice, weeksToGoal } from '@/store/onboarding';
import { useEarnLock } from '@/store/useEarnLock';
import { Radius, Space } from '@/theme/tokens';
import { Type } from '@/theme/type';
import { useTokens } from '@/theme/theme';

/** How long the framing line holds the screen on its own. */
const PREAMBLE_MS = 2200;

export default function RevealStep() {
  const t = useTokens();
  const router = useRouter();
  const [revealed, setRevealed] = useState(false);

  const hoursPerDay = useEarnLock((s) => s.hoursPerDay);
  const hoursEstimated = useEarnLock((s) => s.hoursEstimated);
  const paceMinPerWeek = useEarnLock((s) => s.paceMinPerWeek);
  const usage = useEarnLock((s) => s.usage);
  const name = useEarnLock((s) => s.name);

  const v = voice(usage, name);
  const daysLost = daysLostPerYear(hoursPerDay);
  const reclaimed = hoursReclaimedPerYear(hoursPerDay);
  const weeks = weeksToGoal(hoursPerDay, paceMinPerWeek);

  useEffect(() => {
    const id = setTimeout(() => setRevealed(true), PREAMBLE_MS);
    return () => clearTimeout(id);
  }, []);

  return (
    <View style={[styles.root, { backgroundColor: t.bg }]}>
      {revealed && (
        <Animated.View entering={FadeIn.duration(400).delay(160)} style={styles.root}>
          <OnboardingStep
            step="reveal"
            title={v.family ? `Here’s ${v.who}’s year.` : `Here’s the deal, ${v.who}.`}
            subtitle={
              v.family
                ? `At ${hoursPerDay} hours a day, ${v.who} will spend ${daysLost} full days on a phone this year.`
                : `At ${hoursPerDay} hours a day, you’ll spend ${daysLost} full days on your phone this year.`
            }
            onBack={() => router.back()}
            onCta={() => router.push('/onboarding/notifications')}
            center
          >
            <View style={styles.hero}>
              <Text style={[Type.callout, styles.lead, { color: t.text2 }]}>
                {v.family
                  ? `EarnLock can help ${v.who} win back`
                  : 'EarnLock can help you win back'}
              </Text>

              <View style={styles.number}>
                <CountUp
                  to={reclaimed}
                  delay={240}
                  style={[Type.display, { color: t.accentText }]}
                />
                <Text style={[Type.title2, styles.suffix, { color: t.accentText }]}>hours+</Text>
              </View>

              <Text style={[Type.callout, styles.lead, { color: t.text2 }]}>
                this year — every one of them earned by learning something, at the pace you set:
                about {weeks} {weeks === 1 ? 'week' : 'weeks'} to the goal.
              </Text>

              <Animated.View
                entering={FadeInDown.duration(400).delay(850)}
                style={[styles.footnote, { backgroundColor: t.fill }]}
              >
                <Text style={[Type.caption, styles.footnoteText, { color: t.text3 }]}>
                  {hoursEstimated
                    ? `Based on the ${hoursPerDay} h/day average, until Screen Time reports the real figure`
                    : `Based on the ${hoursPerDay} h/day you reported, and the EarnLock program`}
                </Text>
              </Animated.View>
            </View>
          </OnboardingStep>
        </Animated.View>
      )}

      {/* Rendered last so it stays on top while it fades away. */}
      {!revealed && (
        <Animated.View
          entering={FadeIn.duration(600)}
          exiting={FadeOut.duration(300)}
          style={[StyleSheet.absoluteFill, styles.preamble]}
        >
          <Text style={[Type.title2, styles.preambleText, { color: t.text }]}>
            Some not-so-good news,{'\n'}and some great news.
          </Text>
        </Animated.View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },

  preamble: { alignItems: 'center', justifyContent: 'center', paddingHorizontal: Space.xxl },
  preambleText: { textAlign: 'center' },

  hero: { alignItems: 'center' },
  lead: { textAlign: 'center' },
  number: { flexDirection: 'row', alignItems: 'flex-end', gap: 6, marginVertical: Space.sm },
  suffix: { paddingBottom: 10 },
  footnote: {
    marginTop: Space.xxl,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: Radius.pill,
  },
  footnoteText: { textAlign: 'center' },
});
