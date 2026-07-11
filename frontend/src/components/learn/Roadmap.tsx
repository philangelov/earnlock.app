/**
 * Roadmap — the Learn tab's path, in the shape of a Mimo/Duolingo level map.
 *
 * What a node *is* matters more than how it looks: every node is one real quiz. The done
 * ones are attempts pulled from `quiz_history` and they carry the score the learner
 * actually got. The active node is the quiz that `POST /quiz/generate` will hand back
 * next. The locked ones are the rest of the chapter, which genuinely cannot be started
 * until the active one is finished. Nothing on this screen is a placeholder.
 *
 * The trail is drawn in two passes rather than one. Segments the learner has already
 * walked are laid in the accent, over a gradient; the rest stay a sunken neutral. So the
 * path itself reports progress — you can see how far you've come without reading a single
 * number, and the accent always terminates exactly at the node you can press.
 *
 * Geometry: nodes sit on a serpentine (`sin` at quarter-turns → centre, right, centre,
 * left, centre), joined by cubic curves whose control points are pulled past halfway
 * vertically, so the trail leaves and enters every node straight down instead of cutting
 * a diagonal. A faint dot grid sits underneath to give the path something to travel over.
 */
import { memo, useEffect, useId } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { Circle, Defs, LinearGradient, Path, Stop, Svg } from 'react-native-svg';

import { Appear } from '@/components/Appear';
import { Ring } from '@/components/charts/Ring';
import { Sym } from '@/components/Sym';
import { haptic } from '@/lib/haptics';
import { Space } from '@/theme/tokens';
import { Type } from '@/theme/type';
import { useThemeMode, useTokens } from '@/theme/theme';

const NODE = 70;
const ROW = 108;
/** How far a node swings from the centre line at the peak of the serpentine. */
const AMPLITUDE = 62;
const TRAIL_WIDTH = 14;
const DOT_GRID = 34;

export type NodeState = 'done' | 'active' | 'locked';

export type RoadmapNode = {
  key: string;
  state: NodeState;
  /** Real score for a finished attempt, e.g. "4/5". Absent when the server has no
   *  denominator for it (pre-migration rows) or the node isn't finished. */
  score?: string;
};

export type Chapter = {
  /** 1-based, counted over the learner's whole history — not over what's on screen. */
  number: number;
  title: string;
  /** Short label inside the header ring, e.g. "2/5". Replaced by a tick once complete. */
  ringLabel: string;
  /** 0..1 across this chapter's nodes; drives the header ring. */
  progress: number;
  nodes: RoadmapNode[];
};

/** Where node `i` sits, in the chapter's own coordinate space. */
function nodeCenter(index: number, width: number) {
  return {
    x: width / 2 + AMPLITUDE * Math.sin((index * Math.PI) / 2),
    y: NODE / 2 + index * ROW,
  };
}

/** The curve from node `i` to node `i + 1`. */
function segment(index: number, width: number): string {
  const from = nodeCenter(index, width);
  const to = nodeCenter(index + 1, width);
  // Vertical handles pulled past halfway: the tangents stay upright at each knot, so the
  // path reads as a road rather than a zigzag of diagonals.
  const pull = ROW * 0.62;
  return `M ${from.x} ${from.y} C ${from.x} ${from.y + pull}, ${to.x} ${to.y - pull}, ${to.x} ${to.y}`;
}

function dotGrid(width: number, height: number) {
  const dots: { x: number; y: number }[] = [];
  for (let y = DOT_GRID / 2; y < height; y += DOT_GRID) {
    for (let x = DOT_GRID / 2; x < width; x += DOT_GRID) {
      dots.push({ x, y });
    }
  }
  return dots;
}

export function Roadmap({
  chapters,
  width,
  onStart,
}: {
  chapters: Chapter[];
  width: number;
  onStart: () => void;
}) {
  return (
    <View style={styles.root}>
      {chapters.map((chapter) => (
        <ChapterSection key={chapter.number} chapter={chapter} width={width} onStart={onStart} />
      ))}
    </View>
  );
}

function ChapterSection({
  chapter,
  width,
  onStart,
}: {
  chapter: Chapter;
  width: number;
  onStart: () => void;
}) {
  const t = useTokens();
  const { dark } = useThemeMode();
  const height = (chapter.nodes.length - 1) * ROW + NODE;
  // React's ids carry colons, which have no business inside an SVG `url(#…)` reference.
  const gradientId = `trail-${useId().replace(/[^a-zA-Z0-9]/g, '')}`;

  // On a black page the sunken `fill` all but disappears, taking the unwalked trail and
  // the dot grid with it — the path would read as if it simply stopped at the active
  // node. One step up the neutral ramp restores the same figure/ground relationship the
  // light theme gets for free.
  const trailTrack = dark ? t.fillStrong : t.fill;
  const dotColor = dark ? t.border : t.separator;

  return (
    <View style={styles.chapter}>
      <View style={styles.header}>
        <View style={styles.headerText}>
          <Text style={[Type.overline, { color: t.text3 }]}>CHAPTER {chapter.number}</Text>
          <Text style={[Type.title3, { color: t.text, marginTop: 1 }]} numberOfLines={1}>
            {chapter.title}
          </Text>
        </View>
        <Ring
          size={44}
          strokeWidth={4}
          progress={chapter.progress}
          color={t.accent}
          trackColor={trailTrack}
        >
          {chapter.progress >= 1 ? (
            <Sym name="checkmark" size={14} color={t.accentText} weight="bold" />
          ) : (
            <Text style={[Type.caption, { color: t.text2 }]}>{chapter.ringLabel}</Text>
          )}
        </Ring>
      </View>

      <View style={{ width, height }}>
        <Svg width={width} height={height} style={StyleSheet.absoluteFill}>
          <Defs>
            <LinearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor={t.accent} />
              <Stop offset="1" stopColor={t.accentPress} />
            </LinearGradient>
          </Defs>

          {dotGrid(width, height).map((dot, i) => (
            <Circle key={i} cx={dot.x} cy={dot.y} r={1.4} fill={dotColor} />
          ))}

          {chapter.nodes.slice(0, -1).map((node, i) => {
            // A segment is walked when the node it leaves has been finished: reaching the
            // next node is exactly what finishing this one buys you.
            const walked = node.state === 'done';
            return (
              <Path
                key={i}
                d={segment(i, width)}
                stroke={walked ? `url(#${gradientId})` : trailTrack}
                strokeWidth={TRAIL_WIDTH}
                strokeLinecap="round"
                fill="none"
              />
            );
          })}
        </Svg>

        {chapter.nodes.map((node, i) => {
          const { x, y } = nodeCenter(i, width);
          return (
            <View
              key={node.key}
              style={[styles.nodeSlot, { left: x - NODE / 2, top: y - NODE / 2 }]}
            >
              <PathNode node={node} index={i} onPress={onStart} />
            </View>
          );
        })}
      </View>
    </View>
  );
}

