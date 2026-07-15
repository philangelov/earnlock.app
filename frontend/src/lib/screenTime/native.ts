/**
 * The real Screen Time backend — a thin, defensive wrapper over
 * `react-native-device-activity` (Apple FamilyControls / DeviceActivity / ManagedSettings).
 *
 * The module is require()d inside try/catch so importing this file can never crash a context
 * where the native binding is absent (Expo Go, web). `NATIVE_AVAILABLE` is true only on an iOS
 * device build where `isAvailable()` returns true; every method no-ops safely otherwise.
 *
 * All shielding targets one selection persisted under `SELECTION_ID` (written by the native
 * FamilyActivity picker — see AppSelectionSheet). Locking blocks it, earning time unblocks it.
 */
import Constants from 'expo-constants';
import * as Device from 'expo-device';

import type { AuthStatus, ScreenTimeFacade, SelectionCount } from './types';

export const SELECTION_ID = 'earnlock.blocked';

let RNDA: any = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const mod = require('react-native-device-activity');
  RNDA = mod?.default ?? mod;
} catch {
  RNDA = null;
}

/** Convert a `#rrggbb` token into the {red,green,blue} 0-255 shape react-native-device-activity
 *  expects for shield colors. */
function rgb(hex: string): { red: number; green: number; blue: number } {
  const n = parseInt(hex.replace('#', ''), 16);
  return { red: (n >> 16) & 255, green: (n >> 8) & 255, blue: n & 255 };
}

/** The app's URL scheme, for the deep link the shield's "Start a quiz" button opens. */
function appScheme(): string {
  const s = Constants.expoConfig?.scheme;
  return (Array.isArray(s) ? s[0] : s) ?? 'earnlockapp';
}

/** Write EarnLock's branded lock screen into the app group. The native ShieldConfiguration /
 *  ShieldAction extensions read these values when they render a blocked app's shield. */
function writeShieldConfig(): void {
  if (!RNDA || typeof RNDA.updateShield !== 'function') return;
  try {
    // Deep-link into the branded in-app lock screen (app/locked.tsx), which explains the
    // deal and hands off to the quiz — rather than jumping straight into questions.
    const url = `${appScheme()}://locked`;
    // The shield always overlays a blocked app, so its palette is the dark-theme brand:
    // white title, muted subtitle, one electric-lime button. Prefer Apple's frosted
    // material; fall back to a near-black fill where the blur enum isn't exported.
    const blur = RNDA.UIBlurEffectStyle?.systemMaterialDark;
    RNDA.updateShield(
      {
        title: 'Locked — earn to unlock',
        titleColor: rgb('#ffffff'),
        subtitle: 'Answer a few questions to earn screen time.',
        subtitleColor: rgb('#9c9ea6'),
        iconSystemName: 'bolt.fill',
        ...(typeof blur === 'number'
          ? { backgroundBlurStyle: blur }
          : { backgroundColor: rgb('#101014') }),
        primaryButtonLabel: 'Start a quiz',
        primaryButtonLabelColor: rgb('#12160a'),
        primaryButtonBackgroundColor: rgb('#cbff45'),
        secondaryButtonLabel: 'Not now',
        secondaryButtonLabelColor: rgb('#9c9ea6'),
      },
      {
        // Getting from the shield into the app is the hard part. Apple gives a
        // ShieldAction extension no supported way to launch its host app: RNDA's
        // `openUrl`/`openUrlWithDispatch` build a fresh NSExtensionContext and call
        // `open()`, which has no host to hand off to and silently no-ops on many
        // iOS builds — which is why "Start a quiz" did nothing.
        //
        // The reliable path is a local notification: tapping ANY notification launches
        // the app, and RNDA copies our `userInfo` onto it, so `userInfo.url` routes
        // straight to the lock screen (see observeNotificationTaps in lib/notifications).
        // We fire that notification AND still attempt the direct open, so on builds
        // where `open()` happens to work it's a single tap, and everywhere else the
        // notification is a dependable fallback.
        primary: {
          type: 'openUrlWithDispatch',
          url,
          behavior: 'close',
          delay: 0.6,
          actions: [
            {
              type: 'sendNotification',
              payload: {
                title: 'Earn your screen time',
                body: 'Tap to answer a few quick questions and unlock your apps.',
                sound: 'default',
                interruptionLevel: 'active',
                userInfo: { url: '/locked' },
              },
            },
          ],
        },
        // "Not now" just returns to the Home screen — the apps stay locked.
        secondary: { behavior: 'close' },
      },
    );
  } catch {
    // updateShield is best-effort branding; a failure must never stop the block itself.
  }
}

