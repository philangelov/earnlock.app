import { useFocusEffect } from 'expo-router';
import { useCallback, useMemo } from 'react';
import { ActivityIndicator, StyleSheet, Text, useWindowDimensions, View } from 'react-native';

import { Appear } from '@/components/Appear';
import { Card } from '@/components/Card';
import { BarChart, type BarDatum } from '@/components/charts/BarChart';
import { Meter } from '@/components/charts/Meter';
import { Ring } from '@/components/charts/Ring';
import { TrendLine } from '@/components/charts/TrendLine';
import { EmptyState } from '@/components/EmptyState';
import { SectionHeader } from '@/components/List';
import { StatGlyph, type StatRole } from '@/components/StatGlyph';
import { Sym } from '@/components/Sym';
import { TabScreen } from '@/components/TabScreen';
import type { Stats } from '@/lib/api';
import { useStats } from '@/store/stats';
import { useEarnLock } from '@/store/useEarnLock';
import { Space } from '@/theme/tokens';
import { Type } from '@/theme/type';
import { useTokens } from '@/theme/theme';

const WEEKDAY = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

/** A bare local date ("2026-07-10") parsed as UTC would slip a day west of Greenwich. */
function weekdayInitial(date: string): string {
  const [year, month, day] = date.split('-').map(Number);
  return WEEKDAY[new Date(year, month - 1, day).getDay()];
}

function minutes(seconds: number): string {
  const total = Math.round(seconds / 60);
  const hours = Math.floor(total / 60);
  const rest = total % 60;
  return hours > 0 ? `${hours}h ${rest}m` : `${rest}m`;
}

export default function InsightsScreen() {
  const t = useTokens();
  const { width } = useWindowDimensions();

  const authed = useEarnLock((s) => s.authed);
  const stats = useStats((s) => s.data);
  const loading = useStats((s) => s.loading);
  const refreshing = useStats((s) => s.refreshing);
  const error = useStats((s) => s.error);
  const fetchStats = useStats((s) => s.fetch);

  useFocusEffect(
    useCallback(() => {
      void fetchStats();
    }, [fetchStats]),
  );

  const onRefresh = useCallback(() => void fetchStats({ force: true }), [fetchStats]);

  if (!authed) {
    return (
      <TabScreen contentStyle={styles.content}>
        <EmptyState
          icon="chart.bar"
          title="No insights yet"
          body="Sign in from your profile to keep a history of what you've learned."
        />
      </TabScreen>
    );
  }

  if (loading && !stats) {
    return (
      <TabScreen contentStyle={[styles.content, styles.centered]}>
        <ActivityIndicator color={t.text3} />
      </TabScreen>
    );
  }

  if (!stats || stats.totals.quizzes === 0) {
    return (
      <TabScreen contentStyle={styles.content} refreshing={refreshing} onRefresh={onRefresh}>
        {error != null && <ErrorNote message={error} />}
        <EmptyState
          icon="chart.bar"
          title="Nothing to show yet"
          body="Finish your first quiz and this fills up with your real progress — minutes learned, accuracy, and the subjects you're strongest in."
        />
      </TabScreen>
    );
  }

  return (
    <Insights
      stats={stats}
      width={width}
      refreshing={refreshing}
      onRefresh={onRefresh}
      error={error}
    />
  );
}

