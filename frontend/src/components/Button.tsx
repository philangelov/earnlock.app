/**
 * Button — the full-width action used across the flow. Four variants keep the palette
 * disciplined:
 *   - `filled`  (default) electric-lime fill, near-black `onAccent` label — the primary action.
 *   - `tinted`  soft-lime wash, `accentText` label — secondary / lower-commitment.
 *   - `gray`    neutral fill, primary label — tertiary / "not now".
 *   - `danger`  system-red fill, white label — SOS / destructive.
 * A 0.97 press-scale + medium haptic on press. `disabled` renders the muted fill (no haptic).
 */
import type { ReactNode } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View, type ViewStyle } from 'react-native';

import { haptic } from '@/lib/haptics';
import { Radius } from '@/theme/tokens';
import { Type } from '@/theme/type';
import { useTokens } from '@/theme/theme';

export type ButtonVariant = 'filled' | 'tinted' | 'gray' | 'danger';

export type ButtonProps = {
  label: string;
  onPress?: () => void;
  disabled?: boolean;
  variant?: ButtonVariant;
  /** Optional leading SF Symbol element (already colored to match `fg`). */
  icon?: ReactNode;
  /** Show a spinner in place of the icon and swallow presses while a task runs. */
  loading?: boolean;
  /** Compact height for inline / secondary placements. */
  small?: boolean;
  style?: ViewStyle;
};

export function Button({
  label,
  onPress,
  disabled,
  variant = 'filled',
  icon,
  loading,
  small,
  style,
}: ButtonProps) {
  const t = useTokens();

  const palette: Record<ButtonVariant, { bg: string; fg: string }> = {
    filled: { bg: t.accent, fg: t.onAccent },
    tinted: { bg: t.accentSoft, fg: t.accentText },
    gray: { bg: t.fill, fg: t.text },
    danger: { bg: t.danger, fg: t.onDanger },
  };
  const { bg, fg } = disabled ? { bg: t.fill, fg: t.text3 } : palette[variant];
  const blocked = !!disabled || !!loading;

  const handlePress = () => {
    if (blocked) return;
    haptic.press();
    onPress?.();
  };

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: blocked, busy: !!loading }}
      onPress={handlePress}
      disabled={blocked}
      style={({ pressed }) => [
        styles.base,
        { backgroundColor: bg, paddingVertical: small ? 13 : 16.5 },
        pressed && !blocked && styles.pressed,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator size="small" color={fg} />
      ) : (
        icon != null && <View>{icon}</View>
      )}
      <Text style={[small ? Type.subheadStrong : Type.headline, { color: fg }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    width: '100%',
    borderRadius: Radius.control,
    borderCurve: 'continuous',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  pressed: { transform: [{ scale: 0.97 }], opacity: 0.9 },
});
