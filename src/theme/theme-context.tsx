import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  type PropsWithChildren,
} from 'react';
import { useColorScheme } from 'react-native';

import { useApp } from '@/app-state/provider';
import { darkPalette, lightPalette, resolveTypography, type ColorPalette, type ThemeMode } from '@/theme/tokens';

interface ThemeContextValue {
  mode: ThemeMode;
  preference: 'system' | 'light' | 'dark';
  colors: ColorPalette;
  setPreference(preference: 'system' | 'light' | 'dark'): void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: PropsWithChildren) {
  const systemScheme = useColorScheme();
  const { profile, setThemePreference } = useApp();
  const preference = profile?.themePreference ?? 'system';
  const mode: ThemeMode =
    preference === 'system' ? (systemScheme === 'dark' ? 'dark' : 'light') : preference;
  const colors = mode === 'dark' ? darkPalette : lightPalette;

  const setPreference = useCallback(
    (next: 'system' | 'light' | 'dark') => {
      void setThemePreference(next);
    },
    [setThemePreference],
  );

  const value = useMemo<ThemeContextValue>(
    () => ({ mode, preference, colors, setPreference }),
    [mode, preference, colors, setPreference],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

function useThemeContext() {
  const value = useContext(ThemeContext);
  if (!value) {
    throw new Error('useThemeColors/useThemeMode must be used inside ThemeProvider');
  }
  return value;
}

export function useThemeColors(): ColorPalette {
  return useThemeContext().colors;
}

export function useThemeMode() {
  const { mode, preference, setPreference } = useThemeContext();
  return { mode, preference, setPreference };
}

/** Resolved font families for reading content (Quran text + translation),
 * following the user's Settings choice. See resolveTypography() for why
 * only reading content -- not UI chrome -- switches family. */
export function useTypography() {
  const { profile } = useApp();
  return useMemo(
    () => resolveTypography(profile?.arabicFont ?? 'naskh', profile?.uiFont ?? 'sans'),
    [profile?.arabicFont, profile?.uiFont],
  );
}