function Insights({
  stats,
  width,
  refreshing,
  onRefresh,
  error,
}: {
  stats: Stats;
  width: number;
  refreshing: boolean;
  onRefresh: () => void;
  error: string | null;
}) {
  const t = useTokens();

  const { totals, streak, daily, subjects, recent } = stats;
  const weekSeconds = daily.reduce((sum, day) => sum + day.earned_seconds, 0);
  const todayIndex = daily.length - 1;

  const bars: BarDatum[] = daily.map((day, i) => ({
    label: weekdayInitial(day.date),
    value: Math.round(day.earned_seconds / 60),
    highlight: i === todayIndex,
    accessibilityLabel: `${weekdayInitial(day.date)}, ${Math.round(day.earned_seconds / 60)} minutes earned${
      i === todayIndex ? ', today' : ''
    }`,
  }));

  // Oldest-first, and only attempts whose denominator the server actually stored.
  const trend = useMemo(
    () =>
      recent
        .filter((a) => a.total_count != null && a.total_count > 0)
        .map((a) => a.correct_count / (a.total_count as number))
        .reverse()
        .slice(-14),
    [recent],
  );

  // The card is padded by Space.xl on each side, inside a page padded the same.
  const chartWidth = width - Space.xl * 4;
  const spentFraction =
    totals.earned_seconds > 0 ? totals.spent_seconds / totals.earned_seconds : 0;

  return (
    <TabScreen contentStyle={styles.content} refreshing={refreshing} onRefresh={onRefresh}>
      {error != null && <ErrorNote message={error} />}

      {/* This week — the only chart that answers "am I doing it?" */}
      <Card style={styles.card}>
        <View style={styles.cardHead}>
          <View style={{ flex: 1 }}>
            <Text style={[Type.headline, { color: t.text }]}>Time earned</Text>
            <Text style={[Type.footnote, { color: t.text3, marginTop: 1 }]}>Last 7 days</Text>
          </View>
          <Text style={[Type.number, { color: t.text }]}>{minutes(weekSeconds)}</Text>
        </View>
        <BarChart data={bars} formatValue={(v) => (v > 0 ? `${v}m` : '')} />
      </Card>

      {/* Accuracy — a ring for where you stand, a line for where you're going. */}
      <Card style={styles.card}>
        <View style={styles.cardHead}>
          <View style={{ flex: 1 }}>
            <Text style={[Type.headline, { color: t.text }]}>Accuracy</Text>
            <Text style={[Type.footnote, { color: t.text3, marginTop: 1 }]}>
              {totals.questions_correct} of {totals.questions_answered} questions right
            </Text>
          </View>
          <Ring
            size={54}
            strokeWidth={6}
            progress={totals.accuracy ?? 0}
            color={t.accent}
            trackColor={t.fill}
          >
            <Text style={[Type.captionStrong, { color: t.text }]}>
              {totals.accuracy != null ? `${Math.round(totals.accuracy * 100)}%` : '—'}
            </Text>
          </Ring>
        </View>

        {trend.length >= 2 ? (
          <>
            <TrendLine values={trend} width={chartWidth} color={t.accent} />
            <Text style={[Type.caption, { color: t.text3, marginTop: 4 }]}>
              Score on your last {trend.length} quizzes
            </Text>
          </>
        ) : (
          <Text style={[Type.footnote, { color: t.text3 }]}>
            One more quiz and a trend line appears here.
          </Text>
        )}
      </Card>

      {/* Subject mastery — real, because every question is tagged server-side. */}
      <View>
        <SectionHeader title="Subject mastery" />
        <Card style={styles.card}>
          {subjects.length > 0 ? (
            subjects.map((subject, i) => (
              <View key={subject.subject} style={i > 0 && { marginTop: Space.lg }}>
                <Meter
                  label={subject.subject}
                  value={`${Math.round((subject.accuracy ?? 0) * 100)}%`}
                  fraction={subject.accuracy ?? 0}
                  delay={i * 70}
                />
                <Text style={[Type.caption, styles.masteryMeta, { color: t.text3 }]}>
                  {subject.correct} of {subject.total} right
                </Text>
              </View>
            ))
          ) : (
            <EmptyState
              compact
              icon="square.grid.2x2"
              title="No subjects yet"
              body="Your answers get grouped by subject as you go."
            />
          )}
        </Card>
      </View>

      {/* The ledger. "Spent" is what left the wallet, not a second estimate of it. */}
      <View>
        <SectionHeader title="Screen time" />
        <Card style={styles.card}>
          <Meter
            label="Earned"
            value={minutes(totals.earned_seconds)}
            // Earned is the reference the Spent bar is measured against, so it fills the
            // track — unless there is nothing to reference, in which case a full bar
            // labelled "0m" would be a plain contradiction.
            fraction={totals.earned_seconds > 0 ? 1 : 0}
            labelWidth={58}
          />
          <View style={{ height: Space.md }} />
          <Meter
            label="Spent"
            value={minutes(totals.spent_seconds)}
            fraction={spentFraction}
            color={t.fillStrong}
            labelWidth={58}
          />
          <Text style={[Type.footnote, { color: t.text3, marginTop: Space.lg }]}>
            {totals.remaining_seconds > 0
              ? `${minutes(totals.remaining_seconds)} still in the bank.`
              : 'Your bank is empty — earn some more.'}
          </Text>
        </Card>
      </View>

      {/* Totals. Stat tiles, not charts: a single number needs no axis. */}
      <View style={styles.grid}>
        <Tile role="bestStreak" value={String(streak.best)} label="Best streak" />
        <Tile role="quizzes" value={String(totals.quizzes)} label="Quizzes done" />
        <Tile
          role="questionsRight"
          value={String(totals.questions_correct)}
          label="Questions right"
        />
        <Tile role="timeEarned" value={minutes(totals.earned_seconds)} label="Time earned" />
      </View>
    </TabScreen>
  );
}

function Tile({ role, value, label }: { role: StatRole; value: string; label: string }) {
  const t = useTokens();
  return (
    <Appear duration={260} style={styles.tileWrap}>
      <Card style={styles.tile}>
        <StatGlyph role={role} size={17} />
        <Text style={[Type.numberLg, { color: t.text, marginTop: Space.sm }]}>{value}</Text>
        <Text style={[Type.caption, { color: t.text3 }]}>{label}</Text>
      </Card>
    </Appear>
  );
}

/** A refresh can fail while good data is still on screen; say so without hiding it. */
function ErrorNote({ message }: { message: string }) {
  const t = useTokens();
  return (
    <View style={[styles.errorNote, { backgroundColor: t.dangerSoft }]}>
      <Sym name="exclamationmark.triangle.fill" size={14} color={t.danger} />
      <Text style={[Type.footnote, { color: t.danger, flex: 1 }]}>{message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: Space.xl,
    paddingTop: Space.xs,
    paddingBottom: Space.xxxl,
    gap: Space.lg,
  },
  centered: { flexGrow: 1, alignItems: 'center', justifyContent: 'center' },

  card: { padding: Space.xl },
  cardHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Space.md,
    marginBottom: Space.lg,
  },

  masteryMeta: { marginTop: 4, marginLeft: 86 },

  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: Space.md },
  tileWrap: { width: '47.8%', flexGrow: 1 },
  tile: { padding: Space.lg },

  errorNote: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 12,
    borderRadius: 14,
    borderCurve: 'continuous',
  },
});
