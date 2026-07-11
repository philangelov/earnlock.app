/**
 * Learning statistics — the single source for every number Home, Learn, Insights and
 * Profile display. All of it comes from `GET /stats`, computed server-side from what
 * the learner actually did. Nothing here is seeded, defaulted or invented: before the
 * first quiz, `data` is null and the screens render their empty states.
 *
 * Deliberately not persisted. A streak read from disk is a claim about yesterday that
 * nothing has checked; the server owns the truth and we ask it on focus.
 */
import { create } from 'zustand';

import * as api from '@/lib/api';

import { useEarnLock } from './useEarnLock';

/** Refetch on tab focus, but not more than this often — tab switching is cheap and frequent. */
const STALE_MS = 30_000;

export type StatsState = {
  data: api.Stats | null;
  /** True only for the very first load, when there is nothing to show yet. */
  loading: boolean;
  /** True for a pull-to-refresh or a focus refetch, when stale data is still on screen. */
  refreshing: boolean;
  error: string | null;
  fetchedAt: number;

  /** Fetch unless fresh. `force` bypasses the staleness check (pull-to-refresh). */
  fetch: (options?: { force?: boolean }) => Promise<void>;
  /** Drop everything on sign-out / reset, so the next user never sees the last one's numbers. */
  clear: () => void;
};

export const useStats = create<StatsState>()((set, get) => ({
  data: null,
  loading: false,
  refreshing: false,
  error: null,
  fetchedAt: 0,

  fetch: async ({ force = false } = {}) => {
    // Stats are per-account and every row is owner-scoped; a signed-out user has none.
    if (!useEarnLock.getState().authed) {
      set({ data: null, loading: false, refreshing: false, error: null });
      return;
    }

    const { data, loading, refreshing, fetchedAt } = get();
    if (loading || refreshing) return;
    if (!force && data && Date.now() - fetchedAt < STALE_MS) return;

    set(data ? { refreshing: true, error: null } : { loading: true, error: null });
    try {
      set({
        data: await api.getStats(),
        loading: false,
        refreshing: false,
        fetchedAt: Date.now(),
      });
    } catch (err) {
      const message = err instanceof api.ApiError ? err.message : 'Could not load your stats.';
      // Keep whatever is on screen — a failed refresh should not blank the page.
      set({ error: message, loading: false, refreshing: false });
    }
  },

  clear: () => set({ data: null, loading: false, refreshing: false, error: null, fetchedAt: 0 }),
}));

useEarnLock.subscribe((state, previous) => {
  // Signing out must take the numbers with it. Without this, the next account to sign
  // in on this device sees the previous learner's streak until the first fetch lands.
  if (previous.authed && !state.authed) useStats.getState().clear();

  // A graded quiz moves every figure on every screen. Mark the cache stale so the next
  // focus refetches, rather than serving a snapshot taken before the reward existed.
  if (state.quizResults && !previous.quizResults) useStats.setState({ fetchedAt: 0 });
});

/* ----------------------------------------------------------------- derived reads */

/** Days in the current streak, or 0. Safe to call before the first fetch resolves. */
export function useStreak(): number {
  return useStats((s) => s.data?.streak.current ?? 0);
}

/** How many quizzes the learner has ever completed. Drives the Learn roadmap's position. */
export function useCompletedQuizzes(): number {
  return useStats((s) => s.data?.totals.quizzes ?? 0);
}
