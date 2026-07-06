import * as DocumentPicker from 'expo-document-picker';
import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { Icon } from '@/components/Icon';
import { PrimaryButton } from '@/components/PrimaryButton';
import { Screen } from '@/components/Screen';
import { Font } from '@/theme/tokens';
import { useTokens } from '@/theme/theme';
import { useEarnLock } from '@/store/useEarnLock';

export default function ImportScreen() {
  const t = useTokens();
  const router = useRouter();

  const importText = useEarnLock((s) => s.importText);
  const imported = useEarnLock((s) => s.imported);
  const uploadName = useEarnLock((s) => s.uploadName);
  const setImportText = useEarnLock((s) => s.setImportText);
  const pasteExample = useEarnLock((s) => s.pasteExample);
  const doImport = useEarnLock((s) => s.doImport);
  const setUploadName = useEarnLock((s) => s.setUploadName);

  const uploadTitle = uploadName || 'Upload a file';
  const uploadSub = uploadName ? 'Attached · tap to replace' : 'PDF, Word, image or text';

  const onUpload = async () => {
    try {
      const res = await DocumentPicker.getDocumentAsync({
        type: [
          'application/pdf',
          'application/msword',
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          'text/plain',
          'image/*',
        ],
        copyToCacheDirectory: false,
      });
      if (!res.canceled && res.assets?.[0]) setUploadName(res.assets[0].name);
    } catch {
      // ignore picker errors
    }
  };

  return (
    <Screen scroll contentStyle={styles.content}>
      <View style={styles.tagRow}>
        <Icon name="star" size={19} color={t.primary} />
        <Text style={[styles.tag, { color: t.primary }]}>Knowledge Hub</Text>
      </View>

      <Text style={[styles.title, { color: t.text }]}>Import your notes</Text>
      <Text style={[styles.subtitle, { color: t.text2 }]}>
        Paste notes, a lesson or a link. The AI turns your own material into quiz questions.
      </Text>

      <TextInput
        value={importText}
        onChangeText={setImportText}
        placeholder="Paste your Biology notes, a paragraph from the textbook, or a link…"
        placeholderTextColor={t.text3}
        multiline
        textAlignVertical="top"
        style={[
          styles.textarea,
          { borderColor: t.border, backgroundColor: t.surface2, color: t.text },
        ]}
      />

      <View style={styles.orRow}>
        <View style={[styles.orLine, { backgroundColor: t.border }]} />
        <Text style={[styles.orText, { color: t.text3 }]}>OR</Text>
        <View style={[styles.orLine, { backgroundColor: t.border }]} />
      </View>

      <Pressable
        onPress={onUpload}
        style={[styles.upload, { borderColor: t.border, backgroundColor: t.surface2 }]}>
        <View style={[styles.uploadIcon, { backgroundColor: t.primarySoft }]}>
          <Icon name="upload" size={20} color={t.primary} />
        </View>
        <View style={styles.uploadTextWrap}>
          <Text style={[styles.uploadTitle, { color: t.text }]}>{uploadTitle}</Text>
          <Text style={[styles.uploadSub, { color: t.text3 }]}>{uploadSub}</Text>
        </View>
      </Pressable>

      <View style={styles.chipsRow}>
        <Pressable
          onPress={pasteExample}
          style={[styles.chip, { backgroundColor: t.surface2, borderColor: t.border }]}>
          <Text style={[styles.chipText, { color: t.text2 }]}>Paste example</Text>
        </Pressable>
      </View>

      {imported && (
        <View style={[styles.success, { backgroundColor: t.successSoft, borderColor: t.success }]}>
          <View style={[styles.successIcon, { backgroundColor: t.success }]}>
            <Icon name="check" size={18} color="#fff" strokeWidth={3.2} />
          </View>
          <View>
            <Text style={[styles.successTitle, { color: t.text }]}>12 questions ready</Text>
            <Text style={[styles.successSub, { color: t.text2 }]}>Generated from your notes</Text>
          </View>
        </View>
      )}

      <View style={styles.spacer} />

      {imported ? (
        <PrimaryButton label="Continue" onPress={() => router.push('/blacklist')} />
      ) : (
        <PrimaryButton
          label="Generate questions"
          icon={<Icon name="star" size={19} color={t.onPrimary} />}
          disabled={!(importText.trim() || uploadName)}
          onPress={doImport}
        />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingTop: 6, paddingHorizontal: 26, paddingBottom: 24 },
  tagRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 16 },
  tag: {
    fontFamily: Font.nunito800,
    fontSize: 12.5,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  title: {
    fontFamily: Font.baloo800,
    fontSize: 26,
    lineHeight: 29.12,
    letterSpacing: -0.3,
    marginTop: 8,
  },
  subtitle: {
    fontFamily: Font.nunito400,
    fontSize: 15,
    marginTop: 8,
    lineHeight: 21,
  },
  textarea: {
    marginTop: 18,
    width: '100%',
    height: 132,
    borderRadius: 16,
    borderWidth: 2,
    padding: 15,
    fontFamily: Font.nunito400,
    fontSize: 14.5,
    lineHeight: 21.75,
  },
  orRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 12 },
  orLine: { flex: 1, height: 1 },
  orText: { fontFamily: Font.nunito800, fontSize: 11.5 },
  upload: {
    marginTop: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderRadius: 16,
    borderWidth: 2,
    borderStyle: 'dashed',
  },
  uploadIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  uploadTextWrap: { flex: 1, minWidth: 0 },
  uploadTitle: { fontFamily: Font.nunito800, fontSize: 14 },
  uploadSub: { fontFamily: Font.nunito700, fontSize: 12 },
  chipsRow: { flexDirection: 'row', gap: 8, marginTop: 12 },
  chip: {
    paddingVertical: 8,
    paddingHorizontal: 13,
    borderRadius: 11,
    borderWidth: 1,
    alignSelf: 'flex-start',
  },
  chipText: { fontFamily: Font.nunito800, fontSize: 12.5 },
  success: {
    marginTop: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    padding: 14,
    borderRadius: 15,
    borderWidth: 1,
  },
  successIcon: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  successTitle: { fontFamily: Font.nunito800, fontSize: 14.5 },
  successSub: { fontFamily: Font.nunito400, fontSize: 12.5 },
  spacer: { flex: 1, minHeight: 16 },
});
