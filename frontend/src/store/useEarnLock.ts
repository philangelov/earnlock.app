/**
 * EarnLock store — app state + the real loop logic, backed by the Flask API
 * (docs/api-contract.md). Navigation is handled by expo-router in the screens; this
 * store owns the data and the state transitions. Durable progress (onboarding, grade,
 * subjects, unlock deadline, SOS/debt) is persisted to AsyncStorage; transient
 * quiz-session state is not. The JWT itself lives in expo-secure-store (see
 * lib/api.ts), never here.
 *
 * Achievement figures — streak, accuracy, minutes earned, subject mastery — are NOT
 * here. They are derived server-side from the real quiz history and read through
 * `store/stats.ts`. Keeping them out of a client-persisted store is what stops the app
 * from reporting a streak nothing has verified.
 *
 * SOS has no backend endpoint yet (no /sos route exists) and Wake-Up Lock has no
 * frontend screen yet, so `activateSos` stays local-only/presentational — everything
 * else (auth, quiz generate+submit, screentime balance, knowledge import) is real.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import * as api from '@/lib/api';
import { getIdentityToken, SignInError } from '@/lib/auth';

import { PASTE_EXAMPLE, SUBJECT_DEFS, type SubjectKey } from './content';
import {
  AGE_DEFAULT,
  gradeForAge,
  gradeLabel,
  HOURS_DEFAULT,
  PACE_DEFAULT,
  type AccountProvider,
  type CommitmentKey,
  type HabitKey,
  type UsageKey,
} from './onboarding';

/** Screen time granted per SOS, in milliseconds. Quiz rewards now come from the server. */
const SOS_MS = 2 * 60_000;
/** Matches the backend's default REWARD_SECONDS (architecture.md §8) — UI scaling only,
 * the real reward amount always comes from POST /quiz/submit's earned_seconds. */
export const REWARD_MS = 900 * 1000;

export type EarnLockState = {
  onboarded: boolean;
  /** Answers collected during first run. Demo-only — nothing is sent anywhere. */
  name: string;
  /** Which identity provider saved the progress, if any. No email, no password. */
  account: AccountProvider | null;
  /** file:// URI of the chosen profile picture, copied into the app's documents dir. */
  avatarUri: string | null;
  /** True while a session exists. Hydrated from SecureStore at launch, not persisted here. */
  authed: boolean;
  authLoading: boolean;
  authError: string | null;
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
  importLoading: boolean;
  importError: string | null;
  uploadName: string;
  /** Real quiz fetched from POST /quiz/generate; null until beginQuiz() resolves. */
  quizId: string | null;
  quizQuestions: api.QuizQuestion[];
  /** The closing exercise, authored server-side from the same material. */
  quizRecap: api.QuizRecap | null;
  quizAnswers: Record<string, number>;
  quizResults: api.QuizResult[] | null;
  quizLoading: boolean;
  quizError: string | null;
  lastEarnedSeconds: number;
  qIndex: number;
  selected: number | null;
  recapPick: string | null;
  recapChecked: boolean;
  /** Epoch ms until which apps are unlocked; 0 (or past) = locked. */
  unlockUntil: number;
  sosUsed: boolean;
  debt: boolean;

  // onboarding
  setName: (name: string) => void;
  setAccount: (provider: AccountProvider | null) => void;
  setAvatarUri: (uri: string | null) => void;
  /** Native Apple/Google sign-in. Resolves false on cancel or failure. */
  signIn: (provider: AccountProvider) => Promise<boolean>;
  logoutAccount: () => Promise<void>;
  /** Irreversibly delete the account server-side, then wipe this device. */
  deleteAccount: () => Promise<boolean>;
  /** Read the stored session at launch so screens know whether the API is usable. */
  hydrateAuth: () => Promise<void>;
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
  doImport: () => Promise<boolean>;
  completeOnboarding: () => void;

  // quiz flow
  beginQuiz: () => Promise<boolean>;
  pick: (index: number) => void;
  nextQuestion: () => void;
  submitQuizNow: () => Promise<boolean>;
  resetQuizFlow: () => void;
  fetchBalance: () => Promise<void>;
  pickRecap: (word: string) => void;
  checkRecap: () => void;
  retryRecap: () => void;

  // rewards / hooks
  claim: () => void;
  activateSos: () => void;
};

