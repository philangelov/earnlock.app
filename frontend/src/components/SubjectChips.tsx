/**
 * SubjectChips — the multi-select subject grid, shared by the onboarding step and the Profile
 * edit screen so both stay in step. Selection is the lime fill; a chip is never merely outlined,
 * because "chosen" is the state that seeds quiz generation.
 *
 * Subjects are unlimited: the caller passes the full ordered list (predefined + the learner's
 * own), and — when `onAddCustom` is given — a trailing "Add" chip lets them type a new one.
 */
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { haptic } from '@/lib/haptics';
import { subjectIcon } from '@/store/content';
import { Radius, Space } from '@/theme/tokens';
import { Type } from '@/theme/type';
import { useTokens } from '@/theme/theme';

import { Sym } from './Sym';

export function SubjectChips({
  subjects,
  selected,
  onToggle,
  onAddCustom,
  /** Stagger the chips in (onboarding); pass 0 for the static edit screen. */
  stagger = 0,
  /** Centred under a centred question; left-aligned inside the Profile edit form. */
  align = 'flex-start',
}: {
  /** All pickable subjects, ordered predefined-first then custom. */
  subjects: string[];
  selected: Record<string, boolean>;
  onToggle: (key: string) => void;
  /** When set, renders a trailing "Add" chip that prompts for a custom subject. */
  onAddCustom?: (name: string) => void;
  stagger?: number;
  align?: 'center' | 'flex-start';
}) {
  const t = useTokens();

  const promptCustom = () => {
    haptic.tap();
    Alert.prompt(
      'Add a subject',
      'Type any subject you want to study — questions get written for it just like the built-in ones.',
      (value) => {
        const name = (value ?? '').trim();
        if (name) {
          haptic.select();
          onAddCustom?.(name);
        }
      },
      'plain-text',
    );
  };

  return (
    <View style={[styles.chips, { justifyContent: align }]}>
      {subjects.map((key, i) => {
        const on = !!selected[key];
        return (
          <Animated.View
            key={key}
            entering={stagger > 0 ? FadeInDown.duration(360).delay(i * stagger) : undefined}
          >
            <Pressable
              accessibilityRole="checkbox"
              accessibilityLabel={key}
              accessibilityState={{ checked: on }}
              hitSlop={{ top: 6, bottom: 6 }}
              onPress={() => {
                haptic.select();
                onToggle(key);
              }}
              style={({ pressed }) => [
                styles.chip,
                on
                  ? { backgroundColor: t.accent, borderColor: t.accent }
                  : { backgroundColor: t.surface, borderColor: t.separator },
                pressed && { opacity: 0.6 },
              ]}
            >
              <Sym name={subjectIcon(key)} size={15} color={on ? t.onAccent : t.text2} />
              <Text style={[Type.subheadStrong, { color: on ? t.onAccent : t.text }]}>{key}</Text>
            </Pressable>
          </Animated.View>
        );
      })}

      {onAddCustom && (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Add a custom subject"
          hitSlop={{ top: 6, bottom: 6 }}
          onPress={promptCustom}
          style={({ pressed }) => [
            styles.chip,
            styles.addChip,
            { borderColor: t.border },
            pressed && { opacity: 0.6 },
          ]}
        >
          <Sym name="plus" size={14} color={t.text2} weight="semibold" />
          <Text style={[Type.subheadStrong, { color: t.text2 }]}>Add</Text>
        </Pressable>
      )}
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
  addChip: { borderStyle: 'dashed', borderWidth: 1 },
});