const PathNode = memo(function PathNode({
  node,
  index,
  onPress,
}: {
  node: RoadmapNode;
  index: number;
  onPress: () => void;
}) {
  const t = useTokens();
  const { dark } = useThemeMode();
  const active = node.state === 'active';

  const palette = {
    done: { bg: t.accent, fg: t.onAccent, border: 'transparent' as string },
    active: { bg: t.surface, fg: t.accentText, border: t.accent },
    // Same reason as the trail: `fill` vanishes against black.
    locked: { bg: dark ? t.fillStrong : t.fill, fg: t.text3, border: 'transparent' as string },
  }[node.state];

  const icon = { done: 'checkmark', active: 'bolt.fill', locked: 'lock.fill' } as const;

  return (
    <View style={styles.node}>
      {active && <Pulse color={t.accent} />}

      {/* A hair of a disc peeking out below gives the node a lip to stand on — the same
          trick a physical button uses, and the reason the path reads as three-dimensional
          without a single shadow layer in dark mode, where shadows are invisible. */}
      {node.state !== 'locked' && (
        <View
          pointerEvents="none"
          style={[
            styles.lip,
            {
              backgroundColor:
                node.state === 'done' ? t.accentPress : dark ? t.border : t.fillStrong,
            },
          ]}
        />
      )}

      {/* `Appear`, not `entering={ZoomIn}` — a layout animation that fails to start leaves
          the node at opacity 0, and the active node is the only pressable thing here. */}
      <Appear delay={index * 60} duration={300} scaleFrom={0.82}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={
            active
              ? 'Start the next quiz'
              : node.state === 'done'
                ? `Finished${node.score ? `, scored ${node.score}` : ''}`
                : 'Locked — finish the quiz before it'
          }
          accessibilityState={{ disabled: !active }}
          disabled={!active}
          onPress={() => {
            haptic.press();
            onPress();
          }}
          style={({ pressed }) => [
            styles.disc,
            {
              backgroundColor: palette.bg,
              borderColor: palette.border,
              borderWidth: active ? 3 : 0,
            },
            node.state !== 'locked' && !dark && styles.discRaised,
            pressed && styles.discPressed,
          ]}
        >
          <Sym name={icon[node.state]} size={active ? 26 : 22} color={palette.fg} weight="bold" />
        </Pressable>
      </Appear>

      {active ? (
        <Text style={[Type.captionStrong, styles.caption, { color: t.accentText }]}>START</Text>
      ) : node.score ? (
        <Text style={[Type.caption, styles.caption, { color: t.text3 }]}>{node.score}</Text>
      ) : null}
    </View>
  );
});

/** The one moving thing on the page: a slow halo that says "you are here". */
function Pulse({ color }: { color: string }) {
  const beat = useSharedValue(0);

  useEffect(() => {
    beat.value = withDelay(
      400,
      withRepeat(
        withSequence(
          withTiming(1, { duration: 1400, easing: Easing.out(Easing.quad) }),
          // Hold at 1 — where the halo is already fully transparent — so the pulses
          // breathe instead of strobing.
          withTiming(1, { duration: 700 }),
          withTiming(0, { duration: 0 }),
        ),
        -1,
        false,
      ),
    );
  }, [beat]);

  const halo = useAnimatedStyle(() => ({
    opacity: 0.28 * (1 - beat.value),
    transform: [{ scale: 1 + beat.value * 0.45 }],
  }));

  return (
    <Animated.View pointerEvents="none" style={[styles.halo, halo, { backgroundColor: color }]} />
  );
}

const styles = StyleSheet.create({
  root: { gap: Space.xxl },
  chapter: { gap: Space.lg },

  header: { flexDirection: 'row', alignItems: 'center', gap: Space.md },
  headerText: { flex: 1 },

  nodeSlot: { position: 'absolute', width: NODE, alignItems: 'center' },
  node: { alignItems: 'center' },
  disc: {
    width: NODE,
    height: NODE,
    borderRadius: NODE / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  discRaised: { boxShadow: '0px 4px 12px rgba(12,12,20,0.16)' },
  discPressed: { transform: [{ scale: 0.94 }] },
  lip: {
    position: 'absolute',
    top: 4,
    width: NODE,
    height: NODE,
    borderRadius: NODE / 2,
  },
  halo: {
    position: 'absolute',
    top: 0,
    width: NODE,
    height: NODE,
    borderRadius: NODE / 2,
  },
  caption: { marginTop: 9 },
});
