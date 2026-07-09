import { useRouter } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';

import { OnboardingStep } from '@/components/onboarding/OnboardingStep';
import { WheelPicker } from '@/components/onboarding/WheelPicker';
import { AGE_MAX, AGE_MIN, gradeForAge, voice } from '@/store/onboarding';
import { useEarnLock } from '@/store/useEarnLock';
import { Radius, Space } from '@/theme/tokens';
import { Type } from '@/theme/type';
import { useTokens } from '@/theme/theme';

const AGES = Array.from({ length: AGE_MAX - AGE_MIN + 1 }, (_, i) => AGE_MIN + i);

export default function AgeStep() {
  const t = useTokens();
  const router = useRouter();
  const age = useEarnLock((s) => s.age);
  const setAge = useEarnLock((s) => s.setAge);
  const usage = useEarnLock((s) => s.usage);
  const name = useEarnLock((s) => s.name);

  const v = voice(usage, name);
  const grade = gradeForAge(age);

  return (
    <OnboardingStep
      step="age"
      title={v.ageTitle}
      subtitle={v.ageSubtitle}
      onBack={() => router.back()}
      onCta={() => router.push('/onboarding/screentime')}
      center
    >
      <WheelPicker values={AGES} value={age} onChange={setAge} itemHeight={50} />

      {/* The derived value, shown live — so the wheel visibly does something. */}
      <View style={styles.chipRow}>
        <Animated.View
          key={grade}
          entering={FadeIn.duration(200)}
          style={[styles.chip, { backgroundColor: t.accentSoft }]}
        >
          <Text style={[Type.footnoteStrong, { color: t.accentText }]}>
            Questions at grade {grade} level
          </Text>
        </Animated.View>
      </View>
    </OnboardingStep>
  );
}

const styles = StyleSheet.create({
  chipRow: { alignItems: 'center', marginTop: Space.xxl },
  chip: { paddingVertical: 8, paddingHorizontal: 14, borderRadius: Radius.pill },
});
