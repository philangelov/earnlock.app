import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Icon } from '@/components/Icon';
import { PrimaryButton } from '@/components/PrimaryButton';
import { ProgressRing } from '@/components/ProgressRing';
import { Screen } from '@/components/Screen';
import { APP_DEFS } from '@/store/content';
import { useEarnLock } from '@/store/useEarnLock';
import { Font } from '@/theme/tokens';
import { useTokens } from '@/theme/theme';

export default function HomeScreen() {
  const t = useTokens();
  const router = useRouter();

  const minutesLeft = useEarnLock((s) => s.minutesLeft);
  const streak = useEarnLock((s) => s.streak);
  const coins = useEarnLock((s) => s.coins);
  const debt = useEarnLock((s) => s.debt);

  const locked = minutesLeft <= 0;
  const homeRingColor = locked ? t.pink : t.success;
  const hpct = minutesLeft > 0 ? Math.min(1, minutesLeft / 20) : 0.045;
  const C = 339.292;
  const homeRingOffset = C * (1 - hpct);

  const minLabel = minutesLeft + ':00';
  const earnLabel = locked ? 'Earn screen time' : 'Earn more time';
  const appsLabel = locked ? 'Locked apps' : 'Unlocked apps';

  return (
    <Screen scroll contentStyle={styles.content}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={[styles.greeting, { color: t.text2 }]}>Good afternoon</Text>
          <Text style={[styles.headline, { color: t.text }]}>Ready to learn?</Text>
        </View>
        <View style={styles.pills}>
          <View style={[styles.pill, { backgroundColor: t.surface, borderColor: t.border }]}>
            <Icon name="flame" size={16} color={t.fire} />
            <Text style={[styles.pillText, { color: t.text }]}>{streak}</Text>
          </View>
          <View style={[styles.pill, { backgroundColor: t.surface, borderColor: t.border }]}>
            <Icon name="coin" size={16} color={t.gold} />
            <Text style={[styles.pillText, { color: t.text }]}>{coins}</Text>
          </View>
        </View>
      </View>

      {/* Ring card */}
      <View style={[styles.card, { backgroundColor: t.surface, borderColor: t.border }]}>
        <ProgressRing
          size={196}
          viewBox={130}
          rings={[
            {
              r: 54,
              strokeWidth: 13,
              trackColor: t.surface2,
              color: homeRingColor,
              circumference: 339.29,
              offset: homeRingOffset,
            },
          ]}>
          {locked ? (
            <View style={styles.overlay}>
              <View style={[styles.lockBox, { backgroundColor: t.dangerSoft }]}>
                <Icon name="lockRound" size={26} color={t.fire} />
              </View>
              <Text style={[styles.lockedTitle, { color: t.text }]}>Locked</Text>
              <Text style={[styles.lockedSub, { color: t.text2 }]}>0 min available</Text>
            </View>
          ) : (
            <View style={styles.overlay}>
              <Text style={[styles.minLabel, { color: t.text }]}>{minLabel}</Text>
              <Text style={[styles.minutesLeftLabel, { color: t.success }]}>MINUTES LEFT</Text>
            </View>
          )}
        </ProgressRing>

        <Text style={[styles.cardDesc, { color: t.text2 }]}>
          {locked
            ? 'Your apps are locked. Answer a few questions to earn screen time.'
            : 'Nice — your apps are unlocked. Enjoy your break!'}
        </Text>

        <PrimaryButton
          label={earnLabel}
          icon={<Icon name="bolt" size={19} color={t.onPrimary} />}
          onPress={() => router.push('/journey')}
          style={styles.earnBtn}
        />
      </View>

      {/* SOS debt banner */}
      {debt && (
        <View style={[styles.debt, { backgroundColor: t.dangerSoft }]}>
          <Icon name="alertCircle" size={16} color={t.danger} />
          <Text style={[styles.debtText, { color: t.danger }]}>
            Repaying SOS — your next quiz needs 7 questions.
          </Text>
        </View>
      )}

      {/* Apps */}
      <Text style={[styles.appsLabel, { color: t.text3 }]}>{appsLabel}</Text>
      <View style={styles.apps}>
        {APP_DEFS.map((def) => (
          <View key={def.key} style={[styles.tile, { backgroundColor: def.tile }]}>
            <Icon name={def.icon} size={22} color="#fff" />
            {locked && (
              <View style={styles.tileLock}>
                <Icon name="lockSolid" size={20} color="#fff" />
              </View>
            )}
          </View>
        ))}
      </View>

      <View style={styles.spacer} />

      {/* Emergency unlock */}
      <Pressable
        onPress={() => router.push('/sos')}
        style={({ pressed }) => [
          styles.sos,
          { backgroundColor: t.surface, borderColor: t.border },
          pressed && styles.pressed,
        ]}>
        <Icon name="shield" size={17} color={t.danger} />
        <Text style={[styles.sosText, { color: t.danger }]}>Emergency unlock · 1 left today</Text>
      </Pressable>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingTop: 2, paddingHorizontal: 22, paddingBottom: 16 },

  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 6,
  },
  greeting: { fontFamily: Font.nunito700, fontSize: 13 },
  headline: { fontFamily: Font.baloo800, fontSize: 22, lineHeight: 23.1 },

  pills: { flexDirection: 'row', gap: 8 },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingVertical: 7,
    paddingHorizontal: 11,
    borderRadius: 999,
    borderWidth: 1,
  },
  pillText: { fontFamily: Font.nunito800, fontSize: 14 },

  card: {
    marginTop: 16,
    borderRadius: 26,
    borderWidth: 1,
    paddingVertical: 24,
    paddingHorizontal: 20,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.14,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 16 },
    elevation: 4,
  },

  overlay: { alignItems: 'center' },
  lockBox: {
    width: 46,
    height: 46,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  lockedTitle: { fontFamily: Font.baloo800, fontSize: 21, marginTop: 8 },
  lockedSub: { fontFamily: Font.nunito700, fontSize: 12.5 },
  minLabel: { fontFamily: Font.baloo800, fontSize: 46 },
  minutesLeftLabel: { fontFamily: Font.nunito800, fontSize: 11.5, letterSpacing: 1 },

  cardDesc: {
    fontFamily: Font.nunito600,
    fontSize: 14.5,
    lineHeight: 20.3,
    textAlign: 'center',
    marginTop: 16,
    maxWidth: 238,
  },
  earnBtn: { marginTop: 16 },

  debt: {
    marginTop: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 14,
  },
  debtText: { flex: 1, fontFamily: Font.nunito800, fontSize: 12.5 },

  appsLabel: {
    fontFamily: Font.nunito800,
    fontSize: 12,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    marginTop: 20,
    marginHorizontal: 2,
    marginBottom: 10,
  },
  apps: { flexDirection: 'row', gap: 12 },
  tile: {
    flex: 1,
    aspectRatio: 1,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tileLock: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(8,8,14,0.58)',
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },

  spacer: { flex: 1, minHeight: 16 },

  sos: {
    marginTop: 14,
    padding: 13,
    borderRadius: 15,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  sosText: { fontFamily: Font.nunito800, fontSize: 14 },
  pressed: { transform: [{ scale: 0.97 }] },
});
