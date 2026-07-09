/**
 * EarnLock store — the app's state + the mocked loop logic, lifted from the `Component`
 * class in EarnLock.dc.html. Navigation is handled by expo-router in the screens; this store
 * owns the data and the pure state transitions. Durable progress (onboarding, grade, subjects,
 * blacklist, coins, streak, unlock deadline, SOS/debt) is persisted to AsyncStorage; transient
 * quiz state is not.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { PASTE_EXAMPLE, type SubjectKey } from './content';
import {
  AGE_DEFAULT,
  gradeForAge,
  HOURS_DEFAULT,
  PACE_DEFAULT,
  type AccountProvider,
  type CommitmentKey,
  type HabitKey,
  type UsageKey,
} from './onboarding';

/** Screen time granted per completed quiz / per SOS, in milliseconds. */
export const REWARD_MS = 15 * 60_000;
export const SOS_MS = 2 * 60_000;

export type EarnLockState = {
  onboarded: boolean;
  /** Answers collected during first run. Demo-only — nothing is sent anywhere. */
  name: string;
  /** Which identity provider saved the progress, if any. No email, no password. */
  account: AccountProvider | null;
  age: number;
  hoursPerDay: number;
  /** True when `hoursPerDay` is our average rather than a figure the user gave us. */
  hoursEstimated: boolean;
  /** Minutes of daily screen time to give up each week. */
  paceMinPerWeek: number;
  habits: HabitKey[];
  usage: UsageKey | null;
  commitment: CommitmentKey | null;
  notificationsGranted: boolean;
  grade: number;
  subj: Record<SubjectKey, boolean>;
  importText: string;
  imported: boolean;
  uploadName: string;
  qIndex: number;
  selected: number | null;
  checked: boolean;
  recapPick: string | null;
  recapChecked: boolean;
  /** Epoch ms until which apps are unlocked; 0 (or past) = locked. */
  unlockUntil: number;
  streak: number;
  coins: number;
  sosUsed: boolean;
  debt: boolean;

  // onboarding
  setName: (name: string) => void;
  setAccount: (provider: AccountProvider | null) => void;
  setAge: (age: number) => void;
  setHoursPerDay: (hours: number) => void;
  estimateHoursPerDay: () => void;
  setPace: (minutesPerWeek: number) => void;
  toggleHabit: (key: HabitKey) => void;
  setUsage: (key: UsageKey) => void;
  setCommitment: (key: CommitmentKey) => void;
  setNotificationsGranted: (granted: boolean) => void;
  gradeUp: () => void;
  gradeDown: () => void;
  toggleSubj: (key: SubjectKey) => void;
  setImportText: (text: string) => void;
  pasteExample: () => void;
  setUploadName: (name: string) => void;
  doImport: () => void;
  completeOnboarding: () => void;

  // quiz flow
  pick: (index: number) => void;
  check: () => void;
  nextQuestion: () => void;
  retryQuestion: () => void;
  resetQuizFlow: () => void;
  pickRecap: (word: string) => void;
  checkRecap: () => void;
  retryRecap: () => void;

  // rewards / hooks
  claim: () => void;
  activateSos: () => void;

  // demo utilities
  resetAll: () => void;
};

const initial = {
  onboarded: false,
  name: '',
  account: null as AccountProvider | null,
  age: AGE_DEFAULT,
  hoursPerDay: HOURS_DEFAULT,
  hoursEstimated: true,
  paceMinPerWeek: PACE_DEFAULT,
  habits: [] as HabitKey[],
  usage: null as UsageKey | null,
  commitment: null as CommitmentKey | null,
  notificationsGranted: false,
  grade: gradeForAge(AGE_DEFAULT),
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
  qIndex: 0,
  selected: null as number | null,
  checked: false,
  recapPick: null as string | null,
  recapChecked: false,
  unlockUntil: 0,
  streak: 4,
  coins: 220,
  sosUsed: false,
  debt: false,
};

