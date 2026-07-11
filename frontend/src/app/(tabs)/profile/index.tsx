import { Image } from 'expo-image';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Linking, Pressable, StyleSheet, Text, View } from 'react-native';

import { Card } from '@/components/Card';
import { ListGroup, ListRow, SectionHeader } from '@/components/List';
import { SegmentedControl } from '@/components/SegmentedControl';
import { StatGlyph, type StatRole } from '@/components/StatGlyph';
import { Sym } from '@/components/Sym';
import { TabScreen } from '@/components/TabScreen';
import { discardAvatar, pickAvatar } from '@/lib/avatar';
import { haptic } from '@/lib/haptics';
import { useScreenTime } from '@/lib/screenTime/store';
import { SUBJECT_DEFS } from '@/store/content';
import { useStats } from '@/store/stats';
import { useEarnLock } from '@/store/useEarnLock';
import { Radius, Space } from '@/theme/tokens';
import { Type } from '@/theme/type';
import { useThemeMode, useTokens, type ThemeMode } from '@/theme/theme';

/** Order of the appearance control. `system` sits first because it's the default. */
const THEME_MODES: ThemeMode[] = ['system', 'light', 'dark'];
const THEME_LABELS: Record<ThemeMode, string> = {
  system: 'System',
  light: 'Light',
  dark: 'Dark',
};

