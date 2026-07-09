import { useRouter } from 'expo-router';
import { useEffect } from 'react';
import { Alert, Linking, Pressable, StyleSheet, Text, View } from 'react-native';

import { Card } from '@/components/Card';
import { ListGroup, ListRow } from '@/components/List';
import { Sym } from '@/components/Sym';
import { TabScreen } from '@/components/TabScreen';
import { haptic } from '@/lib/haptics';
import { useScreenTime } from '@/lib/screenTime/store';
import { LEARNER, SUBJECT_DEFS } from '@/store/content';
import { useEarnLock } from '@/store/useEarnLock';
import { Radius, Space } from '@/theme/tokens';
import { Type } from '@/theme/type';
import { useThemeMode, useTokens } from '@/theme/theme';

export default function ProfileScreen() {
  const t = useTokens();
  const router = useRouter();
  const { dark, setDark } = useThemeMode();

  const grade = useEarnLock((s) => s.grade);
  const subj = useEarnLock((s) => s.subj);
  const streak = useEarnLock((s) => s.streak);
  const coins = useEarnLock((s) => s.coins);
  const resetAll = useEarnLock((s) => s.resetAll);
  const name = useEarnLock((s) => s.name).trim();
  const account = useEarnLock((s) => s.account);

  const available = useScreenTime((s) => s.available);
  const status = useScreenTime((s) => s.status);
  const selection = useScreenTime((s) => s.selection);
  const authorize = useScreenTime((s) => s.authorize);
  const revoke = useScreenTime((s) => s.revoke);
  const refresh = useScreenTime((s) => s.refresh);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const subjectCount = SUBJECT_DEFS.filter((s) => subj[s.key]).length;

  // Fall back to the demo learner until onboarding has supplied a real name.
  const displayName = name || LEARNER.name;
  const initials = name
    ? name
        .split(/\s+/)
        .slice(0, 2)
        .map((part) => part[0]?.toUpperCase() ?? '')
        .join('')
    : LEARNER.initials;

  const stConnected = status === 'approved';
  const stValue = !available
    ? 'Device build'
    : stConnected
      ? 'Connected'
      : status === 'denied'
        ? 'Denied'
        : 'Tap to connect';
  const stColor = stConnected ? t.accentText : status === 'denied' ? t.danger : t.text2;

  const onScreenTime = () => {
    if (!available) {
      Alert.alert(
        'Screen Time',
        'Real app blocking runs in a device build with Apple’s Family Controls entitlement. See docs/screen-time.md.',
      );
      return;
    }
    if (stConnected) {
      Alert.alert('Screen Time', 'EarnLock can shield your apps.', [
        { text: 'Disconnect', style: 'destructive', onPress: () => void revoke() },
        { text: 'Done', style: 'cancel' },
      ]);
    } else if (status === 'denied') {
      // iOS won't re-prompt once denied — the only path back is Settings.
      void Linking.openSettings();
    } else {
      haptic.press();
      void authorize().then((s) => {
        if (s === 'approved') haptic.success();
      });
    }
  };

  const onReset = () => {
    Alert.alert('Reset data', 'Clears your progress and returns to onboarding.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Reset',
        style: 'destructive',
        onPress: () => {
          void revoke();
          resetAll();
          router.replace('/');
        },
      },
    ]);
  };

  return (
    <TabScreen contentStyle={styles.content}>
      {/* Identity */}
      <Card style={styles.identity}>
        <View style={[styles.avatar, { backgroundColor: t.accent }]}>
          <Text style={[Type.title2, { color: t.onAccent }]}>{initials}</Text>
        </View>
        <Text style={[Type.title3, { color: t.text, marginTop: Space.md }]}>{displayName}</Text>
        <Text style={[Type.footnote, { color: t.text2 }]}>
          Grade {grade} ·{' '}
          {account === 'apple'
            ? 'Signed in with Apple'
            : account === 'google'
              ? 'Signed in with Google'
              : 'Progress saved on this device'}
        </Text>
        <View style={styles.miniStats}>
          <MiniStat icon="flame.fill" value={String(streak)} label="Streak" />
          <View style={[styles.miniDivider, { backgroundColor: t.separator }]} />
          <MiniStat icon="bolt.circle.fill" value={String(coins)} label="Coins" />
        </View>
      </Card>

      {/* Screen Time */}
      <ListGroup
        header="Screen Time"
        footer={
          available
            ? 'Apps are shielded by Apple Screen Time until time is earned.'
            : 'Real app blocking needs a device build with Apple’s Family Controls entitlement — see docs/screen-time.md.'
        }
      >
        <ListRow
          icon="hourglass"
          iconColor={stColor}
          iconBg={stConnected ? t.accentSoft : t.fill}
          title="Screen Time access"
          trailing={<Text style={[Type.subhead, { color: stColor }]}>{stValue}</Text>}
          onPress={onScreenTime}
        />
        <ListRow
          icon="lock.fill"
          title="Locked apps"
          value={selection.total > 0 ? `${selection.total}` : 'None'}
          onPress={() => router.push('/apps')}
          showChevron
        />
      </ListGroup>

      {/* Appearance */}
      <ListGroup header="Appearance">
        <View style={styles.appearanceRow}>
          <Text style={[Type.body, { color: t.text }]}>Theme</Text>
          <Segmented
            options={['Light', 'Dark']}
            index={dark ? 1 : 0}
            onChange={(i) => setDark(i === 1)}
          />
        </View>
      </ListGroup>

      {/* Learning */}
      <ListGroup header="Learning">
        <ListRow
          icon="graduationcap.fill"
          title="Grade"
          value={`Grade ${grade}`}
          onPress={() => router.push('/setup')}
          showChevron
        />
        <ListRow
          icon="square.grid.2x2.fill"
          title="Subjects"
          value={`${subjectCount} chosen`}
          onPress={() => router.push('/setup')}
          showChevron
        />
        <ListRow
          icon="doc.text.fill"
          title="Study material"
          onPress={() => router.push('/material')}
          showChevron
        />
      </ListGroup>

      {/* About */}
      <ListGroup footer="EarnLock · v1.0">
        <ListRow
          icon="rectangle.portrait.and.arrow.right"
          title="Preview lock screen"
          onPress={() => router.push('/locked')}
          showChevron
        />
        <ListRow icon="arrow.counterclockwise" title="Reset data" destructive onPress={onReset} />
      </ListGroup>
    </TabScreen>
  );
}

