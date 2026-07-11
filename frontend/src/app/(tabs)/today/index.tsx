import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Appear } from '@/components/Appear';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { EarnDial } from '@/components/EarnDial';
import { ListGroup, ListRow } from '@/components/List';
import { statIcon } from '@/components/StatGlyph';
import { StreakDots } from '@/components/StreakDots';
import { Sym } from '@/components/Sym';
import { TabScreen } from '@/components/TabScreen';
import { haptic } from '@/lib/haptics';
import { useScreenTime } from '@/lib/screenTime/store';
import { useStats } from '@/store/stats';
import { REWARD_MS, useEarnLock } from '@/store/useEarnLock';
import { Radius, Space } from '@/theme/tokens';
import { Type } from '@/theme/type';
import { useTokens } from '@/theme/theme';

export default function TodayScreen() {
  const t = useTokens();
  const router = useRouter();

  const unlockUntil = useEarnLock((s) => s.unlockUntil);
  const debt = useEarnLock((s) => s.debt);
  const sosUsed = useEarnLock((s) => s.sosUsed);
  const authed = useEarnLock((s) => s.authed);
  const resetQuizFlow = useEarnLock((s) => s.resetQuizFlow);
  const fetchBalance = useEarnLock((s) => s.fetchBalance);

  const stats = useStats((s) => s.data);
  const refreshing = useStats((s) => s.refreshing);
  const fetchStats = useStats((s) => s.fetch);

  const available = useScreenTime((s) => s.available);
  const status = useScreenTime((s) => s.status);
  const selection = useScreenTime((s) => s.selection);
  const authorize = useScreenTime((s) => s.authorize);
  const refresh = useScreenTime((s) => s.refresh);

  useEffect(() => {
    refresh();
    // Sync the server-authoritative balance on mount (e.g. app reopened on a fresh
    // session) — the locally-held unlockUntil only reflects the last submit otherwise,
    // which goes stale the moment time has actually elapsed server-side.
    fetchBalance();
  }, [refresh, fetchBalance]);

  useFocusEffect(
    useCallback(() => {
      void fetchStats();
    }, [fetchStats]),
  );

  const onRefresh = useCallback(() => {
    void fetchBalance();
    void fetchStats({ force: true });
  }, [fetchBalance, fetchStats]);

  const startQuiz = () => {
    resetQuizFlow();
    router.push('/quiz');
  };

  // Live-tick while the unlock window is open so the countdown updates each second.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const tick = () => setNow(Date.now());
    const t0 = setTimeout(tick, 0);
    if (unlockUntil <= Date.now()) return () => clearTimeout(t0);
    const id = setInterval(() => {
      tick();
      if (Date.now() >= unlockUntil) clearInterval(id);
    }, 1000);
    return () => {
      clearTimeout(t0);
      clearInterval(id);
    };
  }, [unlockUntil]);

  const secondsLeft = Math.max(0, Math.ceil((unlockUntil - now) / 1000));
  const locked = secondsLeft <= 0;
  const timeLabel = `${Math.floor(secondsLeft / 60)}:${String(secondsLeft % 60).padStart(2, '0')}`;
  // A full ring means "at least one lesson's worth of time still banked". The balance can
  // exceed that, so it clamps — a ring that could overflow would have to mean something,
  // and there is nothing for it to mean.
  const dialProgress = (secondsLeft * 1000) / REWARD_MS;

  const approved = status === 'approved';
  const count = selection.total;
  const needsConnect = available && !approved;
  const needsApps = approved && count === 0;

  const streak = stats?.streak.current ?? 0;
  const days = stats?.daily ?? [];
  const earnedToday = days.length > 0 ? days[days.length - 1].earned_seconds : 0;

  return (
    <TabScreen contentStyle={styles.content} refreshing={refreshing} onRefresh={onRefresh}>
      {/* The hero: a ring, a sentence, an action. Nothing else competes. */}
      <View style={styles.hero}>
        <EarnDial locked={locked} timeLabel={timeLabel} progress={dialProgress} />

        <View style={styles.heroCaption}>
          <Text style={[Type.callout, styles.caption, { color: t.text2 }]}>
            {locked
              ? 'Finish a short lesson to unlock your apps.'
              : `${count === 0 ? 'Your apps' : `Your ${count} shielded apps`} are open right now.`}
          </Text>
        </View>

        <Button
          label={locked ? 'Earn screen time' : 'Earn more time'}
          icon={<Sym name="bolt.fill" size={17} color={t.onAccent} />}
          onPress={startQuiz}
          style={styles.cta}
        />
      </View>

      {/* SOS debt banner */}
      {debt && (
        <Appear from={-10} duration={240} style={[styles.debt, { backgroundColor: t.dangerSoft }]}>
          <Sym name="exclamationmark.triangle.fill" size={15} color={t.danger} />
          <Text style={[Type.footnoteStrong, { color: t.danger, flex: 1 }]}>
            Repaying an SOS unlock — finish your next lesson to clear it.
          </Text>
        </Appear>
      )}

      {/* Connect Screen Time prompt (only when the device can, but hasn't) */}
      {needsConnect && (
        <Card style={styles.connect}>
          <View style={[styles.connectIcon, { backgroundColor: t.fill }]}>
            <Sym name="hourglass" size={20} color={t.text} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[Type.headline, { color: t.text }]}>Connect Screen Time</Text>
            <Text style={[Type.footnote, { color: t.text2, marginTop: 1 }]}>
              Grant access so EarnLock can actually shield your apps.
            </Text>
          </View>
          <Button
            label="Connect"
            variant="tinted"
            small
            onPress={() => void authorize()}
            style={styles.connectBtn}
          />
        </Card>
      )}

      {/* The week, as it actually happened. Hidden until there's a real week to show. */}
      {authed && days.length > 0 && (
        <Card style={styles.week}>
          <View style={styles.weekHead}>
            <View style={{ flex: 1 }}>
              <Text style={[Type.headline, { color: t.text }]}>
                {streak > 0 ? `${streak}-day streak` : 'Start a streak'}
              </Text>
              <Text style={[Type.footnote, { color: t.text2, marginTop: 1 }]}>
                {earnedToday > 0
                  ? `${Math.round(earnedToday / 60)} min earned today`
                  : 'Nothing earned today yet'}
              </Text>
            </View>
            {streak > 0 && (
              <View style={[styles.flame, { backgroundColor: t.iconOrange }]}>
                <Sym name={statIcon('streak')} size={17} color={t.onIcon} />
              </View>
            )}
          </View>
          <View style={styles.weekDots}>
            <StreakDots days={days} />
          </View>
        </Card>
      )}

      {/* Shielded apps + the escape hatch, together: both answer "what about my apps?" */}
      <ListGroup
        header="Your apps"
        footer={`Emergency unlock opens everything for 2 minutes. ${
          sosUsed ? 'Used today.' : 'One per day.'
        }`}
      >
        <ListRow
          icon={locked ? 'lock.fill' : 'lock.open.fill'}
          iconColor={locked ? t.onIcon : t.onAccent}
          iconBg={locked ? t.iconBlue : t.accent}
          title={
            needsApps
              ? 'No apps selected'
              : `${count} ${count === 1 ? 'app or category' : 'apps & categories'}`
          }
          subtitle={
            !available
              ? 'Screen Time runs on a device build'
              : needsConnect
                ? 'Connect Screen Time to lock apps'
                : needsApps
                  ? 'Choose which apps to lock'
                  : locked
                    ? 'Shielded until you earn time'
                    : 'Unlocked — re-lock when time runs out'
          }
          onPress={() => router.push('/apps')}
          showChevron
        />
        <ListRow
          icon="cross.case.fill"
          iconColor={t.onIcon}
          iconBg={sosUsed ? t.iconGray : t.iconRed}
          title="Emergency unlock"
          value={sosUsed ? 'None left' : '1 left'}
          onPress={() => {
            haptic.warning();
            router.push('/sos');
          }}
          showChevron
        />
      </ListGroup>
    </TabScreen>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: Space.xl,
    paddingTop: Space.sm,
    paddingBottom: Space.xxxl,
    gap: Space.xl,
  },

  hero: { alignItems: 'stretch' },
  heroCaption: { marginTop: Space.xl, paddingHorizontal: Space.md },
  caption: { textAlign: 'center' },
  cta: { marginTop: Space.xl },

  debt: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: Radius.cardInner,
    borderCurve: 'continuous',
  },

  connect: { flexDirection: 'row', alignItems: 'center', gap: Space.md, padding: Space.md },
  connectIcon: {
    width: 42,
    height: 42,
    borderRadius: Radius.control,
    borderCurve: 'continuous',
    alignItems: 'center',
    justifyContent: 'center',
  },
  connectBtn: { width: 'auto', paddingHorizontal: 18 },

  week: { padding: Space.lg },
  weekHead: { flexDirection: 'row', alignItems: 'center', gap: Space.md },
  flame: {
    width: 36,
    height: 36,
    borderRadius: Radius.control,
    borderCurve: 'continuous',
    alignItems: 'center',
    justifyContent: 'center',
  },
  weekDots: { marginTop: Space.lg },
});
