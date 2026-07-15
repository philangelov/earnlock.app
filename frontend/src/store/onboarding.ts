/**
 * Onboarding content + derivations — the demo-data half of the first-run flow. Everything the
 * onboarding screens ask, offer, or calculate lives here so the screens stay presentational and a
 * real backend can later replace this module without touching a single view.
 *
 * The questions are deliberately EarnLock-specific and they build on each other:
 *
 *   usage       → decides whether the rest of the flow speaks to a learner or about a child
 *   name        → the learner the whole app is now about, greeted by name on the next screen
 *   age         → the grade the quiz generator writes questions at
 *   screentime  → the figure the reveal is computed from
 *   pace        → how fast that figure comes down, and therefore how long the reveal promises
 *   habits      → the notifications we preview and eventually send
 *   subjects    → what quiz questions get generated from
 *   commitment  → how hard the shield bites, which decides whether picking apps is required
 *
 * Nothing here is asked "because onboarding usually asks it", and no answer is collected that
 * some later screen doesn't visibly use.
 */
import type { SymName } from '@/components/Sym';

/* --------------------------------------------------------------------- steps */

/**
 * The linear first-run flow, in order. `greeting` and `calculating` are intentionally absent:
 * they're interstitials with no header, so they neither show nor advance the progress bar.
 * `apps` is the last step and lives at the app root because Profile reuses it as an edit
 * screen. Study material is NOT collected here anymore — it's added after onboarding from the
 * Learn tab's Materials manager, so the first run stays focused on the deal (earn to unlock).
 */
export const ONBOARD_STEPS = [
  'usage',
  'name',
  'age',
  'screentime',
  'pace',
  'habits',
  'subjects',
  'commitment',
  'reveal',
  'notifications',
  'account',
  'apps',
] as const;

export type OnboardStep = (typeof ONBOARD_STEPS)[number];

export const STEP_TOTAL = ONBOARD_STEPS.length;

/** Zero-based position of a step, for the progress bar. */
export function stepIndex(step: OnboardStep): number {
  return ONBOARD_STEPS.indexOf(step);
}

/* --------------------------------------------------------------------- usage */

export type UsageKey = 'solo' | 'family' | 'group';

export const USAGE_MODES: { key: UsageKey; label: string; desc: string; icon: SymName }[] = [
  { key: 'solo', label: 'Just me', desc: 'I want my own time back.', icon: 'person.fill' },
  {
    key: 'family',
    label: 'My child',
    desc: 'I’m setting this up for someone else.',
    icon: 'figure.2.and.child.holdinghands',
  },
  {
    key: 'group',
    label: 'Me and my study group',
    desc: 'We keep each other honest.',
    icon: 'person.3.fill',
  },
];

/* --------------------------------------------------------------------- voice */

/**
 * Every question after `usage` is phrased about the learner. When a parent is setting EarnLock up
 * for a child, the learner is not the person holding the phone — so the copy switches to the third
 * person and uses the child's name once we have it. This is the single place that decision lives.
 */
export function voice(usage: UsageKey | null, name: string) {
  const family = usage === 'family';
  const trimmed = name.trim();
  /** The learner, as this screen should refer to them. */
  const who = family ? trimmed || 'your child' : trimmed;
  const their = family ? 'their' : 'your';

  return {
    family,
    who,

    nameTitle: family ? 'Who are you setting up?' : 'What should we call you?',
    nameSubtitle: family
      ? 'Their name appears on their streak and every quiz they finish.'
      : 'Your name appears on your streak and every quiz you finish.',
    namePlaceholder: family ? 'Their first name' : 'First name',

    greeting: `Hello, ${who}.`,
    greetingMessage: family
      ? `Good to meet ${who}. From here on, every minute on their phone is one they’ve earned — and we’ll show them exactly what it’s worth.`
      : 'It’s good to meet you. From here on, every minute on your phone is one you’ve earned — and we’ll show you exactly what it’s worth.',

    ageTitle: family ? `How old is ${who}?` : 'How old are you?',
    ageSubtitle: `This sets the level ${their} questions are written at.`,

    hoursTitle: family
      ? `How much time does ${who} spend on their phone?`
      : 'How much time do you spend on your phone?',

    habitsTitle: family
      ? `What would you like to change for ${who}?`
      : 'What would you like to change?',
    habitsSubtitle: family
      ? 'Pick everything that sounds familiar.'
      : 'Pick everything that sounds like you.',

    subjectsTitle: family ? `What is ${who} studying?` : 'What are you studying?',
    subjectsSubtitle: family
      ? `Every question ${who} answers to unlock an app comes from one of these.`
      : 'Every question you answer to unlock an app comes from one of these.',

    commitmentTitle: family
      ? `How firm should EarnLock be with ${who}?`
      : 'What level of commitment feels right?',
  };
}

