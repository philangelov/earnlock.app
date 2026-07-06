/**
 * PrimaryButton — the full-width CTA used across the flow. Baloo 2 700, radius 19, a colored
 * drop shadow, and a 0.97 press-scale, matching the design's primary buttons. When `disabled`
 * it renders the muted `surface2`/`text3` "not allowed" style (no shadow, no press).
 */
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View, type ViewStyle } from 'react-native';

import { Font } from '@/theme/tokens';
import { useTokens } from '@/theme/theme';

export type PrimaryButtonProps = {
  label: string;
  onPress?: () => void;
  disabled?: boolean;
  /** Left icon element (already colored). */
  icon?: ReactNode;
  /** Fill color (default primary). */
  background?: string;
  /** Label color (default onPrimary). */
  color?: string;
  /** Turn off the colored drop shadow (e.g. secondary/plain buttons). */
  noShadow?: boolean;
  style?: ViewStyle;
};

export function PrimaryButton({
  label,
  onPress,
  disabled,
  icon,
  background,
  color,
  noShadow,
  style,
}: PrimaryButtonProps) {
  const t = useTokens();
  const bg = disabled ? t.surface2 : background ?? t.primary;
  const fg = disabled ? t.text3 : color ?? t.onPrimary;
  const showShadow = !disabled && !noShadow;

  return (
    <Pressable
      onPress={disabled ? undefined : onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.base,
        { backgroundColor: bg },
        showShadow && { shadowColor: bg, ...styles.shadow },
        pressed && !disabled && styles.pressed,
        style,
      ]}>
      {icon != null && <View style={styles.icon}>{icon}</View>}
      <Text style={[styles.label, { color: fg }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    width: '100%',
    paddingVertical: 17,
    borderRadius: 19,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  shadow: {
    shadowOpacity: 0.4,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 12 },
    elevation: 8,
  },
  pressed: { transform: [{ scale: 0.97 }] },
  label: {
    fontFamily: Font.baloo700,
    fontSize: 17.5,
  },
  icon: { marginRight: 0 },
});
