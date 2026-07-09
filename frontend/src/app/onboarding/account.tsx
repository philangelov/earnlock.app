import { useRouter } from 'expo-router';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { GoogleMark } from '@/components/GoogleMark';
import { OnboardingStep } from '@/components/onboarding/OnboardingStep';
import { Sym } from '@/components/Sym';
import { haptic } from '@/lib/haptics';
import { type AccountProvider } from '@/store/onboarding';
import { useEarnLock } from '@/store/useEarnLock';
import { Radius, Space } from '@/theme/tokens';
import { Type } from '@/theme/type';
import { useTokens } from '@/theme/theme';

/**
 * No email, no password — progress is saved against an identity provider or not at all. Both
 * buttons are presentational for now: they record the choice and move on, because the token
 * exchange belongs to the backend work happening in parallel.
 */
export default function AccountStep() {
  const t = useTokens();
  const router = useRouter();
  const setAccount = useEarnLock((s) => s.setAccount);

  const next = () => router.push('/material');

  const choose = (provider: AccountProvider) => {
    haptic.press();
    setAccount(provider);
    next();
  };

  const skip = () => {
    haptic.tap();
    setAccount(null);
    next();
  };

  return (
    <OnboardingStep
      step="account"
      title="Save your progress"
      subtitle="So your streak, your earned time and your notes survive a new phone."
      onBack={() => router.back()}
      center
    >
      <View style={styles.buttons}>
        {/* Apple's guidance: the button inverts with the interface, never tints. */}
        <ProviderButton
          label="Sign in with Apple"
          background={t.text}
          foreground={t.bg}
          border={t.text}
          onPress={() => choose('apple')}
          mark={<Sym name="apple.logo" size={19} color={t.bg} />}
        />

        <ProviderButton
          label="Sign in with Google"
          background={t.surface}
          foreground={t.text}
          border={t.border}
          onPress={() => choose('google')}
          mark={<GoogleMark size={19} />}
        />
      </View>

      <View style={styles.skipRow}>
        <Text style={[Type.subhead, { color: t.text2 }]}>Would you like to sign in later? </Text>
        <Text
          accessibilityRole="button"
          suppressHighlighting
          onPress={skip}
          style={[Type.subheadStrong, styles.skip, { color: t.text }]}
        >
          Skip
        </Text>
      </View>
    </OnboardingStep>
  );
}

function ProviderButton({
  label,
  mark,
  background,
  foreground,
  border,
  onPress,
}: {
  label: string;
  mark: ReactNode;
  background: string;
  foreground: string;
  border: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => [
        styles.provider,
        { backgroundColor: background, borderColor: border },
        pressed && { opacity: 0.75 },
      ]}
    >
      <View style={styles.mark}>{mark}</View>
      <Text style={[Type.headline, { color: foreground }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  buttons: { gap: Space.md },
  provider: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Space.md,
    paddingVertical: 16,
    borderRadius: Radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
  },
  // Fixed box so both labels start at the same x despite different glyph widths.
  mark: { width: 22, alignItems: 'center' },

  skipRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: Space.xxl,
  },
  skip: { textDecorationLine: 'underline' },
});
