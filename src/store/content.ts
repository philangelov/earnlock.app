/**
 * Static content — transcribed 1:1 from the `Component` class in EarnLock.dc.html.
 * This is the mocked "AI" material for the MVP: fixed questions, recap, subjects, the app
 * blacklist, the Journey level map, and the Stats sample data. When the real AI/backend is
 * wired in later, only this module (and the store's fetch actions) change.
 */
import type { IconName } from '@/components/Icon';
import type { TokenName } from '@/theme/tokens';

export type QuizOption = { e: string; t: string };
export type Question = {
  tag: string;
  q: string;
  opts: QuizOption[];
  answer: number;
  explain: string;
};

export const QUESTIONS: Question[] = [
  {
    tag: 'BIOLOGY',
    q: 'Which organelle is known as the “powerhouse” of the cell?',
    opts: [
      { e: '📦', t: 'Golgi apparatus' },
      { e: '⚡', t: 'Mitochondrion' },
      { e: '🧬', t: 'Nucleus' },
      { e: '🔬', t: 'Ribosome' },
    ],
    answer: 1,
    explain:
      'Mitochondria turn nutrients and oxygen into ATP — the chemical “fuel” your cells run on. Because they make most of that energy, biologists nickname them the powerhouse of the cell.',
  },
  {
    tag: 'HISTORY',
    q: 'In which year did the Berlin Wall fall?',
    opts: [
      { e: '📻', t: '1979' },
      { e: '🧱', t: '1989' },
      { e: '📼', t: '1991' },
      { e: '🚀', t: '1985' },
    ],
    answer: 1,
    explain:
      'On 9 November 1989, eased travel rules and huge peaceful protests brought crowds to the checkpoints and the Berlin Wall was opened. It paved the way for German reunification in 1990.',
  },
];

/** Number of multiple-choice questions before the Recap step. */
export const MC_COUNT = QUESTIONS.length;

export const RECAP = {
  tag: 'RECAP',
  pre: 'A triangle’s interior angles always add up to',
  post: 'degrees.',
  options: ['90', '180', '360'],
  answer: '180',
} as const;

export type SubjectKey =
  | 'Math'
  | 'History'
  | 'Biology'
  | 'English'
  | 'Physics'
  | 'Chemistry'
  | 'Geography'
  | 'Coding';

export type SubjectDef = { key: SubjectKey; icon: IconName; soft: TokenName; color: TokenName };

export const SUBJECT_DEFS: SubjectDef[] = [
  { key: 'Math', icon: 'calc', soft: 'primarySoft', color: 'primary' },
  { key: 'History', icon: 'globe', soft: 'pinkSoft', color: 'pink' },
  { key: 'Biology', icon: 'leaf', soft: 'successSoft', color: 'success' },
  { key: 'English', icon: 'chat', soft: 'blueSoft', color: 'blue' },
  { key: 'Physics', icon: 'atom', soft: 'primarySoft', color: 'primary' },
  { key: 'Chemistry', icon: 'flask', soft: 'pinkSoft', color: 'pink' },
  { key: 'Geography', icon: 'pin', soft: 'successSoft', color: 'success' },
  { key: 'Coding', icon: 'code', soft: 'blueSoft', color: 'blue' },
];

export type AppKey = 'tiktok' | 'insta' | 'brawl' | 'youtube';
export type AppDef = { key: AppKey; name: string; cat: string; tile: string; icon: IconName };

export const APP_DEFS: AppDef[] = [
  { key: 'tiktok', name: 'TikTok', cat: 'Short video', tile: '#111114', icon: 'music' },
  { key: 'insta', name: 'Instagram', cat: 'Social', tile: '#d6336c', icon: 'camera' },
  { key: 'brawl', name: 'Brawl Stars', cat: 'Games', tile: '#f59f00', icon: 'game' },
  { key: 'youtube', name: 'YouTube', cat: 'Video', tile: '#e5342a', icon: 'play' },
];

export type EduItem = { name: string; cat: string; tile: string };

export const EDU_ITEMS: EduItem[] = [
  { name: 'Class Notes', cat: 'Study', tile: '#3b82f6' },
  { name: 'Dictionary', cat: 'Reference', tile: '#12a866' },
  { name: 'Calculator', cat: 'Tools', tile: '#ff1493' },
];

/** Journey level map: node states, accent colors, labels, and their layout points. */
export type LevelState = 'done' | 'active' | 'locked';
export type Level = { state: LevelState; col: TokenName; label: string };

export const JOURNEY_LEVELS: Level[] = [
  { state: 'done', col: 'teal', label: 'Cell basics' },
  { state: 'done', col: 'blue', label: 'Organelles' },
  { state: 'active', col: 'primary', label: 'Energy' },
  { state: 'locked', col: 'teal', label: 'Photosynthesis' },
  { state: 'locked', col: 'blue', label: 'Genetics' },
];

export const JOURNEY_VIEWBOX = { w: 300, h: 560 };
export const JOURNEY_POINTS = [
  { x: 214, y: 52 },
  { x: 92, y: 154 },
  { x: 206, y: 256 },
  { x: 96, y: 358 },
  { x: 210, y: 460 },
];

/** Vertical S-curve through the points (matches the prototype's `smoothPath`). */
export function smoothPath(points: { x: number; y: number }[]): string {
  if (points.length === 0) return '';
  let d = `M${points[0].x} ${points[0].y}`;
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1];
    const b = points[i];
    const my = (a.y + b.y) / 2;
    d += ` C ${a.x} ${my} ${b.x} ${my} ${b.x} ${b.y}`;
  }
  return d;
}

/** Stats — weekly focus bars (0..1 relative height, `today` is highlighted). */
export const WEEK_BARS = [
  { d: 'M', v: 0.6 },
  { d: 'T', v: 0.9 },
  { d: 'W', v: 0.4 },
  { d: 'T', v: 1 },
  { d: 'F', v: 0.75 },
  { d: 'S', v: 0.3 },
  { d: 'S', v: 0.55 },
];
export const WEEK_TODAY_INDEX = 3;

export type SubjectStat = { name: string; pct: number; col: TokenName };
export const SUBJECT_STATS: SubjectStat[] = [
  { name: 'Biology', pct: 72, col: 'teal' },
  { name: 'History', pct: 54, col: 'orange' },
  { name: 'Math', pct: 88, col: 'primary' },
  { name: 'English', pct: 35, col: 'blue' },
];

/** Profile focus-subject chips (name + accent token). */
export const PROFILE_SUBJECTS: { name: string; col: TokenName; soft: TokenName }[] = [
  { name: 'Math', col: 'primary', soft: 'primarySoft' },
  { name: 'History', col: 'orange', soft: 'orangeSoft' },
  { name: 'Biology', col: 'teal', soft: 'tealSoft' },
  { name: 'English', col: 'blue', soft: 'blueSoft' },
];

export const PASTE_EXAMPLE =
  'Photosynthesis: plants use sunlight, water and CO₂ to make glucose and release oxygen. It happens mostly in the chloroplasts, where the green pigment chlorophyll absorbs light energy.';
