import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Icon } from '@/components/Icon';
import { PrimaryButton } from '@/components/PrimaryButton';
import { ProgressRing } from '@/components/ProgressRing';
import { Screen } from '@/components/Screen';
import { APP_DEFS } from '@/store/content';
import { useEarnLock } from '@/store/useEarnLock';
import { Font } from '@/theme/tokens';
import { useTokens } from '@/theme/theme';

const C2 = 364.424;

export default function EarnedScreen() {
  const t = useTokens();
  const router = useRouter();
  const claim = useEarnLock((s) => s.claim);
  const [earned, setEarned] = useState(0);

  useEffect(() => {
    let v = 0;
    const id = setInterval(() => {
      v++;
      if (v >= 15) {
        clearInterval(id);
        v = 15;
      }
      setEarned(v);
    }, 55);
    return () => clearInterval(id);
  }, []);

  const earnRingOffset = C2 * (1 - earned / 15);

  return (
    <Screen scroll contentStyle={styles.content}>
      <View style={styles.spacerTop} />

      <ProgressRing
        size={216}
        viewBox={140}
        rings={[
          {
            r: 58,
            strokeWidth: 13,
            trackColor: t.surface2,
            color: t.success,
            circumference: 364.42,
            offset: earnRingOffset,
          },
        ]}>
        <View style={styles.overlay}>
          <Text style={[styles.earnedNum, { color: t.text }]}>+{earned}</Text>
          <Text style={[styles.earnedLabel, { color: t.success }]}>MINUTES EARNED</Text>
        </View>
      </ProgressRing>

      <Text style={[styles.title, { color: t.text }]}>Nice work!</Text>
      <Text style={[styles.desc, { color: t.text2 }]}>
        You answered 5 correct — that's 15 minutes of screen time. Your apps are unlocked.
      </Text>

      <View style={styles.apps}>
        {APP_DEFS.map((def) => (
          <View key={def.key} style={[styles.tile, { backgroundColor: def.tile }]}>
            <Icon name={def.icon} size={22} color="#fff" />
          </View>
        ))}
      </View>

      <View style={styles.spacerBottom} />
      <PrimaryButton
        label="Start using my apps"
        onPress={() => {
          claim();
          router.replace('/home');
        }}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingTop: 2, paddingHorizontal: 26, paddingBottom: 20, alignItems: 'center' },
  spacerTop: { flex: 1, minHeight: 16 },
  overlay: { alignItems: 'center' },
  earnedNum: {
    fontFamily: Font.baloo800,
    fontSize: 60,
    textAlign: 'center',
  },
  earnedLabel: {
    fontFamily: Font.nunito800,
    fontSize: 12,
    letterSpacing: 1,
    marginTop: 4,
  },
  title: { fontFamily: Font.baloo800, fontSize: 26, marginTop: 26 },
  desc: {
    fontFamily: Font.nunito600,
    fontSize: 15,
    marginTop: 8,
    lineHeight: 21.75,
    textAlign: 'center',
  },
  apps: { flexDirection: 'row', gap: 12, marginTop: 24, alignItems: 'center' },
  tile: {
    width: 52,
    height: 52,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  spacerBottom: { flex: 1, minHeight: 18 },
});
