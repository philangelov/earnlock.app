import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useMemo } from 'react';
import { Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';

import { Card } from '@/components/Card';
import { Meter } from '@/components/charts/Meter';
import { Roadmap, type Chapter, type RoadmapNode } from '@/components/learn/Roadmap';
import { SectionHeader } from '@/components/List';
import { StatGlyph, type StatRole } from '@/components/StatGlyph';
import { Sym } from '@/components/Sym';
import { TabScreen } from '@/components/TabScreen';
import type { QuizAttempt } from '@/lib/api';
import { useStats } from '@/store/stats';
import { CHAPTER_SIZE, chosenSubjects, subjectIcon } from '@/store/content';
import { useEarnLock } from '@/store/useEarnLock';
import { Radius, Space } from '@/theme/tokens';
import { Type } from '@/theme/type';
import { useTokens } from '@/theme/theme';

/** "Math & History", "Math, History & Biology", "Math, History +3". */
function focusLabel(subjects: string[]): string {
  if (subjects.length === 0) return 'General knowledge';
  if (subjects.length === 1) return subjects[0];
  if (subjects.length === 2) return `${subjects[0]} & ${subjects[1]}`;
  if (subjects.length === 3) return `${subjects[0]}, ${subjects[1]} & ${subjects[2]}`;
  return `${subjects[0]}, ${subjects[1]} +${subjects.length - 2}`;
}

/**
 * Turn the raw history into chapters of five.
 *
 * Positions are global: the newest attempt sits at index `completed - 1`, so a chapter
 * number stays correct even though the server only sends back the most recent attempts.
 * The active node is always at `completed % CHAPTER_SIZE` of the current chapter — it is
 * literally the next quiz `/quiz/generate` will produce. The path has no ceiling: a new
 * node every quiz, a new chapter every five, for as long as the learner keeps going.
 */
function buildChapters(completed: number, recent: QuizAttempt[], focus: string): Chapter[] {
  const attemptAt = new Map<number, QuizAttempt>();
  recent.forEach((attempt, fromNewest) => {
    attemptAt.set(completed - 1 - fromNewest, attempt);
  });

  const currentChapter = Math.floor(completed / CHAPTER_SIZE);
  // The oldest attempt we actually hold; everything before it is off the end of the page.
  const oldestKnown = Math.max(0, completed - recent.length);
  const firstChapter = Math.min(Math.floor(oldestKnown / CHAPTER_SIZE), currentChapter);

  const chapters: Chapter[] = [];
  for (let chapter = firstChapter; chapter <= currentChapter; chapter++) {
    const nodes: RoadmapNode[] = [];
    let correct = 0;
    let total = 0;
    let scored = 0;

    for (let slot = 0; slot < CHAPTER_SIZE; slot++) {
      const globalIndex = chapter * CHAPTER_SIZE + slot;
      const attempt = attemptAt.get(globalIndex);
      const state: RoadmapNode['state'] =
        globalIndex < completed ? 'done' : globalIndex === completed ? 'active' : 'locked';

      if (attempt?.total_count != null) {
        correct += attempt.correct_count;
        total += attempt.total_count;
        scored += 1;
      }

      nodes.push({
        key: `${chapter}-${slot}`,
        state,
        score:
          state === 'done' && attempt?.total_count != null
            ? `${attempt.correct_count}/${attempt.total_count}`
            : undefined,
      });
    }

    const doneInChapter = Math.max(0, Math.min(CHAPTER_SIZE, completed - chapter * CHAPTER_SIZE));
    const isCurrent = chapter === currentChapter;

    chapters.push({
      number: chapter + 1,
      title: isCurrent
        ? focus
        : // Only claim a chapter score when every one of its attempts is in hand —
          // summing the three we happen to still hold would quietly understate it.
          scored === CHAPTER_SIZE
          ? `${correct} of ${total} correct`
          : 'Completed',
      ringLabel: `${doneInChapter}/${CHAPTER_SIZE}`,
      progress: doneInChapter / CHAPTER_SIZE,
      nodes,
    });
  }

  // Newest chapter first: the active node — the only thing on this page you can press —
  // then belongs to the first screenful instead of the last.
  return chapters.reverse();
}

export default function LearnScreen() {
  const t = useTokens();
  const router = useRouter();
  const { width } = useWindowDimensions();

  const subj = useEarnLock((s) => s.subj);
  const customSubjects = useEarnLock((s) => s.customSubjects);
  const resetQuizFlow = useEarnLock((s) => s.resetQuizFlow);

  const stats = useStats((s) => s.data);
  const refreshing = useStats((s) => s.refreshing);
  const fetchStats = useStats((s) => s.fetch);

  useFocusEffect(
    useCallback(() => {
      void fetchStats();
    }, [fetchStats]),
  );

  const startQuiz = useCallback(() => {
    resetQuizFlow();
    router.push('/quiz');
  }, [resetQuizFlow, router]);

  const focus = useMemo(
    () => focusLabel(chosenSubjects(subj, customSubjects)),
    [subj, customSubjects],
  );

  const completed = stats?.totals.quizzes ?? 0;
  const chapters = useMemo(
    () => buildChapters(completed, stats?.recent ?? [], focus),
    [completed, stats?.recent, focus],
  );

  const trailWidth = width - Space.xl * 2;
  const accuracy = stats?.totals.accuracy;
  const subjects = stats?.subjects ?? [];
  const materials = stats?.materials ?? [];

  return (
    <TabScreen
      contentStyle={styles.content}
      refreshing={refreshing}
      onRefresh={() => void fetchStats({ force: true })}
    >
      <View style={styles.pills}>
        <Pill role="streak" value={String(stats?.streak.current ?? 0)} label="day streak" />
        <Pill
          role="quizzes"
          value={String(completed)}
          label={completed === 1 ? 'quiz done' : 'quizzes done'}
        />
        {accuracy != null && (
          <Pill role="accuracy" value={`${Math.round(accuracy * 100)}%`} label="accuracy" />
        )}
      </View>

      <Roadmap chapters={chapters} width={trailWidth} onStart={startQuiz} />

      {completed === 0 && (
        <Card style={styles.hint}>
          <Sym name="sparkles" size={17} color={t.accentText} />
          <Text style={[Type.footnote, { color: t.text2, flex: 1 }]}>
            Five questions, about six minutes, fifteen minutes of screen time. Your path grows a
            node every time you finish one.
          </Text>
        </Card>
      )}

      {/* Subject mastery — how well each subject is understood, from real quiz results. */}
      {subjects.length > 0 && (
        <View>
          <SectionHeader title="Subjects" />
          <Card style={styles.masteryCard}>
            {subjects.map((s, i) => (
              <View key={s.subject} style={styles.masteryRow}>
                <Sym name={subjectIcon(s.subject)} size={15} color={t.text2} />
                <View style={{ flex: 1 }}>
                  <Meter
                    label={s.subject}
                    value={s.accuracy != null ? `${Math.round(s.accuracy * 100)}%` : '—'}
                    fraction={s.accuracy ?? 0}
                    delay={i * 60}
                    labelWidth={96}
                  />
                </View>
              </View>
            ))}
          </Card>
        </View>
      )}

      {/* Materials — understanding per imported material, with the full manager one tap away. */}
      <View>
        <SectionHeader
          title="Materials"
          trailing={
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Manage materials"
              hitSlop={8}
              onPress={() => router.push('/materials')}
            >
              <Text style={[Type.footnoteStrong, { color: t.accentText }]}>
                {materials.length > 0 ? 'Manage' : 'Add'}
              </Text>
            </Pressable>
          }
        />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Open materials"
          onPress={() => router.push('/materials')}
          style={({ pressed }) => pressed && { opacity: 0.85 }}
        >
          <Card style={styles.materialsCard}>
            {materials.length === 0 ? (
              <View style={styles.materialEmpty}>
                <View style={[styles.icon, { backgroundColor: t.fill }]}>
                  <Sym name="doc.text.fill" size={18} color={t.text2} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[Type.headline, { color: t.text }]}>Study your own notes</Text>
                  <Text style={[Type.footnote, { color: t.text3, marginTop: 1 }]}>
                    Add a chapter and track how well you understand it.
                  </Text>
                </View>
                <Sym name="plus" size={16} color={t.text3} weight="semibold" />
              </View>
            ) : (
              materials.slice(0, 3).map((m) => {
                const pct = m.total > 0 && m.accuracy != null ? Math.round(m.accuracy * 100) : null;
                return (
                  <View key={m.material_id} style={styles.materialRow}>
                    <View style={[styles.dot, { backgroundColor: t.accent }]} />
                    <Text style={[Type.subhead, { color: t.text, flex: 1 }]} numberOfLines={1}>
                      {m.title || m.preview || 'Untitled'}
                    </Text>
                    <Text style={[Type.footnoteStrong, { color: pct != null ? t.text2 : t.text3 }]}>
                      {pct != null ? `${pct}%` : 'New'}
                    </Text>
                  </View>
                );
              })
            )}
            {materials.length > 3 && (
              <Text style={[Type.footnote, { color: t.text3 }]}>
                +{materials.length - 3} more in Materials
              </Text>
            )}
          </Card>
        </Pressable>
      </View>
    </TabScreen>
  );
}

