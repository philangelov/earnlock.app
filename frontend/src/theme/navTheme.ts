/**
 * Bridges the app's token theme onto React Navigation so native Stack headers and the native
 * tab bar adopt the EarnLock palette and follow the in-app light/dark toggle. Headers use the
 * system font (no override) for a true first-party large-title look; the lime shows only in the
 * interactive tint (back chevrons, bar buttons) via the contrast-safe `accentText`.
 */
import { DarkTheme, DefaultTheme } from 'expo-router';
import { Platform } from 'react-native';

import type { Tokens } from './tokens';

export function makeNavTheme(dark: boolean, t: Tokens) {
  const base = dark ? DarkTheme : DefaultTheme;
  return {
    ...base,
    dark,
    colors: {
      ...base.colors,
      primary: t.accentText,
      background: t.bg,
      card: t.surface,
      text: t.text,
      border: t.separator,
      notification: t.danger,
    },
  };
}

// iOS 26 retired the frosted "chrome material" nav bar for Liquid Glass. At rest the bar is
// invisible and the large title sits on the page; on scroll the content dissolves *under* the bar
// through a soft, edge-to-edge glass fade — no opaque material, no hairline. That fade is the
// native `UIScrollEdgeEffect`, surfaced by react-native-screens as the `scrollEdgeEffects` screen
// option (iOS 26+); its `soft` top edge is the transparent progressive blur the system apps use.
//
// It is mutually exclusive with `headerBlurEffect`: setting both stacks the native effect on top
// of a `UIBlurEffect` background, which is exactly the heavy, un-transparent bar we're replacing.
// So on 26 we drop the blur and the hairline and let the soft edge carry the header. On older iOS
// (deployment target is 16.4) `scrollEdgeEffects` is a no-op, so there we keep the
// `systemChromeMaterial` blur + hairline that stood in for Liquid Glass — the Settings look.
const glassHeader = Platform.OS === 'ios' && parseInt(String(Platform.Version), 10) >= 26;

export function tabStackOptions(t: Tokens) {
  return {
    headerLargeTitle: true,

    // `headerTransparent: true` is what lets content scroll *under* the bar — false makes it
    // opaque and pushes content down, with nothing behind it. What frosts the content underneath
    // then comes from `glassHeader`: the iOS 26 soft scroll-edge effect, or the chrome-material
    // blur below it. The space at rest and the under-bar scroll both come from TabScreen's
    // `contentInsetAdjustmentBehavior="automatic"`.
    headerTransparent: true,
    ...(glassHeader
      ? { scrollEdgeEffects: { top: 'soft' as const }, headerShadowVisible: false }
      : { headerBlurEffect: 'systemChromeMaterial' as const, headerShadowVisible: true }),
    // No shadow under the *expanded* large title — that one really is just decoration.
    headerLargeTitleShadowVisible: false,
    headerStyle: { backgroundColor: 'transparent' },
    headerLargeStyle: { backgroundColor: 'transparent' },
    headerTintColor: t.accentText,
    headerTitleStyle: { color: t.text },
    headerLargeTitleStyle: { color: t.text },
    contentStyle: { backgroundColor: 'transparent' },
  };
}
