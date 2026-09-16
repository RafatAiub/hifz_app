import { useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { useApp } from '@/app-state/provider';
import { useThemedStyles } from '@/theme/create-styles';
import { useThemeColors, useTypography } from '@/theme/theme-context';
import type { QuranAyah } from '@/domain/types';
import { getWordSkeletons } from '@/domain/tajweed-words';
import {
  ARABIC_READING_LINE_HEIGHT,
  ARABIC_READING_SIZE,
  radius,
  spacing,
  tajweedColors,
  type ColorPalette,
} from '@/theme/tokens';

export type MaskLevel = 0 | 1 | 2;

/** Graduated word cues. Revealing a masked word is recorded as a hint. */
export function MaskedAyah({
  ayah,
  maskLevel,
  onReveal,
}: {
  ayah: QuranAyah;
  maskLevel: MaskLevel;
  onReveal: (wordIndex: number) => void;
}) {
  const { profile } = useApp();
  const scale = profile?.arabicTextScale ?? 1;
  const styles = useThemedStyles(createStyles);
  const colors = useThemeColors();
  const fonts = useTypography();
  const words = getWordSkeletons(ayah.key, ayah.arabic);
  const [revealed, setRevealed] = useState<Set<number>>(() => new Set());

  useEffect(() => setRevealed(new Set()), [ayah.key, maskLevel]);

  function toggleWord(index: number) {
    setRevealed((current) => {
      const next = new Set(current);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
        onReveal(index);
      }
      return next;
    });
  }

  return (
    <View
      style={styles.row}
      accessibilityLabel={
        maskLevel === 0 ? 'সম্পূর্ণ আয়াত দেখা যাচ্ছে' : 'শব্দে ট্যাপ করলে সম্পূর্ণ শব্দ দেখা যাবে'
      }
    >
      {words.map(({ word, skeleton, rule }, index) => {
        const isRevealed = maskLevel === 0 || revealed.has(index);
        return (
          <Pressable
            key={index}
            accessibilityRole="button"
            accessibilityState={{ disabled: maskLevel === 0 }}
            accessibilityLabel={isRevealed ? word : `শব্দ ${index + 1}, লুকানো`}
            disabled={maskLevel === 0}
            onPress={() => toggleWord(index)}
            style={({ pressed }) => [
              styles.tile,
              !isRevealed && styles.tileHidden,
              pressed && styles.tilePressed,
            ]}
          >
            {isRevealed ? (
              <Text
                style={[
                  styles.word,
                  {
                    fontFamily: fonts.arabicBold,
                    fontSize: ARABIC_READING_SIZE * scale,
                    lineHeight: ARABIC_READING_LINE_HEIGHT * scale,
                  },
                ]}
              >
                {word}
              </Text>
            ) : maskLevel === 1 ? (
              <Text
                style={[
                  styles.skeleton,
                  {
                    color: rule ? tajweedColors[rule] : colors.primary,
                    fontFamily: fonts.arabicBold,
                    fontSize: ARABIC_READING_SIZE * scale,
                    lineHeight: ARABIC_READING_LINE_HEIGHT * scale,
                  },
                ]}
              >
                {skeleton}
              </Text>
            ) : (
              <View
                style={[
                  styles.blank,
                  { width: Math.min(72, 14 + word.length * 9) * scale },
                ]}
              />
            )}
          </Pressable>
        );
      })}
    </View>
  );
}

function createStyles(colors: ColorPalette) {
  return {
    row: {
      flexDirection: 'row-reverse' as const,
      flexWrap: 'wrap' as const,
      justifyContent: 'flex-start' as const,
      gap: spacing.sm,
    },
    tile: {
      minHeight: 44,
      justifyContent: 'center' as const,
      alignItems: 'center' as const,
      paddingHorizontal: spacing.xs,
      borderRadius: radius.sm,
    },
    tileHidden: {
      backgroundColor: colors.mint,
    },
    tilePressed: {
      opacity: 0.7,
    },
    word: {
      color: colors.ink,
      writingDirection: 'rtl' as const,
    },
    skeleton: {
      writingDirection: 'rtl' as const,
      minWidth: 22,
      textAlign: 'center' as const,
    },
    blank: {
      height: 20,
      borderRadius: radius.sm,
      backgroundColor: colors.line,
    },
  };
}
