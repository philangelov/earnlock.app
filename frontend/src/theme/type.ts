/**
 * Type scale — the system font (San Francisco on iOS) at Apple's text styles. Using the
 * platform font, weights, and tracking is the single strongest "native" signal, so we drop
 * the custom display fonts entirely. Presets are spread into a Text `style`, with color
 * applied separately from tokens:
 *
 *   <Text style={[Type.title1, { color: t.text }]}>Today</Text>
 *
 * Numeric presets (`display`, `mono`) carry tabular-nums so counters don't jitter.
 * `fontFamily` is intentionally omitted → the OS resolves its own UI font.
 */
import type { TextStyle } from 'react-native';

const w = (weight: TextStyle['fontWeight']) => ({ fontWeight: weight });

export const Type = {
  /** Oversized hero numerals — the countdown. */
  display: {
    fontSize: 68,
    lineHeight: 72,
    letterSpacing: -1.5,
    fontVariant: ['tabular-nums'],
    ...w('700'),
  },
  /** The countdown inside the Today dial — sized to breathe within the ring. */
  dial: {
    fontSize: 52,
    lineHeight: 56,
    letterSpacing: -1.2,
    fontVariant: ['tabular-nums'],
    ...w('700'),
  },
  /** Medium hero numeral (stat headline values). */
  numberLg: {
    fontSize: 30,
    lineHeight: 34,
    letterSpacing: 0.2,
    fontVariant: ['tabular-nums'],
    ...w('700'),
  },
  number: {
    fontSize: 22,
    lineHeight: 26,
    fontVariant: ['tabular-nums'],
    ...w('700'),
  },

  largeTitle: { fontSize: 34, lineHeight: 41, letterSpacing: 0.37, ...w('700') },
  title1: { fontSize: 28, lineHeight: 34, letterSpacing: 0.36, ...w('700') },
  title2: { fontSize: 22, lineHeight: 28, letterSpacing: -0.26, ...w('700') },
  title3: { fontSize: 20, lineHeight: 25, letterSpacing: -0.45, ...w('600') },
  headline: { fontSize: 17, lineHeight: 22, letterSpacing: -0.43, ...w('600') },
  body: { fontSize: 17, lineHeight: 23, letterSpacing: -0.43, ...w('400') },
  bodyStrong: { fontSize: 17, lineHeight: 23, letterSpacing: -0.43, ...w('600') },
  callout: { fontSize: 16, lineHeight: 21, letterSpacing: -0.32, ...w('400') },
  calloutStrong: { fontSize: 16, lineHeight: 21, letterSpacing: -0.32, ...w('600') },
  subhead: { fontSize: 15, lineHeight: 20, letterSpacing: -0.23, ...w('400') },
  subheadStrong: { fontSize: 15, lineHeight: 20, letterSpacing: -0.23, ...w('600') },
  footnote: { fontSize: 13, lineHeight: 18, letterSpacing: -0.08, ...w('400') },
  footnoteStrong: { fontSize: 13, lineHeight: 18, letterSpacing: -0.08, ...w('600') },
  caption: { fontSize: 12, lineHeight: 16, ...w('400') },
  captionStrong: { fontSize: 12, lineHeight: 16, ...w('600') },
  /** All-caps section label (grouped-list headers, tag rows). */
  overline: { fontSize: 12, lineHeight: 16, letterSpacing: 0.6, ...w('600') },
} as const satisfies Record<string, TextStyle>;

export type TypeName = keyof typeof Type;
