import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Linking, StyleSheet, Text, View } from 'react-native';

import { APP_PICKER_AVAILABLE, AppPicker } from '@/components/AppSelectionSheet';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { Screen } from '@/components/Screen';
import { StepHeader } from '@/components/StepHeader';
import { Sym } from '@/components/Sym';
import { haptic } from '@/lib/haptics';
import { useScreenTime } from '@/lib/screenTime/store';
import { QUIZ_QUESTIONS } from '@/store/content';
import { requiresLockedApps, STEP_TOTAL, stepIndex } from '@/store/onboarding';
import { useEarnLock } from '@/store/useEarnLock';
import { Radius, Space } from '@/theme/tokens';
import { Type } from '@/theme/type';
import { useTokens } from '@/theme/theme';

export default function AppsScreen() {
  const t = useTokens();
  const router = useRouter();

  const completeOnboarding = useEarnLock((s) => s.completeOnboarding);
  const onboarded = useEarnLock((s) => s.onboarded);
  const commitment = useEarnLock((s) => s.commitment);

  const available = useScreenTime((s) => s.available);
  const status = useScreenTime((s) => s.status);
  const selection = useScreenTime((s) => s.selection);
  const authorize = useScreenTime((s) => s.authorize);
  const refresh = useScreenTime((s) => s.refresh);

  const [pickerOpen, setPickerOpen] = useState(false);
  const approved = status === 'approved';
  const denied = status === 'denied';
  const count = selection.total;

  // Firm mode is the one commitment that can't work without something to shield, so it's the one
  // that gates the CTA. The other two can finish now and add apps from Profile whenever they like.
  // Never gate on a build where Screen Time isn't available at all — that would be a dead end.
  const mustPick = !onboarded && available && requiresLockedApps(commitment);
  const canFinish = !mustPick || count > 0;

  const onConnect = () => {
    haptic.press();
    if (denied) {
      void Linking.openSettings();
      return;
    }
    void authorize().then((s) => {
      if (s === 'approved') haptic.success();
    });
  };

  const finish = () => {
    if (onboarded) {
      router.back();
      return;
    }
    completeOnboarding();
    router.dismissAll();
    router.replace('/today');
  };

  return (
    <Screen
      scroll
      contentStyle={styles.content}
      header={
        <View style={styles.header}>
          <StepHeader
            step={stepIndex('apps')}
            total={STEP_TOTAL}
            title={onboarded ? 'Locked apps' : undefined}
            onBack={() => router.back()}
          />
        </View>
      }
      footer={
        <Button
          label={onboarded ? 'Done' : 'Finish setup'}
          disabled={!canFinish}
          onPress={finish}
        />
      }
      footerStyle={styles.footer}
    >
      <Text style={[Type.title1, styles.heading, { color: t.text }]}>
        {commitment === 'insight' && !onboarded
          ? 'See where the time goes'
          : 'Lock the distractions'}
      </Text>
      <Text style={[Type.subhead, styles.sub, { color: t.text2 }]}>
        {commitment === 'insight' && !onboarded
          ? 'Screen Time gives EarnLock the numbers. Picking apps to shield is optional — add them whenever you’re ready.'
          : 'Apple Screen Time shields your chosen apps until time is earned. Your selection stays private — even to EarnLock.'}
      </Text>

      {/* Step 1 — authorization */}
      <Text style={[Type.overline, styles.stepLabel, { color: t.text3 }]}>STEP 1 · ACCESS</Text>
      <Card style={styles.card}>
        <View style={styles.row}>
          <View style={[styles.icon, { backgroundColor: approved ? t.accentSoft : t.fill }]}>
            <Sym
              name={approved ? 'checkmark' : 'hourglass'}
              size={20}
              color={approved ? t.accentText : t.text}
              weight="semibold"
            />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[Type.headline, { color: t.text }]}>
              {approved ? 'Screen Time connected' : 'Connect Screen Time'}
            </Text>
            <Text style={[Type.footnote, { color: t.text2, marginTop: 1 }]}>
              {!available
                ? 'Available in a device build with Family Controls.'
                : approved
                  ? 'EarnLock can now shield your apps.'
                  : denied
                    ? 'Access was denied — enable it in Settings.'
                    : 'Grant access to let EarnLock lock apps.'}
            </Text>
          </View>
        </View>
        {available && !approved && (
          <Button
            label={denied ? 'Open Settings' : 'Connect Screen Time'}
            variant="tinted"
            small
            onPress={onConnect}
            style={styles.cardBtn}
          />
        )}
      </Card>

      {/* Step 2 — choose apps */}
      <Text style={[Type.overline, styles.stepLabel, { color: t.text3 }]}>STEP 2 · APPS</Text>
      <Card style={styles.card}>
        <View style={styles.row}>
          <View style={[styles.icon, { backgroundColor: count > 0 ? t.accentSoft : t.fill }]}>
            <Sym
              name="apps.iphone"
              size={20}
              color={count > 0 ? t.accentText : t.text}
              weight="semibold"
            />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[Type.headline, { color: t.text }]}>
              {count > 0
                ? `${count} ${count === 1 ? 'app or category' : 'apps & categories'}`
                : 'Choose apps to lock'}
            </Text>
            <Text style={[Type.footnote, { color: t.text2, marginTop: 1 }]}>
              {!approved
                ? 'Connect Screen Time first.'
                : mustPick
                  ? 'Firm locks need at least one app to shield.'
                  : 'Optional — you can add these later from Profile.'}
            </Text>
          </View>
        </View>
        <Button
          label={count > 0 ? 'Edit selection' : 'Choose apps'}
          variant="gray"
          small
          disabled={!approved || !APP_PICKER_AVAILABLE}
          onPress={() => setPickerOpen(true)}
          style={styles.cardBtn}
        />
      </Card>

      {/* Reward explainer */}
      <View style={[styles.banner, { backgroundColor: t.accentSoft }]}>
        <View style={[styles.bannerIcon, { backgroundColor: t.accent }]}>
          <Sym name="bolt.fill" size={18} color={t.onAccent} weight="bold" />
        </View>
        <Text style={[Type.subheadStrong, { color: t.text, flex: 1 }]}>
          {QUIZ_QUESTIONS} correct answers earn 15 minutes of screen time.
        </Text>
      </View>

      <AppPicker visible={pickerOpen} onClose={() => setPickerOpen(false)} onChange={refresh} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: Space.xl, paddingTop: Space.sm },
  content: { paddingHorizontal: Space.xl, paddingBottom: Space.xxl },
  footer: { paddingHorizontal: Space.xl, paddingTop: Space.md },

  heading: { textAlign: 'center', marginTop: Space.xl },
  sub: { textAlign: 'center', marginTop: 8 },

  stepLabel: { marginTop: Space.xl, marginBottom: Space.sm, marginHorizontal: 4 },
  card: { padding: Space.lg },
  row: { flexDirection: 'row', alignItems: 'center', gap: Space.md },
  icon: {
    width: 42,
    height: 42,
    borderRadius: Radius.control,
    borderCurve: 'continuous',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardBtn: { marginTop: Space.lg },

  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Space.md,
    marginTop: Space.xl,
    padding: Space.lg,
    borderRadius: Radius.card,
    borderCurve: 'continuous',
  },
  bannerIcon: {
    width: 38,
    height: 38,
    borderRadius: Radius.control,
    borderCurve: 'continuous',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
