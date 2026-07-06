import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Icon } from '@/components/Icon';
import { PrimaryButton } from '@/components/PrimaryButton';
import { Screen } from '@/components/Screen';
import { SUBJECT_DEFS, type SubjectDef } from '@/store/content';
import { useEarnLock } from '@/store/useEarnLock';
import { Font } from '@/theme/tokens';
import { useTokens } from '@/theme/theme';

function SubjectCard({
  def,
  selected,
  onToggle,
}: {
  def: SubjectDef;
  selected: boolean;
  onToggle: () => void;
}) {
  const t = useTokens();
  return (
    <Pressable
      onPress={onToggle}
      style={[
        styles.card,
        { backgroundColor: t.surface, borderColor: selected ? t.primary : t.border },
        selected && { shadowColor: t.primary, ...styles.cardShadow },
      ]}>
      <View style={[styles.iconWrap, { backgroundColor: t[def.soft] }]}>
        <Icon name={def.icon} size={24} color={t[def.color]} />
      </View>
      <Text style={[styles.cardLabel, { color: t.text }]}>{def.key}</Text>
      {selected && (
        <View style={[styles.badge, { backgroundColor: t.primary }]}>
          <Icon name="check" size={14} color="#fff" strokeWidth={3.4} />
        </View>
      )}
    </Pressable>
  );
}

export default function SubjectsScreen() {
  const t = useTokens();
  const router = useRouter();
  const subj = useEarnLock((s) => s.subj);
  const toggleSubj = useEarnLock((s) => s.toggleSubj);

  return (
    <Screen scroll contentStyle={styles.content}>
      <Text style={[styles.title, { color: t.text }]}>Pick your focus{'\n'}subjects</Text>
      <Text style={[styles.subtitle, { color: t.text2 }]}>
        We'll mix questions from these — change them anytime.
      </Text>

      <View style={styles.grid}>
        {SUBJECT_DEFS.map((def) => (
          <SubjectCard
            key={def.key}
            def={def}
            selected={subj[def.key]}
            onToggle={() => toggleSubj(def.key)}
          />
        ))}
      </View>

      <View style={styles.spacer} />
      <PrimaryButton label="Continue" onPress={() => router.push('/import')} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingTop: 6, paddingHorizontal: 26, paddingBottom: 24 },
  title: {
    fontFamily: Font.baloo800,
    fontSize: 27,
    lineHeight: 30.24,
    letterSpacing: -0.3,
    marginTop: 18,
  },
  subtitle: { fontFamily: Font.nunito600, fontSize: 15, marginTop: 9, lineHeight: 21 },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 13,
    marginTop: 26,
  },
  card: {
    position: 'relative',
    flexBasis: '47%',
    flexGrow: 1,
    padding: 16,
    borderRadius: 18,
    borderWidth: 2,
  },
  cardShadow: {
    shadowOpacity: 0.5,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 8 },
    elevation: 6,
  },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardLabel: { fontFamily: Font.baloo700, fontSize: 17, marginTop: 12 },
  badge: {
    position: 'absolute',
    top: 12,
    right: 12,
    width: 23,
    height: 23,
    borderRadius: 11.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  spacer: { flex: 1, minHeight: 20 },
});
