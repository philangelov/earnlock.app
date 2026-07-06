import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Icon } from '@/components/Icon';
import { PrimaryButton } from '@/components/PrimaryButton';
import { Screen } from '@/components/Screen';
import { APP_DEFS, EDU_ITEMS } from '@/store/content';
import { useEarnLock } from '@/store/useEarnLock';
import { Font } from '@/theme/tokens';
import { useTokens } from '@/theme/theme';

export default function BlacklistScreen() {
  const t = useTokens();
  const router = useRouter();
  const apps = useEarnLock((s) => s.apps);
  const toggleApp = useEarnLock((s) => s.toggleApp);

  return (
    <Screen scroll contentStyle={styles.content}>
      <Text style={[styles.title, { color: t.text }]}>Lock your{'\n'}distractions</Text>
      <Text style={[styles.subtitle, { color: t.text2 }]}>
        Locked apps open only after you earn time.
      </Text>

      <View style={styles.appList}>
        {APP_DEFS.map((def) => {
          const on = apps[def.key];
          return (
            <View key={def.key} style={[styles.appRow, { backgroundColor: t.surface, borderColor: t.border }]}>
              <View style={[styles.tile, { backgroundColor: def.tile }]}>
                <Icon name={def.icon} size={21} color="#fff" />
              </View>
              <View style={styles.rowText}>
                <Text style={[styles.rowName, { color: t.text }]}>{def.name}</Text>
                <Text style={[styles.rowCat, { color: t.text3 }]}>{def.cat}</Text>
              </View>
              <Pressable
                onPress={() => toggleApp(def.key)}
                style={[
                  styles.track,
                  {
                    backgroundColor: on ? t.primary : t.border,
                    justifyContent: on ? 'flex-end' : 'flex-start',
                  },
                ]}>
                <View style={styles.knob} />
              </Pressable>
            </View>
          );
        })}
      </View>

      <Text style={[styles.sectionLabel, { color: t.text3 }]}>Always allowed</Text>

      <View style={styles.eduList}>
        {EDU_ITEMS.map((item) => (
          <View key={item.name} style={[styles.eduRow, { backgroundColor: t.surface2 }]}>
            <View style={[styles.tile, { backgroundColor: item.tile }]}>
              <Icon name="book" size={21} color="#fff" />
            </View>
            <View style={styles.rowText}>
              <Text style={[styles.rowName, { color: t.text }]}>{item.name}</Text>
              <Text style={[styles.rowCat, { color: t.text3 }]}>{item.cat}</Text>
            </View>
            <View style={[styles.openPill, { backgroundColor: t.successSoft }]}>
              <Icon name="check" size={13} color={t.success} strokeWidth={3} />
              <Text style={[styles.openText, { color: t.success }]}>Open</Text>
            </View>
          </View>
        ))}
      </View>

      <View style={[styles.banner, { backgroundColor: t.primarySoft }]}>
        <View style={[styles.bannerIcon, { backgroundColor: t.primary }]}>
          <Icon name="bolt" size={20} color="#fff" />
        </View>
        <Text style={[styles.bannerText, { color: t.text }]}>
          5 correct answers = <Text style={{ color: t.primary }}>15 minutes</Text>
        </Text>
      </View>

      <View style={styles.spacer} />
      <PrimaryButton label="Finish setup" onPress={() => router.replace('/home')} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingTop: 6, paddingHorizontal: 22, paddingBottom: 24 },
  title: {
    fontFamily: Font.baloo800,
    fontSize: 26,
    lineHeight: 29.12,
    letterSpacing: -0.3,
    marginTop: 16,
  },
  subtitle: { fontFamily: Font.nunito600, fontSize: 14.5, marginTop: 8, lineHeight: 20.3 },

  appList: { gap: 9, marginTop: 20 },
  appRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 13,
    paddingVertical: 11,
    paddingHorizontal: 13,
    borderRadius: 16,
    borderWidth: 1,
  },
  tile: {
    width: 42,
    height: 42,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowText: { flex: 1 },
  rowName: { fontFamily: Font.nunito800, fontSize: 15 },
  rowCat: { fontFamily: Font.nunito700, fontSize: 12.5 },

  track: {
    width: 46,
    height: 28,
    borderRadius: 999,
    padding: 3,
    flexDirection: 'row',
    alignItems: 'center',
  },
  knob: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#fff',
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 2,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },

  sectionLabel: {
    fontFamily: Font.nunito800,
    fontSize: 11,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    marginTop: 18,
    marginHorizontal: 4,
    marginBottom: 10,
  },

  eduList: { gap: 9 },
  eduRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 13,
    paddingVertical: 11,
    paddingHorizontal: 13,
    borderRadius: 16,
  },
  openPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingVertical: 6,
    paddingHorizontal: 11,
    borderRadius: 999,
  },
  openText: { fontFamily: Font.nunito800, fontSize: 12 },

  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 18,
    padding: 15,
    borderRadius: 16,
  },
  bannerIcon: {
    width: 38,
    height: 38,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bannerText: { flex: 1, fontFamily: Font.nunito800, fontSize: 14.5, lineHeight: 18.85 },

  spacer: { flex: 1, minHeight: 18 },
});
