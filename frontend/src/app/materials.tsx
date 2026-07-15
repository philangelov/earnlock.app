/**
 * Materials — the manager for a learner's imported study material. It lists everything
 * they've added, shows how well each one is understood (from real quiz results, via
 * GET /stats → materials), and lets them study a material (a quiz drawn only from it) or
 * remove it. Adding opens the paste/import form (material.tsx). Reachable from the Learn
 * tab and from Profile → Study material.
 */
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { Meter } from '@/components/charts/Meter';
import { EmptyState } from '@/components/EmptyState';
import { Screen } from '@/components/Screen';
import { StepHeader } from '@/components/StepHeader';
import { Sym } from '@/components/Sym';
import * as api from '@/lib/api';
import { haptic } from '@/lib/haptics';
import { useStats } from '@/store/stats';
import { useEarnLock } from '@/store/useEarnLock';
import { Radius, Space } from '@/theme/tokens';
import { Type } from '@/theme/type';
import { useTokens } from '@/theme/theme';

export default function MaterialsScreen() {
  const t = useTokens();
  const router = useRouter();

  const authed = useEarnLock((s) => s.authed);
  const resetQuizFlow = useEarnLock((s) => s.resetQuizFlow);

  const materials = useStats((s) => s.data?.materials) ?? [];
  const fetchStats = useStats((s) => s.fetch);

  useFocusEffect(
    useCallback(() => {
      void fetchStats();
    }, [fetchStats]),
  );

  const addMaterial = () => router.push('/material');

  const study = (materialId: string) => {
    resetQuizFlow();
    router.push({ pathname: '/quiz', params: { materialId } });
  };

  const remove = (materialId: string, title: string) => {
    Alert.alert(
      'Delete material?',
      `“${title}” and its understanding are removed. Quizzes you already earned from it are kept.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            void api
              .deleteMaterial(materialId)
              .then(() => fetchStats({ force: true }))
              .catch(() => Alert.alert('Could not delete', 'Check your connection and try again.'));
          },
        },
      ],
    );
  };

  return (
    <Screen
      scroll
      contentStyle={styles.content}
      header={
        <View style={styles.header}>
          <StepHeader
            step={0}
            total={1}
            title="Materials"
            onBack={() => router.back()}
            onSkip={authed ? addMaterial : undefined}
            skipLabel="Add"
          />
        </View>
      }
    >
      <Text style={[Type.title1, { color: t.text, marginTop: Space.lg }]}>Your materials</Text>
      <Text style={[Type.subhead, { color: t.text2, marginTop: 6 }]}>
        Paste notes or a chapter, and every quiz drawn from it tracks how well you’ve understood it.
      </Text>

      {!authed ? (
        <EmptyState
          icon="person.crop.circle.badge.questionmark"
          title="Sign in to add materials"
          body="Materials and their progress live with your account so they survive a new phone."
        />
      ) : materials.length === 0 ? (
        <View style={styles.emptyWrap}>
          <EmptyState
            icon="doc.text"
            title="No materials yet"
            body="Add a chapter summary, class notes, or vocabulary — we’ll write quizzes from it."
          />
          <Button
            label="Add material"
            icon={<Sym name="plus" size={16} color={t.onAccent} />}
            onPress={addMaterial}
          />
        </View>
      ) : (
        <View style={styles.list}>
          {materials.map((m) => (
            <MaterialCard
              key={m.material_id}
              material={m}
              onStudy={() => study(m.material_id)}
              onDelete={() => remove(m.material_id, m.title || 'this material')}
            />
          ))}
        </View>
      )}
    </Screen>
  );
}

function MaterialCard({
  material,
  onStudy,
  onDelete,
}: {
  material: api.StatsMaterial;
  onStudy: () => void;
  onDelete: () => void;
}) {
  const t = useTokens();
  const studied = material.total > 0 && material.accuracy != null;
  const pct = studied ? Math.round((material.accuracy ?? 0) * 100) : null;
  const title = material.title || material.preview || 'Untitled material';

  return (
    <Card style={styles.card}>
      <View style={styles.cardTop}>
        <View style={[styles.icon, { backgroundColor: t.fill }]}>
          <Sym
            name={material.source_type === 'link' ? 'link' : 'doc.text.fill'}
            size={17}
            color={t.text2}
          />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[Type.headline, { color: t.text }]} numberOfLines={1}>
            {title}
          </Text>
          <Text style={[Type.footnote, { color: t.text3 }]} numberOfLines={1}>
            {studied ? `${material.correct}/${material.total} correct` : 'Not studied yet'}
          </Text>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Delete ${title}`}
          hitSlop={10}
          onPress={() => {
            haptic.tap();
            onDelete();
          }}
          style={({ pressed }) => [styles.trash, pressed && { opacity: 0.5 }]}
        >
          <Sym name="trash" size={17} color={t.text3} />
        </Pressable>
      </View>

      <Meter
        label="Understanding"
        value={pct != null ? `${pct}%` : 'New'}
        fraction={pct != null ? pct / 100 : 0}
        labelWidth={110}
      />

      <Button
        label={studied ? 'Keep studying' : 'Study this'}
        variant="tinted"
        small
        icon={<Sym name="bolt.fill" size={14} color={t.accentText} />}
        onPress={onStudy}
      />
    </Card>
  );
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: Space.xl, paddingTop: Space.sm },
  content: { paddingHorizontal: Space.xl, paddingBottom: Space.xxxl },

  emptyWrap: { marginTop: Space.lg, gap: Space.lg },
  list: { marginTop: Space.xl, gap: Space.md },

  card: { padding: Space.lg, gap: Space.md },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: Space.md },
  icon: {
    width: 38,
    height: 38,
    borderRadius: Radius.control,
    borderCurve: 'continuous',
    alignItems: 'center',
    justifyContent: 'center',
  },
  trash: { padding: 4 },
});
