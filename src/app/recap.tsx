import { useRouter } from 'expo-router';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type TextStyle,
  type ViewStyle,
} from 'react-native';

import { Icon } from '@/components/Icon';
import { PrimaryButton } from '@/components/PrimaryButton';
import { Screen } from '@/components/Screen';
import { RECAP } from '@/store/content';
import { Font } from '@/theme/tokens';
import { useTokens } from '@/theme/theme';
import { useEarnLock } from '@/store/useEarnLock';

export default function RecapScreen() {
  const t = useTokens();
  const router = useRouter();

  const recapPick = useEarnLock((s) => s.recapPick);
  const recapChecked = useEarnLock((s) => s.recapChecked);
  const pickRecap = useEarnLock((s) => s.pickRecap);
  const checkRecap = useEarnLock((s) => s.checkRecap);

  const recapPre = RECAP.pre;
  const recapPost = RECAP.post;
  const options = RECAP.options;
  const answer = RECAP.answer;
  const recapBlank = recapPick || '';
  const recapCorrect = recapPick === RECAP.answer;

  const quizBack = () => router.push('/journey');
  const quizClose = () => router.push('/home');

  // Blank chip state (box + text color).
  let blankBox: ViewStyle;
  let blankColor: string;
  if (recapChecked) {
    if (recapCorrect) {
      blankBox = { borderWidth: 2, borderColor: t.success, backgroundColor: t.successSoft };
      blankColor = t.success;
    } else {
      blankBox = { borderWidth: 2, borderColor: t.danger, backgroundColor: t.dangerSoft };
      blankColor = t.danger;
    }
  } else if (recapPick) {
    blankBox = { borderWidth: 2, borderColor: t.primary, backgroundColor: t.primarySoft };
    blankColor = t.text;
  } else {
    blankBox = {
      borderWidth: 2,
      borderStyle: 'dashed',
      borderColor: t.border,
      backgroundColor: t.surface2,
    };
    blankColor = t.text3;
  }

  const chipStyle = (w: string): ViewStyle => {
    if (!recapChecked) {
      if (recapPick === w) {
        return { borderWidth: 2, borderColor: t.primary, backgroundColor: t.primarySoft };
      }
      return { borderWidth: 2, borderColor: t.border, backgroundColor: t.surface };
    }
    if (w === answer) {
      return { borderWidth: 2, borderColor: t.success, backgroundColor: t.successSoft };
    }
    if (recapPick === w) {
      return { borderWidth: 2, borderColor: t.danger, backgroundColor: t.dangerSoft };
    }
    return { borderWidth: 2, borderColor: t.border, backgroundColor: t.surface, opacity: 0.55 };
  };

  const recapFbText = recapCorrect ? 'Correct — 180°!' : "Not quite — it's 180°.";
  const fbColor = recapCorrect ? t.success : t.danger;
  const fbBg = recapCorrect ? t.successSoft : t.dangerSoft;

  const recapBtnLabel = recapChecked ? 'Continue →' : 'Check';
  const recapBtnDisabled = !(recapPick || recapChecked);
  const onBtn = () => (recapChecked ? router.push('/earned') : checkRecap());

  const sentenceText: TextStyle = {
    fontFamily: Font.nunito700,
    fontSize: 20,
    lineHeight: 35,
    color: t.text2,
  };

  return (
    <Screen bottomInset>
      {/* Progress */}
      <View style={[styles.progressTrack, { backgroundColor: t.surface2 }]}>
        <View style={[styles.progressFill, { backgroundColor: t.primary }]} />
      </View>

      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={quizBack} hitSlop={8}>
          <Icon name="chevronLeft" size={22} color={t.text3} />
        </Pressable>
        <Pressable onPress={quizClose} hitSlop={8}>
          <Icon name="close" size={21} color={t.text3} />
        </Pressable>
      </View>

      {/* Body */}
      <ScrollView
        style={styles.bodyScroll}
        contentContainerStyle={styles.body}
        showsVerticalScrollIndicator={false}>
        <View style={styles.tagRow}>
          <View style={[styles.tagDot, { backgroundColor: t.fire }]} />
          <Text style={[styles.tagText, { color: t.fire }]}>RECAP</Text>
        </View>

        <Text style={[styles.fillTitle, { color: t.text }]}>Fill in the blank</Text>

        <View style={styles.sentenceRow}>
          <Text style={sentenceText}>{recapPre + ' '}</Text>
          <View style={[styles.blankChip, blankBox]}>
            <Text style={[styles.blankText, { color: blankColor }]}>{recapBlank}</Text>
          </View>
          <Text style={sentenceText}>{' ' + recapPost}</Text>
        </View>

        <View style={styles.spacer} />

        <View style={styles.chipsRow}>
          {options.map((w) => (
            <Pressable
              key={w}
              onPress={() => pickRecap(w)}
              style={({ pressed }) => [
                styles.chip,
                chipStyle(w),
                pressed && !recapChecked && styles.pressed,
              ]}>
              <Text style={[styles.chipText, { color: t.text }]}>{w}</Text>
            </Pressable>
          ))}
        </View>
      </ScrollView>

      {/* Footer */}
      <View style={styles.footer}>
        {recapChecked && (
          <View style={[styles.feedback, { backgroundColor: fbBg }]}>
            <Text style={[styles.feedbackText, { color: fbColor }]}>{recapFbText}</Text>
          </View>
        )}
        <PrimaryButton label={recapBtnLabel} disabled={recapBtnDisabled} onPress={onBtn} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  progressTrack: {
    height: 6,
    marginTop: 2,
    marginHorizontal: 20,
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressFill: { width: '90%', height: '100%', borderRadius: 3 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 13,
    paddingHorizontal: 20,
    paddingBottom: 2,
  },
  bodyScroll: { flex: 1 },
  body: { flexGrow: 1, paddingTop: 6, paddingHorizontal: 24, paddingBottom: 0 },
  tagRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  tagDot: { width: 9, height: 9, borderRadius: 4.5 },
  tagText: { fontFamily: Font.nunito800, fontSize: 12, letterSpacing: 1 },
  fillTitle: { fontFamily: Font.baloo700, fontSize: 20, marginTop: 8 },
  sentenceRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    marginTop: 22,
  },
  blankChip: {
    minWidth: 76,
    height: 40,
    borderRadius: 11,
    paddingHorizontal: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  blankText: { fontFamily: Font.baloo700, fontSize: 18 },
  spacer: { flex: 1, minHeight: 22 },
  chipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 6,
  },
  chip: {
    paddingVertical: 12,
    paddingHorizontal: 18,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipText: { fontFamily: Font.nunito800, fontSize: 15 },
  pressed: { transform: [{ scale: 0.97 }] },
  footer: { paddingTop: 8, paddingHorizontal: 22, paddingBottom: 0 },
  feedback: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 14,
    marginBottom: 10,
  },
  feedbackText: { fontFamily: Font.nunito800, fontSize: 14 },
});
