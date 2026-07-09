/**
 * SubjectChips — the multi-select subject grid, shared by the onboarding step and the Profile
 * edit screen so both stay in step. Selection is the lime fill; a chip is never merely outlined,
 * because "chosen" is the state that seeds quiz generation.
 */
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { haptic } from '@/lib/haptics';
import { SUBJECT_DEFS, type SubjectKey } from '@/store/content';
import { Radius, Space } from '@/theme/tokens';
import { Type } from '@/theme/type';
import { useTokens } from '@/theme/theme';

import { Sym } from './Sym';

export function SubjectChips({
  selected,
  onToggle,
  /** Stagger the chips in (onboarding); pass 0 for the static edit screen. */
  stagger = 0,
  /** Centred under a centred question; left-aligned inside the Profile edit form. */
  align = 'flex-start',
}: {
  selected: Record<SubjectKey, boolean>;
  onToggle: (key: SubjectKey) => void;
  stagger?: number;
  align?: 'center' | 'flex-start';
}) {
  const t = useTokens();
  return (
    <View style={[styles.chips, { justifyContent: align }]}>
      {SUBJECT_DEFS.map((s, i) => {
        const on = selected[s.key];
        return (
          <Animated.View
            key={s.key}
            entering={stagger > 0 ? FadeInDown.duration(360).delay(i * stagger) : undefined}
          >
            <Pressable
              accessibilityRole="checkbox"
              accessibilityLabel={s.key}
              accessibilityState={{ checked: on }}
              hitSlop={{ top: 6, bottom: 6 }}
              onPress={() => {
                haptic.select();
                onToggle(s.key);
              }}
              style={({ pressed }) => [
                styles.chip,
                on
                  ? { backgroundColor: t.accent, borderColor: t.accent }
                  : { backgroundColor: t.surface, borderColor: t.separator },
                pressed && { opacity: 0.6 },
              ]}
            >
              <Sym name={s.icon} size={15} color={on ? t.onAccent : t.text2} />
              <Text style={[Type.subheadStrong, { color: on ? t.onAccent : t.text }]}>{s.key}</Text>
            </Pressable>
          </Animated.View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: Space.sm },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingVertical: 9,
    paddingHorizontal: 14,
    borderRadius: Radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
  },
});
