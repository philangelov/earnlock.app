import { Redirect, useRouter } from 'expo-router';
import { useSyncExternalStore } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { Button } from '@/components/Button';
import { Logo } from '@/components/Logo';
import { Screen } from '@/components/Screen';
import { Sym, type SymName } from '@/components/Sym';
import { useEarnLock } from '@/store/useEarnLock';
import { Radius, Space } from '@/theme/tokens';
import { Type } from '@/theme/type';
import { useTokens } from '@/theme/theme';

function Benefit({
  icon,
  title,
  desc,
  accent,
  delay,
}: {
  icon: SymName;
  title: string;
  desc: string;
  accent?: boolean;
  delay: number;
}) {
  const t = useTokens();
  return (
    <Animated.View entering={FadeInDown.duration(420).delay(delay)} style={styles.benefit}>
      <View style={[styles.benefitIcon, { backgroundColor: accent ? t.accentSoft : t.fill }]}>
        <Sym name={icon} size={20} color={accent ? t.accentText : t.text} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[Type.headline, { color: t.text }]}>{title}</Text>
        <Text style={[Type.subhead, { color: t.text2, marginTop: 2 }]}>{desc}</Text>
      </View>
    </Animated.View>
  );
}

export default function WelcomeScreen() {
  const t = useTokens();
  const router = useRouter();
  const onboarded = useEarnLock((s) => s.onboarded);

  // Wait for the persisted store to rehydrate so a returning user never flashes onboarding.
  const hydrated = useSyncExternalStore(
    (onChange) => useEarnLock.persist.onFinishHydration(onChange),
    () => useEarnLock.persist.hasHydrated(),
  );

  if (!hydrated) return null;
  if (onboarded) return <Redirect href="/today" />;

  return (
    <Screen
      scroll
      contentStyle={styles.content}
      footer={<Button label="Get started" onPress={() => router.push('/onboarding/usage')} />}
      footerStyle={styles.footer}
    >
      <Animated.View entering={FadeInDown.duration(420)} style={styles.logo}>
        <Logo size={72} />
      </Animated.View>

      <Text style={[Type.largeTitle, { color: t.text }]}>
        Screen time,{'\n'}earned by learning.
      </Text>
      <Text style={[Type.body, { color: t.text2, marginTop: Space.md }]}>
        EarnLock keeps distracting apps locked until a few quick questions are answered — turning
        idle scrolling into real progress.
      </Text>

      <View style={styles.benefits}>
        <Benefit
          icon="lock.fill"
          title="Lock the distractions"
          desc="Choose the apps that eat the day. They stay shielded until time is earned."
          delay={80}
        />
        <Benefit
          icon="graduationcap.fill"
          title="Learn to unlock"
          desc="Answer questions from your own notes to earn 15 minutes at a time."
          accent
          delay={160}
        />
        <Benefit
          icon="flame.fill"
          title="Build the habit"
          desc="Keep a daily streak and watch subjects climb toward mastery."
          delay={240}
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: Space.xxl, paddingTop: Space.xxl, paddingBottom: Space.xxl },
  footer: { paddingHorizontal: Space.xxl, paddingTop: Space.md },
  // The mark sits flush left with the title it introduces. The PNG carries ~12% transparent
  // padding, so it is pulled back by that much to align optically with the text below.
  logo: { alignSelf: 'flex-start', marginBottom: Space.md, marginLeft: -8 },
  benefits: { gap: Space.xl, marginTop: Space.xxxl },
  benefit: { flexDirection: 'row', gap: Space.md, alignItems: 'flex-start' },
  benefitIcon: {
    width: 42,
    height: 42,
    borderRadius: Radius.control,
    borderCurve: 'continuous',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
