import { useEffect, useRef } from 'react';
import { useRouter } from 'expo-router';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type ViewStyle,
} from 'react-native';
import Animated, { LinearTransition } from 'react-native-reanimated';

import { Button } from '@/components/Button';
import { Screen } from '@/components/Screen';
import { Sym } from '@/components/Sym';
import { haptic } from '@/lib/haptics';
import { useEarnLock } from '@/store/useEarnLock';
import { Radius, Space } from '@/theme/tokens';
import { Type } from '@/theme/type';
import { useTokens } from '@/theme/theme';

// The backend never sends correct_index until the whole quiz is submitted
// (docs/api-contract.md — "answers can't be read from the payload"), so there is no
// per-question reveal here: pick an answer for every question, then submit once at the
// end. Correctness and explanations only exist after that, on the results screen.
export default function QuizScreen() {
  const t = useTokens();
  const router = useRouter();

  const quizQuestions = useEarnLock((s) => s.quizQuestions);
  const qIndex = useEarnLock((s) => s.qIndex);
  const selected = useEarnLock((s) => s.selected);
  const quizError = useEarnLock((s) => s.quizError);
  const beginQuiz = useEarnLock((s) => s.beginQuiz);
  const pick = useEarnLock((s) => s.pick);
  const nextQuestion = useEarnLock((s) => s.nextQuestion);
  const submitQuizNow = useEarnLock((s) => s.submitQuizNow);

  const started = useRef(false);
  useEffect(() => {
    if (started.current || quizQuestions.length > 0) return;
    started.current = true;
    beginQuiz();
  }, [beginQuiz, quizQuestions.length]);

  const q = quizQuestions[qIndex];
  const isLast = qIndex + 1 >= quizQuestions.length;
  const qProg = quizQuestions.length > 0 ? qIndex / quizQuestions.length : 0;

  const onButton = async () => {
    haptic.select();
    if (!isLast) {
      nextQuestion();
      return;
    }
    const ok = await submitQuizNow();
    if (!ok) return;
    // Read fresh from the store, not the hook-bound `quizResults` above — that variable
    // was captured at the last render (before submit), so it's still stale/null here.
    const results = useEarnLock.getState().quizResults ?? [];
    const hasMisses = results.some((r) => !r.correct);
    router.replace(hasMisses ? '/learning' : '/recap');
  };

  const optStyle = (i: number): ViewStyle =>
    selected === i
      ? { borderColor: t.accent, backgroundColor: t.accentSoft }
      : { borderColor: t.separator, backgroundColor: t.surface };

  if (quizQuestions.length === 0) {
    return (
      <Screen bottomInset>
        <View style={styles.center}>
          {quizError ? (
            <>
              <Text style={[Type.body, { color: t.danger, textAlign: 'center' }]}>{quizError}</Text>
              <Button
                label="Try again"
                onPress={() => beginQuiz()}
                style={{ marginTop: Space.lg }}
              />
            </>
          ) : (
            <ActivityIndicator color={t.accent} />
          )}
        </View>
      </Screen>
    );
  }

  return (
    <Screen bottomInset>
      {/* Top bar */}
      <View style={styles.top}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Back"
          onPress={() => {
            haptic.tap();
            router.back();
          }}
          hitSlop={10}
          style={styles.iconBtn}
        >
          <Sym name="chevron.left" size={20} color={t.text2} weight="semibold" />
        </Pressable>
        <View style={[styles.track, { backgroundColor: t.fill }]}>
          <Animated.View
            layout={LinearTransition.duration(300)}
            style={[styles.trackFill, { width: `${qProg * 100}%`, backgroundColor: t.accent }]}
          />
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Close quiz"
          onPress={() => {
            haptic.tap();
            router.navigate('/today');
          }}
          hitSlop={10}
          style={styles.iconBtn}
        >
          <Sym name="xmark" size={19} color={t.text2} weight="semibold" />
        </Pressable>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={styles.body}
        showsVerticalScrollIndicator={false}
      >
        <Text style={[Type.overline, { color: t.accentText, textTransform: 'uppercase' }]}>
          Question {qIndex + 1} of {quizQuestions.length}
        </Text>
        <Text style={[Type.title1, { color: t.text, marginTop: Space.sm }]}>{q.prompt}</Text>

        <View style={styles.options}>
          {q.options.map((opt, i) => (
            <Pressable
              key={i}
              accessibilityRole="button"
              accessibilityLabel={opt}
              accessibilityState={{ selected: selected === i }}
              onPress={() => pick(i)}
              style={({ pressed }) => [styles.opt, optStyle(i), pressed && styles.pressScale]}
            >
              <Text style={[Type.bodyStrong, styles.optText, { color: t.text }]}>{opt}</Text>
            </Pressable>
          ))}
        </View>
      </ScrollView>

      {/* Footer */}
      <View style={styles.footer}>
        <Button
          label={isLast ? 'Submit quiz' : 'Next question'}
          disabled={selected == null}
          onPress={onButton}
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  top: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Space.md,
    paddingHorizontal: Space.lg,
    paddingTop: Space.sm,
  },
  iconBtn: { width: 30, height: 30, alignItems: 'center', justifyContent: 'center' },
  track: { flex: 1, height: 7, borderRadius: Radius.pill, overflow: 'hidden' },
  trackFill: { height: '100%', borderRadius: Radius.pill },

  body: { paddingHorizontal: Space.xl, paddingTop: Space.xl, paddingBottom: Space.lg },
  options: { gap: Space.md, marginTop: Space.xxl },
  opt: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Space.md,
    paddingVertical: 16,
    paddingHorizontal: Space.lg,
    borderRadius: Radius.cardInner,
    borderCurve: 'continuous',
    borderWidth: 1.5,
  },
  optText: { flex: 1 },
  pressScale: { transform: [{ scale: 0.98 }] },

  footer: { paddingHorizontal: Space.xl, paddingTop: Space.sm, gap: Space.md },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: Space.xl },
});
