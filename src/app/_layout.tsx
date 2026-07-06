import {
  Baloo2_500Medium,
  Baloo2_600SemiBold,
  Baloo2_700Bold,
  Baloo2_800ExtraBold,
} from '@expo-google-fonts/baloo-2';
import {
  Nunito_400Regular,
  Nunito_600SemiBold,
  Nunito_700Bold,
  Nunito_800ExtraBold,
  Nunito_900Black,
} from '@expo-google-fonts/nunito';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { ThemeProvider, useThemeMode, useTokens } from '@/theme/theme';

SplashScreen.preventAutoHideAsync();

function RootNavigator() {
  const t = useTokens();
  const { dark } = useThemeMode();
  return (
    <>
      <StatusBar style={dark ? 'light' : 'dark'} />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: t.bg },
        }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="grade" />
        <Stack.Screen name="subjects" />
        <Stack.Screen name="import" />
        <Stack.Screen name="blacklist" />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="quiz" />
        <Stack.Screen name="learning" />
        <Stack.Screen name="recap" />
        <Stack.Screen name="earned" />
        <Stack.Screen name="wakeup" />
        <Stack.Screen
          name="sos"
          options={{ presentation: 'transparentModal', animation: 'fade' }}
        />
      </Stack>
    </>
  );
}

export default function RootLayout() {
  const [loaded] = useFonts({
    Nunito_400Regular,
    Nunito_600SemiBold,
    Nunito_700Bold,
    Nunito_800ExtraBold,
    Nunito_900Black,
    Baloo2_500Medium,
    Baloo2_600SemiBold,
    Baloo2_700Bold,
    Baloo2_800ExtraBold,
  });

  useEffect(() => {
    if (loaded) SplashScreen.hideAsync();
  }, [loaded]);

  if (!loaded) return null;

  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <RootNavigator />
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
