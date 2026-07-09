import { useRouter } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

import { ChoiceRow } from '@/components/onboarding/ChoiceRow';
import { OnboardingStep } from '@/components/onboarding/OnboardingStep';
import { HABITS, voice } from '@/store/onboarding';
import { useEarnLock } from '@/store/useEarnLock';
import { Space } from '@/theme/tokens';
import { Type } from '@/theme/type';
import { useTokens } from '@/theme/theme';

export default function HabitsStep() {
  const t = useTokens();
  const router = useRouter();
  const habits = useEarnLock((s) => s.habits);
  const toggleHabit = useEarnLock((s) => s.toggleHabit);
  const usage = useEarnLock((s) => s.usage);
  const name = useEarnLock((s) => s.name);

  const v = voice(usage, name);

  return (
    <OnboardingStep
      step="habits"
      title={v.habitsTitle}
      subtitle={v.habitsSubtitle}
      onBack={() => router.back()}
      ctaDisabled={habits.length === 0}
      onCta={() => router.push('/onboarding/subjects')}
    >
      <View style={styles.list}>
        {HABITS.map((h, i) => (
          <ChoiceRow
            key={h.key}
            label={h.label}
            multi
            selected={habits.includes(h.key)}
            onPress={() => toggleHabit(h.key)}
            delay={i * 40}
          />
        ))}
      </View>

      <Text style={[Type.caption, styles.footnote, { color: t.text3 }]}>
        These decide what EarnLock says on the lock screen, and when.
      </Text>
    </OnboardingStep>
  );
}

const styles = StyleSheet.create({
  list: { gap: Space.sm },
  footnote: { textAlign: 'center', marginTop: Space.xl },
});