const initial = {
  onboarded: false,
  name: '',
  account: null as AccountProvider | null,
  avatarUri: null as string | null,
  authed: false,
  authLoading: false,
  authError: null as string | null,
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
  importLoading: false,
  importError: null as string | null,
  uploadName: '',
  quizId: null as string | null,
  quizQuestions: [] as api.QuizQuestion[],
  quizRecap: null as api.QuizRecap | null,
  quizAnswers: {} as Record<string, number>,
  quizResults: null as api.QuizResult[] | null,
  quizLoading: false,
  quizError: null as string | null,
  lastEarnedSeconds: 0,
  qIndex: 0,
  selected: null as number | null,
  recapPick: null as string | null,
  recapChecked: false,
  unlockUntil: 0,
  sosUsed: false,
  debt: false,
};

export const useEarnLock = create<EarnLockState>()(
  persist(
    (set, get) => ({
      ...initial,

      setName: (name) => set({ name }),
      setAccount: (account) => set({ account }),
      setAvatarUri: (avatarUri) => set({ avatarUri }),

      signIn: async (provider) => {
        set({ authLoading: true, authError: null });
        try {
          const identity = await getIdentityToken(provider);
          // Cancelled at the system sheet — not an error, and not worth a red message.
          if (!identity) {
            set({ authLoading: false });
            return false;
          }

          await api.signInWithIdToken(identity.provider, identity.idToken, identity.nonce);
          set({ account: provider, authed: true, authLoading: false });

          // The id_token grant carries no signup metadata, so a fresh account's grade is
          // 'unspecified' until we say otherwise. Onboarding already knows it. Best-effort:
          // a failure here must not undo a sign-in that actually succeeded.
          const { grade, subj } = get();
          const focus = SUBJECT_DEFS.filter((s) => subj[s.key]).map((s) => s.key);
          try {
            await api.updateProfile({
              grade_or_age: gradeLabel(grade),
              ...(focus.length > 0 ? { focus_subjects: focus } : {}),
            });
          } catch {
            // Profile stays at its defaults; Profile → Grade & subjects can fix it.
          }

          return true;
        } catch (err) {
          // `fetch` rejects with a bare TypeError when the request never reached a server at
          // all — wrong host, backend down. Left in the generic branch it reads as "the
          // provider refused you", which is the one thing it does not mean.
          const unreachable = err instanceof TypeError;
          const message =
            err instanceof api.ApiError || err instanceof SignInError
              ? err.message
              : unreachable
                ? 'Could not reach EarnLock. Check your connection.'
                : 'Could not sign in.';
          set({ authError: message, authLoading: false });
          return false;
        }
      },
      logoutAccount: async () => {
        await api.signOut();
        // Signing out leaves the account intact on the server but takes it off this
        // device entirely — grade, subjects, avatar and the unlock clock included. The
        // next person to open the app must not inherit the last one's answers, and a
        // signed-out device must not keep an open unlock window.
        set({ ...initial });
      },
      deleteAccount: async () => {
        if (!get().authed) return false;
        try {
          await api.deleteAccount();
        } catch {
          // The rows may or may not be gone; either way, do not wipe the device on a
          // failure the user could retry.
          return false;
        }
        set({ ...initial });
        return true;
      },
      hydrateAuth: async () => {
        set({ authed: await api.isAuthenticated() });
      },

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
      // A picked file (PDF/image) has no backend counterpart — /knowledge/import only
      // accepts pasted text or a URL — so a file selection stays presentational-only.
      // Pasted text is real: it's sent to POST /knowledge/import and stored server-side.
      doImport: async () => {
        const { importText, uploadName, authed } = get();
        if (!importText.trim()) {
          set({ imported: uploadName.length > 0 });
          return uploadName.length > 0;
        }
        // Skipped sign-in: /knowledge/import needs a session. Keep the text locally so
        // onboarding can finish, rather than dead-ending on a 401 the user can't act on.
        if (!authed) {
          set({ imported: true, importError: null });
          return true;
        }
        set({ importLoading: true, importError: null });
        try {
          await api.importText(importText);
          set({ imported: true, importLoading: false });
          return true;
        } catch (err) {
          const message = err instanceof api.ApiError ? err.message : 'Could not save that.';
          set({ importError: message, importLoading: false });
          return false;
        }
      },
      completeOnboarding: () => set({ onboarded: true }),

      beginQuiz: async () => {
        // Every quiz is graded and rewarded server-side, so there is nothing to show a
        // signed-out user. Say so instead of surfacing a bare 401.
        if (!get().authed) {
          set({ quizError: 'Sign in to start a quiz.', quizLoading: false });
          return false;
        }
        set({ quizLoading: true, quizError: null, quizResults: null });
        try {
          const quiz = await api.generateQuiz();
          set({
            quizId: quiz.quiz_id,
            quizQuestions: quiz.questions,
            quizRecap: quiz.recap,
            quizAnswers: {},
            qIndex: 0,
            selected: null,
            quizLoading: false,
          });
          return true;
        } catch (err) {
          const message = err instanceof api.ApiError ? err.message : 'Could not load a quiz.';
          set({ quizError: message, quizLoading: false });
          return false;
        }
      },
      // No per-question reveal: the backend never sends correct_index until the whole
      // quiz is submitted (docs/api-contract.md — "answers can't be read from the
      // payload"), so a pick just records the answer; grading happens once, at submit.
      pick: (index) =>
        set((s) => {
          const q = s.quizQuestions[s.qIndex];
          if (!q) return { selected: index };
          return { selected: index, quizAnswers: { ...s.quizAnswers, [q.id]: index } };
        }),
      nextQuestion: () =>
        set((s) => {
          const nextIndex = s.qIndex + 1;
          const nextQ = s.quizQuestions[nextIndex];
          return {
            qIndex: nextIndex,
            selected: nextQ ? (s.quizAnswers[nextQ.id] ?? null) : null,
          };
        }),
      submitQuizNow: async () => {
        const { quizId, quizQuestions, quizAnswers } = get();
        if (!quizId) return false;
        const answers: api.QuizAnswer[] = quizQuestions.map((q) => ({
          id: q.id,
          selected_index: quizAnswers[q.id] ?? null,
        }));
        set({ quizLoading: true, quizError: null });
        try {
          const res = await api.submitQuiz(quizId, answers);
          set((s) => ({
            quizResults: res.results,
            lastEarnedSeconds: res.earned_seconds,
            quizLoading: false,
            // The balance is server-authoritative from here — replace, don't stack.
            unlockUntil: Date.now() + res.new_balance_seconds * 1000,
            debt: res.sos_debt_cleared ? false : s.debt,
            sosUsed: res.sos_debt_cleared ? false : s.sosUsed,
          }));
          return true;
        } catch (err) {
          const message = err instanceof api.ApiError ? err.message : 'Could not submit.';
          set({ quizError: message, quizLoading: false });
          return false;
        }
      },
      resetQuizFlow: () =>
        set({
          quizId: null,
          quizQuestions: [],
          quizRecap: null,
          quizAnswers: {},
          quizResults: null,
          quizError: null,
          qIndex: 0,
          selected: null,
          recapPick: null,
          recapChecked: false,
        }),
      /**
       * Resync the unlock clock from the server's window.
       *
       * `remaining_seconds` is derived server-side from `unlocked_until - now()`, so it
       * only ever counts down. Turning it back into a local deadline is therefore safe:
       * re-reading it cannot extend the window, which is exactly what the old wallet did
       * on every launch. The device's own clock is used only to render the countdown, not
       * to decide how much time is left.
       */
      fetchBalance: async () => {
        if (!get().authed) return;
        try {
          const balance = await api.getBalance();
          set({
            unlockUntil:
              balance.remaining_seconds > 0 ? Date.now() + balance.remaining_seconds * 1000 : 0,
          });
        } catch {
          // Best-effort sync — the locally-held unlockUntil is an absolute instant, so it
          // stays honest (it can only run down) until the next successful fetch.
        }
      },
      pickRecap: (word) => set((s) => (s.recapChecked ? {} : { recapPick: word })),
      checkRecap: () => set((s) => (s.recapPick ? { recapChecked: true } : {})),
      // Clear a wrong recap attempt so the learner must get it right before the reward.
      retryRecap: () => set({ recapPick: null, recapChecked: false }),

      // The real reward was already granted by submitQuizNow(); this just clears the
      // transient per-attempt UI state once the celebration screen has taken over.
      claim: () => set({ recapPick: null, recapChecked: false }),
      activateSos: () =>
        set((s) => ({
          sosUsed: true,
          debt: true,
          // Stack on top of any time already earned rather than truncating it.
          unlockUntil: Math.max(Date.now(), s.unlockUntil) + SOS_MS,
        })),
    }),
    {
      name: 'earnlock-store',
      storage: createJSONStorage(() => AsyncStorage),
      // Persist durable progress only; quiz-session and auth-flow state stay transient.
      partialize: (s) => ({
        onboarded: s.onboarded,
        name: s.name,
        account: s.account,
        avatarUri: s.avatarUri,
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
        sosUsed: s.sosUsed,
        debt: s.debt,
      }),
    },
  ),
);
