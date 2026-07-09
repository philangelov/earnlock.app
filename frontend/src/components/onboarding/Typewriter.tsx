/**
 * Typewriter — reveals `text` one character at a time behind a blinking caret. Used once, for the
 * greeting: the name arriving letter by letter is what makes it read as addressed to you rather
 * than templated at you.
 *
 * The whole string is exposed to assistive tech immediately — a screen reader should not have to
 * wait out an animation.
 */
import { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View, type TextStyle } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { useTokens } from '@/theme/theme';

export function Typewriter({
  text,
  speed = 55,
  delay = 250,
  style,
  onDone,
}: {
  text: string;
  /** Milliseconds per character. */
  speed?: number;
  delay?: number;
  style?: TextStyle | TextStyle[];
  onDone?: () => void;
}) {
  const t = useTokens();
  const [count, setCount] = useState(0);

  // Held in a ref so a fresh inline callback each render can't restart the typing.
  const done = useRef(onDone);
  useEffect(() => {
    done.current = onDone;
  }, [onDone]);

  useEffect(() => {
    let tick: ReturnType<typeof setInterval>;
    let i = 0;
    const start = setTimeout(() => {
      tick = setInterval(() => {
        i += 1;
        setCount(i);
        if (i >= text.length) {
          clearInterval(tick);
          done.current?.();
        }
      }, speed);
    }, delay);

    return () => {
      clearTimeout(start);
      clearInterval(tick);
    };
  }, [text, speed, delay]);

  const finished = count >= text.length;

  const blink = useSharedValue(1);
  useEffect(() => {
    blink.value = withRepeat(
      withSequence(
        withTiming(0, { duration: 420, easing: Easing.inOut(Easing.quad) }),
        withTiming(1, { duration: 420, easing: Easing.inOut(Easing.quad) }),
      ),
      -1,
    );
  }, [blink]);
  const caret = useAnimatedStyle(() => ({ opacity: finished ? 0 : blink.value }));

  return (
    <View style={styles.row} accessible accessibilityLabel={text}>
      <Text style={style} accessibilityElementsHidden importantForAccessibility="no">
        {text.slice(0, count)}
      </Text>
      <Animated.View style={[styles.caret, caret, { backgroundColor: t.accent }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  caret: { width: 3, height: 30, marginLeft: 4, borderRadius: 2 },
});
