import { useRouter } from 'expo-router';
import { useEffect, useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';

import { GoogleMark } from '@/components/GoogleMark';
import { OnboardingStep } from '@/components/onboarding/OnboardingStep';
import { Sym } from '@/components/Sym';
import { isAppleAvailable, isGoogleConfigured } from '@/lib/auth';
import { haptic } from '@/lib/haptics';
import { type AccountProvider } from '@/store/onboarding';
import { useEarnLock } from '@/store/useEarnLock';
import { Radius, Space } from '@/theme/tokens';
import { Type } from '@/theme/type';
import { useTokens } from '@/theme/theme';

/**
 * Sign in with Apple or Google — EarnLock has no passwords. Each button opens the native
 * sheet, and the identity token it returns is exchanged for a session by the backend
 * (POST /auth/oauth). Skipping is allowed, but a signed-out user cannot earn time: quizzes
 * are generated and graded server-side.
 */
export default function AccountStep() {
  const t = useTokens();
  const router = useRouter();

  const signIn = useEarnLock((s) => s.signIn);
  const setAccount = useEarnLock((s) => s.setAccount);
  const authLoading = useEarnLock((s) => s.authLoading);
  const authError = useEarnLock((s) => s.authError);

  // The sheet only exists on iOS 13+, so the button appears only where it can work.
  const [appleReady, setAppleReady] = useState(false);
  useEffect(() => {
    let active = true;
    void isAppleAvailable().then((ok) => active && setAppleReady(ok));
    return () => {
      active = false;
    };
  }, []);

  const googleReady = isGoogleConfigured();
  // Study material is no longer collected during onboarding — the last step is picking apps
  // to lock. Materials are added afterwards from the Learn tab's Materials manager.
  const next = () => router.push('/apps');

  const choose = async (provider: AccountProvider) => {
    haptic.press();
    if (await signIn(provider)) {
      haptic.success();
      next();
    }
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
        {appleReady && (
          // Apple's guidance: the button inverts with the interface, never tints.
          <ProviderButton
            label="Sign in with Apple"
            background={t.text}
            foreground={t.bg}
            border={t.text}
            disabled={authLoading}
            onPress={() => void choose('apple')}
            mark={<Sym name="apple.logo" size={19} color={t.bg} />}
          />
        )}

        <ProviderButton
          label="Sign in with Google"
          background={t.surface}
          foreground={t.text}
          border={t.border}
          disabled={authLoading || !googleReady}
          onPress={() => void choose('google')}
          mark={<GoogleMark size={19} />}
        />
      </View>

      {!googleReady && (
        <Text style={[Type.caption, styles.note, { color: t.text3 }]}>
          Google sign-in needs client IDs in this build.
        </Text>
      )}

      {authError != null && (
        <Animated.Text
          entering={FadeIn.duration(180)}
          style={[Type.footnote, styles.error, { color: t.danger }]}
        >
          {authError}
        </Animated.Text>
      )}

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
  disabled,
  onPress,
}: {
  label: string;
  mark: ReactNode;
  background: string;
  foreground: string;
  border: string;
  disabled?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.provider,
        { backgroundColor: background, borderColor: border },
        pressed && !disabled && { opacity: 0.75 },
        disabled && { opacity: 0.4 },
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

  note: { textAlign: 'center', marginTop: Space.md },
  error: { textAlign: 'center', marginTop: Space.lg },

  skipRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: Space.xxl,
  },
  skip: { textDecorationLine: 'underline' },
});
