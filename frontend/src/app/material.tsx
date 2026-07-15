import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import type { ComponentProps } from 'react';
import { Alert, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { Screen } from '@/components/Screen';
import { StepHeader } from '@/components/StepHeader';
import { Sym } from '@/components/Sym';
import { haptic } from '@/lib/haptics';
import { useStats } from '@/store/stats';
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
  const uploadUri = useEarnLock((s) => s.uploadUri);
  const uploadData = useEarnLock((s) => s.uploadData);
  const setUpload = useEarnLock((s) => s.setUpload);
  const doImport = useEarnLock((s) => s.doImport);
  const importLoading = useEarnLock((s) => s.importLoading);
  const importError = useEarnLock((s) => s.importError);

  const hasFile = !!(uploadUri || uploadData);
  const canContinue = importText.trim().length > 0 || hasFile;

  // A picked file wins over stray text, so a paste box that still has content is dimmed
  // once a file is chosen — the Save will send the file, not the text.
  const pickPdf = async () => {
    haptic.tap();
    try {
      const res = await DocumentPicker.getDocumentAsync({
        type: 'application/pdf',
        copyToCacheDirectory: true,
      });
      const asset = res.canceled ? null : res.assets[0];
      if (asset) {
        setUpload({
          uri: asset.uri,
          name: asset.name,
          mimeType: asset.mimeType || 'application/pdf',
        });
      }
    } catch {
      Alert.alert('Could not open that file', 'Try another PDF, or paste the text instead.');
    }
  };

  const pickPhoto = async () => {
    haptic.tap();
    try {
      // base64:true makes iOS hand back JPEG bytes even for a HEIC photo, so the server
      // (and the model that reads it) always gets a format it understands.
      const res = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        quality: 0.8,
        base64: true,
      });
      const asset = res.canceled ? null : res.assets[0];
      if (asset?.base64) {
        setUpload({ data: asset.base64, name: asset.fileName || 'Photo', mimeType: 'image/jpeg' });
      }
    } catch {
      Alert.alert('Could not open that photo', 'Try another photo, or paste the text instead.');
    }
  };

  const onContinue = async () => {
    const ok = await doImport();
    if (!ok) return;
    // The material list is derived from GET /stats; force a refetch so the one just added
    // shows up on the Materials screen straight away rather than after the 30s cache window.
    void useStats.getState().fetch({ force: true });
    router.back();
  };

  const saveLabel = importLoading ? (hasFile ? 'Reading your file…' : 'Saving…') : 'Save';

  return (
    <Screen
      scroll
      contentStyle={styles.content}
      avoidKeyboard
      header={
        <View style={styles.header}>
          <StepHeader step={0} total={1} title="Study material" onBack={() => router.back()} />
        </View>
      }
      footer={
        <Button
          label={saveLabel}
          loading={importLoading}
          disabled={!canContinue || importLoading}
          onPress={onContinue}
        />
      }
      footerStyle={styles.footer}
    >
      <Text style={[Type.title1, styles.heading, { color: t.text }]}>Add your material</Text>
      {importError && (
        <Text style={[Type.footnote, styles.error, { color: t.danger }]}>{importError}</Text>
      )}
      <Text style={[Type.subhead, styles.sub, { color: t.text2 }]}>
        Paste notes, upload a PDF, or snap a photo of a page — questions are generated from your own
        content.
      </Text>

      <Card style={hasFile ? [styles.inputCard, { opacity: 0.45 }] : styles.inputCard}>
        <TextInput
          value={importText}
          onChangeText={setImportText}
          editable={!hasFile}
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
            disabled={hasFile}
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

      {hasFile ? (
        <Card style={styles.upload}>
          <View style={[styles.uploadIcon, { backgroundColor: t.accentSoft }]}>
            <Sym name="checkmark" size={18} color={t.accentText} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[Type.headline, { color: t.text }]} numberOfLines={1}>
              {uploadName || 'Selected file'}
            </Text>
            <Text style={[Type.footnote, { color: t.text3 }]}>Ready — Save to add it</Text>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Remove selected file"
            hitSlop={10}
            onPress={() => {
              haptic.tap();
              setUpload(null);
            }}
            style={({ pressed }) => [styles.clear, pressed && { opacity: 0.5 }]}
          >
            <Sym name="xmark.circle.fill" size={22} color={t.text3} />
          </Pressable>
        </Card>
      ) : (
        <View style={styles.choosers}>
          <UploadChoice
            icon="arrow.up.doc.fill"
            title="Upload a PDF"
            subtitle="Worksheets, chapters, handouts"
            onPress={pickPdf}
          />
          <UploadChoice
            icon="camera.fill"
            title="Choose a photo"
            subtitle="Textbook pages, screenshots"
            onPress={pickPhoto}
          />
        </View>
      )}
    </Screen>
  );
}

function UploadChoice({
  icon,
  title,
  subtitle,
  onPress,
}: {
  icon: ComponentProps<typeof Sym>['name'];
  title: string;
  subtitle: string;
  onPress: () => void;
}) {
  const t = useTokens();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      onPress={onPress}
      style={({ pressed }) => [pressed && { opacity: 0.7 }]}
    >
      <Card style={styles.upload}>
        <View style={[styles.uploadIcon, { backgroundColor: t.fill }]}>
          <Sym name={icon} size={18} color={t.text} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[Type.headline, { color: t.text }]}>{title}</Text>
          <Text style={[Type.footnote, { color: t.text3 }]}>{subtitle}</Text>
        </View>
        <Sym name="chevron.right" size={14} color={t.text3} weight="semibold" />
      </Card>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: Space.xl, paddingTop: Space.sm },
  content: { paddingHorizontal: Space.xl, paddingBottom: Space.xxl },
  footer: { paddingHorizontal: Space.xl, paddingTop: Space.md },
  error: { textAlign: 'center', marginTop: Space.sm },

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

  choosers: { gap: Space.md },
  upload: { flexDirection: 'row', alignItems: 'center', gap: Space.md, padding: Space.lg },
  uploadIcon: {
    width: 42,
    height: 42,
    borderRadius: Radius.control,
    borderCurve: 'continuous',
    alignItems: 'center',
    justifyContent: 'center',
  },
  clear: { padding: 2 },
});
