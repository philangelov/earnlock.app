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
// The legacy entry point is where base64 file reads live in SDK 57 — the new File API
// exposes arrayBuffer()/text() but no base64 helper, and we need base64 to hand the file
// to the backend (which forwards it straight to the model). This import is the sanctioned
// way to keep that one call.
import { readAsStringAsync } from 'expo-file-system/legacy';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import * as api from '@/lib/api';
import { getIdentityToken, SignInError } from '@/lib/auth';

import {
  chosenSubjects,
  normalizeSubject,
  PASTE_EXAMPLE,
  SUBJECT_DEFS,
  type SubjectKey,
} from './content';
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
  /** Which subjects are switched on. Keys are subject names — predefined or custom. */
  subj: Record<SubjectKey, boolean>;
  /** Custom subjects the learner typed in, so they persist as pickable chips. */
  customSubjects: string[];
  importText: string;
  importLoading: boolean;
  importError: string | null;
  /** A chosen file to upload (PDF/photo). `uploadName` is its display name; the bytes are
   *  sent as base64 — either read from `uploadUri` at submit time (a picked document) or
   *  already in hand as `uploadData` (a photo, which the picker hands back as JPEG base64).
   *  Transient — not persisted. */
  uploadName: string;
  uploadUri: string | null;
  uploadData: string | null;
  uploadMime: string | null;
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
  /** Add a learner-typed subject (normalised, de-duped) and switch it on. */
  addCustomSubject: (name: string) => void;
  setImportText: (text: string) => void;
  pasteExample: () => void;
  /** Record (or clear) the chosen file. Provide `uri` (read at submit) or `data` (base64
   *  already in hand). Pass null to clear the selection. */
  setUpload: (file: { uri?: string; data?: string; name: string; mimeType: string } | null) => void;
  doImport: () => Promise<boolean>;
  completeOnboarding: () => void;

  // quiz flow
  /** Start a quiz. Pass a materialId to draw questions from that material and credit its
   *  understanding; omit it for a profile quiz (grade + focus subjects). */
  beginQuiz: (materialId?: string) => Promise<boolean>;
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
  customSubjects: [] as string[],
  importText: '',
  importLoading: false,
  importError: null as string | null,
  uploadName: '',
  uploadUri: null as string | null,
  uploadData: null as string | null,
  uploadMime: null as string | null,
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
          const { grade, subj, customSubjects } = get();
          const focus = chosenSubjects(subj, customSubjects);
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
          // The real error is otherwise swallowed into a fixed string, which made a
          // can't-reach-the-server failure indistinguishable from a provider refusal.
          if (__DEV__) console.error('[signIn] failed', err);

          // `fetch` rejects when the request never reached a server at all — wrong host,
          // backend down. That rejection is a bare TypeError on some RN builds and an Error
          // whose message is "Network request failed" on others; match both, or it reads as
          // "the provider refused you", which is the one thing it does not mean.
          const netMessage = err instanceof Error ? err.message : '';
          const unreachable =
            err instanceof TypeError || /network request failed/i.test(netMessage);
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
      addCustomSubject: (name) =>
        set((s) => {
          const clean = normalizeSubject(name);
          if (!clean) return {};
          const lower = clean.toLowerCase();
          // Typing a name that already exists (predefined or custom, any casing) just
          // switches that one on rather than creating a near-duplicate chip.
          const predefined = SUBJECT_DEFS.find((d) => d.key.toLowerCase() === lower);
          if (predefined) return { subj: { ...s.subj, [predefined.key]: true } };
          const existing = s.customSubjects.find((c) => c.toLowerCase() === lower);
          if (existing) return { subj: { ...s.subj, [existing]: true } };
          return {
            subj: { ...s.subj, [clean]: true },
            customSubjects: [...s.customSubjects, clean],
          };
        }),
      setImportText: (importText) => set({ importText }),
      pasteExample: () => set({ importText: PASTE_EXAMPLE }),
      setUpload: (file) =>
        set({
          uploadName: file?.name ?? '',
          uploadUri: file?.uri ?? null,
          uploadData: file?.data ?? null,
          uploadMime: file?.mimeType ?? null,
          importError: null,
        }),
      // Two real upload paths now:
      //   - a picked file (PDF/photo): its bytes are read as base64 and POSTed to
      //     /knowledge/import as source_type=file; the server transcribes the text.
      //   - pasted text: POSTed as source_type=text.
      // A file wins over stray text if both are present (the file is the deliberate action).
      doImport: async () => {
        const { importText, uploadUri, uploadData, uploadMime, uploadName, authed } = get();
        const hasFile = !!(uploadUri || uploadData);
        const hasText = importText.trim().length > 0;
        if (!hasFile && !hasText) return false;

        if (!authed) {
          // A file must go through the server (it can't be transcribed on-device), so it
          // can't be kept locally the way pasted text can. Ask the user to sign in.
          if (hasFile) {
            set({ importError: 'Sign in to add materials to your account.' });
            return false;
          }
          // Pasted text with no session: keep it in the form rather than dead-ending on a
          // 401 the user can't act on.
          set({ importError: null });
          return true;
        }

        set({ importLoading: true, importError: null });
        try {
          if (hasFile) {
            const data =
              uploadData ?? (await readAsStringAsync(uploadUri!, { encoding: 'base64' }));
            await api.importFile({
              data,
              mimeType: uploadMime ?? 'application/octet-stream',
              filename: uploadName || undefined,
            });
          } else {
            await api.importText(importText);
          }
          // Clear the form on success. This is a REPEATABLE "Add material" form (reopened
          // from the Materials manager), so leaving the input in place would re-submit it —
          // a duplicate — on the next visit.
          set({
            importLoading: false,
            importText: '',
            uploadName: '',
            uploadUri: null,
            uploadData: null,
            uploadMime: null,
          });
          return true;
        } catch (err) {
          const message = err instanceof api.ApiError ? err.message : 'Could not save that.';
          set({ importError: message, importLoading: false });
          return false;
        }
      },
      completeOnboarding: () => set({ onboarded: true }),

      beginQuiz: async (materialId) => {
        // Every quiz is graded and rewarded server-side, so there is nothing to show a
        // signed-out user. Say so instead of surfacing a bare 401.
        if (!get().authed) {
          set({ quizError: 'Sign in to start a quiz.', quizLoading: false });
          return false;
        }
        set({ quizLoading: true, quizError: null, quizResults: null });
        try {
          const quiz = await api.generateQuiz(materialId ? { materialId } : undefined);
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
          set({
            quizResults: res.results,
            lastEarnedSeconds: res.earned_seconds,
            quizLoading: false,
            // The balance is server-authoritative from here — replace, don't stack.
            unlockUntil: Date.now() + res.new_balance_seconds * 1000,
            // SOS is a local-only mechanic (there is no /sos endpoint), so its debt and
            // daily allowance can't be cleared by the server. A completed lesson repays the
            // debt and refreshes the allowance — matching the SOS sheet's own promise — which
            // also stops both from getting permanently stuck on a flag that never flips.
            debt: false,
            sosUsed: false,
          });
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
        customSubjects: s.customSubjects,
        importText: s.importText,
        unlockUntil: s.unlockUntil,
        sosUsed: s.sosUsed,
        debt: s.debt,
      }),
    },
  ),
);
