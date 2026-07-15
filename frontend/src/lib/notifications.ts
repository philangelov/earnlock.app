/**
 * Local notifications — EarnLock only ever schedules LOCAL notifications (the push
 * entitlement is deliberately stripped; see plugins/with-no-push-entitlement.js). Three
 * kinds, all tappable straight into a quiz:
 *
 *   • Daily reminder     — a once-a-day nudge to keep the streak alive.
 *   • Time running low    — fires ~2 min before earned screen time runs out.
 *   • Apps re-locked      — fires the moment the window closes and apps shield again.
 *
 * The last two are scheduled from the unlock deadline (`unlockUntil`) by the lock-
 * enforcement bridge, so they always match the real window and are rescheduled whenever
 * more time is earned. Identifiers are persisted so a reschedule cancels the old ones
 * even across launches.
 *
 * The native module is require()d defensively: on a build whose pods predate
 * expo-notifications (or on web) every function is a safe no-op rather than a crash.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

type NotificationsModule = typeof import('expo-notifications');

let N: NotificationsModule | null = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  N = require('expo-notifications');
} catch {
  N = null;
}

const DAILY_ID_KEY = 'earnlock-notif-daily';
const LOW_TIME_ID_KEY = 'earnlock-notif-lowtime';
const RELOCK_ID_KEY = 'earnlock-notif-relock';

/** When the daily reminder fires (local device time). Early evening — after school, before bed. */
const DAILY_HOUR = 18;
const DAILY_MINUTE = 0;
/** How long before the window closes the "running low" nudge fires. */
const LOW_TIME_LEAD_SECONDS = 120;

/** Where a tapped notification lands — the router path handled by the root layout's
 *  tap observer (not a scheme URL: the tap is routed inside the running app). */
const TAP_TARGET = '/quiz';

async function cancelStored(key: string): Promise<void> {
  if (!N) return;
  const id = await AsyncStorage.getItem(key);
  if (id) {
    try {
      await N.cancelScheduledNotificationAsync(id);
    } catch {
      // already fired or gone — either way, forget it
    }
    await AsyncStorage.removeItem(key);
  }
}

/**
 * Register how a notification looks when it arrives while the app is foregrounded, and how
 * taps route. Call once at launch. Safe to call more than once.
 */
export function setupNotificationHandler(): void {
  if (!N) return;
  N.setNotificationHandler({
    handleNotification: async () => ({
      shouldPlaySound: true,
      shouldSetBadge: false,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  });
}

/**
 * Route a tapped notification to its `data.url`. Wire this in the root layout with the
 * router's push as `onUrl`; it also replays the notification that cold-launched the app.
 * Returns an unsubscribe.
 */
export function observeNotificationTaps(onUrl: (url: string) => void): () => void {
  if (!N) return () => {};

  const redirect = (data: unknown) => {
    const url = (data as { url?: unknown } | undefined)?.url;
    if (typeof url === 'string' && url) onUrl(url);
  };

  // A notification that launched the app from cold isn't delivered to the runtime listener.
  void N.getLastNotificationResponseAsync?.().then((response) => {
    if (response) redirect(response.notification.request.content.data);
  });

  const sub = N.addNotificationResponseReceivedListener((response) => {
    redirect(response.notification.request.content.data);
  });
  return () => sub.remove();
}

/**
 * Schedule (or cancel) the repeating daily reminder. `enabled` mirrors the learner's
 * notification permission — turn it off and the reminder is cancelled.
 */
export async function syncDailyReminder(enabled: boolean): Promise<void> {
  if (!N) return;
  await cancelStored(DAILY_ID_KEY);
  if (!enabled) return;
  try {
    const id = await N.scheduleNotificationAsync({
      content: {
        title: 'Keep your streak alive',
        body: 'A couple of questions earns your screen time for today.',
        data: { url: TAP_TARGET },
      },
      trigger: {
        type: N.SchedulableTriggerInputTypes.DAILY,
        hour: DAILY_HOUR,
        minute: DAILY_MINUTE,
      },
    });
    await AsyncStorage.setItem(DAILY_ID_KEY, id);
  } catch {
    // scheduling is best-effort — never let a reminder failure surface to the learner
  }
}

/**
 * Schedule the two window reminders for a given unlock deadline, replacing any prior pair.
 * A deadline already in the past (or too soon) just cancels them.
 */
export async function scheduleWindowReminders(unlockUntilMs: number): Promise<void> {
  if (!N) return;
  await cancelWindowReminders();

  const now = Date.now();
  if (unlockUntilMs <= now) return;

  try {
    const lowAt = unlockUntilMs - LOW_TIME_LEAD_SECONDS * 1000;
    // Only worth a "running low" nudge if there's more than a moment before it.
    if (lowAt > now + 30_000) {
      const lowId = await N.scheduleNotificationAsync({
        content: {
          title: 'Screen time running low',
          body: 'About two minutes left — a quick quiz earns more.',
          data: { url: TAP_TARGET },
        },
        trigger: { type: N.SchedulableTriggerInputTypes.DATE, date: new Date(lowAt) },
      });
      await AsyncStorage.setItem(LOW_TIME_ID_KEY, lowId);
    }

    const relockId = await N.scheduleNotificationAsync({
      content: {
        title: 'Apps locked',
        body: 'Time’s up. One quiz unlocks 15 more minutes.',
        data: { url: TAP_TARGET },
      },
      trigger: { type: N.SchedulableTriggerInputTypes.DATE, date: new Date(unlockUntilMs) },
    });
    await AsyncStorage.setItem(RELOCK_ID_KEY, relockId);
  } catch {
    // best-effort
  }
}

/** Cancel the earned-window reminders (apps are locked, or the window was reset). */
export async function cancelWindowReminders(): Promise<void> {
  await cancelStored(LOW_TIME_ID_KEY);
  await cancelStored(RELOCK_ID_KEY);
}
