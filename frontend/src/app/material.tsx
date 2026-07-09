import * as DocumentPicker from 'expo-document-picker';
import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { Screen } from '@/components/Screen';
import { StepHeader } from '@/components/StepHeader';
import { Sym } from '@/components/Sym';
import { haptic } from '@/lib/haptics';
import { STEP_TOTAL, stepIndex } from '@/store/onboarding';
import { useEarnLock } from '@/store/useEarnLock';
import { Radius, Space } from '@/theme/tokens';
import { Type } from '@/theme/type';
import { useTokens } from '@/theme/theme';

export default function MaterialScreen() {
  const t = useTokens();
  const router = useRouter();

  const importText = useEarnLock((s) => s.importText);
  const setImportText = useEarnLock((s) => s.setImportText);
  const pasteExample = useEarnLock((s) => s.pasteExample);
  const uploadName = useEarnLock((s) => s.uploadName);
  const setUploadName = useEarnLock((s) => s.setUploadName);
  const doImport = useEarnLock((s) => s.doImport);
  const onboarded = useEarnLock((s) => s.onboarded);

  const canContinue = importText.trim().length > 0 || uploadName.length > 0;

  const pickFile = async () => {
    haptic.tap();
    const res = await DocumentPicker.getDocumentAsync({
      type: ['application/pdf', 'image/*'],
      copyToCacheDirectory: false,
    });
    if (!res.canceled && res.assets[0]) setUploadName(res.assets[0].name);
  };

  const onContinue = () => {
    doImport();
    if (onboarded) router.back();
    else router.push('/apps');
  };

  return (
    <Screen
      scroll
      contentStyle={styles.content}
      avoidKeyboard
      header={
        <View style={styles.header}>
          <StepHeader
            step={stepIndex('material')}
            total={STEP_TOTAL}
            title={onboarded ? 'Study material' : undefined}
            onBack={() => router.back()}
          />
        </View>
      }
      footer={
        <Button
          label={onboarded ? 'Save' : 'Generate questions'}
          disabled={!canContinue}
          onPress={onContinue}
        />
      }
      footerStyle={styles.footer}
    >
      <Text style={[Type.title1, styles.heading, { color: t.text }]}>Add your material</Text>
      <Text style={[Type.subhead, styles.sub, { color: t.text2 }]}>
        Paste notes or upload a worksheet — questions are generated from your own content.
      </Text>

      <Card style={styles.inputCard}>
        <TextInput
          value={importText}
          onChangeText={setImportText}
          placeholder="Paste class notes, a chapter summary, or vocabulary…"
          placeholderTextColor={t.text3}
          accessibilityLabel="Study material"
          multiline
          textAlignVertical="top"
          style={[Type.body, styles.input, { color: t.text }]}
        />
        <View style={[styles.inputFooter, { borderTopColor: t.separator }]}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Paste example notes"
            hitSlop={{ top: 10, bottom: 10 }}
            onPress={() => {
              haptic.tap();
              pasteExample();
            }}
            style={({ pressed }) => [styles.ghostBtn, pressed && { opacity: 0.6 }]}
          >
            <Sym name="text.badge.plus" size={15} color={t.accentText} />
            <Text style={[Type.footnoteStrong, { color: t.accentText }]}>Paste example</Text>
          </Pressable>
          {importText.trim().length > 0 && (
            <Text style={[Type.caption, { color: t.text3, fontVariant: ['tabular-nums'] }]}>
              {importText.trim().length} chars
            </Text>
          )}
        </View>
      </Card>

      <Text style={[Type.overline, styles.or, { color: t.text3 }]}>OR</Text>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel={
          uploadName ? `Uploaded ${uploadName}, tap to replace` : 'Upload a PDF or photo'
        }
        onPress={pickFile}
        style={({ pressed }) => pressed && { opacity: 0.7 }}
      >
        <Card style={styles.upload}>
          <View style={[styles.uploadIcon, { backgroundColor: t.fill }]}>
            <Sym
              name={uploadName ? 'checkmark' : 'arrow.up.doc.fill'}
              size={18}
              color={uploadName ? t.accentText : t.text}
            />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[Type.headline, { color: t.text }]} numberOfLines={1}>
              {uploadName || 'Upload a PDF or photo'}
            </Text>
            <Text style={[Type.footnote, { color: t.text3 }]}>
              {uploadName ? 'Ready to use' : 'Worksheets, textbook pages, screenshots'}
            </Text>
          </View>
          <Sym name="chevron.right" size={14} color={t.text3} weight="semibold" />
        </Card>
      </Pressable>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: Space.xl, paddingTop: Space.sm },
  content: { paddingHorizontal: Space.xl, paddingBottom: Space.xxl },
  footer: { paddingHorizontal: Space.xl, paddingTop: Space.md },

  heading: { textAlign: 'center', marginTop: Space.xl },
  sub: { textAlign: 'center', marginTop: 8 },

  inputCard: { marginTop: Space.xl, padding: 0, overflow: 'hidden' },
  input: {
    minHeight: 128,
    paddingHorizontal: Space.lg,
    paddingTop: Space.lg,
    paddingBottom: Space.md,
  },
  inputFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Space.md,
    paddingVertical: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  ghostBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 4,
    paddingHorizontal: 6,
  },

  or: { textAlign: 'center', marginVertical: Space.lg },

  upload: { flexDirection: 'row', alignItems: 'center', gap: Space.md, padding: Space.lg },
  uploadIcon: {
    width: 42,
    height: 42,
    borderRadius: Radius.control,
    borderCurve: 'continuous',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
