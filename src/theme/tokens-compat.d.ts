declare module '@/theme/tokens' {
  export const colors: {
    canvas: string;
    surface: string;
    ink: string;
    muted: string;
    line: string;
    primary: string;
    primaryPressed: string;
    primarySoft: string;
    mint: string;
    coral: string;
    gold: string;
    paleGold: string;
    danger: string;
    white: string;
  };
  export const spacing: Record<'xs' | 'sm' | 'md' | 'lg' | 'xl' | 'xxl', number>;
  export const radius: Record<'sm' | 'md', number>;
  export const radii: Record<'sm' | 'md', number>;
  export const typography: {
    bengali: string;
    bengaliMedium: string;
    arabic: string;
  };
  export const type: {
    bengali: string;
    bengaliMedium: string;
    arabic: string;
  };
}
