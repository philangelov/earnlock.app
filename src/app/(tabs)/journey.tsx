import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Path, Svg } from 'react-native-svg';

import { Icon } from '@/components/Icon';
import { ProgressRing } from '@/components/ProgressRing';
import { Screen } from '@/components/Screen';
import { JOURNEY_LEVELS, JOURNEY_POINTS, JOURNEY_VIEWBOX, smoothPath } from '@/store/content';
import { useEarnLock } from '@/store/useEarnLock';
import { Font } from '@/theme/tokens';
import { useTokens } from '@/theme/theme';

const RW = JOURNEY_VIEWBOX.w; // 300
const RH = JOURNEY_VIEWBOX.h; // 560

const activeIdx = JOURNEY_LEVELS.findIndex((l) => l.state === 'active');
const roadPathD = smoothPath(JOURNEY_POINTS);
const roadDoneD = smoothPath(JOURNEY_POINTS.slice(0, activeIdx + 1));

export default function JourneyScreen() {
  const t = useTokens();
  const router = useRouter();
  const coins = useEarnLock((s) => s.coins);
  const streak = useEarnLock((s) => s.streak);
  const routeVar = useEarnLock((s) => s.routeVar);
  const resetQuizFlow = useEarnLock((s) => s.resetQuizFlow);
  const isA = routeVar === 'A';

  const startQuiz = () => {
    resetQuizFlow();
    router.push('/quiz');
  };

  return (
    <Screen scroll contentStyle={styles.content}>
      {/* Top stat pills */}
      <View style={styles.topRow}>
        <View style={[styles.pill, { backgroundColor: t.surface, borderColor: t.border }]}>
          <Icon name="coin" size={17} color={t.gold} />
          <Text style={[styles.pillText, { color: t.text }]}>{coins}</Text>
        </View>
        <View style={[styles.pill, { backgroundColor: t.surface, borderColor: t.border }]}>
          <Icon name="flame" size={17} color={t.fire} />
          <Text style={[styles.pillText, { color: t.text }]}>{streak} day streak</Text>
        </View>
      </View>

      {/* Chapter card */}
      <View style={[styles.chapterCard, { backgroundColor: t.surface, borderColor: t.border }]}>
        <View style={{ flex: 1 }}>
          <Text style={[styles.chapterKicker, { color: t.primary }]}>Chapter 1</Text>
          <Text style={[styles.chapterTitle, { color: t.text }]}>Cell Biology</Text>
        </View>
        <ProgressRing
          size={54}
          viewBox={40}
          rings={[
            {
              r: 15,
              strokeWidth: 5,
              trackColor: t.surface2,
              color: t.primary,
              circumference: 94.25,
              offset: 49.9,
            },
          ]}>
          <Text style={[styles.ringText, { color: t.text }]}>47%</Text>
        </ProgressRing>
      </View>

      {/* Road + level nodes */}
      <View style={[styles.road, { minHeight: RH }]}>
        <Svg
          style={StyleSheet.absoluteFill}
          width="100%"
          height="100%"
          viewBox={`0 0 ${RW} ${RH}`}
          preserveAspectRatio="none">
          {isA ? (
            <>
              <Path
                d={roadPathD}
                stroke={t.surface2}
                strokeWidth={34}
                fill="none"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <Path
                d={roadPathD}
                stroke={t.border}
                strokeWidth={30}
                fill="none"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <Path
                d={roadPathD}
                stroke={t.border}
                strokeWidth={5}
                fill="none"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeDasharray={[1, 22]}
              />
              <Path
                d={roadDoneD}
                stroke={t.pink}
                strokeWidth={30}
                fill="none"
                strokeLinecap="round"
                strokeLinejoin="round"
                opacity={0.9}
              />
            </>
          ) : (
            <>
              <Path
                d={roadPathD}
                stroke={t.border}
                strokeWidth={7}
                fill="none"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeDasharray={[0.5, 15]}
              />
              <Path
                d={roadDoneD}
                stroke={t.pink}
                strokeWidth={7}
                fill="none"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeDasharray={[0.5, 15]}
              />
            </>
          )}
        </Svg>

        {JOURNEY_LEVELS.map((level, i) => {
          const p = JOURNEY_POINTS[i];
          const isActive = level.state === 'active';
          const isDone = level.state === 'done';
          const isLocked = level.state === 'locked';
          const size = isActive ? 78 : 66;
          const boxRadius = isA ? 22 : size / 2;
          const col = t[level.col];

          const boxStyle = isLocked
            ? {
                width: size,
                height: size,
                borderRadius: boxRadius,
                backgroundColor: t.surface2,
                borderWidth: 2,
                borderColor: t.border,
                boxShadow: 'inset 0px 2px 6px rgba(0,0,0,0.08)',
              }
            : {
                width: size,
                height: size,
                borderRadius: boxRadius,
                backgroundColor: col,
                shadowColor: col,
                shadowOpacity: 0.45,
                shadowRadius: 12,
                shadowOffset: { width: 0, height: 8 },
                elevation: 6,
              };

          return (
            <Pressable
              key={i}
              onPress={isActive ? startQuiz : undefined}
              style={[
                styles.node,
                { left: `${(p.x / RW) * 100}%`, top: `${(p.y / RH) * 100}%` },
              ]}>
              <View style={[styles.box, boxStyle]}>
                {isActive && (
                  <View
                    style={[
                      styles.pulse,
                      { borderColor: t.primary, borderRadius: isA ? 22 : (size + 4) / 2 },
                    ]}
                  />
                )}
                {isDone && (
                  <Icon
                    name="check"
                    size={isA ? 30 : 28}
                    color="#fff"
                    strokeWidth={isA ? 3.2 : 3.4}
                  />
                )}
                {isActive && <Icon name="bolt" size={isA ? 32 : 30} color="#fff" />}
                {isLocked && <Icon name="lockSolid" size={isA ? 26 : 24} color={t.text3} />}
                {isActive && (
                  <View style={[styles.startBadge, { backgroundColor: t.primary }]}>
                    <Text style={styles.startText}>START</Text>
                  </View>
                )}
              </View>
              <Text style={[styles.label, { color: isLocked ? t.text3 : t.text }]}>
                {level.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingTop: 2, paddingHorizontal: 22, paddingBottom: 8 },

  topRow: { flexDirection: 'row', gap: 8, marginTop: 6 },
  pill: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 13,
    padding: 9,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  pillText: { fontFamily: Font.nunito800, fontSize: 15 },

  chapterCard: {
    flexDirection: 'row',
    gap: 14,
    alignItems: 'center',
    paddingVertical: 15,
    paddingHorizontal: 18,
    borderRadius: 20,
    borderWidth: 1,
    marginTop: 12,
  },
  chapterKicker: {
    fontFamily: Font.nunito800,
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  chapterTitle: { fontFamily: Font.baloo800, fontSize: 19, lineHeight: 20.9, marginTop: 2 },
  ringText: { fontFamily: Font.nunito800, fontSize: 12.5 },

  road: { flex: 1, marginTop: 6 },

  node: {
    position: 'absolute',
    alignItems: 'center',
    zIndex: 2,
    transform: [{ translateX: '-50%' }, { translateY: '-50%' }],
  },
  box: { alignItems: 'center', justifyContent: 'center' },
  pulse: {
    position: 'absolute',
    top: -2,
    left: -2,
    right: -2,
    bottom: -2,
    borderWidth: 3,
    opacity: 0.55,
  },
  startBadge: {
    position: 'absolute',
    top: -32,
    left: '50%',
    transform: [{ translateX: '-50%' }],
    paddingVertical: 5,
    paddingHorizontal: 12,
    borderRadius: 999,
  },
  startText: { fontFamily: Font.nunito800, fontSize: 11, color: '#fff' },
  label: {
    marginTop: 9,
    fontFamily: Font.nunito800,
    fontSize: 11.5,
    textAlign: 'center',
    maxWidth: 96,
    lineHeight: 13.5,
  },
});
