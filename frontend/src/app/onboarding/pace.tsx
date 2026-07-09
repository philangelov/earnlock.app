import { useRouter } from 'expo-router';
import { StyleSheet } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';

import { OnboardingStep } from '@/components/onboarding/OnboardingStep';
import { PaceSlider } from '@/components/onboarding/PaceSlider';
import { weeksToGoal } from '@/store/onboarding';
import { useEarnLock } from '@/store/useEarnLock';
import { Space } from '@/theme/tokens';
import { Type } from '@/theme/type';
import { useTokens } from '@/theme/theme';

/**
 * Sits directly after the screen-time question, because the number it works on is the one just
 * given — and the answer decides how long the reveal is allowed to promise.
 */
export default function PaceStep() {
  const t = useTokens();
  const router = useRouter();

  const hoursPerDay = useEarnLock((s) => s.hoursPerDay);
  const paceMinPerWeek = useEarnLock((s) => s.paceMinPerWeek);
  const setPace = useEarnLock((s) => s.setPace);

  const weeks = weeksToGoal(hoursPerDay, paceMinPerWeek);

  return (
    <OnboardingStep
      step="pace"
      title="How fast do you want to reach your goal?"
      onBack={() => router.back()}
      onCta={() => router.push('/onboarding/habits')}
      center
    >
      <PaceSlider value={paceMinPerWeek} onChange={setPace} />

      <Animated.Text
        key={weeks}
        entering={FadeIn.duration(200)}
        style={[Type.footnote, styles.weeks, { color: t.text2 }]}
      >
        You’ll reach your goal in about {weeks} {weeks === 1 ? 'week' : 'weeks'}.
      </Animated.Text>
    </OnboardingStep>
  );
}

const styles = StyleSheet.create({
  weeks: { textAlign: 'center', marginTop: Space.lg },
});