/* ----------------------------------------------------------------------- age */

export const AGE_MIN = 8;
export const AGE_MAX = 80;
export const AGE_DEFAULT = 14;

/**
 * School grade implied by an age, clamped to the 1–12 range the quiz generator understands.
 * Asking for age (a fact) and deriving grade (a mechanism) is friendlier than asking for grade,
 * and it means the age screen genuinely tunes question difficulty rather than just collecting a
 * number. Adults land at 12 — the ceiling — which is the right level for them anyway.
 */
export function gradeForAge(age: number): number {
  return Math.min(12, Math.max(1, age - 6));
}

const GRADE_ORDINALS = ['1st', '2nd', '3rd', ...Array.from({ length: 9 }, (_, i) => `${i + 4}th`)];

/** "8th grade" — the exact string shape the backend's grade_or_age validation accepts. */
export function gradeLabel(grade: number): string {
  return `${GRADE_ORDINALS[Math.min(12, Math.max(1, grade)) - 1]} grade`;
}

/* --------------------------------------------------------------- phone hours */

export const HOURS_MIN = 1;
export const HOURS_MAX = 12;
/** Roughly the reported daily average — what "I don't know" resolves to. */
export const HOURS_DEFAULT = 5;

/**
 * The share of daily phone time the shield realistically converts back into something else.
 * A deliberately conservative, honest figure — the reveal screen shows its work rather than
 * promising the user their whole life back.
 */
const RECLAIM_RATE = 0.35;

/** Hours a year EarnLock can plausibly hand back. */
export function hoursReclaimedPerYear(hoursPerDay: number): number {
  return Math.round(hoursPerDay * 365 * RECLAIM_RATE);
}

/** Whole days a year spent on the phone at this daily rate. */
export function daysLostPerYear(hoursPerDay: number): number {
  return Math.round((hoursPerDay * 365) / 24);
}

/* ---------------------------------------------------------------------- pace */

/** Minutes of daily screen time to give up each week. */
export const PACE_MIN = 10;
export const PACE_MAX = 90;
export const PACE_STEP = 5;
export const PACE_DEFAULT = 30;

/** Fast enough to feel within a month, slow enough to still be there in three. */
const PACE_BAND: readonly [number, number] = [25, 45];

/** Slow, steady, quick — the three marks under the track. */
export const PACE_STOPS: { icon: SymName; label: string }[] = [
  { icon: 'tortoise.fill', label: `${PACE_MIN} min` },
  { icon: 'hare.fill', label: `${(PACE_MIN + PACE_MAX) / 2} min` },
  { icon: 'flame.fill', label: `${PACE_MAX} min` },
];

export type PaceTone = 'gentle' | 'recommended' | 'ambitious';

export function paceTone(pace: number): PaceTone {
  if (pace < PACE_BAND[0]) return 'gentle';
  if (pace > PACE_BAND[1]) return 'ambitious';
  return 'recommended';
}

export const PACE_TONE: Record<PaceTone, { label: string; note: string }> = {
  gentle: { label: 'Gentle', note: 'Barely noticeable, but it will take a while.' },
  recommended: { label: 'Recommended', note: 'The pace most people actually keep.' },
  ambitious: { label: 'Ambitious', note: 'Fast — you’ll feel this one.' },
};

