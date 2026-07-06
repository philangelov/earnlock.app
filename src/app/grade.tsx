import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Icon } from '@/components/Icon';
import { PrimaryButton } from '@/components/PrimaryButton';
import { Screen } from '@/components/Screen';
import { Font } from '@/theme/tokens';
import { useTokens } from '@/theme/theme';
import { useEarnLock } from '@/store/useEarnLock';

export default function GradeScreen() {
  const t = useTokens();
  const router = useRouter();
  const grade = useEarnLock((s) => s.grade);
  const gradeUp = useEarnLock((s) => s.gradeUp);
  const gradeDown = useEarnLock((s) => s.gradeDown);

  const gradeHint =
    grade <= 4
      ? 'Primary · gentle questions'
      : grade <= 7
        ? 'Middle school · balanced'
        : grade <= 10
          ? 'High school · challenging'
          : 'Upper high school · advanced';

  return (
    <Screen scroll contentStyle={styles.content}>
      <Text style={[styles.title, { color: t.text }]}>What grade are{'\n'}you in?</Text>
      <Text style={[styles.subtitle, { color: t.text2 }]}>
        This sets how hard your AI questions are.
      </Text>

      <View style={styles.middle}>
        <View style={styles.stepper}>
          <Pressable
            onPress={gradeDown}
            style={[styles.roundBtn, { backgroundColor: t.primarySoft }]}>
            <Icon name="minus" size={26} color={t.primary} strokeWidth={3} />
          </Pressable>

          <View style={styles.numberBlock}>
            <Text style={[styles.gradeNumber, { color: t.text }]}>{grade}</Text>
            <Text style={[styles.gradeLabel, { color: t.text3 }]}>GRADE</Text>
          </View>

          <Pressable
            onPress={gradeUp}
            style={[styles.roundBtn, { backgroundColor: t.primarySoft }]}>
            <Icon name="plus" size={26} color={t.primary} strokeWidth={3} />
          </Pressable>
        </View>

        <View style={[styles.hint, { backgroundColor: t.surface2 }]}>
          <Text style={[styles.hintText, { color: t.text2 }]}>{gradeHint}</Text>
        </View>
      </View>

      <PrimaryButton label="Continue" onPress={() => router.push('/subjects')} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingTop: 6, paddingHorizontal: 26, paddingBottom: 24 },
  title: {
    fontFamily: Font.baloo800,
    fontSize: 27,
    lineHeight: 30.24,
    letterSpacing: -0.3,
    marginTop: 18,
  },
  subtitle: { fontFamily: Font.nunito600, fontSize: 15, marginTop: 9, lineHeight: 21 },
  middle: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 26 },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: 26 },
  roundBtn: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  numberBlock: { alignItems: 'center', minWidth: 96 },
  gradeNumber: { fontFamily: Font.baloo800, fontSize: 80, textAlign: 'center' },
  gradeLabel: {
    fontFamily: Font.nunito800,
    fontSize: 12,
    letterSpacing: 1.5,
    marginTop: 6,
    textAlign: 'center',
  },
  hint: { paddingVertical: 9, paddingHorizontal: 16, borderRadius: 999 },
  hintText: { fontFamily: Font.nunito800, fontSize: 13.5 },
});
