/**
 * Static app content — the things that are the same for every learner: the subject
 * list, the recap exercise, and the copy that promises the deal.
 *
 * Everything *about a learner* — streak, accuracy, minutes earned, subject mastery, the
 * Learn roadmap — is not here. It comes from `GET /stats` via `store/stats.ts`, computed
 * server-side from their real quiz history. This module used to carry a demo learner and
 * a set of plausible-looking charts; a number that looks like data but isn't is worse
 * than an empty state, so they are gone.
 *
 * Icons are SF Symbol names (rendered by <Sym/>).
 */
import type { SymName } from '@/components/Sym';

/* ---------------------------------------------------------------- subjects */

/**
 * A subject is just a string now. The learner can study any of the predefined ones below
 * OR add their own — unlimited, and the backend's `subject_stats`/`focus_subjects` both key
 * on free text, so a custom subject earns and tracks exactly like a built-in one.
 */
export type SubjectKey = string;

export type SubjectDef = { key: SubjectKey; icon: SymName };

/** The predefined subjects the picker offers up front, with an SF Symbol each. The list is
 *  free to grow: the backend no longer rejects an unknown subject, it only canonicalises the
 *  casing of the ones it recognises (keep this roughly in step with backend VALID_SUBJECTS so
 *  the built-ins store with tidy casing). Custom subjects fall back to a generic book glyph. */
export const SUBJECT_DEFS: SubjectDef[] = [
  { key: 'Math', icon: 'function' },
  { key: 'Biology', icon: 'leaf.fill' },
  { key: 'History', icon: 'building.columns.fill' },
  { key: 'English', icon: 'character.book.closed.fill' },
  { key: 'Physics', icon: 'atom' },
  { key: 'Chemistry', icon: 'drop.fill' },
  { key: 'Geography', icon: 'globe.americas.fill' },
  { key: 'Coding', icon: 'chevron.left.forwardslash.chevron.right' },
  { key: 'Literature', icon: 'books.vertical.fill' },
  { key: 'Computer Science', icon: 'desktopcomputer' },
  { key: 'Economics', icon: 'chart.line.uptrend.xyaxis' },
  { key: 'Art', icon: 'paintpalette.fill' },
  { key: 'Music', icon: 'music.note' },
  { key: 'Languages', icon: 'character.bubble.fill' },
  { key: 'Psychology', icon: 'brain.head.profile' },
  { key: 'Astronomy', icon: 'moon.stars.fill' },
  { key: 'Health', icon: 'heart.fill' },
  { key: 'Statistics', icon: 'chart.bar.fill' },
];

const SUBJECT_ICONS = new Map<string, SymName>(SUBJECT_DEFS.map((s) => [s.key, s.icon]));

/** Icon for a subject name coming back from the server, which may be one we don't draw. */
export function subjectIcon(subject: string): SymName {
  return SUBJECT_ICONS.get(subject) ?? 'book.closed.fill';
}

/** The subjects a learner has switched on, ordered predefined-first then custom, de-duped.
 *  This is the single source of truth for "what am I studying" — used for the focus label,
 *  the profile update sent on sign-in, and the Learn journey's subject switcher. */
export function chosenSubjects(subj: Record<string, boolean>, custom: string[] = []): string[] {
  const ordered = [...SUBJECT_DEFS.map((d) => d.key), ...custom];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const key of ordered) {
    if (subj[key] && !seen.has(key)) {
      seen.add(key);
      out.push(key);
    }
  }
  // Defensive: a selected key that is in neither list still counts as chosen.
  for (const key of Object.keys(subj)) {
    if (subj[key] && !seen.has(key)) {
      seen.add(key);
      out.push(key);
    }
  }
  return out;
}

/** Normalise a typed-in custom subject: trim, collapse inner whitespace, cap length.
 *  Returns '' for anything that isn't a usable subject name. */
export function normalizeSubject(raw: string): string {
  return raw.replace(/\s+/g, ' ').trim().slice(0, 40);
}

/** Every pickable subject — the predefined ones followed by the learner's custom ones. */
export function allSubjects(custom: string[] = []): string[] {
  return [...SUBJECT_DEFS.map((d) => d.key), ...custom];
}

/** How many subjects are currently switched on (predefined or custom). */
export function chosenCount(subj: Record<string, boolean>): number {
  return Object.values(subj).filter(Boolean).length;
}

/* -------------------------------------------------------------- quiz material */

/**
 * Questions in a normal quiz. Mirrors the backend's `QUIZ_LEN_NORMAL` (and its
 * `QUIZ_CORRECT_TARGET`, which is the same number) — the server generates and grades every
 * quiz, so this constant exists only for copy that promises the deal up front.
 */
export const QUIZ_QUESTIONS = 5;

/** How many quizzes make up one chapter of the Learn roadmap. */
export const CHAPTER_SIZE = 5;

export const PASTE_EXAMPLE =
  'Photosynthesis: plants use sunlight, water and CO₂ to make glucose and release oxygen. It happens mostly in the chloroplasts, where the green pigment chlorophyll absorbs light energy.';
