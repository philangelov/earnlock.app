/**
 * Logo — the EarnLock mark.
 *
 * The source PNG is a white silhouette on transparency, so it is invisible on a light background
 * as shipped. It's rendered as a template image instead: `tintColor` paints the mask with the
 * primary label colour, which inverts with the theme — black on the light page, white on the dark
 * one — and the lime stays reserved for the action below it.
 */
import { Image } from 'expo-image';

import { useTokens } from '@/theme/theme';

// `require`, not an ES import: PNG modules carry no type declarations here, so `import` fails tsc.
const MARK = require('../../assets/earnlock-logo.png');

export function Logo({ size = 72, color }: { size?: number; color?: string }) {
  const t = useTokens();
  return (
    <Image
      source={MARK}
      tintColor={(color ?? t.text) as string}
      contentFit="contain"
      style={{ width: size, height: size }}
      accessible
      accessibilityLabel="EarnLock"
    />
  );
}
