import { Stack, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon } from '@/components/Icon';
import { PrimaryButton } from '@/components/PrimaryButton';
import { useEarnLock } from '@/store/useEarnLock';
import { Font } from '@/theme/tokens';
import { useTokens } from '@/theme/theme';

export default function SosScreen() {
  const t = useTokens();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const useSos = useEarnLock((s) => s.useSos);

  return (
    <View style={styles.root}>
      <Stack.Screen options={{ contentStyle: { backgroundColor: 'transparent' } }} />
      <StatusBar style="light" />

      {/* Dim backdrop — tap anywhere outside the sheet to dismiss. */}
      <Pressable style={[StyleSheet.absoluteFill, styles.backdrop]} onPress={() => router.back()} />

      {/* Bottom sheet. */}
      <View style={[styles.sheet, { backgroundColor: t.bg, paddingBottom: 26 + insets.bottom }]}>
        <View style={[styles.icon, { backgroundColor: t.dangerSoft }]}>
          <Icon name="shieldAlert" size={34} color={t.danger} />
        </View>

        <Text style={[styles.title, { color: t.text }]}>Emergency unlock</Text>

        <Text style={[styles.subtitle, { color: t.text2 }]}>
          Unlock all your apps for{' '}
          <Text style={[styles.subtitleBold, { color: t.text }]}>2 minutes</Text>, right now.
        </Text>

        <View style={[styles.warning, { backgroundColor: t.dangerSoft }]}>
          <View style={styles.warnIcon}>
            <Icon name="alertCircle" size={20} color={t.danger} />
          </View>
          <Text style={[styles.warnText, { color: t.text }]}>
            You have <Text style={styles.warnBold}>1 SOS</Text> today. Using it means your next
            quiz needs <Text style={styles.warnBold}>7 questions</Text> instead of 5 to repay the
            time.
          </Text>
        </View>

        <PrimaryButton
          label="Use my SOS (2 min)"
          background={t.danger}
          color="#fff"
          onPress={() => {
            useSos();
            router.back();
          }}
          style={styles.sosBtn}
        />

        <Pressable
          onPress={() => router.back()}
          style={({ pressed }) => [styles.notNow, pressed && styles.pressed]}>
          <Text style={[styles.notNowText, { color: t.text2 }]}>Not now</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: 'flex-end' },
  backdrop: { backgroundColor: 'rgba(8,7,12,0.55)' },
  sheet: {
    paddingTop: 28,
    paddingHorizontal: 26,
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    borderBottomLeftRadius: 44,
    borderBottomRightRadius: 44,
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowRadius: 30,
    shadowOffset: { width: 0, height: -10 },
    elevation: 24,
  },
  icon: {
    width: 66,
    height: 66,
    borderRadius: 20,
    alignSelf: 'center',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontFamily: Font.baloo800,
    fontSize: 24,
    textAlign: 'center',
    marginTop: 18,
  },
  subtitle: {
    fontFamily: Font.nunito600,
    fontSize: 15,
    lineHeight: 21.75,
    textAlign: 'center',
    marginTop: 8,
  },
  subtitleBold: { fontFamily: Font.nunito800 },
  warning: {
    flexDirection: 'row',
    gap: 11,
    padding: 15,
    borderRadius: 16,
    marginTop: 20,
    alignItems: 'flex-start',
  },
  warnIcon: { flexShrink: 0, marginTop: 1 },
  warnText: {
    flex: 1,
    fontFamily: Font.nunito700,
    fontSize: 13.5,
    lineHeight: 19.575,
  },
  warnBold: { fontFamily: Font.nunito800 },
  sosBtn: { marginTop: 18 },
  notNow: {
    marginTop: 9,
    paddingVertical: 13,
    alignItems: 'center',
  },
  notNowText: { fontFamily: Font.nunito800, fontSize: 15 },
  pressed: { transform: [{ scale: 0.97 }] },
});
