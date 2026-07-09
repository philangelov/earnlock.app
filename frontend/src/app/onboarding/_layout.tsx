/**
 * Onboarding stack — the linear first-run flow. Questions push with the platform's default slide,
 * so the back-swipe means "change my answer". Some screens opt out of that:
 *
 *  - `screentime` and `pace` own a horizontal drag. The interactive-pop recogniser is a native
 *    gesture, not part of React Native's responder system, so the slider cannot refuse it from JS —
 *    dragging the thumb would pop the screen. They keep the back chevron instead.
 *  - `calculating` auto-advances, and swiping back into a screen about to replace itself leaves
 *    the flow in a state the user can't reason about.
 *  - `greeting` and `reveal` are moments rather than questions, so they fade in — but they stay
 *    swipeable, since going back just returns to the last thing that was asked.
 *
 * Disabling the gesture here is only half the job: this stack is nested inside the root one, whose
 * `onboarding` screen has an edge recogniser of its own that fires whenever this stack's declines.
 * The root layout turns that one off — see `app/_layout.tsx`.
 */
import { Stack } from 'expo-router';

import { useTokens } from '@/theme/theme';

export default function OnboardingLayout() {
  const t = useTokens();
  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: t.bg } }}>
      <Stack.Screen name="greeting" options={{ animation: 'fade' }} />
      <Stack.Screen name="screentime" options={{ gestureEnabled: false }} />
      <Stack.Screen name="pace" options={{ gestureEnabled: false }} />
      <Stack.Screen name="calculating" options={{ animation: 'fade', gestureEnabled: false }} />
      <Stack.Screen name="reveal" options={{ animation: 'fade' }} />
    </Stack>
  );
}
