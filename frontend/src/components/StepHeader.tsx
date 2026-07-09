/**
 * StepHeader — the top bar for the onboarding flow: a back chevron, a progress bar, and an
 * optional trailing "Skip". The bar animates from the previous step's fraction to this step's on
 * mount, so pushing a screen visibly advances it rather than snapping.
 *
 * When a screen is reused as an EDIT screen (opened from Profile rather than the linear first-run
 * flow), pass `title` instead — the bar is replaced by a centered title, so we don't imply a
 * wizard that isn't happening.
 */
import { useEffect } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { haptic } from '@/lib/haptics';
import { Radius, Space } from '@/theme/tokens';
import { Type } from '@/theme/type';
import { useTokens } from '@/theme/theme';

import { Sym } from './Sym';

export function StepHeader({
  step,
  total,
  title,
  onBack,
  onSkip,
  skipLabel = 'Skip',
}: {
  /** Zero-based index of the current step. */
  step: number;
  total: number;
  /** Edit-mode title — when set, replaces the progress bar. */
  title?: string;
  onBack: () => void;
  /** Renders a trailing text button when provided. */
  onSkip?: () => void;
  skipLabel?: string;
}) {
  const t = useTokens();

  // Grow the bar on mount: from where the previous screen left it, to this step's share.
  const progress = useSharedValue(step / total);
  useEffect(() => {
    progress.value = withTiming((step + 1) / total, {
      duration: 480,
      easing: Easing.out(Easing.cubic),
    });
  }, [progress, step, total]);

  const fill = useAnimatedStyle(() => ({ width: `${progress.value * 100}%` }));

  return (
    <View style={styles.root}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Go back"
        hitSlop={12}
        onPress={() => {
          haptic.tap();
          onBack();
        }}
        style={({ pressed }) => [
          styles.back,
          { backgroundColor: t.fill },
          pressed && { opacity: 0.6 },
        ]}
      >
        <Sym name="chevron.left" size={17} color={t.text} weight="semibold" />
      </Pressable>

      {title ? (
        <Text style={[Type.headline, styles.title, { color: t.text }]} numberOfLines={1}>
          {title}
        </Text>
      ) : (
        <View
          style={[styles.track, { backgroundColor: t.fill }]}
          accessibilityRole="progressbar"
          accessibilityLabel={`Step ${step + 1} of ${total}`}
          accessibilityValue={{ min: 0, max: total, now: step + 1 }}
        >
          <Animated.View style={[styles.fill, { backgroundColor: t.accent }, fill]} />
        </View>
      )}

      {onSkip ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={skipLabel}
          hitSlop={12}
          onPress={() => {
            haptic.tap();
            onSkip();
          }}
          style={({ pressed }) => [styles.skip, pressed && { opacity: 0.5 }]}
        >
          <Text style={[Type.subheadStrong, { color: t.text3 }]}>{skipLabel}</Text>
        </Pressable>
      ) : (
        <View style={styles.spacer} />
      )}
    </View>
  );
}

const CONTROL = 34;

const styles = StyleSheet.create({
  root: { flexDirection: 'row', alignItems: 'center', gap: Space.md },
  back: {
    width: CONTROL,
    height: CONTROL,
    borderRadius: Radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  track: { flex: 1, height: 5, borderRadius: Radius.pill, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: Radius.pill },
  title: { flex: 1, textAlign: 'center' },
  skip: { minWidth: CONTROL, alignItems: 'flex-end' },
  spacer: { width: CONTROL },
});
