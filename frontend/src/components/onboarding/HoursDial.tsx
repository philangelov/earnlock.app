/**
 * HoursDial — the hours-per-day answer: a hero numeral over a draggable track with −/+ stepping.
 * The numeral is deliberately never animated: scaling 68pt text softens it for the whole
 * animation, and the haptic already reports the change.
 */
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Sym } from '@/components/Sym';
import { haptic } from '@/lib/haptics';
import { HOURS_MAX, HOURS_MIN } from '@/store/onboarding';
import { Radius, Space } from '@/theme/tokens';
import { Type } from '@/theme/type';
import { useTokens } from '@/theme/theme';

import { DragTrack } from './DragTrack';

export function HoursDial({
  value,
  onChange,
  min = HOURS_MIN,
  max = HOURS_MAX,
}: {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
}) {
  const t = useTokens();

  const step = (delta: number) => {
    const next = Math.min(max, Math.max(min, value + delta));
    if (next === value) return;
    haptic.select();
    onChange(next);
  };

  return (
    <View style={styles.root}>
      <Text style={[Type.display, { color: t.text }]}>{value}</Text>
      <Text style={[Type.overline, styles.unit, { color: t.text3 }]}>
        {value >= max ? 'HOURS OR MORE' : value === 1 ? 'HOUR' : 'HOURS'}
      </Text>

      <View style={styles.controls}>
        <RoundButton
          icon="minus"
          label="Fewer hours"
          disabled={value <= min}
          onPress={() => step(-1)}
        />
        <DragTrack
          value={value}
          min={min}
          max={max}
          onChange={onChange}
          accessibilityLabel="Hours on your phone each day"
        />
        <RoundButton
          icon="plus"
          label="More hours"
          disabled={value >= max}
          onPress={() => step(1)}
        />
      </View>
    </View>
  );
}

function RoundButton({
  icon,
  label,
  onPress,
  disabled,
}: {
  icon: 'plus' | 'minus';
  label: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  const t = useTokens();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!disabled }}
      disabled={disabled}
      hitSlop={8}
      onPress={onPress}
      style={({ pressed }) => [
        styles.round,
        { backgroundColor: t.fill },
        pressed && !disabled && { opacity: 0.6 },
        disabled && { opacity: 0.35 },
      ]}
    >
      <Sym name={icon} size={16} color={t.text} weight="bold" />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { alignItems: 'center' },
  unit: { marginTop: 2 },
  controls: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'stretch',
    gap: Space.lg,
    marginTop: Space.xxl,
  },
  round: {
    width: 40,
    height: 40,
    borderRadius: Radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
