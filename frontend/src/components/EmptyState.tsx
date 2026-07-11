/**
 * EmptyState — what a surface shows when the learner has genuinely done nothing yet.
 *
 * It exists so no screen ever has to invent a number to look alive. A zeroed chart and a
 * seeded one are indistinguishable to a reader; a sentence that says "nothing here yet,
 * here's how to change that" is not.
 */
import { StyleSheet, Text, View } from 'react-native';

import { Space } from '@/theme/tokens';
import { Type } from '@/theme/type';
import { useTokens } from '@/theme/theme';

import { Sym, type SymName } from './Sym';

export function EmptyState({
  icon,
  title,
  body,
  compact,
}: {
  icon: SymName;
  title: string;
  body: string;
  /** Tighter padding for an empty card inside a populated screen. */
  compact?: boolean;
}) {
  const t = useTokens();
  return (
    <View style={[styles.root, { paddingVertical: compact ? Space.xl : Space.xxxl }]}>
      <View style={[styles.well, { backgroundColor: t.fill }]}>
        <Sym name={icon} size={22} color={t.text3} />
      </View>
      <Text style={[Type.headline, styles.text, { color: t.text }]}>{title}</Text>
      <Text style={[Type.footnote, styles.text, { color: t.text3 }]}>{body}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { alignItems: 'center', gap: 6, paddingHorizontal: Space.xl },
  well: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Space.xs,
  },
  text: { textAlign: 'center' },
});
