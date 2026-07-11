/**
 * SegmentedControl — a real UISegmentedControl on iOS (see `SegmentedControl.ios.tsx`,
 * which Metro picks instead of this file on that platform).
 *
 * This is the fallback for every other platform, where `@expo/ui/swift-ui` does not
 * exist: a hand-rolled track + thumb built from tokens. It is deliberately a separate
 * file rather than a `Platform.OS` branch, because importing the SwiftUI tree at module
 * scope on Android or web crashes with "Unable to get view config".
 */
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { haptic } from '@/lib/haptics';
import { Radius } from '@/theme/tokens';
import { Type } from '@/theme/type';
import { useThemeMode, useTokens } from '@/theme/theme';

export type SegmentedControlProps = {
  options: string[];
  selectedIndex: number;
  onChange: (index: number) => void;
};

export function SegmentedControl({ options, selectedIndex, onChange }: SegmentedControlProps) {
  const t = useTokens();
  const { dark } = useThemeMode();
  // The thumb must read as raised ABOVE the track in both themes. In light the track is
  // grey and the thumb is white (surface); in dark, surface is darker than the track, so
  // the lighter fillStrong is what reads as "on top".
  const thumb = dark ? t.fillStrong : t.surface;

  return (
    <View style={[styles.track, { backgroundColor: t.fill }]}>
      {options.map((option, i) => {
        const active = i === selectedIndex;
        return (
          <Pressable
            key={option}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            hitSlop={{ top: 10, bottom: 10 }}
            onPress={() => {
              haptic.select();
              onChange(i);
            }}
            style={[styles.segment, active && { backgroundColor: thumb }]}
          >
            <Text style={[Type.footnoteStrong, { color: active ? t.text : t.text2 }]}>
              {option}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  track: { flexDirection: 'row', padding: 2, borderRadius: Radius.chip, gap: 2 },
  segment: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: Radius.chip - 2,
    borderCurve: 'continuous',
  },
});
