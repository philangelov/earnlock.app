import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/Button';
import { Sym } from '@/components/Sym';
import { haptic } from '@/lib/haptics';
import { QUIZ_QUESTIONS } from '@/store/content';
import { useEarnLock } from '@/store/useEarnLock';
import { Radius, Space } from '@/theme/tokens';
import { Type } from '@/theme/type';
import { useTokens } from '@/theme/theme';

export default function LockedScreen() {
  const t = useTokens();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const resetQuizFlow = useEarnLock((s) => s.resetQuizFlow);

  const startQuiz = () => {
    resetQuizFlow();
    router.replace('/quiz');
  };

  // The shield deep-links here on a cold launch, so there may be no back stack to pop —
  // fall back to the Today tab rather than dead-ending on a no-op back.
  const dismiss = () => {
    haptic.tap();
    if (router.canGoBack()) router.back();
    else router.replace('/today');
  };

  return (
    <View
      style={[
        styles.root,
        {
          backgroundColor: t.bg,
          paddingTop: insets.top + Space.sm,
          paddingBottom: insets.bottom + Space.lg,
        },
      ]}
    >
      <View style={styles.topBar}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Close"
          onPress={dismiss}
          hitSlop={12}
          style={[styles.close, { backgroundColor: t.fill }]}
        >
          <Sym name="xmark" size={16} color={t.text2} weight="semibold" />
        </Pressable>
      </View>

      <View style={styles.center}>
        <View style={[styles.hero, { backgroundColor: t.fill }]}>
          <Sym name="lock.fill" size={44} color={t.text} weight="semibold" />
        </View>
        <Text style={[Type.title1, styles.title, { color: t.text }]}>Your apps are locked</Text>
        <Text style={[Type.body, styles.subtitle, { color: t.text2 }]}>
          Answer a few quick questions from your notes to unlock 15 minutes of screen time.
        </Text>

        <View style={[styles.reward, { backgroundColor: t.accentSoft }]}>
          <Sym name="bolt.fill" size={15} color={t.accentText} />
          <Text style={[Type.subheadStrong, { color: t.accentText }]}>
            {QUIZ_QUESTIONS} correct = 15 minutes
          </Text>
        </View>
      </View>

      <View style={styles.footer}>
        <Button
          label="Earn screen time"
          icon={<Sym name="bolt.fill" size={16} color={t.onAccent} />}
          onPress={startQuiz}
        />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Maybe later"
          onPress={dismiss}
          style={({ pressed }) => [styles.later, pressed && { opacity: 0.6 }]}
        >
          <Text style={[Type.calloutStrong, { color: t.text2 }]}>Maybe later</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, paddingHorizontal: Space.xl },
  topBar: { alignItems: 'flex-end' },
  close: {
    width: 32,
    height: 32,
    borderRadius: Radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: Space.md },
  hero: {
    width: 108,
    height: 108,
    borderRadius: 30,
    borderCurve: 'continuous',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Space.xs,
  },
  title: { textAlign: 'center', marginTop: Space.sm },
  subtitle: { textAlign: 'center', maxWidth: 320 },
  reward: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingVertical: 9,
    paddingHorizontal: 15,
    borderRadius: Radius.pill,
    marginTop: Space.sm,
  },
  footer: { gap: Space.sm },
  later: { paddingVertical: 12, alignItems: 'center' },
});
