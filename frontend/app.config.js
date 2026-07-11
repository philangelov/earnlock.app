/**
 * Dynamic Expo config. Keeps app.json as the static base and layers on the native pieces that
 * depend on credentials, so a checkout without them still resolves and still builds.
 *
 *   EXPO_APPLE_TEAM_ID / EXPO_APP_GROUP           Apple Screen Time (Family Controls)
 *   EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID              Sign in with Google
 *   EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID              Sign in with Google (Supabase audience)
 *   EXPO_PUBLIC_API_URL                           Backend origin; defaults to app.json's
 *
 * At `expo prebuild` this generates the Family Controls entitlement + the shield/monitor
 * extensions and sets extra.screenTimeEnabled = true. The plugins only affect native
 * (prebuild/device) builds — `expo start` still runs, and Screen Time reports itself
 * unavailable there because the native module isn't present. See docs/screen-time.md.
 */
const base = require('./app.json').expo;

// Project defaults (this repo's Apple account). Override via env for another team/group.
const APPLE_TEAM_ID = process.env.EXPO_APPLE_TEAM_ID || 'ZMJTV28224';
const APP_GROUP = process.env.EXPO_APP_GROUP || 'group.com.filipangelov.earnlock';
const screenTimeEnabled = Boolean(APPLE_TEAM_ID && APP_GROUP);

const GOOGLE_IOS_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID || '';
const GOOGLE_WEB_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID || '';

/**
 * Google's iOS SDK returns to the app through the reversed client ID. It is derivable, so
 * derive it — a hand-copied second constant is one more thing to get subtly wrong.
 *   1234-abc.apps.googleusercontent.com  ->  com.googleusercontent.apps.1234-abc
 */
function reversedClientId(clientId) {
  const suffix = '.apps.googleusercontent.com';
  if (!clientId.endsWith(suffix)) return null;
  return `com.googleusercontent.apps.${clientId.slice(0, -suffix.length)}`;
}

module.exports = () => {
  const plugins = [...(base.plugins ?? [])];

  if (screenTimeEnabled) {
    // Family Controls needs iOS 15.1+, but SDK 57's toolchain enforces a 16.4 floor.
    plugins.push(['expo-build-properties', { ios: { deploymentTarget: '16.4' } }]);
    plugins.push([
      'react-native-device-activity',
      { appleTeamId: APPLE_TEAM_ID, appGroup: APP_GROUP },
    ]);
  }

  // Adds the `com.apple.developer.applesignin` entitlement. The App ID must have the
  // "Sign in with Apple" capability enabled in the Apple Developer portal, or signing fails
  // the same way the push entitlement did.
  plugins.push('expo-apple-authentication');

  // The profile picture. iOS's PHPicker runs out of process, so no library permission is
  // ever requested — but App Review still reads the string if one is ever surfaced.
  plugins.push([
    'expo-image-picker',
    {
      photosPermission:
        'EarnLock uses a photo you choose as your profile picture. It stays on this device.',
    },
  ]);

  // Only when configured: the plugin throws without an iosUrlScheme, and a checkout with no
  // Google credentials should still build (the button disables itself — see lib/auth.ts).
  const iosUrlScheme = reversedClientId(GOOGLE_IOS_CLIENT_ID);
  if (iosUrlScheme) {
    plugins.push(['@react-native-google-signin/google-signin', { iosUrlScheme }]);
  }

  // Last, so it runs after expo-notifications' auto-applied plugin has written `aps-environment`.
  // EarnLock only schedules local notifications; the push entitlement would fail signing against a
  // profile that has no Push Notifications capability. See the plugin for the full story.
  plugins.push('./plugins/with-no-push-entitlement');

  return {
    ...base,
    plugins,
    ios: {
      ...(base.ios ?? {}),
      // Required by the device-activity / apple-targets tooling to sign the extensions.
      ...(screenTimeEnabled ? { appleTeamId: APPLE_TEAM_ID } : {}),
    },
    extra: {
      ...(base.extra ?? {}),
      apiUrl: process.env.EXPO_PUBLIC_API_URL || base.extra?.apiUrl,
      screenTimeEnabled,
      googleIosClientId: GOOGLE_IOS_CLIENT_ID,
      googleWebClientId: GOOGLE_WEB_CLIENT_ID,
    },
  };
};