export default function ProfileScreen() {
  const t = useTokens();
  const router = useRouter();
  const { mode, setMode } = useThemeMode();

  const grade = useEarnLock((s) => s.grade);
  const subj = useEarnLock((s) => s.subj);
  const name = useEarnLock((s) => s.name).trim();
  const account = useEarnLock((s) => s.account);
  const authed = useEarnLock((s) => s.authed);
  const avatarUri = useEarnLock((s) => s.avatarUri);
  const setAvatarUri = useEarnLock((s) => s.setAvatarUri);
  const logoutAccount = useEarnLock((s) => s.logoutAccount);
  const deleteAccount = useEarnLock((s) => s.deleteAccount);

  const stats = useStats((s) => s.data);
  const refreshing = useStats((s) => s.refreshing);
  const fetchStats = useStats((s) => s.fetch);

  const available = useScreenTime((s) => s.available);
  const status = useScreenTime((s) => s.status);
  const selection = useScreenTime((s) => s.selection);
  const authorize = useScreenTime((s) => s.authorize);
  const revoke = useScreenTime((s) => s.revoke);
  const refresh = useScreenTime((s) => s.refresh);

  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useFocusEffect(
    useCallback(() => {
      void fetchStats();
    }, [fetchStats]),
  );

  const subjectCount = SUBJECT_DEFS.filter((s) => subj[s.key]).length;

  // No demo learner to fall back on: an unnamed account is simply "Learner", and the
  // avatar wears a person glyph rather than someone else's initials.
  const displayName = name || 'Learner';
  const initials = name
    ? name
        .split(/\s+/)
        .slice(0, 2)
        .map((part) => part[0]?.toUpperCase() ?? '')
        .join('')
    : null;

  const accuracy = stats?.totals.accuracy;

  const stConnected = status === 'approved';
  const stValue = !available
    ? 'Device build'
    : stConnected
      ? 'Connected'
      : status === 'denied'
        ? 'Denied'
        : 'Tap to connect';

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

  const onPickAvatar = () => {
    haptic.press();
    void pickAvatar(avatarUri).then((uri) => {
      if (uri) {
        setAvatarUri(uri);
        haptic.success();
      }
    });
  };

  const onRemoveAvatar = () => {
    discardAvatar(avatarUri);
    setAvatarUri(null);
  };

  const onAvatarPress = () => {
    if (!avatarUri) {
      onPickAvatar();
      return;
    }
    Alert.alert('Profile picture', undefined, [
      { text: 'Choose a new photo', onPress: onPickAvatar },
      { text: 'Remove photo', style: 'destructive', onPress: onRemoveAvatar },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  const onSignOut = () => {
    Alert.alert(
      'Sign out?',
      'Your account is kept. This device forgets your progress until you sign back in.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Sign out',
          style: 'destructive',
          onPress: () => {
            void revoke();
            void logoutAccount().then(() => router.replace('/'));
          },
        },
      ],
    );
  };

  const onDeleteAccount = () => {
    Alert.alert(
      'Delete your account?',
      'Your quizzes, streak, earned time and imported notes are permanently erased. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            setDeleting(true);
            void revoke();
            void deleteAccount().then((ok) => {
              setDeleting(false);
              if (ok) {
                router.replace('/');
                return;
              }
              Alert.alert(
                'Could not delete your account',
                'Nothing was removed. Check your connection and try again.',
              );
            });
          },
        },
      ],
    );
  };

  return (
    <TabScreen
      contentStyle={styles.content}
      refreshing={refreshing}
      onRefresh={() => void fetchStats({ force: true })}
    >
      {/* Identity — every figure below the name comes from the server, or isn't shown. */}
      <Card style={styles.identity}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={avatarUri ? 'Change your profile picture' : 'Add a profile picture'}
          onPress={onAvatarPress}
          style={({ pressed }) => pressed && styles.avatarPressed}
        >
          <View style={[styles.avatar, { backgroundColor: t.accent }]}>
            {avatarUri ? (
              <Image source={{ uri: avatarUri }} style={styles.avatarImage} contentFit="cover" />
            ) : initials ? (
              <Text style={[Type.title2, { color: t.onAccent }]}>{initials}</Text>
            ) : (
              <Sym name="person.fill" size={30} color={t.onAccent} />
            )}
          </View>
          <View style={[styles.avatarBadge, { backgroundColor: t.surface, borderColor: t.bg }]}>
            <Sym name="camera.fill" size={12} color={t.text2} />
          </View>
        </Pressable>

        <Text style={[Type.title3, { color: t.text, marginTop: Space.md }]}>{displayName}</Text>
        <Text style={[Type.footnote, { color: t.text2 }]}>
          Grade {grade} ·{' '}
          {account === 'apple'
            ? 'Signed in with Apple'
            : account === 'google'
              ? 'Signed in with Google'
              : 'Progress saved on this device'}
        </Text>
        {stats != null && (
          <View style={styles.miniStats}>
            <MiniStat role="streak" value={String(stats.streak.current)} label="Streak" />
            <View style={[styles.miniDivider, { backgroundColor: t.separator }]} />
            <MiniStat role="quizzes" value={String(stats.totals.quizzes)} label="Quizzes" />
            <View style={[styles.miniDivider, { backgroundColor: t.separator }]} />
            <MiniStat
              role="accuracy"
              value={accuracy != null ? `${Math.round(accuracy * 100)}%` : '—'}
              label="Accuracy"
            />
          </View>
        )}
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
          iconColor={t.onIcon}
          iconBg={t.iconIndigo}
          title="Screen Time access"
          trailing={<Text style={[Type.subhead, { color: t.text2 }]}>{stValue}</Text>}
          onPress={onScreenTime}
        />
        <ListRow
          icon="lock.fill"
          iconColor={t.onIcon}
          iconBg={t.iconBlue}
          title="Locked apps"
          value={selection.total > 0 ? `${selection.total}` : 'None'}
          onPress={() => router.push('/apps')}
          showChevron
        />
      </ListGroup>

      {/* Appearance — no enclosing card. A segmented control is already a container; a
          second one around it just draws a box around a box. */}
      <View>
        <SectionHeader title="Appearance" />
        {/* No haptic here: on iOS this is a real UISegmentedControl and taps itself.
            The portable fallback does its own. */}
        <SegmentedControl
          options={THEME_MODES.map((m) => THEME_LABELS[m])}
          selectedIndex={THEME_MODES.indexOf(mode)}
          onChange={(i) => setMode(THEME_MODES[i])}
        />
        <Text style={[Type.footnote, styles.groupFooter, { color: t.text3 }]}>
          System follows your device’s light or dark setting.
        </Text>
      </View>

      {/* Learning */}
      <ListGroup header="Learning">
        <ListRow
          icon="graduationcap.fill"
          iconColor={t.onIcon}
          iconBg={t.iconOrange}
          title="Grade"
          value={`Grade ${grade}`}
          onPress={() => router.push('/setup')}
          showChevron
        />
        <ListRow
          icon="square.grid.2x2.fill"
          iconColor={t.onIcon}
          iconBg={t.iconPurple}
          title="Subjects"
          value={`${subjectCount} chosen`}
          onPress={() => router.push('/setup')}
          showChevron
        />
        <ListRow
          icon="doc.text.fill"
          iconColor={t.onIcon}
          iconBg={t.iconTeal}
          title="Study material"
          onPress={() => router.push('/material')}
          showChevron
        />
      </ListGroup>

      {/* Account. Only a signed-in user has one to sign out of or delete; the alternative
          would be two buttons that lie about what they do. */}
      {authed ? (
        <ListGroup header="Account" footer="EarnLock · v1.0">
          <ListRow
            icon="rectangle.portrait.and.arrow.right"
            iconColor={t.onIcon}
            iconBg={t.iconGray}
            title="Sign out"
            onPress={onSignOut}
          />
          <ListRow
            icon="trash.fill"
            iconColor={t.onIcon}
            iconBg={t.iconRed}
            title="Delete account"
            destructive
            onPress={deleting ? undefined : onDeleteAccount}
            trailing={deleting ? <ActivityIndicator color={t.text3} /> : undefined}
          />
        </ListGroup>
      ) : (
        <ListGroup footer="EarnLock · v1.0">
          <ListRow
            icon="icloud.slash.fill"
            iconColor={t.onIcon}
            iconBg={t.iconGray}
            title="Not signed in"
            subtitle="Progress lives on this device only"
          />
        </ListGroup>
      )}
    </TabScreen>
  );
}

function MiniStat({ role, value, label }: { role: StatRole; value: string; label: string }) {
  const t = useTokens();
  return (
    <View style={styles.miniStat} accessible accessibilityLabel={`${value} ${label}`}>
      <StatGlyph role={role} size={14} />
      <Text style={[Type.headline, { color: t.text }]}>{value}</Text>
      <Text style={[Type.caption, { color: t.text3 }]}>{label}</Text>
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
    width: 78,
    height: 78,
    borderRadius: Radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  avatarImage: { width: '100%', height: '100%' },
  avatarPressed: { opacity: 0.85, transform: [{ scale: 0.97 }] },
  avatarBadge: {
    position: 'absolute',
    right: -2,
    bottom: -2,
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  miniStats: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'stretch',
    marginTop: Space.lg,
  },
  miniStat: { flex: 1, alignItems: 'center', gap: 2 },
  miniDivider: { width: StyleSheet.hairlineWidth, height: 30 },

  groupFooter: { paddingHorizontal: 4, marginTop: 7, lineHeight: 17 },
});
