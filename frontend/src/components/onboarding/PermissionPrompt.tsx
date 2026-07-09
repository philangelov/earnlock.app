/**
 * PermissionPrompt — a facsimile of the iOS notification permission alert, with a finger nudging
 * toward Allow. Tapping either button is real: "Allow" raises the actual system dialog (which
 * lands in the same place, over the same words, with the thumb already there), and "Don't Allow"
 * moves on without asking.
 *
 * The forgery is the point, so it stays a forgery: the alert carries the system's own sentence and
 * no marketing of ours. The reason we want the permission belongs on the screen around it.
 */
import { useEffect } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { Radius, Space } from '@/theme/tokens';
import { Type } from '@/theme/type';
import { useThemeMode, useTokens } from '@/theme/theme';

export function PermissionPrompt({
  onAllow,
  onDeny,
  busy,
}: {
  onAllow: () => void;
  onDeny: () => void;
  busy?: boolean;
}) {
  const t = useTokens();
  const { dark } = useThemeMode();

  // The system alert is a light panel floating over a dimmed screen. On our light background that
  // means a step *down* into grey; on black it means a step *up* out of it.
  const panel = dark ? t.surface2 : t.fillStrong;

  const bob = useSharedValue(0);
  useEffect(() => {
    bob.value = withRepeat(
      withSequence(
        withTiming(-7, { duration: 560, easing: Easing.inOut(Easing.quad) }),
        withTiming(0, { duration: 560, easing: Easing.inOut(Easing.quad) }),
      ),
      -1,
    );
  }, [bob]);
  const finger = useAnimatedStyle(() => ({ transform: [{ translateY: bob.value }] }));

  return (
    <View style={styles.root}>
      <View style={[styles.alert, { backgroundColor: panel, borderColor: t.separator }]}>
        <Text style={[Type.headline, styles.title, { color: t.text }]}>
          “EarnLock” Would Like to Send You Notifications
        </Text>

        <View style={[styles.rule, { backgroundColor: t.border }]} />

        <View style={styles.buttons}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Don’t allow notifications"
            disabled={busy}
            onPress={onDeny}
            style={({ pressed }) => [styles.button, pressed && { opacity: 0.5 }]}
          >
            <Text style={[Type.body, { color: t.text }]}>Don’t Allow</Text>
          </Pressable>

          <View style={[styles.vRule, { backgroundColor: t.border }]} />

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Allow notifications"
            disabled={busy}
            onPress={onAllow}
            style={({ pressed }) => [
              styles.button,
              { backgroundColor: t.accent },
              pressed && { opacity: 0.8 },
              busy && { opacity: 0.6 },
            ]}
          >
            <Text style={[Type.bodyStrong, { color: t.onAccent }]}>Allow</Text>
          </Pressable>
        </View>
      </View>

      {/* Sits under the right half — i.e. under Allow. */}
      <View style={styles.fingerRow} pointerEvents="none">
        <View style={styles.half} />
        <View style={styles.half}>
          <Animated.Text style={[styles.finger, finger]}>👆</Animated.Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { alignSelf: 'center', width: '100%', maxWidth: 320 },

  alert: {
    borderRadius: Radius.cardInner,
    borderCurve: 'continuous',
    borderWidth: StyleSheet.hairlineWidth,
    // Clips the Allow fill into the alert's bottom-right corner.
    overflow: 'hidden',
  },
  title: { textAlign: 'center', paddingHorizontal: Space.xl, paddingVertical: Space.xxl },

  rule: { height: StyleSheet.hairlineWidth },
  vRule: { width: StyleSheet.hairlineWidth },
  buttons: { flexDirection: 'row' },
  button: { flex: 1, height: 52, alignItems: 'center', justifyContent: 'center' },

  fingerRow: { flexDirection: 'row', marginTop: Space.sm },
  half: { flex: 1, alignItems: 'center' },
  finger: { fontSize: 32, lineHeight: 40 },
});
