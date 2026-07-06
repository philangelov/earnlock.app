/**
 * ThemeProvider — exposes the active light/dark token object and a persisted theme choice.
 * Mirrors the prototype, which defaults to light (`dark:false`) and stores the choice in
 * localStorage; here we persist to AsyncStorage under `earnlock-theme`.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

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
