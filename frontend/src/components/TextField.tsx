/**
 * TextField — the single-line input used by the onboarding questions.
 *
 * Focus is a colour transition, not a swap: the border eases from `separator` to `accent` over a
 * cubic curve while a soft accent ring fades in behind the field. The fill stays `surface`
 * throughout — washing the background in lime on focus fights the text for attention, and in dark
 * mode `accentSoft` is translucent, so interpolating into it would let the page background bleed
 * through mid-animation.
 *
 * Nothing about the geometry changes on focus (the border keeps its width, the ring is absolutely
 * positioned outside the field), so the text never reflows or resamples.
 */
import { useEffect, useState, type ReactNode } from 'react';
import { StyleSheet, TextInput, View, type TextInputProps } from 'react-native';
import Animated, {
  Easing,
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { Radius, Space } from '@/theme/tokens';
import { Type } from '@/theme/type';
import { useTokens } from '@/theme/theme';

/** How far the focus ring sits outside the field. */
const RING = 4;
const FADE = { duration: 220, easing: Easing.out(Easing.cubic) } as const;

export type TextFieldProps = Omit<TextInputProps, 'style'> & {
  /** Element pinned to the right inside the field (validity check, unit, etc.). */
  trailing?: ReactNode;
};

export function TextField({ trailing, onFocus, onBlur, ...rest }: TextFieldProps) {
  const t = useTokens();
  const [focused, setFocused] = useState(false);

  const on = useSharedValue(0);
  useEffect(() => {
    on.value = withTiming(focused ? 1 : 0, FADE);
  }, [on, focused]);

  const field = useAnimatedStyle(() => ({
    borderColor: interpolateColor(on.value, [0, 1], [t.separator, t.accent]),
  }));
  const ring = useAnimatedStyle(() => ({ opacity: on.value * 0.3 }));

  return (
    <View>
      <Animated.View pointerEvents="none" style={[styles.ring, ring, { borderColor: t.accent }]} />

      <Animated.View style={[styles.field, field, { backgroundColor: t.surface }]}>
        <TextInput
          placeholderTextColor={t.text3}
          selectionColor={t.accentText}
          cursorColor={t.accentText}
          onFocus={(e) => {
            setFocused(true);
            onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocused(false);
            onBlur?.(e);
          }}
          style={[Type.title3, styles.input, { color: t.text }]}
          {...rest}
        />
        {trailing != null && <View style={styles.trailing}>{trailing}</View>}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  ring: {
    position: 'absolute',
    top: -RING,
    left: -RING,
    right: -RING,
    bottom: -RING,
    borderRadius: Radius.control + RING,
    borderCurve: 'continuous',
    borderWidth: RING,
  },
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Space.lg,
    borderRadius: Radius.control,
    borderCurve: 'continuous',
    // A constant width, so only the colour moves — an animated border width would nudge the text.
    borderWidth: 1,
  },
  input: { flex: 1, paddingVertical: 18, textAlign: 'center' },
  // Absolute so it can't pull the centred text off-centre.
  trailing: { position: 'absolute', right: Space.lg },
});
