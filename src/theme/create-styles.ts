import { useMemo } from 'react';
import { StyleSheet } from 'react-native';

import { useThemeColors } from '@/theme/theme-context';
import type { ColorPalette } from '@/theme/tokens';

export function useThemedStyles<
  T extends StyleSheet.NamedStyles<T> | StyleSheet.NamedStyles<unknown>,
>(factory: (colors: ColorPalette) => T): T {
  const colors = useThemeColors();
  return useMemo(() => StyleSheet.create(factory(colors)), [colors]);
}
