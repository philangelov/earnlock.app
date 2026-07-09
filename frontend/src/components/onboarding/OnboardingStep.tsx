/**
 * OnboardingStep — the single layout every first-run question uses, so thirteen screens read as
 * one flow: progress header, centred question, optional supporting line, the answer control, and
 * an action pinned to the bottom with an optional ghost action above it ("I don't know").
 *
 * Header and footer are `Screen`'s fixed bands: the CTA is on screen from the first frame and is
 * never something you have to scroll to find.
 */
import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { Button } from '@/components/Button';
import { Screen } from '@/components/Screen';
import { StepHeader } from '@/components/StepHeader';
import { haptic } from '@/lib/haptics';
import { STEP_TOTAL, stepIndex, type OnboardStep } from '@/store/onboarding';
import { Space } from '@/theme/tokens';
import { Type } from '@/theme/type';
import { useTokens } from '@/theme/theme';

export type OnboardingStepProps = {
  /** Which step this is — drives the progress bar. */
  step: OnboardStep;
  title: string;
  subtitle?: string;
  /** Optional element under the subtitle (social proof pill, derived-value chip). */
  badge?: ReactNode;
  children?: ReactNode;

  onBack: () => void;
  onSkip?: () => void;
  skipLabel?: string;

  ctaLabel?: string;
  ctaDisabled?: boolean;
  /** Omit when the step's own content carries the action — the footer disappears with it. */
  onCta?: () => void;
  /** Quiet text action directly above the CTA. */
  ghostLabel?: string;
  onGhost?: () => void;

  /** Centre the answer control in the space between header and footer. */
  center?: boolean;
  /** Lift the footer above the keyboard (text-entry steps). */
  avoidKeyboard?: boolean;
};

export function OnboardingStep({
  step,
  title,
  subtitle,
  badge,
  children,
  onBack,
  onSkip,
  skipLabel,
  ctaLabel = 'Continue',
  ctaDisabled,
  onCta,
  ghostLabel,
  onGhost,
  center,
  avoidKeyboard,
}: OnboardingStepProps) {
  const t = useTokens();

  const header = (
    <StepHeader
      step={stepIndex(step)}
      total={STEP_TOTAL}
      onBack={onBack}
      onSkip={onSkip}
      skipLabel={skipLabel}
    />
  );

  const footer =
    onCta != null ? (
      <>
        {ghostLabel != null && onGhost != null && (
          <Text
            accessibilityRole="button"
            suppressHighlighting
            onPress={() => {
              haptic.tap();
              onGhost();
            }}
            style={[Type.subheadStrong, styles.ghost, { color: t.text3 }]}
          >
            {ghostLabel}
          </Text>
        )}
        <Button label={ctaLabel} disabled={ctaDisabled} onPress={onCta} />
      </>
    ) : undefined;

  return (
    <Screen
      scroll
      contentStyle={styles.content}
      header={<View style={styles.header}>{header}</View>}
      footer={footer}
      footerStyle={styles.footer}
      avoidKeyboard={avoidKeyboard}
    >
      <Animated.View entering={FadeInDown.duration(420)}>
        <Text style={[Type.title1, styles.title, { color: t.text }]}>{title}</Text>
      </Animated.View>

      {subtitle != null && (
        <Animated.View entering={FadeInDown.duration(420).delay(70)}>
          <Text style={[Type.subhead, styles.subtitle, { color: t.text2 }]}>{subtitle}</Text>
        </Animated.View>
      )}

      {badge}

      <Animated.View
        entering={FadeInDown.duration(460).delay(140)}
        style={[styles.body, center && styles.bodyCentered]}
      >
        {children}
      </Animated.View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: Space.xl, paddingTop: Space.sm, paddingBottom: Space.lg },
  content: { paddingHorizontal: Space.xl, paddingBottom: Space.xl },

  title: { textAlign: 'center' },
  subtitle: { textAlign: 'center', marginTop: 8 },

  body: { marginTop: Space.xxl },
  // `center` keeps the question pinned under the header and floats the control in the space left
  // over — the field, the wheel and the sliders want the optical centre, not the top of the gap.
  // `flexGrow` rather than `flex`, so the control keeps its intrinsic height and the page scrolls
  // when the keyboard leaves too little room, instead of the control being squeezed.
  bodyCentered: { flexGrow: 1, justifyContent: 'center', marginTop: Space.lg },

  footer: { paddingHorizontal: Space.xl, paddingTop: Space.md, gap: Space.lg },
  ghost: { textAlign: 'center', paddingVertical: 4 },
});
