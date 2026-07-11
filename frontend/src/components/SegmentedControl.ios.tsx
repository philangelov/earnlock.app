/**
 * SegmentedControl (iOS) — a real `UISegmentedControl`, via SwiftUI's `Picker` with the
 * `.segmented` style (`@expo/ui/swift-ui`). Nothing here is drawn by us: the sliding
 * thumb, the press states, the haptics and the dark-mode palette are all the system's.
 *
 * `@expo/ui/swift-ui` is iOS-only — importing it at module scope elsewhere crashes with
 * "Unable to get view config" — which is exactly why this lives in a `.ios.tsx` file
 * beside a portable fallback rather than behind a `Platform.OS` branch.
 *
 * `Host` is given the app's own colour scheme, not the device's: EarnLock's appearance is
 * an in-app setting, and this control is how you change it, so it must repaint with the
 * choice you just made rather than with whatever iOS is set to.
 */
import { Host } from '@expo/ui';
import { Picker, Text } from '@expo/ui/swift-ui';
import { pickerStyle, tag } from '@expo/ui/swift-ui/modifiers';

import { useThemeMode } from '@/theme/theme';

import type { SegmentedControlProps } from './SegmentedControl';

export type { SegmentedControlProps };

export function SegmentedControl({ options, selectedIndex, onChange }: SegmentedControlProps) {
  const { dark } = useThemeMode();

  return (
    <Host matchContents colorScheme={dark ? 'dark' : 'light'}>
      <Picker
        selection={selectedIndex}
        onSelectionChange={(index) => onChange(Number(index))}
        modifiers={[pickerStyle('segmented')]}
      >
        {options.map((option, i) => (
          <Text key={option} modifiers={[tag(i)]}>
            {option}
          </Text>
        ))}
      </Picker>
    </Host>
  );
}
