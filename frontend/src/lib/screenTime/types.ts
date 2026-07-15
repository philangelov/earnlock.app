/**
 * Screen Time — shared types. The app now talks to ONE real backend
 * (Apple FamilyControls / DeviceActivity / ManagedSettings via react-native-device-activity).
 * There is no simulated fallback: when the native stack isn't present (Expo Go, web, Android,
 * or a build without the config plugin) the facade reports `available: false` and the UI shows
 * an honest "run on a device" state rather than pretending to block anything.
 */

/** Apple's authorization states, plus `unavailable` for non-device contexts. */
export type AuthStatus = 'unavailable' | 'notDetermined' | 'denied' | 'approved';

/** Counts of what's in the shielded FamilyActivity selection (app identities are private). */
export type SelectionCount = {
  apps: number;
  categories: number;
  webDomains: number;
  total: number;
};

export interface ScreenTimeFacade {
  /** True only on an iOS device build with the native Screen Time module loaded. */
  readonly available: boolean;
  /** Stable id the shielded selection is persisted + blocked under. */
  readonly selectionId: string;

  getAuthStatus(): AuthStatus;
  requestAuthorization(): Promise<AuthStatus>;
  revoke(): Promise<void>;

  /** Read the current shielded-selection counts from the persisted selection. */
  getSelectionCount(): SelectionCount;

  /** Write EarnLock's custom lock screen (title, lime "Start a quiz" button, deep link)
   *  so a blocked app shows our shield instead of iOS's default. Persists in the app
   *  group; safe to call anytime and a no-op off-device. */
  configureShield(): void;

  /** Immediately shield (block) the chosen apps. */
  shield(): Promise<void>;
  /** Immediately unshield (allow) the chosen apps. */
  unshield(): Promise<void>;
}
