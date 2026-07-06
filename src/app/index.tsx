import { useRouter } from 'expo-router';
import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Icon, type IconName } from '@/components/Icon';
import { PrimaryButton } from '@/components/PrimaryButton';
import { Screen } from '@/components/Screen';
import { Font } from '@/theme/tokens';
import { useTokens } from '@/theme/theme';

function Benefit({
  icon,
  iconColor,
  iconBg,
  title,
  desc,
}: {
  icon: IconName;
  iconColor: string;
  iconBg: string;
  title: string;
  desc: string;
}) {
  const t = useTokens();
  return (
    <View style={styles.benefitRow}>
      <View style={[styles.benefitIcon, { backgroundColor: iconBg }]}>
        <Icon name={icon} size={23} color={iconColor} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[styles.benefitTitle, { color: t.text }]}>{title}</Text>
        <Text style={[styles.benefitDesc, { color: t.text2 }]}>{desc}</Text>
      </View>
    </View>
  );
}

export default function WelcomeScreen() {
  const t = useTokens();
  const router = useRouter();

  return (
    <Screen scroll contentStyle={styles.content}>
      <Text style={[styles.title, { color: t.text }]}>Welcome to{'\n'}EarnLock</Text>
      <Text style={[styles.subtitle, { color: t.text2 }]}>
        Turn screen time into a reward you earn by learning.
      </Text>

      <View style={styles.benefits}>
        <Benefit
          icon="lockRound"
          iconColor={t.primary}
          iconBg={t.primarySoft}
          title="Lock the distractions"
          desc="Pick the apps that eat your time. They stay locked until you learn."
        />
        <Benefit
          icon="star"
          iconColor={t.success}
          iconBg={t.successSoft}
          title="Earn time by learning"
          desc="Answer quick AI questions from your own notes to unlock minutes."
        />
        <Benefit
          icon="flame"
          iconColor={t.fire}
          iconBg="rgba(255,106,69,0.14)"
          title="Keep your streak alive"
          desc="Climb your knowledge map and build a daily learning streak."
        />
      </View>

      <View style={styles.spacer} />
      <PrimaryButton label="Get started" onPress={() => router.push('/grade')} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingTop: 6, paddingHorizontal: 26, paddingBottom: 24 },
  title: {
    fontFamily: Font.baloo800,
    fontSize: 31,
    lineHeight: 34,
    letterSpacing: -0.4,
    marginTop: 14,
  },
  subtitle: { fontFamily: Font.nunito600, fontSize: 15.5, marginTop: 10, lineHeight: 22 },
  benefits: { gap: 24, marginTop: 38 },
  benefitRow: { flexDirection: 'row', gap: 15, alignItems: 'flex-start' },
  benefitIcon: {
    width: 47,
    height: 47,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  benefitTitle: { fontFamily: Font.baloo700, fontSize: 18 },
  benefitDesc: { fontFamily: Font.nunito600, fontSize: 14.5, lineHeight: 20.6, marginTop: 2 },
  spacer: { flex: 1, minHeight: 20 },
});
