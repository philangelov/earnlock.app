import { useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text } from 'react-native';

import { OnboardingStep } from '@/components/onboarding/OnboardingStep';
import { PermissionPrompt } from '@/components/onboarding/PermissionPrompt';
import { haptic } from '@/lib/haptics';
import { notificationExample } from '@/store/onboarding';
import { useEarnLock } from '@/store/useEarnLock';
import { Space } from '@/theme/tokens';
import { Type } from '@/theme/type';
import { useTokens } from '@/theme/theme';

/**
 * The mock alert IS this screen's call to action, so there's no pinned button underneath — two
 * competing "Allow"s would be worse than none.
 */
export default function NotificationsStep() {
  const t = useTokens();
  const router = useRouter();
  const [asking, setAsking] = useState(false);

  const habits = useEarnLock((s) => s.habits);
  const setNotificationsGranted = useEarnLock((s) => s.setNotificationsGranted);

  const example = notificationExample(habits);
  const next = () => router.push('/onboarding/account');

  const allow = async () => {
    if (asking) return;
    setAsking(true);
    try {
      // Imported on demand: on a build whose pods predate expo-notifications, this throws here
      // rather than taking the whole route down at module load.
      const Notifications = await import('expo-notifications');
      const { granted } = await Notifications.requestPermissionsAsync();
      setNotificationsGranted(granted);
      if (granted) haptic.success();
    } catch {
      // No native module (Expo Go without a rebuild) — a permission must never dead-end the flow.
      setNotificationsGranted(false);
    } finally {
      setAsking(false);
      next();
    }
  };

  const deny = () => {
    setNotificationsGranted(false);
    next();
  };

  return (
    <OnboardingStep
      step="notifications"
      title="Reach your goals with notifications"
      onBack={() => router.back()}
      center
    >
      <PermissionPrompt onAllow={() => void allow()} onDeny={deny} busy={asking} />

      <Text style={[Type.caption, styles.example, { color: t.text3 }]}>
        From the habits you picked, they read like:{'\n'}“{example}”
      </Text>
    </OnboardingStep>
  );
}

const styles = StyleSheet.create({
  example: { textAlign: 'center', marginTop: Space.xxl, lineHeight: 18 },
});
