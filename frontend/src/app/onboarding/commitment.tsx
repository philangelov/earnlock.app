import { useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { ChoiceRow } from '@/components/onboarding/ChoiceRow';
import { OnboardingStep } from '@/components/onboarding/OnboardingStep';
import { COMMITMENTS, voice } from '@/store/onboarding';
import { useEarnLock } from '@/store/useEarnLock';
import { Space } from '@/theme/tokens';

/**
 * The answer here is load-bearing: `firm` makes picking at least one app to shield a requirement
 * on the final step, and each option rewords the plan the calculating screen claims to build.
 */
export default function CommitmentStep() {
  const router = useRouter();
  const commitment = useEarnLock((s) => s.commitment);
  const setCommitment = useEarnLock((s) => s.setCommitment);
  const usage = useEarnLock((s) => s.usage);
  const name = useEarnLock((s) => s.name);

  const v = voice(usage, name);

  return (
    <OnboardingStep
      step="commitment"
      title={v.commitmentTitle}
      subtitle="This decides how hard the shield bites on day one."
      onBack={() => router.back()}
      ctaDisabled={commitment == null}
      onCta={() => router.push('/onboarding/calculating')}
    >
      <View style={styles.list}>
        {COMMITMENTS.map((c, i) => (
          <ChoiceRow
            key={c.key}
            label={c.label}
            desc={c.desc}
            icon={c.icon}
            selected={commitment === c.key}
            onPress={() => setCommitment(c.key)}
            delay={i * 60}
          />
        ))}
      </View>
    </OnboardingStep>
  );
}

const styles = StyleSheet.create({
  list: { gap: Space.sm },
});
