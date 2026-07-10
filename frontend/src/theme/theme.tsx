/**
 * ThemeProvider — exposes the active light/dark token object and the persisted appearance choice.
 *
 * Three modes. `system` is the default and follows the device, which is what a first launch should
 * do: the native splash screen already follows the system appearance (`userInterfaceStyle` is
 * `automatic` in app.json), so anything else means launching into one appearance and landing in
 * another. `light` and `dark` are explicit overrides, chosen in Profile and persisted under
 * `earnlock-theme`.
 *
 * An explicit override also forces the native UIKit trait collection, so the chrome the JS theme
 * can't reach — the tab bar, the form-sheet grabber and dim, the keyboard — follows the choice
 * rather than the device. In `system` mode we set it back to `unspecified` and let the OS drive.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Appearance, useColorScheme } from 'react-native';

import { DarkTokens, LightTokens, type Tokens } from './tokens';

const STORAGE_KEY = 'earnlock-theme';

export type ThemeMode = 'system' | 'light' | 'dark';

const MODES: readonly ThemeMode[] = ['system', 'light', 'dark'];

const isMode = (value: string | null): value is ThemeMode =>
  value != null && (MODES as readonly string[]).includes(value);

type ThemeContextValue = {
  dark: boolean;
  mode: ThemeMode;
  tokens: Tokens;
  setMode: (mode: ThemeMode) => void;
  ready: boolean;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  // In `system` mode nothing overrides the appearance, so this tracks the device live. Under an
  // explicit override it reports the override instead — which is why `dark` below only consults it
  // when the mode is `system`.
  const system = useColorScheme();

  const [mode, setModeState] = useState<ThemeMode>('system');
  const [ready, setReady] = useState(false);

  // A value written before this release is a bare 'light' | 'dark' — still a valid explicit mode,
  // so an existing choice survives the upgrade rather than being reset to system.
  useEffect(() => {
    let active = true;
    AsyncStorage.getItem(STORAGE_KEY)
      .then((value) => {
        if (active && isMode(value)) setModeState(value);
      })
      .catch(() => {})
      .finally(() => active && setReady(true));
    return () => {
      active = false;
    };
  }, []);

  const dark = mode === 'system' ? system === 'dark' : mode === 'dark';

  // react-native-web has no native trait collection to set — Appearance.setColorScheme isn't
  // implemented there and throws, so this is native-only (iOS/Android).
  useEffect(() => {
    if (process.env.EXPO_OS === 'web') return;
    Appearance.setColorScheme(mode === 'system' ? 'unspecified' : mode);
    return () => Appearance.setColorScheme('unspecified');
  }, [mode]);

  const value = useMemo<ThemeContextValue>(() => {
    const setMode = (next: ThemeMode) => {
      setModeState(next);
      AsyncStorage.setItem(STORAGE_KEY, next).catch(() => {});
    };
    return {
      dark,
      mode,
      tokens: dark ? DarkTokens : LightTokens,
      setMode,
      ready,
    };
  }, [dark, mode, ready]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

function useThemeContext(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within a ThemeProvider');
  return ctx;
}

/** The active token object — the primary hook screens use for colors. */
export function useTokens(): Tokens {
  return useThemeContext().tokens;
}

/** Resolved appearance + the mode behind it, for the Profile control. */
export function useThemeMode() {
  const { dark, mode, setMode, ready } = useThemeContext();
  return { dark, mode, setMode, ready };
}
