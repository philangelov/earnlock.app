/**
 * CountUp — a numeral that eases from zero up to `to`. Used for the reveal's hero figure, where
 * the number arriving is the whole point: a static "766" is a claim, a number climbing to 766
 * is a result.
 */
import { useEffect, useState } from 'react';
import { Text, type TextStyle } from 'react-native';

/** Thousands separators without depending on the runtime's Intl build. */
function group(n: number): string {
  return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

export function CountUp({
  to,
  duration = 1500,
  delay = 0,
  style,
}: {
  to: number;
  duration?: number;
  delay?: number;
  style?: TextStyle | TextStyle[];
}) {
  const [n, setN] = useState(0);

  useEffect(() => {
    let raf = 0;
    let startedAt = 0;

    const tick = (now: number) => {
      if (startedAt === 0) startedAt = now;
      const elapsed = now - startedAt - delay;
      if (elapsed < 0) {
        raf = requestAnimationFrame(tick);
        return;
      }
      const p = Math.min(1, elapsed / duration);
      // easeOutCubic — fast arrival, gentle landing.
      setN(Math.round((1 - Math.pow(1 - p, 3)) * to));
      if (p < 1) raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [to, duration, delay]);

  return (
    <Text style={style} accessibilityLabel={group(to)}>
      {group(n)}
    </Text>
  );
}
