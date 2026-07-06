/**
 * Screen — the standard page container: fills the viewport with the theme background and
 * applies the top safe-area inset (the OS draws the real status bar; we don't fake the
 * prototype's "9:41" bar). Set `scroll` for scrollable pages — the content container uses
 * `flexGrow:1` so a `<View style={{ flex:1 }} />` spacer can pin the CTA to the bottom, exactly
 * like the design's `flex:1` spacer + `overflow-y:auto` pattern.
 */
import type { ReactNode } from 'react';
import { ScrollView, View, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTokens } from '@/theme/theme';

export type ScreenProps = {
  children: ReactNode;
  scroll?: boolean;
  /** Applied to the content wrapper / ScrollView content container (padding, etc.). */
  contentStyle?: ViewStyle | ViewStyle[];
  /** Background override (default tokens.bg). */
  background?: string;
  /** Apply the top safe-area inset (default true). */
  topInset?: boolean;
  /** Apply the bottom safe-area inset (default false; tab screens let the tab bar handle it). */
  bottomInset?: boolean;
};

export function Screen({
  children,
  scroll,
  contentStyle,
  background,
  topInset = true,
  bottomInset = false,
}: ScreenProps) {
  const t = useTokens();
  const insets = useSafeAreaInsets();
  const paddingTop = topInset ? insets.top : 0;
  const paddingBottom = bottomInset ? insets.bottom : 0;

  return (
    <View style={{ flex: 1, backgroundColor: background ?? t.bg, paddingTop }}>
      {scroll ? (
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={[{ flexGrow: 1, paddingBottom }, contentStyle]}
          showsVerticalScrollIndicator={false}>
          {children}
        </ScrollView>
      ) : (
        <View style={[{ flex: 1, paddingBottom }, contentStyle]}>{children}</View>
      )}
    </View>
  );
}
