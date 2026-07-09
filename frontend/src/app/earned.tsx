import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { Button } from '@/components/Button';
import { ProgressRing } from '@/components/ProgressRing';
import { Screen } from '@/components/Screen';
import { Sym } from '@/components/Sym';
import { haptic } from '@/lib/haptics';
import { useScreenTime } from '@/lib/screenTime/store';
import { useEarnLock } from '@/store/useEarnLock';
import { Radius, Space } from '@/theme/tokens';
import { Type } from '@/theme/type';
import { useTokens } from '@/theme/theme';

export default function EarnedScreen() {
  const t = useTokens();
  const router = useRouter();
  const claim = useEarnLock((s) => s.claim);
  const lastEarnedSeconds = useEarnLock((s) => s.lastEarnedSeconds);
  const count = useScreenTime((s) => s.selection.total);

  // The reward was already granted by submitQuizNow() at the end of the quiz — server-
  // side, atomically, before this screen ever mounts. claim() here just clears transient
  // per-attempt UI state (recap picks etc.), so the reward can't be lost by swiping away.
  const claimed = useRef(false);
  useEffect(() => {
    if (claimed.current) return;
    claimed.current = true;
    claim();
    haptic.success();
  }, [claim]);

  const earnedMinutes = Math.round(lastEarnedSeconds / 60);
  const [earned, setEarned] = useState(0);
  useEffect(() => {
    if (earnedMinutes <= 0) return;
    let v = 0;
    const id = setInterval(() => {
      v++;
      if (v >= earnedMinutes) {
        clearInterval(id);
        v = earnedMinutes;
      }
      setEarned(v);
    }, 45);
    return () => clearInterval(id);
  }, [earnedMinutes]);

  return (
    <Screen scroll bottomInset contentStyle={styles.content}>
      <View style={styles.spacer} />

      <Animated.View entering={FadeInDown.duration(320)}>
        <ProgressRing
          size={208}
          viewBox={140}
          rings={[
            {
              r: 58,
              strokeWidth: 12,
              trackColor: t.fill,
              color: t.accent,
              progress: earnedMinutes > 0 ? earned / earnedMinutes : 0,
            },
          ]}
        >
          <View style={styles.center}>
            <Text style={[Type.display, { color: t.text }]}>+{earned}</Text>
            <Text style={[Type.overline, { color: t.accentText, textTransform: 'uppercase' }]}>
              minutes earned
            </Text>
          </View>
        </ProgressRing>
      </Animated.View>

      <Text style={[Type.title1, { color: t.text, marginTop: Space.xxl }]}>Nice work!</Text>
      <Text style={[Type.body, styles.desc, { color: t.text2 }]}>
        {earnedMinutes > 0
          ? `Quiz complete — you earned ${earnedMinutes} minute${earnedMinutes === 1 ? '' : 's'} and your apps are unlocked.`
          : 'Quiz complete — answer more correctly next time to earn screen time.'}
      </Text>

      <View style={[styles.chip, { backgroundColor: t.accentSoft }]}>
        <Sym name="lock.open.fill" size={15} color={t.accentText} />
        <Text style={[Type.subheadStrong, { color: t.accentText }]}>
          {count > 0
            ? `${count} ${count === 1 ? 'app or category' : 'apps & categories'} unlocked`
            : 'Your apps are unlocked'}
        </Text>
      </View>

      <View style={styles.spacer} />
      <Button label="Start using my apps" onPress={() => router.navigate('/today')} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: Space.xl, paddingTop: Space.sm, alignItems: 'center', flexGrow: 1 },
  spacer: { flex: 1, minHeight: Space.lg },
  center: { alignItems: 'center', gap: 4 },
  desc: { marginTop: Space.sm, textAlign: 'center', maxWidth: 300 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingVertical: 9,
    paddingHorizontal: 15,
    borderRadius: Radius.pill,
    marginTop: Space.xl,
  },
});
