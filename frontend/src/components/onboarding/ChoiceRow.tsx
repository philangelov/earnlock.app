/**
 * ChoiceRow — one selectable answer in an onboarding question. Handles both shapes:
 * `multi` renders a checkbox (habits), otherwise a radio (usage, commitment).
 *
 * Selection animates the fill and border between `surface`/`separator` and `accentSoft`/`accent`
 * rather than swapping them instantly, which is what makes a list of these feel considered.
 *
 * Timing curves only, no springs: a spring overshoot rescales the row's text mid-flight, and the
 * intermediate frames rasterise soft. Colour and opacity transitions stay crisp.
 */
import { useEffect } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  FadeIn,
  FadeInDown,
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { Sym, type SymName } from '@/components/Sym';
import { haptic } from '@/lib/haptics';
import { Radius, Space } from '@/theme/tokens';
import { Type } from '@/theme/type';
import { useTokens } from '@/theme/theme';

export function ChoiceRow({
  label,
  desc,
  icon,
  selected,
  multi,
  onPress,
  delay = 0,
}: {
  label: string;
  desc?: string;
  icon?: SymName;
  selected: boolean;
  /** Checkbox (many answers) instead of radio (one answer). */
  multi?: boolean;
  onPress: () => void;
  /** Stagger for the entering animation. */
  delay?: number;
}) {
  const t = useTokens();

  const on = useSharedValue(selected ? 1 : 0);
  useEffect(() => {
    on.value = withTiming(selected ? 1 : 0, { duration: 180, easing: Easing.out(Easing.quad) });
  }, [on, selected]);

  const surface = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(on.value, [0, 1], [t.surface, t.accentSoft]),
    borderColor: interpolateColor(on.value, [0, 1], [t.separator, t.accent]),
  }));

  return (
    <Animated.View entering={FadeInDown.duration(400).delay(delay)}>
      <Pressable
        accessibilityRole={multi ? 'checkbox' : 'radio'}
        accessibilityLabel={label}
        accessibilityHint={desc}
        accessibilityState={{ checked: selected }}
        onPress={() => {
          haptic.select();
          onPress();
        }}
        style={({ pressed }) => pressed && styles.pressed}
      >
        <Animated.View style={[styles.row, surface]}>
          {icon != null && (
            <View style={[styles.iconWell, { backgroundColor: selected ? t.accent : t.fill }]}>
              <Sym name={icon} size={16} color={selected ? t.onAccent : t.text2} />
            </View>
          )}

          <View style={styles.copy}>
            <Text style={[Type.calloutStrong, { color: t.text }]}>{label}</Text>
            {desc != null && (
              <Text style={[Type.footnote, { color: t.text2, marginTop: 2 }]}>{desc}</Text>
            )}
          </View>

          <View
            style={[
              multi ? styles.box : styles.circle,
              selected
                ? { backgroundColor: t.accent, borderColor: t.accent }
                : { borderColor: t.border },
            ]}
          >
            {selected && (
              <Animated.View entering={FadeIn.duration(120)}>
                <Sym name="checkmark" size={11} color={t.onAccent} weight="bold" />
              </Animated.View>
            )}
          </View>
        </Animated.View>
      </Pressable>
    </Animated.View>
  );
}

const MARK = 22;

const styles = StyleSheet.create({
  // Opacity, not scale — scaling a row of text for a press blurs it for the duration.
  pressed: { opacity: 0.6 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Space.md,
    paddingVertical: 14,
    paddingHorizontal: Space.lg,
    borderRadius: Radius.control,
    borderCurve: 'continuous',
    borderWidth: StyleSheet.hairlineWidth,
  },
  iconWell: {
    width: 32,
    height: 32,
    borderRadius: Radius.chip,
    borderCurve: 'continuous',
    alignItems: 'center',
    justifyContent: 'center',
  },
  copy: { flex: 1 },
  circle: {
    width: MARK,
    height: MARK,
    borderRadius: Radius.pill,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  box: {
    width: MARK,
    height: MARK,
    borderRadius: 7,
    borderCurve: 'continuous',
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
