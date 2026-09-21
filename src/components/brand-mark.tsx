import { Image, View, StyleSheet } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { useThemeColors } from '@/theme/theme-context';

/** Sacred emblem: renders the 3D Holy Quran icon by default, with an optional
 * fallback or vector variant. Used as a high-fidelity spiritual touch on the
 * home screen and navigation bars. */
export function BrandMark({
  size = 36,
  color,
  variant = '3d',
}: {
  size?: number;
  color?: string;
  variant?: '3d' | 'vector';
}) {
  const colors = useThemeColors();
  const fill = color ?? colors.gold;

  if (variant === '3d') {
    return (
      <View
        style={[
          styles.imageContainer,
          {
            width: size,
            height: size,
            borderRadius: size * 0.26,
            borderColor: colors.gold,
          },
        ]}
      >
        <Image
          source={require('../../assets/icon.png')}
          style={{ width: size, height: size, borderRadius: size * 0.26 }}
          resizeMode="cover"
        />
      </View>
    );
  }

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

const styles = StyleSheet.create({
  imageContainer: {
    overflow: 'hidden',
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 3,
  },
});