/** Weeks to give back `RECLAIM_RATE` of the daily habit at this weekly rate. */
export function weeksToGoal(hoursPerDay: number, paceMinPerWeek: number): number {
  const minutesToCut = hoursPerDay * 60 * RECLAIM_RATE;
  return Math.max(1, Math.round(minutesToCut / paceMinPerWeek));
}

/* ------------------------------------------------------------------- account */

/** Progress is saved against an identity provider — we never ask for an email or a password. */
export type AccountProvider = 'apple' | 'google';

/* -------------------------------------------------------------------- habits */

export type HabitKey =
  'morning' | 'instead' | 'shorts' | 'notifications' | 'bed' | 'late' | 'drained';

/**
 * Each habit carries the notification EarnLock would actually send about it — which is what the
 * permission screen quotes back. Picking "scrolling first thing in the morning" is therefore a
 * choice about what lands on the lock screen, not an opinion we file away.
 */
export const HABITS: { key: HabitKey; label: string; notification: string }[] = [
  {
    key: 'morning',
    label: 'Scrolling first thing in the morning',
    notification: 'Good morning. Three questions and the day is yours.',
  },
  {
    key: 'instead',
    label: 'Reaching for my phone instead of studying',
    notification: 'Instagram is locked. Two questions unlocks 15 minutes.',
  },
  {
    key: 'shorts',
    label: 'Losing hours to short videos',
    notification: 'You’ve used 12 of your 15 earned minutes.',
  },
  {
    key: 'notifications',
    label: 'Checking notifications mid-homework',
    notification: 'Focus block started — everything else stays quiet.',
  },
  {
    key: 'bed',
    label: 'Using my phone in bed',
    notification: 'It’s 22:30. Your apps lock in ten minutes.',
  },
  {
    key: 'late',
    label: 'Putting off assignments until it’s late',
    notification: 'Biology quiz ready — earn tonight’s screen time now.',
  },
  {
    key: 'drained',
    label: 'Feeling drained after scrolling',
    notification: 'Nice work. 15 minutes earned and a 5-day streak.',
  },
];

/**
 * One real notification, drawn from the habits the user picked — quoted on the permission screen
 * so the ask is backed by a concrete example in their own words rather than a promise.
 */
export function notificationExample(habits: HabitKey[]): string {
  const chosen = HABITS.find((h) => habits.includes(h.key));
  return (chosen ?? HABITS[0]).notification;
}

/* ---------------------------------------------------------------- commitment */

export type CommitmentKey = 'curious' | 'firm' | 'insight';

export const COMMITMENTS: {
  key: CommitmentKey;
  label: string;
  desc: string;
  icon: SymName;
}[] = [
  {
    key: 'curious',
    label: 'Just exploring',
    desc: 'Gentle nudges. Lock an app whenever you’re ready.',
    icon: 'sparkles',
  },
  {
    key: 'firm',
    label: 'Firm locks that hold',
    desc: 'Chosen apps stay shielded until time is earned.',
    icon: 'lock.fill',
  },
  {
    key: 'insight',
    label: 'Show me the numbers first',
    desc: 'Start with a Screen Time report. Add locks later.',
    icon: 'chart.bar.fill',
  },
];

/** Firm mode is the only one that can't work without at least one shielded app. */
export function requiresLockedApps(commitment: CommitmentKey | null): boolean {
  return commitment === 'firm';
}

/* --------------------------------------------------------------- calculating */

export const CALCULATING_MS = 3000;

/** What the plan is built from — the user's own answers, read back to them. */
export function calculatingSteps(input: {
  habits: HabitKey[];
  grade: number;
  subjectCount: number;
  commitment: CommitmentKey | null;
}): string[] {
  const { habits, grade, subjectCount, commitment } = input;
  const plan: Record<CommitmentKey, string> = {
    curious: 'Setting gentle nudges',
    firm: 'Building your lock plan',
    insight: 'Preparing your Screen Time report',
  };
  return [
    `Reading ${habits.length} habit${habits.length === 1 ? '' : 's'}`,
    `Matching grade ${grade}`,
    `Tuning ${subjectCount} subject${subjectCount === 1 ? '' : 's'}`,
    commitment ? plan[commitment] : 'Building your plan',
  ];
}
