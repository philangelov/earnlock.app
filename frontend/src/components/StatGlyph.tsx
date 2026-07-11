/**
 * StatGlyph — the icon for a metric, wherever that metric appears.
 *
 * A streak is orange on Today, on Learn, on Insights and on Profile; accuracy is always
 * purple. Binding the colour to the *metric* rather than to the screen is what lets you
 * find "quizzes done" on a page you've never read, and it is why these live in one table
 * instead of being chosen four times.
 *
 * The colours are decoration, not state (see `tokens.ts`): they identify a figure, they
 * never say whether it is good. `accent` still means earned, `danger` still means
 * destructive, and neither is used here.
 */
import type { SymName } from '@/components/Sym';
import type { Tokens } from '@/theme/tokens';
import { useTokens } from '@/theme/theme';

import { Sym } from './Sym';

export type StatRole =
  'streak' | 'bestStreak' | 'quizzes' | 'accuracy' | 'questionsRight' | 'timeEarned';

const ROLES: Record<StatRole, { icon: SymName; tint: (t: Tokens) => string }> = {
  streak: { icon: 'flame.fill', tint: (t) => t.iconOrange },
  bestStreak: { icon: 'flame.fill', tint: (t) => t.iconOrange },
  quizzes: { icon: 'checkmark.seal.fill', tint: (t) => t.iconBlue },
  accuracy: { icon: 'target', tint: (t) => t.iconPurple },
  questionsRight: { icon: 'brain.head.profile', tint: (t) => t.iconTeal },
  timeEarned: { icon: 'hourglass', tint: (t) => t.iconIndigo },
};

export function statIcon(role: StatRole): SymName {
  return ROLES[role].icon;
}

export function StatGlyph({ role, size = 14 }: { role: StatRole; size?: number }) {
  const t = useTokens();
  const { icon, tint } = ROLES[role];
  return <Sym name={icon} size={size} color={tint(t)} />;
}
