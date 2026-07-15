/**
 * useLockEnforcement — the bridge between the earn clock and the OS shield. Mounted once at the
 * app root, it watches the store's `unlockUntil` (only after the persisted store has rehydrated,
 * so the pre-hydration default of 0 never shields on cold launch):
 *   - time remaining  → unshield the blocked apps now, and schedule a re-shield at the deadline
 *   - time up / never → shield the blocked apps now
 *
 * `screenTime.shield()/unshield()` no-op safely when Screen Time isn't available or authorized.
 * The JS deadline timer only fires while the app is foregrounded; the ManagedSettings shield
 * itself persists (apps stay closed) until we unshield, so the lock never leaks. A background-
 * exact re-shield would use a DeviceActivityMonitor schedule (see docs/screen-time.md).
 */
import { useEffect, useSyncExternalStore } from 'react';

import { cancelWindowReminders, scheduleWindowReminders } from '@/lib/notifications';
import { useEarnLock } from '@/store/useEarnLock';

import { screenTime } from './index';
import { useScreenTime } from './store';

export function useLockEnforcement() {
  const unlockUntil = useEarnLock((s) => s.unlockUntil);
  const notificationsGranted = useEarnLock((s) => s.notificationsGranted);
  // Re-run when the selection or authorization changes too, so newly chosen apps (or a just-
  // granted authorization) get shielded immediately while locked — not only at the next lock
  // transition.
  const selectionTotal = useScreenTime((s) => s.selection.total);
  const status = useScreenTime((s) => s.status);
  const hydrated = useSyncExternalStore(
    (cb) => useEarnLock.persist.onFinishHydration(cb),
    () => useEarnLock.persist.hasHydrated(),
  );

  useEffect(() => {
    if (!hydrated) return;
    let cancelled = false;
    const remaining = unlockUntil - Date.now();

    if (remaining > 0) {
      void screenTime.unshield();
      // Mirror the window with local reminders: a "running low" nudge and a "re-locked"
      // one, timed off the same deadline the JS timer below re-shields at. Only when the
      // learner opted into notifications; otherwise make sure none linger.
      if (notificationsGranted) void scheduleWindowReminders(unlockUntil);
      else void cancelWindowReminders();
      const id = setTimeout(() => {
        if (!cancelled) void screenTime.shield();
      }, remaining);
      return () => {
        cancelled = true;
        clearTimeout(id);
      };
    }

    void screenTime.shield();
    // The window is closed — the apps are locked now, so a reminder about it is moot.
    void cancelWindowReminders();
    return () => {
      cancelled = true;
    };
  }, [unlockUntil, hydrated, selectionTotal, status, notificationsGranted]);
}
