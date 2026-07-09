/**
 * A beat, not a question — so it carries no progress bar. The name types itself out, and only once
 * it has landed do the message and the action arrive. The footer reserves the button's height from
 * the first frame, so nothing below the message jumps when it fades in.
 */
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';

import { Button } from '@/components/Button';
import { Typewriter } from '@/components/onboarding/Typewriter';
import { Screen } from '@/components/Screen';
import { Sym } from '@/components/Sym';
import { haptic } from '@/lib/haptics';
import { voice } from '@/store/onboarding';
import { useEarnLock } from '@/store/useEarnLock';
import { Radius, Space } from '@/theme/tokens';
import { Type } from '@/theme/type';
import { useTokens } from '@/theme/theme';

export default function GreetingStep() {
  const t = useTokens();
  const router = useRouter();
  const [typed, setTyped] = useState(false);

  const usage = useEarnLock((s) => s.usage);
  const name = useEarnLock((s) => s.name);

  // Greet the first name only — "Hello, Mia Chen." reads like a summons.
  const first = name.trim().split(/\s+/)[0] ?? '';
  const v = voice(usage, first);

  return (
    <Screen
      contentStyle={styles.content}
      header={
        <View style={styles.header}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Go back"
            hitSlop={12}
            onPress={() => {
              haptic.tap();
              router.back();
            }}
            style={({ pressed }) => [
              styles.back,
              { backgroundColor: t.fill },
              pressed && { opacity: 0.6 },
            ]}
          >
            <Sym name="chevron.left" size={17} color={t.text} weight="semibold" />
          </Pressable>
        </View>
      }
      footer={
        <View style={styles.action}>
          {typed && (
            <Animated.View entering={FadeIn.duration(360)}>
              <Button label="Continue" onPress={() => router.push('/onboarding/age')} />
            </Animated.View>
          )}
        </View>
      }
      footerStyle={styles.footer}
    >
      <View style={styles.center}>
        <Typewriter
          text={v.greeting}
          style={[Type.largeTitle, { color: t.text }]}
          onDone={() => setTyped(true)}
        />

        {typed && (
          <Animated.Text
            entering={FadeInDown.duration(520).delay(120)}
            style={[Type.body, styles.message, { color: t.text2 }]}
          >
            {v.greetingMessage}
          </Animated.Text>
        )}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: Space.xl, paddingTop: Space.sm },
  content: { paddingHorizontal: Space.xl },
  footer: { paddingHorizontal: Space.xl, paddingTop: Space.md },
  back: {
    width: 34,
    height: 34,
    borderRadius: Radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  message: { textAlign: 'center', marginTop: Space.lg },
  // Holds the button's footprint before it exists, so the message never shifts.
  action: { minHeight: 56, justifyContent: 'flex-end' },
});
