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

export type SubjectKey =
  'Math' | 'Biology' | 'History' | 'English' | 'Physics' | 'Chemistry' | 'Geography' | 'Coding';

export type SubjectDef = { key: SubjectKey; icon: SymName };

/** Must stay in step with the backend's `VALID_SUBJECTS` (backend/app/validation.py):
 *  the server rejects a PUT /profile carrying a subject it doesn't know, and tags each
 *  generated question with one of these names. */
export const SUBJECT_DEFS: SubjectDef[] = [
  { key: 'Math', icon: 'function' },
  { key: 'Biology', icon: 'leaf.fill' },
  { key: 'History', icon: 'building.columns.fill' },
  { key: 'English', icon: 'character.book.closed.fill' },
  { key: 'Physics', icon: 'atom' },
  { key: 'Chemistry', icon: 'drop.fill' },
  { key: 'Geography', icon: 'globe.americas.fill' },
  { key: 'Coding', icon: 'chevron.left.forwardslash.chevron.right' },
];

const SUBJECT_ICONS = new Map<string, SymName>(SUBJECT_DEFS.map((s) => [s.key, s.icon]));

/** Icon for a subject name coming back from the server, which may be one we don't draw. */
export function subjectIcon(subject: string): SymName {
  return SUBJECT_ICONS.get(subject) ?? 'book.fill';
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
