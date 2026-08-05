import Svg, { Path } from 'react-native-svg';

import { useThemeColors } from '@/theme/theme-context';

/** Sacred crescent emblem: a simple crescent moon with a small star,
 * matching the app's gold accent. Used as a light spiritual touch on the
 * home screen, not as a religious authority mark. */
export function BrandMark({ size = 28, color }: { size?: number; color?: string }) {
  const colors = useThemeColors();
  const fill = color ?? colors.gold;
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M14.5 3.5C10.4 4.6 7.4 8.3 7.4 12.7c0 5.2 4.2 9.4 9.4 9.4 1.6 0 3.1-.4 4.4-1.1-1.5.8-3.2 1.2-5 1.2-6 0-10.9-4.9-10.9-10.9 0-4.7 3-8.7 7.2-10.2-.1 0-.1.1 0 0z"
        fill={fill}
      />
      <Path
        d="M18.8 6.3l.6 1.5 1.5.6-1.5.6-.6 1.5-.6-1.5-1.5-.6 1.5-.6z"
        fill={fill}
      />
    </Svg>
  );
}
