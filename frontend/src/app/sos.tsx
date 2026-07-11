/**
 * Emergency unlock — a bottom sheet sized exactly to its content (`fitToContents`).
 *
 * Nothing here adds the bottom safe-area inset. A `formSheet` is already anchored above
 * the home indicator by UIKit, so padding by `insets.bottom` on top of that leaves a band
 * of dead white under the last control — which is what made the sheet look like it had
 * slipped down the screen. The only bottom padding is the sheet's own breathing room.
 */
import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/Button';
import { Sym } from '@/components/Sym';
import { haptic } from '@/lib/haptics';
import { useEarnLock } from '@/store/useEarnLock';
import { Radius, Space } from '@/theme/tokens';
import { Type } from '@/theme/type';
import { useTokens } from '@/theme/theme';

export default function SosScreen() {
  const t = useTokens();
  const router = useRouter();
  const sosUsed = useEarnLock((s) => s.sosUsed);
  const activateSos = useEarnLock((s) => s.activateSos);

  return (
    // No flex:1 — `fitToContents` measures this view, so it must have intrinsic height.
    <View style={styles.root}>
      <View style={[styles.icon, { backgroundColor: t.dangerSoft }]}>
        <Sym name="exclamationmark.shield.fill" size={28} color={t.danger} />
      </View>

      <Text style={[Type.title2, styles.title, { color: t.text }]}>Emergency unlock</Text>
      <Text style={[Type.callout, styles.subtitle, { color: t.text2 }]}>
        Open all your apps for 2 minutes, right now — no quiz required.
      </Text>

      <View style={[styles.warning, { backgroundColor: t.dangerSoft }]}>
        <Sym name="exclamationmark.triangle.fill" size={18} color={t.danger} />
        <Text style={[Type.footnote, styles.warnText, { color: t.text }]}>
          {sosUsed
            ? 'You’ve used your 1 SOS today. Finish a lesson to repay it and refresh your allowance.'
            : 'This puts you in debt — you repay it by finishing your next lesson.'}
        </Text>
      </View>

      <Button
        label={sosUsed ? 'No SOS left today' : 'Use my SOS · 2 min'}
        variant="danger"
        disabled={sosUsed}
        onPress={() => {
          haptic.warning();
          activateSos();
          router.back();
        }}
        style={styles.action}
      />

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Not now"
        onPress={() => {
          haptic.tap();
          router.back();
        }}
        style={({ pressed }) => [styles.notNow, pressed && { opacity: 0.6 }]}
      >
        <Text style={[Type.calloutStrong, { color: t.text2 }]}>Not now</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    paddingHorizontal: Space.xl,
    // The grabber lives in the top band; start below it.
    paddingTop: Space.xl,
    paddingBottom: Space.lg,
  },
  icon: {
    width: 60,
    height: 60,
    borderRadius: Radius.card,
    borderCurve: 'continuous',
    alignSelf: 'center',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { textAlign: 'center', marginTop: Space.lg },
  subtitle: { textAlign: 'center', marginTop: 6 },
  warning: {
    flexDirection: 'row',
    gap: 10,
    padding: Space.lg,
    borderRadius: Radius.control,
    borderCurve: 'continuous',
    marginTop: Space.xl,
    alignItems: 'flex-start',
  },
  warnText: { flex: 1, lineHeight: 18 },
  action: { marginTop: Space.xl },
  notNow: { marginTop: Space.xs, paddingVertical: 14, alignItems: 'center' },
});
