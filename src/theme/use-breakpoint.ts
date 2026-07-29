import { useWindowDimensions } from 'react-native';

export type Breakpoint = 'compact' | 'base' | 'wide';

export function useBreakpoint(): Breakpoint {
  const { width } = useWindowDimensions();
  if (width < 360) return 'compact';
  if (width >= 900) return 'wide';
  return 'base';
}