function Pill({ role, value, label }: { role: StatRole; value: string; label: string }) {
  const t = useTokens();
  return (
    <View
      style={[styles.pill, { backgroundColor: t.surface, borderColor: t.separator }]}
      accessible
      accessibilityLabel={`${value} ${label}`}
    >
      <StatGlyph role={role} size={13} />
      <Text style={[Type.footnoteStrong, { color: t.text }]}>{value}</Text>
      <Text style={[Type.caption, { color: t.text3 }]} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: Space.xl,
    paddingTop: Space.xs,
    paddingBottom: Space.xxxl,
    gap: Space.xl,
  },

  pills: { flexDirection: 'row', gap: Space.sm },
  pill: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingVertical: 9,
    paddingHorizontal: 10,
    borderRadius: Radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
  },

  hint: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    padding: Space.lg,
  },

  masteryCard: { padding: Space.lg, gap: Space.md },
  masteryRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },

  materialsCard: { padding: Space.lg, gap: Space.md },
  materialEmpty: { flexDirection: 'row', alignItems: 'center', gap: Space.md },
  icon: {
    width: 38,
    height: 38,
    borderRadius: Radius.control,
    borderCurve: 'continuous',
    alignItems: 'center',
    justifyContent: 'center',
  },
  materialRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  dot: { width: 7, height: 7, borderRadius: 4 },
});
