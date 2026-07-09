/**
 * Screen — the standard page container. It fills the viewport with the theme background, applies
 * the top safe-area inset (the OS draws the real status bar; we don't fake one), and lays out
 * three bands in a flex column:
 *
 *     [ header ]   fixed
 *     [ body   ]   flex:1, scrolls when `scroll` is set
 *     [ footer ]   fixed, owns the bottom safe-area inset
 *
 * A `footer` is how a primary action stays put: it lives outside the scroll area, so it is on
 * screen from the first frame and never has to be scrolled to. With `avoidKeyboard`, the footer's
 * bottom padding tracks the keyboard — which grows the footer, which shrinks the flex:1 body, so
 * the content lifts with the keyboard rather than hiding behind it.
 *
 * Without a footer, `bottomInset` pads the content instead (the original behaviour).
 */
import type { ReactNode } from 'react';
import { ScrollView, StyleSheet, View, type ViewStyle } from 'react-native';
import Animated, { useAnimatedKeyboard, useAnimatedStyle } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Space } from '@/theme/tokens';
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
  /** Pad the content by the bottom inset. Ignored when a `footer` is present. */
  bottomInset?: boolean;
  /** Fixed band above the body — a step header, a back button. */
  header?: ReactNode;
  /** Fixed band below the body — the primary action. Never scrolls. */
  footer?: ReactNode;
  /** Padding for the footer band (horizontal padding, gaps). */
  footerStyle?: ViewStyle | ViewStyle[];
  /** Lift the footer above the keyboard. Only meaningful alongside `footer`. */
  avoidKeyboard?: boolean;
};

export function Screen({
  children,
  scroll,
  contentStyle,
  background,
  topInset = true,
  bottomInset = false,
  header,
  footer,
  footerStyle,
  avoidKeyboard,
}: ScreenProps) {
  const t = useTokens();
  const insets = useSafeAreaInsets();
  const keyboard = useAnimatedKeyboard();

  const hasFooter = footer != null;
  const paddingTop = topInset ? insets.top : 0;
  const paddingBottom = bottomInset && !hasFooter ? insets.bottom : 0;

  const footerBand = useAnimatedStyle(() => ({
    paddingBottom: avoidKeyboard
      ? Math.max(insets.bottom, keyboard.height.value + Space.md)
      : Math.max(insets.bottom, Space.md),
  }));

  const body = scroll ? (
    <ScrollView
      style={styles.flex}
      contentContainerStyle={[styles.grow, { paddingBottom }, contentStyle]}
      showsVerticalScrollIndicator={false}
      // With a footer the band already tracks the keyboard; letting the ScrollView inset as well
      // would move the content twice.
      automaticallyAdjustKeyboardInsets={!hasFooter}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="interactive"
    >
      {children}
    </ScrollView>
  ) : (
    <View style={[styles.flex, { paddingBottom }, contentStyle]}>{children}</View>
  );

  return (
    <View style={[styles.flex, { backgroundColor: background ?? t.bg, paddingTop }]}>
      {header}
      {body}
      {hasFooter && <Animated.View style={[footerStyle, footerBand]}>{footer}</Animated.View>}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  grow: { flexGrow: 1 },
});
