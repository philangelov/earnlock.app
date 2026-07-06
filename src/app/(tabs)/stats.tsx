/**
 * Stats — activity rings, weekly focus bars, and subject mastery (main tab).
 * All static sample data; no navigation. Transcribed 1:1 from the design prototype.
 */
import { StyleSheet, Text, View } from 'react-native';

import { ProgressRing } from '@/components/ProgressRing';
import { Screen } from '@/components/Screen';
import { SUBJECT_STATS, WEEK_BARS, WEEK_TODAY_INDEX } from '@/store/content';
import { Font, type TokenName } from '@/theme/tokens';
import { useTokens } from '@/theme/theme';

type LegendItem = { label: string; value: number; total: number; col: TokenName };

const LEGEND: LegendItem[] = [
  { label: 'QUESTIONS', value: 41, total: 50, col: 'pink' },
  { label: 'MINUTES EARNED', value: 72, total: 100, col: 'success' },
  { label: 'DAY STREAK', value: 4, total: 7, col: 'cyan' },
];

export default function StatsScreen() {
  const t = useTokens();

  return (
    <Screen scroll contentStyle={styles.content}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={[styles.title, { color: t.text }]}>Your progress</Text>
        <Text style={[styles.headerWeek, { color: t.text3 }]}>This week</Text>
      </View>

      {/* Activity rings card */}
      <View style={[styles.ringsCard, { backgroundColor: t.surface, borderColor: t.border }]}>
        <ProgressRing
          size={132}
          viewBox={140}
          rings={[
            { r: 58, strokeWidth: 12, trackColor: t.pinkSoft, color: t.pink, circumference: 364.42, offset: 65.6 },
            { r: 45, strokeWidth: 12, trackColor: t.successSoft, color: t.success, circumference: 282.74, offset: 99.0 },
            { r: 32, strokeWidth: 12, trackColor: t.cyanSoft, color: t.cyan, circumference: 201.06, offset: 100.5 },
          ]}
        />
        <View style={styles.legend}>
          {LEGEND.map((item) => (
            <View key={item.label} style={styles.legendItem}>
              <View style={styles.legendHead}>
                <View style={[styles.dot, { backgroundColor: t[item.col] }]} />
                <Text style={[styles.legendLabel, { color: t.text2 }]}>{item.label}</Text>
              </View>
              <Text style={[styles.legendValue, { color: t.text }]}>
                {item.value}
                <Text style={[styles.legendTotal, { color: t.text3 }]}> / {item.total}</Text>
              </Text>
            </View>
          ))}
        </View>
      </View>

      {/* Focus minutes card */}
      <View style={[styles.focusCard, { backgroundColor: t.surface, borderColor: t.border }]}>
        <View style={styles.cardHead}>
          <Text style={[styles.cardTitle, { color: t.text }]}>Focus minutes</Text>
          <Text style={[styles.focusTotal, { color: t.blue }]}>3h 48m</Text>
        </View>
        <View style={styles.bars}>
          {WEEK_BARS.map((bar, i) => (
            <View key={i} style={styles.barCol}>
              <View
                style={[
                  styles.bar,
                  {
                    height: 14 + bar.v * 84,
                    backgroundColor: i === WEEK_TODAY_INDEX ? t.primary : t.blueSoft,
                  },
                ]}
              />
              <Text style={[styles.barDay, { color: t.text3 }]}>{bar.d}</Text>
            </View>
          ))}
        </View>
      </View>

      {/* Subject mastery card */}
      <View style={[styles.masteryCard, { backgroundColor: t.surface, borderColor: t.border }]}>
        <Text style={[styles.masteryTitle, { color: t.text }]}>Subject mastery</Text>
        <View style={styles.masteryList}>
          {SUBJECT_STATS.map((s) => (
            <View key={s.name}>
              <View style={styles.masteryHead}>
                <View style={styles.masteryName}>
                  <View style={[styles.dot, { backgroundColor: t[s.col] }]} />
                  <Text style={[styles.masteryLabel, { color: t.text }]}>{s.name}</Text>
                </View>
                <Text style={[styles.masteryPct, { color: t.text2 }]}>{s.pct}%</Text>
              </View>
              <View style={[styles.track, { backgroundColor: t.surface2 }]}>
                <View style={[styles.fill, { width: `${s.pct}%`, backgroundColor: t[s.col] }]} />
              </View>
            </View>
          ))}
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingTop: 2, paddingHorizontal: 22, paddingBottom: 16 },

  header: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  title: { fontFamily: Font.baloo800, fontSize: 24 },
  headerWeek: { fontFamily: Font.nunito800, fontSize: 12.5 },

  // Rings card
  ringsCard: {
    marginTop: 14,
    borderRadius: 24,
    borderWidth: 1,
    padding: 20,
    flexDirection: 'row',
    gap: 18,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 12 },
    elevation: 2,
  },
  legend: { flex: 1, gap: 12 },
  legendItem: { gap: 3 },
  legendHead: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  dot: { width: 9, height: 9, borderRadius: 4.5 },
  legendLabel: { fontFamily: Font.nunito800, fontSize: 12 },
  legendValue: { fontFamily: Font.baloo800, fontSize: 19 },
  legendTotal: { fontFamily: Font.baloo800, fontSize: 13 },

  // Focus card
  focusCard: {
    marginTop: 14,
    borderRadius: 24,
    borderWidth: 1,
    paddingTop: 18,
    paddingHorizontal: 18,
    paddingBottom: 14,
  },
  cardHead: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' },
  cardTitle: { fontFamily: Font.baloo700, fontSize: 16 },
  focusTotal: { fontFamily: Font.nunito800, fontSize: 13 },
  bars: {
    flexDirection: 'row',
    marginTop: 16,
    height: 104,
    gap: 8,
    alignItems: 'flex-end',
  },
  barCol: {
    flex: 1,
    alignItems: 'center',
    gap: 7,
    justifyContent: 'flex-end',
    height: '100%',
  },
  bar: { width: '100%', borderRadius: 7 },
  barDay: { fontFamily: Font.nunito800, fontSize: 10.5 },

  // Mastery card
  masteryCard: { marginTop: 14, borderRadius: 24, borderWidth: 1, padding: 18 },
  masteryTitle: { fontFamily: Font.baloo700, fontSize: 16, marginBottom: 14 },
  masteryList: { gap: 14 },
  masteryHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  masteryName: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  masteryLabel: { fontFamily: Font.nunito800, fontSize: 13.5 },
  masteryPct: { fontFamily: Font.nunito800, fontSize: 13 },
  track: { height: 9, borderRadius: 999, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: 999 },
});
