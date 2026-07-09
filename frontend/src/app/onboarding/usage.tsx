import { useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { ChoiceRow } from '@/components/onboarding/ChoiceRow';
import { OnboardingStep } from '@/components/onboarding/OnboardingStep';
import { USAGE_MODES } from '@/store/onboarding';
import { useEarnLock } from '@/store/useEarnLock';
import { Space } from '@/theme/tokens';

/**
 * Asked first, because it decides who the learner is — and therefore whether every question that
 * follows is about the person holding the phone or about their child.
 */
export default function UsageStep() {
  const router = useRouter();
  const usage = useEarnLock((s) => s.usage);
  const setUsage = useEarnLock((s) => s.setUsage);

  return (
    <OnboardingStep
      step="usage"
      title="Who are you setting up EarnLock for?"
      subtitle="It changes who the questions are written for."
      onBack={() => router.back()}
      ctaDisabled={usage == null}
      onCta={() => router.push('/onboarding/name')}
    >
      <View style={styles.list}>
        {USAGE_MODES.map((m, i) => (
          <ChoiceRow
            key={m.key}
            label={m.label}
            desc={m.desc}
            icon={m.icon}
            selected={usage === m.key}
            onPress={() => setUsage(m.key)}
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
