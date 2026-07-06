/**
 * EarnLock color tokens — transcribed 1:1 from the design prototype's `themeVars()`
 * (EarnLock.dc.html). Four accent families: purple (primary/actions), pink (streak /
 * journey / accents), green (earned / correct), blue (coins / info). `*Soft` variants are
 * the same hues at ~15% alpha for icon/chip backgrounds.
 *
 * Every color in the app must come from here — no ad-hoc hex values in components.
 */

export const LightTokens = {
  bg: '#eef0f6',
  bg2: '#ffffff',
  surface: '#ffffff',
  surface2: '#e9eaf1',
  text: '#191a24',
  text2: '#666a7a',
  text3: '#a3a6b6',
  border: '#e3e4ee',
  primary: '#7c3aed',
  primaryPress: '#6a2fd8',
  primarySoft: '#f0e9ff',
  onPrimary: '#ffffff',
  success: '#00a851',
  successSoft: '#e0f7ea',
  danger: '#f5384e',
  dangerSoft: '#ffe8ea',
  pink: '#e6248a',
  pinkSoft: '#ffe4f1',
  blue: '#0a84ff',
  blueSoft: '#e2efff',
  cyan: '#0a84ff',
  cyanSoft: '#e2efff',
  teal: '#00a851',
  tealSoft: '#e0f7ea',
  orange: '#e6248a',
  orangeSoft: '#ffe4f1',
  gold: '#0a84ff',
  fire: '#e6248a',
  statusInk: '#191a24',
} as const;

export type TokenName = keyof typeof LightTokens;
export type Tokens = Record<TokenName, string>;

export const DarkTokens: Tokens = {
  bg: '#000000',
  bg2: '#000000',
  surface: '#121216',
  surface2: '#1e1e24',
  text: '#ffffff',
  text2: '#9a9aa4',
  text3: '#6a6a74',
  border: '#2a2a31',
  primary: '#8b5cf6',
  primaryPress: '#7a45f0',
  primarySoft: 'rgba(139,92,246,0.18)',
  onPrimary: '#ffffff',
  success: '#00e676',
  successSoft: 'rgba(0,230,118,0.15)',
  danger: '#ff4d5e',
  dangerSoft: 'rgba(255,77,94,0.15)',
  pink: '#ff2d9b',
  pinkSoft: 'rgba(255,45,155,0.16)',
  blue: '#1e9bff',
  blueSoft: 'rgba(30,155,255,0.16)',
  cyan: '#1e9bff',
  cyanSoft: 'rgba(30,155,255,0.16)',
  teal: '#00e676',
  tealSoft: 'rgba(0,230,118,0.15)',
  orange: '#ff2d9b',
  orangeSoft: 'rgba(255,45,155,0.16)',
  gold: '#1e9bff',
  fire: '#ff2d9b',
  statusInk: '#ffffff',
};

/**
 * Font families loaded in the root layout via @expo-google-fonts.
 * Baloo 2 = headings, titles, the big hero numbers. Nunito = body text.
 * On native, custom font weights only apply through the exact family name, so we
 * reference the weighted variant directly instead of relying on `fontWeight`.
 */
export const Font = {
  baloo500: 'Baloo2_500Medium',
  baloo600: 'Baloo2_600SemiBold',
  baloo700: 'Baloo2_700Bold',
  baloo800: 'Baloo2_800ExtraBold',
  nunito400: 'Nunito_400Regular',
  nunito600: 'Nunito_600SemiBold',
  nunito700: 'Nunito_700Bold',
  nunito800: 'Nunito_800ExtraBold',
  nunito900: 'Nunito_900Black',
} as const;