function MiniStat({
  icon,
  value,
  label,
}: {
  icon: 'flame.fill' | 'bolt.circle.fill';
  value: string;
  label: string;
}) {
  const t = useTokens();
  return (
    <View style={styles.miniStat} accessible accessibilityLabel={`${value} ${label}`}>
      <Sym name={icon} size={14} color={t.text2} />
      <Text style={[Type.headline, { color: t.text }]}>{value}</Text>
      <Text style={[Type.caption, { color: t.text3 }]}>{label}</Text>
    </View>
  );
}

function Segmented({
  options,
  index,
  onChange,
}: {
  options: string[];
  index: number;
  onChange: (i: number) => void;
}) {
  const t = useTokens();
  const { dark } = useThemeMode();
  // The active thumb must read as elevated ABOVE the track in both themes. In light the track is
  // grey and the thumb is white (surface); in dark, surface is darker than the track, so use the
  // lighter fillStrong instead.
  const thumb = dark ? t.fillStrong : t.surface;
  return (
    <View style={[styles.segmented, { backgroundColor: t.fill }]}>
      {options.map((opt, i) => {
        const active = i === index;
        return (
          <Pressable
            key={opt}
            accessibilityRole="button"
            accessibilityLabel={`${opt} theme`}
            accessibilityState={{ selected: active }}
            hitSlop={{ top: 10, bottom: 10 }}
            onPress={() => {
              haptic.select();
              onChange(i);
            }}
            style={[styles.segment, active && { backgroundColor: thumb }]}
          >
            <Text style={[Type.footnoteStrong, { color: active ? t.text : t.text2 }]}>{opt}</Text>
          </Pressable>
        );
      })}
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

  identity: { padding: Space.xl, alignItems: 'center' },
  avatar: {
    width: 68,
    height: 68,
    borderRadius: Radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  miniStats: { flexDirection: 'row', alignItems: 'center', gap: Space.xl, marginTop: Space.lg },
  miniStat: { alignItems: 'center', gap: 2 },
  miniDivider: { width: StyleSheet.hairlineWidth, height: 30 },

  appearanceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 9,
    paddingHorizontal: 14,
    minHeight: 52,
  },
  segmented: { flexDirection: 'row', padding: 2, borderRadius: Radius.chip, gap: 2 },
  segment: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: Radius.chip - 2,
    borderCurve: 'continuous',
  },
});
