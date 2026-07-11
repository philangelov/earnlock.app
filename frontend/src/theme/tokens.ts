/**
 * EarnLock color tokens — a clean, near-monochrome iOS-native palette anchored by a single
 * electric-lime accent. Everything structural is greyscale (system-faithful grouped
 * backgrounds, elevated surfaces, hairline separators); lime is reserved for the moments
 * that matter — earned time, the primary action, live progress, the "unlocked" state.
 *
 * Rules of the system:
 *  - `accent` is a FILL and a stroke, never body text. Text/icons on top of it use `onAccent`.
 *  - When we truly need accent-colored text on a page, use `accentText` (a readable,
 *    contrast-safe lime that darkens on light backgrounds and brightens on dark).
 *  - `danger` (system red) is the only other hue, reserved for SOS / destructive / "incorrect".
 *  - The "locked" state is intentionally monochrome, not red — restraint reads as calm.
 *
 * Every color in the app must come from here — no ad-hoc hex values in components.
 */

export const LightTokens = {
  /** Grouped page background (iOS systemGroupedBackground, nudged cooler). */
  bg: '#f4f5f7',
  /** Elevated card / sheet surface. */
  surface: '#ffffff',
  /** A second elevated tone for nested surfaces on white. */
  surface2: '#f6f7f9',
  /** Sunken fill — progress tracks, unselected chips, icon wells. */
  fill: '#eceef2',
  /** Stronger sunken fill for pressed / secondary buttons. */
  fillStrong: '#e2e5ea',

  /** Primary label. */
  text: '#0b0b0f',
  /** Secondary label. */
  text2: '#6a6c76',
  /** Tertiary label — small captions, meta. Passes AA on bg + surface at 11–13px. */
  text3: '#8b8d97',

  /** Hairline separator (opaque equivalent of ~8% black). */
  separator: '#e4e5ea',
  /** Slightly stronger border for outlined controls. */
  border: '#d9dbe1',

  /** Electric lime — the one accent. Fills, rings, selected states, "earned". */
  accent: '#c2f235',
  /** Pressed accent. */
  accentPress: '#b2e21f',
  /** Text / icons that sit on top of an `accent` fill. */
  onAccent: '#14180a',
  /** Soft lime wash for chips / tinted buttons / highlight fills. */
  accentSoft: '#eef8cf',
  /** Contrast-safe lime for accent-colored TEXT on light surfaces (dark chartreuse). */
  accentText: '#4b6b00',

  /** System red — SOS, destructive, "incorrect". */
  danger: '#ff3b30',
  dangerSoft: '#ffe8e6',
  onDanger: '#ffffff',

  /**
   * Icon-well fills, Settings-style: a saturated rounded square with a white glyph.
   *
   * These are the ONE place other hues are allowed, and they are decoration, not meaning:
   * the colour identifies a row at a glance, it never encodes state. State is still said
   * with `accent` (earned/active) and `danger` (destructive), which is why `iconRed`
   * matches `danger` exactly rather than being a fourth shade of red. Values are Apple's
   * system colors so they sit correctly beside real iOS chrome.
   */
  iconBlue: '#007aff',
  iconIndigo: '#5856d6',
  iconPurple: '#af52de',
  iconOrange: '#ff9500',
  iconTeal: '#30b0c7',
  iconRed: '#ff3b30',
  iconGray: '#8e8e93',
  /** Glyph drawn on any `icon*` fill. */
  onIcon: '#ffffff',

  /** Dimmed overlay behind modals and locked-app tiles (same in both themes). */
  scrim: 'rgba(10,10,16,0.5)',
} as const;

export type TokenName = keyof typeof LightTokens;
export type Tokens = Record<TokenName, string>;

export const DarkTokens: Tokens = {
  bg: '#000000',
  surface: '#141416',
  surface2: '#1c1c20',
  fill: '#26262b',
  fillStrong: '#303036',

  text: '#ffffff',
  text2: '#9c9ea6',
  text3: '#7c7e88',

  separator: '#2a2a30',
  border: '#33343b',

  accent: '#cbff45',
  accentPress: '#bdf52f',
  onAccent: '#12160a',
  accentSoft: 'rgba(203,255,69,0.14)',
  accentText: '#cbff45',

  danger: '#ff453a',
  dangerSoft: 'rgba(255,69,58,0.16)',
  onDanger: '#ffffff',

  // Apple's dark-mode system colors: brighter and slightly desaturated so they don't
  // vibrate against black.
  iconBlue: '#0a84ff',
  iconIndigo: '#5e5ce6',
  iconPurple: '#bf5af2',
  iconOrange: '#ff9f0a',
  iconTeal: '#40c8e0',
  iconRed: '#ff453a',
  iconGray: '#8e8e93',
  onIcon: '#ffffff',

  scrim: 'rgba(0,0,0,0.6)',
};

/**
 * Corner radii — continuous (squircle) curves via `borderCurve: 'continuous'`.
 * Cards read as calm rectangles; only true pills use `pill`.
 */
export const Radius = {
  card: 22,
  cardInner: 16,
  tile: 15,
  control: 14,
  chip: 11,
  pill: 999,
} as const;

/** 4-pt spacing scale used for gaps / padding across screens. */
export const Space = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 28,
  xxxl: 40,
} as const;
