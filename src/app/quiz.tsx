import { useRouter } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View, type ViewStyle } from 'react-native';

import { Icon } from '@/components/Icon';
import { PrimaryButton } from '@/components/PrimaryButton';
import { Screen } from '@/components/Screen';
import { MC_COUNT, QUESTIONS } from '@/store/content';
import { Font } from '@/theme/tokens';
import { useEarnLock } from '@/store/useEarnLock';
import { useTokens } from '@/theme/theme';

export default function QuizScreen() {
  const t = useTokens();
  const router = useRouter();

  const qIndex = useEarnLock((s) => s.qIndex);
  const selected = useEarnLock((s) => s.selected);
  const checked = useEarnLock((s) => s.checked);
  const quizVar = useEarnLock((s) => s.quizVar);
  const pick = useEarnLock((s) => s.pick);
  const check = useEarnLock((s) => s.check);
  const nextQuestion = useEarnLock((s) => s.nextQuestion);

  const q = QUESTIONS[Math.min(qIndex, QUESTIONS.length - 1)];
  const correct = selected === q.answer;

  const qProg = Math.min(100, ((qIndex + (checked ? 1 : 0)) / (MC_COUNT + 1)) * 100);
  const qDot = q.tag === 'BIOLOGY' ? t.success : t.gold;

  const quizBack = () => router.push('/journey');
  const quizClose = () => router.push('/home');

  const quizBtnHandler = () => {
    if (!checked) {
      check();
      return;
    }
    // checked -> advance
    if (selected !== q.answer) {
      router.push('/learning');
      return;
    }
    const ni = qIndex + 1;
    nextQuestion();
    if (ni >= MC_COUNT) router.push('/recap');
  };

  const quizBtnLabel = checked ? (correct ? 'Continue →' : 'See why →') : 'Check';
  const quizFbText = correct ? 'Correct — nice one!' : "Not quite. Let's learn why.";

  // Per-option state style (shared by both layouts).
  const optState = (i: number): ViewStyle => {
    const isAnswer = i === q.answer;
    const isPicked = selected === i;
    if (!checked) {
      if (isPicked) {
        return { borderWidth: 2, borderColor: t.primary, backgroundColor: t.primarySoft };
      }
      return { borderWidth: 2, borderColor: t.border, backgroundColor: t.surface };
    }
    if (isAnswer) {
      return { borderWidth: 2, borderColor: t.success, backgroundColor: t.successSoft };
    }
    if (isPicked) {
      return { borderWidth: 2, borderColor: t.danger, backgroundColor: t.dangerSoft };
    }
    return { borderWidth: 2, borderColor: t.border, backgroundColor: t.surface, opacity: 0.5 };
  };

  // The check / x badge for an option (null when it shouldn't show one).
  const optBadge = (i: number, size: number) => {
    if (!checked) return null;
    if (i === q.answer) return <Icon name="checkCircle" size={size} color={t.success} />;
    if (selected === i) return <Icon name="xCircle" size={size} color={t.danger} />;
    return null;
  };

  const renderOptionA = (i: number) => {
    const opt = q.opts[i];
    return (
      <Pressable
        key={i}
        onPress={() => pick(i)}
        style={({ pressed }) => [
          styles.optA,
          optState(i),
          pressed && !checked && styles.pressScale,
        ]}>
        <Text style={styles.emojiA}>{opt.e}</Text>
        <Text style={[styles.optAText, { color: t.text }]}>{opt.t}</Text>
        {optBadge(i, 22)}
      </Pressable>
    );
  };

  const renderOptionB = (i: number) => {
    const opt = q.opts[i];
    const badge = optBadge(i, 20);
    return (
      <Pressable
        key={i}
        onPress={() => pick(i)}
        style={({ pressed }) => [
          styles.optB,
          optState(i),
          pressed && !checked && styles.pressScale,
        ]}>
        <Text style={styles.emojiB}>{opt.e}</Text>
        <Text style={[styles.optBText, { color: t.text }]}>{opt.t}</Text>
        {badge != null && <View style={styles.badgeB}>{badge}</View>}
      </Pressable>
    );
  };

  // Chunk options into rows of two for the grid layout.
  const gridRows: number[][] = [];
  for (let i = 0; i < q.opts.length; i += 2) {
    gridRows.push(q.opts.slice(i, i + 2).map((_, k) => i + k));
  }

  return (
    <Screen bottomInset>
      {/* Progress */}
      <View style={[styles.progressTrack, { backgroundColor: t.surface2 }]}>
        <View style={[styles.progressFill, { width: `${qProg}%`, backgroundColor: t.primary }]} />
      </View>

      {/* Header */}
      <View style={styles.header}>
        <Pressable
          onPress={quizBack}
          style={({ pressed }) => [styles.iconBtn, pressed && styles.pressDim]}>
          <Icon name="chevronLeft" size={22} color={t.text2} />
        </Pressable>
        <Pressable
          onPress={quizClose}
          style={({ pressed }) => [styles.iconBtn, pressed && styles.pressDim]}>
          <Icon name="close" size={21} color={t.text2} />
        </Pressable>
      </View>

      {/* Body */}
      <ScrollView
        style={styles.body}
        contentContainerStyle={styles.bodyContent}
        showsVerticalScrollIndicator={false}>
        <View style={styles.tagRow}>
          <View style={[styles.dot, { backgroundColor: qDot }]} />
          <Text style={[styles.tagText, { color: qDot }]}>{q.tag}</Text>
        </View>

        <Text style={[styles.qText, { color: t.text }]}>{q.q}</Text>

        <View style={styles.spacer} />

        {quizVar === 'A' ? (
          <View style={styles.optionsA}>{q.opts.map((_, i) => renderOptionA(i))}</View>
        ) : (
          <View style={styles.optionsB}>
            {gridRows.map((row, r) => (
              <View key={r} style={styles.gridRow}>
                {row.map((i) => renderOptionB(i))}
              </View>
            ))}
          </View>
        )}
      </ScrollView>

      {/* Footer */}
      <View style={styles.footer}>
        {checked && (
          <View
            style={[
              styles.fbBar,
              { backgroundColor: correct ? t.successSoft : t.dangerSoft },
            ]}>
            <Text style={[styles.fbText, { color: correct ? t.success : t.danger }]}>
              {quizFbText}
            </Text>
          </View>
        )}
        <PrimaryButton
          label={quizBtnLabel}
          disabled={!(checked || selected != null)}
          onPress={quizBtnHandler}
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  progressTrack: {
    height: 6,
    marginTop: 2,
    marginHorizontal: 20,
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressFill: { height: '100%', borderRadius: 3 },

  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 13,
    paddingHorizontal: 18,
    paddingBottom: 2,
  },
  iconBtn: { width: 34, height: 34, alignItems: 'center', justifyContent: 'center' },
  pressDim: { opacity: 0.55 },

  body: { flex: 1 },
  bodyContent: { flexGrow: 1, paddingTop: 6, paddingHorizontal: 22 },

  tagRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  dot: { width: 9, height: 9, borderRadius: 4.5 },
  tagText: { fontFamily: Font.nunito800, fontSize: 12, letterSpacing: 1 },

  qText: { fontFamily: Font.baloo700, fontSize: 23, lineHeight: 28.52, marginTop: 12 },

  spacer: { flex: 1, minHeight: 18 },

  // List (variant A)
  optionsA: { gap: 11, marginBottom: 4 },
  optA: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 13,
    paddingVertical: 15,
    paddingHorizontal: 17,
    borderRadius: 16,
  },
  emojiA: { fontSize: 22 },
  optAText: { flex: 1, fontFamily: Font.nunito700, fontSize: 15 },

  // Grid (variant B)
  optionsB: { gap: 11, marginBottom: 4 },
  gridRow: { flexDirection: 'row', gap: 11 },
  optB: {
    position: 'relative',
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 20,
    paddingHorizontal: 12,
    borderRadius: 20,
    minHeight: 120,
  },
  emojiB: { fontSize: 30 },
  optBText: { fontFamily: Font.nunito800, fontSize: 14.5, textAlign: 'center' },
  badgeB: { position: 'absolute', top: 9, right: 9 },

  pressScale: { transform: [{ scale: 0.97 }] },

  // Footer
  footer: { paddingTop: 8, paddingHorizontal: 22 },
  fbBar: {
    flexDirection: 'row',
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 14,
    marginBottom: 10,
  },
  fbText: { fontFamily: Font.nunito800, fontSize: 14 },
});
