/**
 * Root layout — providers + the native Stack. Uses the system font throughout (no custom font
 * gate), so the first frame is instant. On mount it hydrates the Screen Time facade and mounts
 * the lock-enforcement bridge (store clock → shield/unshield). The splash hides once the
 * persisted theme is ready so the app opens in the user's chosen appearance.
 */
import { Stack, ThemeProvider as NavigationThemeProvider, useRouter, type Href } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useMemo } from 'react';
import { AppState } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import {
  observeNotificationTaps,
  setupNotificationHandler,
  syncDailyReminder,
} from '@/lib/notifications';
import { screenTime } from '@/lib/screenTime';
import { useLockEnforcement } from '@/lib/screenTime/enforcement';
import { useScreenTime } from '@/lib/screenTime/store';
import { useEarnLock } from '@/store/useEarnLock';
import { makeNavTheme } from '@/theme/navTheme';
import { ThemeProvider, useThemeMode, useTokens } from '@/theme/theme';

SplashScreen.preventAutoHideAsync();

function RootNavigator() {
  const t = useTokens();
  const router = useRouter();
  const { dark, ready } = useThemeMode();
  const navTheme = useMemo(() => makeNavTheme(dark, t), [dark, t]);

  // Local notifications: register how they look, and route a tap (or the notification that
  // cold-launched the app) to the quiz it points at.
  useEffect(() => {
    setupNotificationHandler();
    return observeNotificationTaps((url) => router.navigate(url as Href));
  }, [router]);

  // Schedule / cancel the daily study reminder to match the learner's notification choice.
  const notificationsGranted = useEarnLock((s) => s.notificationsGranted);
  useEffect(() => {
    void syncDailyReminder(notificationsGranted);
  }, [notificationsGranted]);

  // Re-read Screen Time on launch and whenever the app returns to the foreground, so status +
  // selection count stay fresh after the system authorization sheet, the app picker, or changes
  // made in iOS Settings.
  //
  // The unlock clock is resynced at the same moment. The window is a server-side deadline, so
  // an hour spent in the background is an hour spent — the countdown must come back reading
  // what the server says, not what the JS timer last managed to tick to before it was frozen.
  const refreshScreenTime = useScreenTime((s) => s.refresh);
  const fetchBalance = useEarnLock((s) => s.fetchBalance);
  useEffect(() => {
    // Install EarnLock's custom lock screen once at launch. It persists in the app group, so
    // a blocked app shows our shield (with the "Start a quiz" deep link) rather than iOS's
    // default — even if the OS re-applies the block after a reboot.
    screenTime.configureShield();
    refreshScreenTime();
    void fetchBalance();
    const sub = AppState.addEventListener('change', (state) => {
      if (state !== 'active') return;
      refreshScreenTime();
      void fetchBalance();
    });
    return () => sub.remove();
  }, [refreshScreenTime, fetchBalance]);

  // The session lives in SecureStore, not in the persisted store, so read it once at launch.
  // Screens gate on `authed` rather than firing requests that can only come back 401.
  const hydrateAuth = useEarnLock((s) => s.hydrateAuth);
  useEffect(() => {
    void hydrateAuth();
  }, [hydrateAuth]);

  // Keep the OS shield in sync with the earn clock for the whole app lifetime.
  useLockEnforcement();

  useEffect(() => {
    if (ready) SplashScreen.hideAsync();
  }, [ready]);

  return (
    <NavigationThemeProvider value={navTheme}>
      <StatusBar style={dark ? 'light' : 'dark'} />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: t.bg } }}>
        {/*
         * The onboarding group is its own nested stack, and it owns going back — the inner stack's
         * per-screen `gestureEnabled` decides whether a step can be swiped away. Leaving the pop
         * gesture on here would give the OUTER navigation controller an edge recogniser too, and
         * it would fire whenever the inner one declines (the two slider steps) — swiping the whole
         * flow back to Welcome instead of doing nothing. Half-finished onboarding should never be
         * one stray swipe from the start.
         */}
        <Stack.Screen name="onboarding" options={{ gestureEnabled: false }} />
        <Stack.Screen
          name="sos"
          options={{
            presentation: 'formSheet',
            sheetGrabberVisible: true,
            sheetAllowedDetents: 'fitToContents',
            sheetCornerRadius: 28,
            contentStyle: { backgroundColor: t.surface },
          }}
        />
        <Stack.Screen
          name="locked"
          options={{ presentation: 'fullScreenModal', animation: 'fade' }}
        />
      </Stack>
    </NavigationThemeProvider>
  );
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <RootNavigator />
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
