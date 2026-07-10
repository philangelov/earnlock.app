/**
 * Strips the `aps-environment` entitlement from the iOS app target.
 *
 * `expo-notifications` ships an auto-applied config plugin that writes `aps-environment` into the
 * entitlements unconditionally — its only knob picks `development` vs `production`, never "off".
 * That entitlement asks the provisioning profile for the Push Notifications capability, and a
 * profile without it fails the build:
 *
 *     Provisioning Profile "iOS Team Provisioning Profile: ..." does not support the
 *     Push Notifications capability.
 *
 * EarnLock never registers for APNs. It asks for notification permission and schedules LOCAL
 * notifications (apps lock in ten minutes, a quiz is ready) — neither needs push, and both work
 * fine through UNUserNotificationCenter without the entitlement. So drop it rather than enable a
 * capability on the App ID that the app has no use for.
 *
 * Registered last in `app.config.js`, so it runs after the plugin that adds it. If remote push is
 * ever needed, delete this plugin and enable Push Notifications on the App ID instead.
 */
const { withEntitlementsPlist } = require('expo/config-plugins');

module.exports = function withNoPushEntitlement(config) {
  return withEntitlementsPlist(config, (cfg) => {
    delete cfg.modResults['aps-environment'];
    return cfg;
  });
};
