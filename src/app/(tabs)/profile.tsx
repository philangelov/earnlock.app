import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Icon, type IconName } from '@/components/Icon';
import { Screen } from '@/components/Screen';
import { PROFILE_SUBJECTS } from '@/store/content';
import { Font, type TokenName } from '@/theme/tokens';
import { useThemeMode, useTokens } from '@/theme/theme';

type StatDef = { icon: IconName; color: TokenName; value: string; label: string };
type SettingRow = {
  icon: IconName;
  soft: TokenName;
  color: TokenName;
  title: string;
  sub: string;
  onPress: () => void;
};

export default function ProfileScreen() {
  const t = useTokens();
  const router = useRouter();
  const { dark, toggle } = useThemeMode();

  const stats: StatDef[] = [
    { icon: 'flame', color: 'fire', value: '4', label: 'Streak' },
    { icon: 'coin', color: 'cyan', value: '220', label: 'Coins' },
    { icon: 'star', color: 'success', value: '312', label: 'Solved' },
  ];

  const settings: SettingRow[] = [
    {
      icon: 'star',
      soft: 'primarySoft',
      color: 'primary',
      title: 'Knowledge Hub',
      sub: 'Notes & imported material',
      onPress: () => router.push('/import'),
    },
    {
      icon: 'lockSolid',
      soft: 'pinkSoft',
      color: 'pink',
      title: 'Locked apps',
      sub: '3 apps blacklisted',
      onPress: () => router.push('/blacklist'),
    },
    {
      icon: 'sun',
      soft: 'orangeSoft',
      color: 'orange',
      title: 'Wake-Up Lock',
      sub: 'On · 07:30 every day',
      onPress: () => router.push('/wakeup'),
    },
    {
      icon: 'bolt',
      soft: 'cyanSoft',
      color: 'cyan',
      title: 'Exchange rate',
      sub: '5 correct = 15 minutes',
      onPress: () => {},
    },
    {
      icon: dark ? 'moon' : 'sun',
      soft: 'primarySoft',
      color: 'primary',
      title: 'Appearance',
      sub: dark ? 'Dark' : 'Light',
      onPress: toggle,
    },
  ];

  return (
    <Screen scroll contentStyle={styles.content}>
      {/* Avatar */}
      <View style={styles.avatarCol}>
        <View style={[styles.avatarRing, { backgroundColor: t.primary }]}>
          <View style={[styles.avatarInner, { backgroundColor: t.surface }]}>
            <Text style={[styles.avatarText, { color: t.text }]}>AP</Text>
          </View>
        </View>
        <Text style={[styles.name, { color: t.text }]}>Alex Petrov</Text>
        <View style={styles.headChips}>
          <View style={[styles.headChip, { backgroundColor: t.primarySoft }]}>
            <Text style={[styles.headChipText, { color: t.primary }]}>8th grade</Text>
          </View>
          <View style={[styles.headChip, { backgroundColor: t.orangeSoft }]}>
            <Text style={[styles.headChipText, { color: t.orange }]}>Level 7</Text>
          </View>
        </View>
      </View>

      {/* Level card */}
      <View style={[styles.levelCard, { backgroundColor: t.surface, borderColor: t.border }]}>
        <View style={styles.levelHead}>
          <Text style={[styles.levelTitle, { color: t.text2 }]}>Level 7 · Scholar</Text>
          <Text style={[styles.levelXp, { color: t.text3 }]}>720 / 1000 XP</Text>
        </View>
        <View style={[styles.track, { backgroundColor: t.surface2 }]}>
          <View style={[styles.trackFill, { backgroundColor: t.primary }]} />
        </View>
      </View>

      {/* Stat cards */}
      <View style={styles.statRow}>
        {stats.map((s) => (
          <View
            key={s.label}
            style={[styles.statCard, { backgroundColor: t.surface, borderColor: t.border }]}>
            <Icon name={s.icon} size={20} color={t[s.color]} />
            <Text style={[styles.statValue, { color: t.text }]}>{s.value}</Text>
            <Text style={[styles.statLabel, { color: t.text3 }]}>{s.label}</Text>
          </View>
        ))}
      </View>

      {/* Focus subjects */}
      <Text style={[styles.secLabel, { color: t.text3 }]}>Focus subjects</Text>
      <View style={styles.chipsWrap}>
        {PROFILE_SUBJECTS.map((s) => (
          <View key={s.name} style={[styles.subjChip, { backgroundColor: t[s.soft] }]}>
            <View style={[styles.subjDot, { backgroundColor: t[s.col] }]} />
            <Text style={[styles.subjName, { color: t[s.col] }]}>{s.name}</Text>
          </View>
        ))}
      </View>

      {/* Settings */}
      <Text style={[styles.secLabel, { color: t.text3 }]}>Settings</Text>
      <View style={[styles.settingsCard, { backgroundColor: t.surface, borderColor: t.border }]}>
        {settings.map((r, i) => (
          <Pressable
            key={r.title}
            onPress={r.onPress}
            style={[
              styles.row,
              { borderBottomColor: t.border },
              i === settings.length - 1 && styles.rowLast,
            ]}>
            <View style={[styles.rowIcon, { backgroundColor: t[r.soft] }]}>
              <Icon name={r.icon} size={18} color={t[r.color]} />
            </View>
            <View style={styles.rowText}>
              <Text style={[styles.rowTitle, { color: t.text }]}>{r.title}</Text>
              <Text style={[styles.rowSub, { color: t.text3 }]}>{r.sub}</Text>
            </View>
            <Icon name="chevronRight" size={18} color={t.text3} />
          </Pressable>
        ))}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingTop: 2, paddingHorizontal: 22, paddingBottom: 16 },

  avatarCol: { alignItems: 'center', marginTop: 14 },
  avatarRing: {
    width: 92,
    height: 92,
    borderRadius: 999,
    padding: 4,
  },
  avatarInner: {
    width: '100%',
    height: '100%',
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { fontFamily: Font.baloo800, fontSize: 34 },
  name: { fontFamily: Font.baloo800, fontSize: 23, marginTop: 12 },
  headChips: { flexDirection: 'row', gap: 7, marginTop: 5 },
  headChip: { paddingVertical: 4, paddingHorizontal: 11, borderRadius: 999 },
  headChipText: { fontFamily: Font.nunito800, fontSize: 12 },

  levelCard: {
    marginTop: 18,
    borderWidth: 1,
    borderRadius: 20,
    paddingVertical: 16,
    paddingHorizontal: 18,
  },
  levelHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 9,
  },
  levelTitle: { fontFamily: Font.nunito800, fontSize: 13 },
  levelXp: { fontFamily: Font.nunito800, fontSize: 12.5 },
  track: { height: 11, borderRadius: 999, overflow: 'hidden' },
  trackFill: { height: '100%', width: '72%', borderRadius: 999 },

  statRow: { flexDirection: 'row', gap: 10, marginTop: 12 },
  statCard: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 18,
    paddingVertical: 14,
    paddingHorizontal: 10,
    alignItems: 'center',
    gap: 3,
  },
  statValue: { fontFamily: Font.baloo800, fontSize: 20 },
  statLabel: { fontFamily: Font.nunito800, fontSize: 11 },

  secLabel: {
    fontFamily: Font.nunito800,
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: 20,
    marginHorizontal: 2,
    marginBottom: 10,
  },

  chipsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 9 },
  subjChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingVertical: 9,
    paddingHorizontal: 14,
    borderRadius: 999,
  },
  subjDot: { width: 8, height: 8, borderRadius: 999 },
  subjName: { fontFamily: Font.nunito800, fontSize: 13.5 },

  settingsCard: {
    borderWidth: 1,
    borderRadius: 20,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 13,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
  },
  rowLast: { borderBottomWidth: 0 },
  rowIcon: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowText: { flex: 1 },
  rowTitle: { fontFamily: Font.nunito800, fontSize: 14.5 },
  rowSub: { fontFamily: Font.nunito700, fontSize: 12, marginTop: 2 },
});
