import { useRouter } from 'expo-router';
import { useEffect } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View, type ViewStyle } from 'react-native';

import { Appear } from '@/components/Appear';
import { Button } from '@/components/Button';
import { Screen } from '@/components/Screen';
import { Sym } from '@/components/Sym';
import { haptic } from '@/lib/haptics';
import { useEarnLock } from '@/store/useEarnLock';
import { Radius, Space } from '@/theme/tokens';
import { Type } from '@/theme/type';
import { useTokens } from '@/theme/theme';

export default function RecapScreen() {
  const t = useTokens();
  const router = useRouter();

  const recap = useEarnLock((s) => s.quizRecap);
  const questionCount = useEarnLock((s) => s.quizQuestions.length);
  const hasResults = useEarnLock((s) => s.quizResults != null);
  const recapPick = useEarnLock((s) => s.recapPick);
  const recapChecked = useEarnLock((s) => s.recapChecked);
  const pickRecap = useEarnLock((s) => s.pickRecap);
  const checkRecap = useEarnLock((s) => s.checkRecap);
  const retryRecap = useEarnLock((s) => s.retryRecap);

  // The recap belongs to a quiz session. Landing here without one (a deep link, a reload
  // after the session was reset) means there is nothing to recap — go where the user
  // actually is: the reward if they earned one, otherwise Today.
  useEffect(() => {
    if (!recap) router.replace(hasResults ? '/earned' : '/today');
  }, [recap, hasResults, router]);

  const correct = recap != null && recapPick === recap.answer;
  // Derived from flow state: all MC done, plus this final step once it's answered correctly.
  const total = questionCount || 1;
  const progress = (total + (recapChecked && correct ? 1 : 0)) / (total + 1);

  const blankStyle = (): ViewStyle => {
    if (recapChecked) {
      return correct
        ? { borderColor: t.accent, backgroundColor: t.accentSoft }
        : { borderColor: t.danger, backgroundColor: t.dangerSoft };
    }
    if (recapPick) return { borderColor: t.accent, backgroundColor: t.accentSoft };
    return { borderColor: t.border, backgroundColor: t.fill, borderStyle: 'dashed' };
  };

  const chipStyle = (w: string): ViewStyle => {
    if (!recapChecked) {
      return recapPick === w
        ? { borderColor: t.accent, backgroundColor: t.accentSoft }
        : { borderColor: t.separator, backgroundColor: t.surface };
    }
    if (w === recap?.answer) return { borderColor: t.accent, backgroundColor: t.accentSoft };
    if (recapPick === w) return { borderColor: t.danger, backgroundColor: t.dangerSoft };
    return { borderColor: t.separator, backgroundColor: t.surface, opacity: 0.5 };
  };

  // The redirect above is already in flight; render nothing rather than a broken sentence.
  if (!recap) return null;

  const onButton = () => {
    if (recapChecked) {
      if (correct) router.replace('/earned');
      else retryRecap();
      return;
    }
    if (correct) haptic.success();
    else haptic.error();
    checkRecap();
  };

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
          <View
            style={[styles.trackFill, { width: `${progress * 100}%`, backgroundColor: t.accent }]}
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
          Recap
        </Text>
        <Text style={[Type.title1, { color: t.text, marginTop: Space.sm }]}>Fill in the blank</Text>

        <View style={styles.sentence}>
          <Text style={[Type.title3, styles.sentenceText, { color: t.text2 }]}>
            {recap.sentence_before}{' '}
          </Text>
          <View style={[styles.blank, blankStyle()]}>
            <Text style={[Type.title3, { color: recapChecked && !correct ? t.danger : t.text }]}>
              {recapPick || '?'}
            </Text>
          </View>
          {recap.sentence_after !== '' && (
            <Text style={[Type.title3, styles.sentenceText, { color: t.text2 }]}>
              {' '}
              {recap.sentence_after}
            </Text>
          )}
        </View>

        <View style={styles.chips}>
          {recap.options.map((w) => (
            <Pressable
              key={w}
              accessibilityRole="button"
              accessibilityState={{ selected: recapPick === w }}
              onPress={() => {
                haptic.select();
                pickRecap(w);
              }}
              style={({ pressed }) => [
                styles.chip,
                chipStyle(w),
                pressed && !recapChecked && styles.pressScale,
              ]}
            >
              <Text style={[Type.title3, { color: t.text }]}>{w}</Text>
            </Pressable>
          ))}
        </View>
      </ScrollView>

      <View style={styles.footer}>
        {recapChecked && (
          <Appear
            from={-8}
            duration={200}
            accessibilityLiveRegion="polite"
            style={[styles.fb, { backgroundColor: correct ? t.accentSoft : t.dangerSoft }]}
          >
            <Sym
              name={correct ? 'checkmark.circle.fill' : 'info.circle.fill'}
              size={17}
              color={correct ? t.accentText : t.danger}
            />
            <Text
              style={[Type.subheadStrong, { color: correct ? t.accentText : t.danger, flex: 1 }]}
            >
              {correct ? `Correct — it’s ${recap.answer}!` : 'Not quite — give it another go.'}
            </Text>
          </Appear>
        )}
        <Button
          label={recapChecked ? (correct ? 'Claim your reward' : 'Try again') : 'Check answer'}
          disabled={!(recapPick || recapChecked)}
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

  body: { flexGrow: 1, paddingHorizontal: Space.xl, paddingTop: Space.xl },
  sentence: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', marginTop: Space.xxl },
  sentenceText: { lineHeight: 40 },
  blank: {
    minWidth: 70,
    height: 42,
    borderRadius: Radius.chip,
    borderCurve: 'continuous',
    borderWidth: 2,
    paddingHorizontal: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Space.md,
    marginTop: Space.xxxl,
    justifyContent: 'center',
  },
  chip: {
    minWidth: 78,
    paddingVertical: 14,
    paddingHorizontal: 22,
    borderRadius: Radius.cardInner,
    borderCurve: 'continuous',
    borderWidth: 1.5,
    alignItems: 'center',
  },
  pressScale: { transform: [{ scale: 0.97 }] },

  footer: { paddingHorizontal: Space.xl, paddingTop: Space.sm, gap: Space.md },
  fb: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: Radius.control,
    borderCurve: 'continuous',
  },
});
