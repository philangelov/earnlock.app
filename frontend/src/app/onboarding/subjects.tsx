import { useRouter } from 'expo-router';
import { StyleSheet, Text } from 'react-native';

import { OnboardingStep } from '@/components/onboarding/OnboardingStep';
import { SubjectChips } from '@/components/SubjectChips';
import { allSubjects, chosenCount } from '@/store/content';
import { voice } from '@/store/onboarding';
import { useEarnLock } from '@/store/useEarnLock';
import { Space } from '@/theme/tokens';
import { Type } from '@/theme/type';
import { useTokens } from '@/theme/theme';

export default function SubjectsStep() {
  const t = useTokens();
  const router = useRouter();
  const subj = useEarnLock((s) => s.subj);
  const toggleSubj = useEarnLock((s) => s.toggleSubj);
  const customSubjects = useEarnLock((s) => s.customSubjects);
  const addCustomSubject = useEarnLock((s) => s.addCustomSubject);
  const usage = useEarnLock((s) => s.usage);
  const name = useEarnLock((s) => s.name);

  const v = voice(usage, name);
  const chosen = chosenCount(subj);

  return (
    <OnboardingStep
      step="subjects"
      title={v.subjectsTitle}
      subtitle={v.subjectsSubtitle}
      onBack={() => router.back()}
      ctaDisabled={chosen === 0}
      onCta={() => router.push('/onboarding/commitment')}
    >
      <SubjectChips
        subjects={allSubjects(customSubjects)}
        selected={subj}
        onToggle={toggleSubj}
        onAddCustom={addCustomSubject}
        stagger={35}
        align="center"
      />

      <Text style={[Type.caption, styles.footnote, { color: t.text3 }]}>
        {chosen === 0 ? 'Choose at least one to continue.' : `${chosen} chosen`}
      </Text>
    </OnboardingStep>
  );
}

const styles = StyleSheet.create({
  footnote: { textAlign: 'center', marginTop: Space.xxl },
});
