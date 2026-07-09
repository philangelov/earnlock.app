import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { ListGroup, ListRow, SectionHeader } from '@/components/List';
import { Sym, type SymName } from '@/components/Sym';
import { TabScreen } from '@/components/TabScreen';
import { haptic } from '@/lib/haptics';
import { useScreenTime } from '@/lib/screenTime/store';
import { REWARD_MS, useEarnLock } from '@/store/useEarnLock';
import { Radius, Space } from '@/theme/tokens';
import { Type } from '@/theme/type';
import { useTokens } from '@/theme/theme';

export default function TodayScreen() {
  const t = useTokens();
  const router = useRouter();

  const unlockUntil = useEarnLock((s) => s.unlockUntil);
  const streak = useEarnLock((s) => s.streak);
  const coins = useEarnLock((s) => s.coins);
  const debt = useEarnLock((s) => s.debt);
  const sosUsed = useEarnLock((s) => s.sosUsed);
  const resetQuizFlow = useEarnLock((s) => s.resetQuizFlow);
  const fetchBalance = useEarnLock((s) => s.fetchBalance);

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
  const timeLabel = locked
    ? 'Locked'
    : `${Math.floor(secondsLeft / 60)}:${String(secondsLeft % 60).padStart(2, '0')}`;
  const barProgress = locked ? 0 : Math.min(1, (secondsLeft * 1000) / (REWARD_MS + 5 * 60_000));

  const approved = status === 'approved';
  const count = selection.total;
  const needsConnect = available && !approved;
  const needsApps = approved && count === 0;

  const stats: { icon: SymName; value: string; label: string }[] = [
    { icon: 'flame.fill', value: String(streak), label: 'Day streak' },
    { icon: 'bolt.circle.fill', value: String(coins), label: 'Coins' },
    { icon: 'checkmark.seal.fill', value: '312', label: 'Solved' },
  ];

  return (
    <TabScreen contentStyle={styles.content}>
      {/* Hero — the earn clock */}
      <Card style={styles.hero}>
        <View style={styles.pillRow}>
          <View style={[styles.statusPill, { backgroundColor: locked ? t.fill : t.accentSoft }]}>
            <View style={[styles.dot, { backgroundColor: locked ? t.text3 : t.accent }]} />
            <Text style={[Type.footnoteStrong, { color: locked ? t.text2 : t.accentText }]}>
              {locked ? 'Apps locked' : 'Apps unlocked'}
            </Text>
          </View>
        </View>

        <Text style={[Type.display, styles.time, { color: locked ? t.text2 : t.text }]}>
          {timeLabel}
        </Text>
        <Text style={[Type.subhead, styles.timeSub, { color: t.text2 }]}>
          {locked ? 'Learn a little to unlock your apps' : 'of screen time left today'}
        </Text>

        <View style={[styles.track, { backgroundColor: t.fill }]}>
          <View
            style={[
              styles.trackFill,
              {
                width: `${Math.max(barProgress * 100, locked ? 0 : 4)}%`,
                backgroundColor: t.accent,
              },
            ]}
          />
        </View>

        <Button
          label={locked ? 'Earn screen time' : 'Earn more time'}
          icon={<Sym name="bolt.fill" size={17} color={t.onAccent} />}
          onPress={startQuiz}
          style={styles.earnBtn}
        />
      </Card>

      {/* SOS debt banner */}
      {debt && (
        <Animated.View
          entering={FadeInDown.duration(240)}
          style={[styles.debt, { backgroundColor: t.dangerSoft }]}
        >
          <Sym name="exclamationmark.triangle.fill" size={15} color={t.danger} />
          <Text style={[Type.footnoteStrong, { color: t.danger, flex: 1 }]}>
            Repaying an SOS unlock — finish your next lesson to clear it.
          </Text>
        </Animated.View>
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

      {/* Stat strip */}
      <Card style={styles.strip}>
        {stats.map((s, i) => (
          <View
            key={s.label}
            style={styles.statCol}
            accessible
            accessibilityLabel={`${s.value} ${s.label}`}
          >
            {i > 0 && <View style={[styles.divider, { backgroundColor: t.separator }]} />}
            <Sym name={s.icon} size={16} color={t.text2} />
            <Text style={[Type.numberLg, { color: t.text }]}>{s.value}</Text>
            <Text style={[Type.caption, { color: t.text3 }]}>{s.label}</Text>
          </View>
        ))}
      </Card>

      {/* Shielded apps — real selection, count-based (app identities are private) */}
      <View style={styles.section}>
        <SectionHeader title="Shielded apps" />
        <ListGroup>
          <ListRow
            icon={locked ? 'lock.fill' : 'lock.open.fill'}
            iconColor={locked ? t.text : t.accentText}
            iconBg={locked ? t.fill : t.accentSoft}
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
        </ListGroup>
      </View>

      {/* Emergency unlock */}
      <ListGroup style={styles.section}>
        <ListRow
          icon="cross.case.fill"
          iconColor={t.danger}
          iconBg={t.dangerSoft}
          title="Emergency unlock"
          subtitle={`${sosUsed ? 0 : 1} left today · 2 min`}
          onPress={() => {
            haptic.warning();
            router.push('/sos');
          }}
          showChevron
        />
      </ListGroup>

      {/* Screen Time connection status */}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Screen Time settings, opens Profile"
        hitSlop={12}
        onPress={() => router.push('/profile')}
        style={({ pressed }) => [styles.stStatus, pressed && { opacity: 0.6 }]}
      >
        <View style={[styles.stDot, { backgroundColor: approved ? t.accent : t.text3 }]} />
        <Text style={[Type.caption, { color: t.text3 }]}>
          Screen Time ·{' '}
          {!available ? 'Device build required' : approved ? 'Connected' : 'Not connected'}
        </Text>
      </Pressable>
    </TabScreen>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: Space.xl,
    paddingTop: Space.xs,
    paddingBottom: Space.xxxl,
    gap: Space.lg,
  },

  hero: {
    paddingHorizontal: Space.xl,
    paddingTop: Space.lg,
    paddingBottom: Space.xl,
    alignItems: 'center',
  },
  pillRow: { alignSelf: 'stretch', alignItems: 'center' },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 5,
    paddingHorizontal: 11,
    borderRadius: Radius.pill,
  },
  dot: { width: 7, height: 7, borderRadius: 4 },
  time: { marginTop: Space.lg, textAlign: 'center' },
  timeSub: { marginTop: 2, textAlign: 'center' },
  track: {
    alignSelf: 'stretch',
    height: 8,
    borderRadius: Radius.pill,
    marginTop: Space.xl,
    overflow: 'hidden',
  },
  trackFill: { height: '100%', borderRadius: Radius.pill },
  earnBtn: { marginTop: Space.xl },

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

  strip: { flexDirection: 'row', paddingVertical: Space.lg, paddingHorizontal: 4 },
  statCol: { flex: 1, alignItems: 'center', gap: 4 },
  divider: {
    position: 'absolute',
    left: 0,
    top: '50%',
    width: StyleSheet.hairlineWidth,
    height: 34,
    transform: [{ translateY: -17 }],
  },

  section: { gap: 0 },

  stStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: Space.xs,
    paddingVertical: Space.sm,
  },
  stDot: { width: 6, height: 6, borderRadius: 3 },
});