function computeAvailable(): boolean {
  try {
    // Real Screen Time needs ALL of: iOS, a physical device (the Simulator can't authorize),
    // the Family Controls entitlement actually configured (app.config.js sets
    // extra.screenTimeEnabled only when EXPO_APPLE_TEAM_ID + EXPO_APP_GROUP are provided), and
    // the native module loaded. Anything short of that → honest "device build required" state,
    // never a Connect button that silently dead-ends.
    if (process.env.EXPO_OS !== 'ios') return false;
    if (!Device.isDevice) return false;
    if (!Constants.expoConfig?.extra?.screenTimeEnabled) return false;
    return !!RNDA && typeof RNDA.isAvailable === 'function' && RNDA.isAvailable();
  } catch {
    return false;
  }
}

export const NATIVE_AVAILABLE = computeAvailable();

function mapStatus(raw: unknown): AuthStatus {
  // Apple: 0 notDetermined, 1 denied, 2 approved (the lib may also return the string enum).
  if (raw === 2 || raw === 'approved') return 'approved';
  if (raw === 1 || raw === 'denied') return 'denied';
  return 'notDetermined';
}

const EMPTY: SelectionCount = { apps: 0, categories: 0, webDomains: 0, total: 0 };

export const nativeScreenTime: ScreenTimeFacade = {
  available: NATIVE_AVAILABLE,
  selectionId: SELECTION_ID,

  getAuthStatus() {
    if (!NATIVE_AVAILABLE) return 'unavailable';
    try {
      return mapStatus(RNDA.getAuthorizationStatus());
    } catch {
      return 'unavailable';
    }
  },

  async requestAuthorization() {
    if (!NATIVE_AVAILABLE) return 'unavailable';
    try {
      await RNDA.requestAuthorization('individual');
    } catch {
      // Can throw if already denied; fall through to reading the definitive status.
    }
    return this.getAuthStatus();
  },

  async revoke() {
    if (!NATIVE_AVAILABLE) return;
    try {
      await RNDA.revokeAuthorization?.();
    } catch {
      // ignore
    }
  },

  getSelectionCount() {
    if (!NATIVE_AVAILABLE) return EMPTY;
    try {
      const m = RNDA.activitySelectionMetadata?.({ activitySelectionId: SELECTION_ID });
      if (!m) return EMPTY;
      const apps = m.applicationCount ?? 0;
      const categories = m.categoryCount ?? 0;
      const webDomains = m.webDomainCount ?? 0;
      return { apps, categories, webDomains, total: apps + categories + webDomains };
    } catch {
      return EMPTY;
    }
  },

  configureShield() {
    if (!NATIVE_AVAILABLE) return;
    writeShieldConfig();
  },

  async shield() {
    if (!NATIVE_AVAILABLE) return;
    try {
      // Make sure our custom lock screen is in place before the block takes effect, so a
      // shielded app never briefly shows iOS's default shield.
      writeShieldConfig();
      await RNDA.blockSelection({ activitySelectionId: SELECTION_ID });
    } catch {
      // nothing selected yet, or not authorized
    }
  },

  async unshield() {
    if (!NATIVE_AVAILABLE) return;
    try {
      await RNDA.unblockSelection({ activitySelectionId: SELECTION_ID });
    } catch {
      // ignore
    }
  },
};
