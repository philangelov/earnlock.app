/**
 * Grade & subjects — the Profile edit screen. First-run collects these through the onboarding
 * flow (age implies the grade, `onboarding/subjects` picks the subjects), so this screen exists
 * purely to change them afterwards: always titled, always "Save".
 */
import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { SectionHeader } from '@/components/List';
import { Screen } from '@/components/Screen';
import { StepHeader } from '@/components/StepHeader';
import { SubjectChips } from '@/components/SubjectChips';
import { Sym } from '@/components/Sym';
import { haptic } from '@/lib/haptics';
import { allSubjects, chosenCount } from '@/store/content';
import { useEarnLock } from '@/store/useEarnLock';
import { Radius, Space } from '@/theme/tokens';
import { Type } from '@/theme/type';
import { useTokens } from '@/theme/theme';

export default function SetupScreen() {
  const t = useTokens();
  const router = useRouter();

  const grade = useEarnLock((s) => s.grade);
  const gradeUp = useEarnLock((s) => s.gradeUp);
  const gradeDown = useEarnLock((s) => s.gradeDown);
  const subj = useEarnLock((s) => s.subj);
  const toggleSubj = useEarnLock((s) => s.toggleSubj);
  const customSubjects = useEarnLock((s) => s.customSubjects);
  const addCustomSubject = useEarnLock((s) => s.addCustomSubject);

  const chosen = chosenCount(subj);

  return (
    <Screen
      scroll
      contentStyle={styles.content}
      header={
        <View style={styles.header}>
          <StepHeader step={0} total={1} title="Grade & subjects" onBack={() => router.back()} />
        </View>
      }
      footer={<Button label="Save" disabled={chosen === 0} onPress={() => router.back()} />}
      footerStyle={styles.footer}
    >
      <Text style={[Type.title1, { color: t.text, marginTop: Space.lg }]}>A bit about you</Text>
      <Text style={[Type.body, { color: t.text2, marginTop: 6 }]}>
        This tunes the questions to the right level and topics.
      </Text>

      {/* Grade stepper */}
      <SectionHeader title="Grade level" style={styles.sectionHeader} />
      <Card style={styles.gradeCard}>
        <View>
          <Text style={[Type.headline, { color: t.text }]}>Grade {grade}</Text>
          <Text style={[Type.footnote, { color: t.text3 }]}>
            Ages roughly {grade + 5}–{grade + 6}
          </Text>
        </View>
        <View style={styles.stepper}>
          <StepBtn icon="minus" label="Decrease grade" disabled={grade <= 1} onPress={gradeDown} />
          <Text style={[Type.title3, styles.gradeValue, { color: t.text }]}>{grade}</Text>
          <StepBtn icon="plus" label="Increase grade" disabled={grade >= 12} onPress={gradeUp} />
        </View>
      </Card>

      {/* Subjects */}
      <SectionHeader title={`Subjects · ${chosen} chosen`} style={styles.sectionHeader} />
      <SubjectChips
        subjects={allSubjects(customSubjects)}
        selected={subj}
        onToggle={toggleSubj}
        onAddCustom={addCustomSubject}
      />
    </Screen>
  );
}

function StepBtn({
  icon,
  label,
  onPress,
  disabled,
}: {
  icon: 'plus' | 'minus';
  label: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  const t = useTokens();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!disabled }}
      hitSlop={{ top: 8, bottom: 8, left: 6, right: 6 }}
      disabled={disabled}
      onPress={() => {
        haptic.select();
        onPress();
      }}
      style={({ pressed }) => [
        styles.stepBtn,
        { backgroundColor: t.fill },
        pressed && !disabled && { opacity: 0.6 },
        disabled && { opacity: 0.4 },
      ]}
    >
      <Sym name={icon} size={16} color={t.text} weight="bold" />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: Space.xl, paddingTop: Space.sm },
  content: { paddingHorizontal: Space.xl, paddingBottom: Space.xxl },
  footer: { paddingHorizontal: Space.xl, paddingTop: Space.md },
  sectionHeader: { marginTop: Space.xxl, marginBottom: Space.sm },

  gradeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: Space.lg,
  },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: Space.md },
  gradeValue: { minWidth: 26, textAlign: 'center', fontVariant: ['tabular-nums'] },
  stepBtn: {
    width: 34,
    height: 34,
    borderRadius: Radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
