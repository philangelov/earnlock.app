import { useRouter } from 'expo-router';
import { useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
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
 * Real auth: email/password, wired to POST /auth/register and /auth/login
 * (docs/api-contract.md — Supabase Auth supports email/password only, no OAuth). The
 * Apple/Google buttons below stay presentational — real Sign in with Apple/Google would
 * need OAuth providers configured in Supabase plus native sign-in SDKs, out of scope here.
 */
export default function AccountStep() {
  const t = useTokens();
  const router = useRouter();
  const setAccount = useEarnLock((s) => s.setAccount);
  const registerAccount = useEarnLock((s) => s.registerAccount);
  const loginAccount = useEarnLock((s) => s.loginAccount);
  const authLoading = useEarnLock((s) => s.authLoading);
  const authError = useEarnLock((s) => s.authError);

  const [mode, setMode] = useState<'register' | 'login'>('register');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const next = () => router.push('/material');

  const submit = async () => {
    haptic.press();
    const ok =
      mode === 'register'
        ? await registerAccount(email.trim(), password)
        : await loginAccount(email.trim(), password);
    if (ok) next();
  };

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

  const canSubmit = email.trim().length > 3 && password.length >= 8 && !authLoading;

  return (
    <OnboardingStep
      step="account"
      title="Save your progress"
      subtitle="So your streak, your earned time and your notes survive a new phone."
      onBack={() => router.back()}
      center
    >
      <Card style={styles.formCard}>
        <TextInput
          value={email}
          onChangeText={setEmail}
          placeholder="Email"
          placeholderTextColor={t.text3}
          accessibilityLabel="Email"
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="email-address"
          style={[Type.body, styles.input, { color: t.text, borderColor: t.separator }]}
        />
        <TextInput
          value={password}
          onChangeText={setPassword}
          placeholder="Password (min. 8 characters)"
          placeholderTextColor={t.text3}
          accessibilityLabel="Password"
          autoCapitalize="none"
          autoCorrect={false}
          secureTextEntry
          style={[Type.body, styles.input, { color: t.text, borderColor: t.separator }]}
        />
        {authError && (
          <Text style={[Type.footnote, styles.error, { color: t.danger }]}>{authError}</Text>
        )}
        <Button
          label={authLoading ? 'Please wait…' : mode === 'register' ? 'Create account' : 'Log in'}
          disabled={!canSubmit}
          onPress={submit}
          style={styles.submitBtn}
        />
        <Text
          accessibilityRole="button"
          suppressHighlighting
          onPress={() => setMode(mode === 'register' ? 'login' : 'register')}
          style={[Type.footnote, styles.modeSwitch, { color: t.text2 }]}
        >
          {mode === 'register' ? 'Already have an account? Log in' : 'New here? Create an account'}
        </Text>
      </Card>

      <Text style={[Type.overline, styles.or, { color: t.text3 }]}>OR</Text>

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
  formCard: { padding: Space.lg, gap: Space.md },
  input: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: Radius.control,
    borderCurve: 'continuous',
    paddingHorizontal: Space.md,
    paddingVertical: 12,
  },
  error: { textAlign: 'center' },
  submitBtn: { marginTop: Space.xs },
  modeSwitch: { textAlign: 'center', textDecorationLine: 'underline' },

  or: { textAlign: 'center', marginVertical: Space.lg },

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
