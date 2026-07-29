export type ThemeMode = 'light' | 'dark';

export interface ColorPalette {
  canvas: string;
  surface: string;
  surfaceElevated: string;
  ink: string;
  muted: string;
  line: string;
  primary: string;
  primaryPressed: string;
  mint: string;
  coral: string;
  gold: string;
  paleGold: string;
  danger: string;
  white: string;
  overlay: string;
  /** Always-dark accent card background, independent of theme (hero/spotlight blocks). */
  spotlight: string;
  onSpotlight: string;
  onSpotlightMuted: string;
  elevation: {
    card: {
      shadowColor: string;
      shadowOpacity: number;
      shadowRadius: number;
      shadowOffset: { width: number; height: number };
      elevation: number;
    };
  };
}

export const lightPalette: ColorPalette = {
  canvas: '#F6F4EE',
  surface: '#FFFFFF',
  surfaceElevated: '#FFFFFF',
  ink: '#15231D',
  muted: '#5E6E66',
  line: '#E3E0D5',
  primary: '#155C43',
  primaryPressed: '#0E4632',
  mint: '#E1EFE6',
  coral: '#E76F51',
  gold: '#B8862E',
  paleGold: '#F6EDCF',
  danger: '#B83A3A',
  white: '#FFFFFF',
  overlay: 'rgba(15, 23, 18, 0.5)',
  spotlight: '#122A20',
  onSpotlight: '#F3F7F4',
  onSpotlightMuted: '#B9CFC2',
  elevation: {
    card: {
      shadowColor: '#0B140F',
      shadowOpacity: 0.08,
      shadowRadius: 14,
      shadowOffset: { width: 0, height: 6 },
      elevation: 2,
    },
  },
} as const;

export const darkPalette: ColorPalette = {
  canvas: '#0F1712',
  surface: '#161F1A',
  surfaceElevated: '#1C271F',
  ink: '#EDEFE9',
  muted: '#93A399',
  line: 'rgba(237, 239, 233, 0.12)',
  primary: '#3FAE80',
  primaryPressed: '#2F8B65',
  mint: '#1D2E24',
  coral: '#F0836A',
  gold: '#E4B94E',
  paleGold: '#33301C',
  danger: '#E5695F',
  white: '#FFFFFF',
  overlay: 'rgba(0, 0, 0, 0.6)',
  spotlight: '#0C1B15',
  onSpotlight: '#F3F7F4',
  onSpotlightMuted: '#9FBBAD',
  elevation: {
    card: {
      shadowColor: '#000000',
      shadowOpacity: 0.45,
      shadowRadius: 14,
      shadowOffset: { width: 0, height: 6 },
      elevation: 4,
    },
  },
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
} as const;

export const radius = {
  sm: 4,
  md: 8,
  lg: 16,
  full: 999,
} as const;

export const typography = {
  bengali: 'NotoSansBengali',
  bengaliMedium: 'NotoSansBengaliMedium',
  arabic: 'NotoNaskhArabic',
  arabicBold: 'NotoNaskhArabicBold',
} as const;

/**
 * Standard tajweed rule colors (source: alquran.cloud's tajweed-guide
 * legend, cross-checked against the open-source vipafattal/TajweedParser
 * implementation). Fixed across light/dark theme, matching the convention
 * used by quran.com and most tajweed-color Quran apps.
 */
export const tajweedColors = {
  hsl: '#AAAAAA',
  madda_normal: '#537FFF',
  madda_permissible: '#4050FF',
  madda_necessary: '#000EBC',
  madda_obligatory: '#2144C1',
  qalaqah: '#DD0008',
  ikhafa_shafawi: '#D500B7',
  ikhafa: '#9400A8',
  idgham_shafawi: '#58B800',
  iqlab: '#26BFFD',
  idgham_ghunnah: '#169777',
  idgham_no_ghunnah: '#169200',
  idgham_mutajanisayn: '#A1A1A1',
  idgham_mutaqaribayn: '#A1A1A1',
  ghunnah: '#FF7E1E',
} as const;

export type TajweedRule = keyof typeof tajweedColors;
