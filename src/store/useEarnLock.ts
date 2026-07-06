/**
 * EarnLock store — the app's state + the mocked loop logic, lifted from the `Component`
 * class in EarnLock.dc.html. Navigation is handled by expo-router in the screens; this store
 * owns the data and the pure state transitions. Durable progress (grade, subjects, blacklist,
 * coins, streak, balance, SOS/debt) is persisted to AsyncStorage; transient quiz state is not.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { PASTE_EXAMPLE, type AppKey, type SubjectKey } from './content';

export type RouteVariant = 'A' | 'B';

export type EarnLockState = {
  grade: number;
  subj: Record<SubjectKey, boolean>;
  importText: string;
  imported: boolean;
  uploadName: string;
  apps: Record<AppKey, boolean>;
  routeVar: RouteVariant;
  quizVar: RouteVariant;
  qIndex: number;
  selected: number | null;
  checked: boolean;
  recapPick: string | null;
  recapChecked: boolean;
  minutesLeft: number;
  streak: number;
  coins: number;
  sosUsed: boolean;
  debt: boolean;

  // onboarding
  setGrade: (grade: number) => void;
  gradeUp: () => void;
  gradeDown: () => void;
  toggleSubj: (key: SubjectKey) => void;
  setImportText: (text: string) => void;
  pasteExample: () => void;
  setUploadName: (name: string) => void;
  doImport: () => void;
  toggleApp: (key: AppKey) => void;

  // prototype variants
  setRouteVar: (v: RouteVariant) => void;
  setQuizVar: (v: RouteVariant) => void;

  // quiz flow
  pick: (index: number) => void;
  check: () => void;
  nextQuestion: () => void;
  resetQuizFlow: () => void;
  pickRecap: (word: string) => void;
  checkRecap: () => void;

  // rewards / hooks
  claim: () => void;
  useSos: () => void;
};

const initial = {
  grade: 8,
  subj: {
    Math: true,
    History: true,
    Biology: false,
    English: false,
    Physics: false,
    Chemistry: false,
    Geography: false,
    Coding: false,
  } as Record<SubjectKey, boolean>,
  importText: '',
  imported: false,
  uploadName: '',
  apps: { tiktok: true, insta: true, brawl: true, youtube: false } as Record<AppKey, boolean>,
  routeVar: 'A' as RouteVariant,
  quizVar: 'A' as RouteVariant,
  qIndex: 0,
  selected: null as number | null,
  checked: false,
  recapPick: null as string | null,
  recapChecked: false,
  minutesLeft: 0,
  streak: 4,
  coins: 220,
  sosUsed: false,
  debt: false,
};

export const useEarnLock = create<EarnLockState>()(
  persist(
    (set) => ({
      ...initial,

      setGrade: (grade) => set({ grade }),
      gradeUp: () => set((s) => ({ grade: Math.min(12, s.grade + 1) })),
      gradeDown: () => set((s) => ({ grade: Math.max(1, s.grade - 1) })),
      toggleSubj: (key) => set((s) => ({ subj: { ...s.subj, [key]: !s.subj[key] } })),
      setImportText: (importText) => set({ importText }),
      pasteExample: () => set({ importText: PASTE_EXAMPLE }),
      setUploadName: (uploadName) => set({ uploadName }),
      doImport: () => set({ imported: true }),
      toggleApp: (key) => set((s) => ({ apps: { ...s.apps, [key]: !s.apps[key] } })),

      setRouteVar: (routeVar) => set({ routeVar }),
      setQuizVar: (quizVar) => set({ quizVar }),

      pick: (index) => set((s) => (s.checked ? {} : { selected: index })),
      check: () => set((s) => (s.selected != null ? { checked: true } : {})),
      nextQuestion: () => set((s) => ({ qIndex: s.qIndex + 1, selected: null, checked: false })),
      resetQuizFlow: () =>
        set({ qIndex: 0, selected: null, checked: false, recapPick: null, recapChecked: false }),
      pickRecap: (word) => set((s) => (s.recapChecked ? {} : { recapPick: word })),
      checkRecap: () => set((s) => (s.recapPick ? { recapChecked: true } : {})),

      claim: () =>
        set((s) => ({
          minutesLeft: 15,
          coins: s.coins + 20,
          qIndex: 0,
          selected: null,
          checked: false,
          recapPick: null,
          recapChecked: false,
        })),
      useSos: () => set({ sosUsed: true, debt: true, minutesLeft: 2 }),
    }),
    {
      name: 'earnlock-store',
      storage: createJSONStorage(() => AsyncStorage),
      // Persist durable progress only; quiz-flow state stays transient.
      partialize: (s) => ({
        grade: s.grade,
        subj: s.subj,
        importText: s.importText,
        imported: s.imported,
        uploadName: s.uploadName,
        apps: s.apps,
        routeVar: s.routeVar,
        quizVar: s.quizVar,
        minutesLeft: s.minutesLeft,
        streak: s.streak,
        coins: s.coins,
        sosUsed: s.sosUsed,
        debt: s.debt,
      }),
    },
  ),
);