export const useEarnLock = create<EarnLockState>()(
  persist(
    (set) => ({
      ...initial,

      setName: (name) => set({ name }),
      setAccount: (account) => set({ account }),
      setPace: (paceMinPerWeek) => set({ paceMinPerWeek }),
      // Age is the question we ask; grade is the mechanism we derive from it, and what the quiz
      // generator actually reads. Keep them in lockstep — Profile can still override the grade.
      setAge: (age) => set({ age, grade: gradeForAge(age) }),
      // Touching the dial means the figure is theirs; "I don't know" leaves it ours, and the
      // reveal is careful to say which.
      setHoursPerDay: (hoursPerDay) => set({ hoursPerDay, hoursEstimated: false }),
      estimateHoursPerDay: () => set({ hoursPerDay: HOURS_DEFAULT, hoursEstimated: true }),
      toggleHabit: (key) =>
        set((s) => ({
          habits: s.habits.includes(key) ? s.habits.filter((h) => h !== key) : [...s.habits, key],
        })),
      setUsage: (usage) => set({ usage }),
      setCommitment: (commitment) => set({ commitment }),
      setNotificationsGranted: (notificationsGranted) => set({ notificationsGranted }),

      gradeUp: () => set((s) => ({ grade: Math.min(12, s.grade + 1) })),
      gradeDown: () => set((s) => ({ grade: Math.max(1, s.grade - 1) })),
      toggleSubj: (key) => set((s) => ({ subj: { ...s.subj, [key]: !s.subj[key] } })),
      // Editing the inputs invalidates a previous "questions ready" result.
      setImportText: (importText) => set({ importText, imported: false }),
      pasteExample: () => set({ importText: PASTE_EXAMPLE, imported: false }),
      setUploadName: (uploadName) => set({ uploadName, imported: false }),
      doImport: () => set({ imported: true }),
      completeOnboarding: () => set({ onboarded: true }),

      pick: (index) => set((s) => (s.checked ? {} : { selected: index })),
      check: () => set((s) => (s.selected != null ? { checked: true } : {})),
      nextQuestion: () => set((s) => ({ qIndex: s.qIndex + 1, selected: null, checked: false })),
      // Clear the current attempt but keep the question index (used after remediation).
      retryQuestion: () => set({ selected: null, checked: false }),
      resetQuizFlow: () =>
        set({
          qIndex: 0,
          selected: null,
          checked: false,
          recapPick: null,
          recapChecked: false,
        }),
      pickRecap: (word) => set((s) => (s.recapChecked ? {} : { recapPick: word })),
      checkRecap: () => set((s) => (s.recapPick ? { recapChecked: true } : {})),
      // Clear a wrong recap attempt so the learner must get it right before the reward.
      retryRecap: () => set({ recapPick: null, recapChecked: false }),

      claim: () =>
        set((s) => ({
          // Extend the unlock window; stacking on top of any time still remaining.
          unlockUntil: Math.max(Date.now(), s.unlockUntil) + REWARD_MS,
          coins: s.coins + 20,
          // Completing a quiz repays the SOS debt and refreshes the SOS allowance.
          debt: false,
          sosUsed: false,
          qIndex: 0,
          selected: null,
          checked: false,
          recapPick: null,
          recapChecked: false,
        })),
      activateSos: () =>
        set((s) => ({
          sosUsed: true,
          debt: true,
          // Stack on top of any time already earned rather than truncating it.
          unlockUntil: Math.max(Date.now(), s.unlockUntil) + SOS_MS,
        })),

      // Wipe progress back to a fresh first-run state (demo reset).
      resetAll: () => set({ ...initial }),
    }),
    {
      name: 'earnlock-store',
      storage: createJSONStorage(() => AsyncStorage),
      // Persist durable progress only; quiz-flow state stays transient.
      partialize: (s) => ({
        onboarded: s.onboarded,
        name: s.name,
        account: s.account,
        age: s.age,
        hoursPerDay: s.hoursPerDay,
        hoursEstimated: s.hoursEstimated,
        paceMinPerWeek: s.paceMinPerWeek,
        habits: s.habits,
        usage: s.usage,
        commitment: s.commitment,
        notificationsGranted: s.notificationsGranted,
        grade: s.grade,
        subj: s.subj,
        importText: s.importText,
        imported: s.imported,
        uploadName: s.uploadName,
        unlockUntil: s.unlockUntil,
        streak: s.streak,
        coins: s.coins,
        sosUsed: s.sosUsed,
        debt: s.debt,
      }),
    },
  ),
);
