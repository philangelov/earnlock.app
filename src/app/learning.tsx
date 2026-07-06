import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Icon } from '@/components/Icon';
import { Screen } from '@/components/Screen';
import { MC_COUNT, QUESTIONS } from '@/store/content';
import { useEarnLock } from '@/store/useEarnLock';
import { Font } from '@/theme/tokens';
import { useTokens } from '@/theme/theme';

export default function LearningScreen() {
  const t = useTokens();
  const router = useRouter();

  const qIndex = useEarnLock((s) => s.qIndex);
  const nextQuestion = useEarnLock((s) => s.nextQuestion);

  const learnExplain = QUESTIONS[Math.min(qIndex, QUESTIONS.length - 1)].explain;

  const [lockLeft, setLockLeft] = useState(10);
  useEffect(() => {
    const id = setInterval(
      () => setLockLeft((v) => (v <= 1 ? (clearInterval(id), 0) : v - 1)),
      1000,
    );
    return () => clearInterval(id);
  }, []);

  const lockPct = ((10 - lockLeft) / 10) * 100;
  const locked = lockLeft > 0;
  const learnBtnLabel = locked ? 'Keep reading… ' + lockLeft + 's' : "I'm ready! →";

  const learnContinue = () => {
    const ni = qIndex + 1;
    nextQuestion();
    if (ni >= MC_COUNT) router.replace('/recap');
    else router.replace('/quiz');
  };

  return (
    <Screen bottomInset>
      {/* Progress */}
      <View style={[styles.progress, { backgroundColor: t.surface2 }]}>
        <View style={[styles.progressFill, { backgroundColor: t.primary }]} />
      </View>

      {/* Top icons */}
      <View style={styles.topRow}>
        <Icon name="bookmark" size={20} color={t.text3} />
        <Icon name="share" size={20} color={t.text3} />
      </View>

      {/* Body */}
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={styles.body}
        showsVerticalScrollIndicator={false}>
        <View style={styles.tag}>
          <View style={[styles.tagDot, { backgroundColor: t.fire }]} />
          <Text style={[styles.tagText, { color: t.fire }]}>LEARNING MODE</Text>
        </View>

        <View style={[styles.starBox, { backgroundColor: t.primarySoft }]}>
          <Icon name="star" size={34} color={t.primary} />
        </View>

        <Text style={[styles.title, { color: t.text }]}>Not quite — here's the idea</Text>
        <Text style={[styles.explain, { color: t.text2 }]}>{learnExplain}</Text>
      </ScrollView>

      {/* Footer */}
      <View style={styles.footer}>
        <Pressable
          disabled={locked}
          onPress={locked ? undefined : learnContinue}
          style={({ pressed }) => [
            styles.btn,
            locked
              ? [styles.btnLocked, { backgroundColor: t.surface2 }]
              : [styles.btnReady, { backgroundColor: t.primary, shadowColor: t.primary }],
            !locked && pressed && styles.pressed,
          ]}>
          {locked && (
            <View
              style={[styles.btnFill, { width: `${lockPct}%`, backgroundColor: t.primarySoft }]}
            />
          )}
          <Text style={[styles.btnLabel, { color: locked ? t.text2 : t.onPrimary }]}>
            {learnBtnLabel}
          </Text>
        </Pressable>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  progress: {
    height: 6,
    borderRadius: 3,
    marginTop: 2,
    marginHorizontal: 20,
    overflow: 'hidden',
  },
  progressFill: { height: '100%', width: '66%', borderRadius: 3 },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 16,
    paddingTop: 14,
    paddingHorizontal: 22,
    paddingBottom: 2,
  },
  body: {
    flexGrow: 1,
    alignItems: 'center',
    paddingTop: 16,
    paddingHorizontal: 26,
    paddingBottom: 0,
  },
  tag: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  tagDot: { width: 9, height: 9, borderRadius: 4.5 },
  tagText: { fontFamily: Font.nunito800, fontSize: 12, letterSpacing: 1 },
  starBox: {
    width: 66,
    height: 66,
    borderRadius: 20,
    marginTop: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontFamily: Font.baloo700,
    fontSize: 20,
    marginTop: 20,
    textAlign: 'center',
  },
  explain: {
    fontFamily: Font.nunito400,
    fontSize: 16.5,
    lineHeight: 24.75,
    marginTop: 14,
    textAlign: 'center',
  },
  footer: { paddingTop: 8, paddingHorizontal: 22, paddingBottom: 0 },
  btn: {
    width: '100%',
    borderRadius: 19,
    padding: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnLocked: { overflow: 'hidden' },
  btnReady: {
    shadowOpacity: 0.4,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 12 },
    elevation: 8,
  },
  btnFill: { position: 'absolute', left: 0, top: 0, bottom: 0 },
  btnLabel: { fontFamily: Font.baloo700, fontSize: 17 },
  pressed: { transform: [{ scale: 0.97 }] },
});
