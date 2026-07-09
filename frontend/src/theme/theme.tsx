/**
 * ThemeProvider — exposes the active light/dark token object and a persisted theme choice.
 * Mirrors the prototype, which defaults to light (`dark:false`) and stores the choice in
 * localStorage; here we persist to AsyncStorage under `earnlock-theme`.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Appearance } from 'react-native';

import { DarkTokens, LightTokens, type Tokens } from './tokens';

const STORAGE_KEY = 'earnlock-theme';

type ThemeContextValue = {
  dark: boolean;
  tokens: Tokens;
  setDark: (dark: boolean) => void;
  toggle: () => void;
  ready: boolean;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  // Prototype default is light.
  const [dark, setDarkState] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let active = true;
    AsyncStorage.getItem(STORAGE_KEY)
      .then((value) => {
        if (active && value) setDarkState(value === 'dark');
      })
      .catch(() => {})
      .finally(() => active && setReady(true));
    return () => {
      active = false;
    };
  }, []);

  // The in-app toggle is the single source of truth for appearance. Force the native
  // UIKit trait collection to match it so native chrome the JS theme can't reach —
  // the tab bar, form-sheet grabber/dim, keyboard — follows the toggle too (not the
  // device system setting). Reset to system on unmount.
  // react-native-web has no native trait collection to set — Appearance.setColorScheme
  // isn't implemented there and throws, so this is native-only (iOS/Android).
  useEffect(() => {
    if (process.env.EXPO_OS === 'web') return;
    Appearance.setColorScheme(dark ? 'dark' : 'light');
    return () => Appearance.setColorScheme('unspecified');
  }, [dark]);

  const value = useMemo<ThemeContextValue>(() => {
    const setDark = (next: boolean) => {
      setDarkState(next);
      AsyncStorage.setItem(STORAGE_KEY, next ? 'dark' : 'light').catch(() => {});
    };
    return {
      dark,
      tokens: dark ? DarkTokens : LightTokens,
      setDark,
      toggle: () => setDark(!dark),
      ready,
    };
  }, [dark, ready]);

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

/** Theme mode + setters, for the appearance toggle. */
export function useThemeMode() {
  const { dark, setDark, toggle, ready } = useThemeContext();
  return { dark, setDark, toggle, ready };
}
