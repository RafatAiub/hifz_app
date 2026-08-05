import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { useApp } from '@/app-state/provider';
import { useThemedStyles } from '@/theme/create-styles';
import { useTypography } from '@/theme/theme-context';
import type { QuranAyah } from '@/domain/types';
import { radius, spacing, type ColorPalette } from '@/theme/tokens';

const BASE_SIZE = 34;
const BASE_LINE_HEIGHT = 60;

/**
 * Word-by-word self-testing: every word starts hidden behind a blank tile.
 * Tap a tile to reveal that word; tap a revealed word to hide it again.
 * Each *new* reveal counts as a hint, same as the old whole-ayah toggle did.
 */
export function MaskedAyah({
  ayah,
  onReveal,
}: {
  ayah: QuranAyah;
  onReveal: () => void;
}) {
  const { profile } = useApp();
  const scale = profile?.arabicTextScale ?? 1;
  const styles = useThemedStyles(createStyles);
  const fonts = useTypography();
  const words = ayah.arabic.split(/\s+/).filter(Boolean);
  const [revealed, setRevealed] = useState<Set<number>>(() => new Set());

  function toggleWord(index: number) {
    setRevealed((current) => {
      const next = new Set(current);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
        onReveal();
      }
      return next;
    });
  }

  return (
    <View style={styles.row} accessibilityLabel="আয়াতের শব্দগুলো লুকানো, টাচ করে দেখুন">
      {words.map((word, index) => {
        const isRevealed = revealed.has(index);
        return (
          <Pressable
            key={index}
            accessibilityRole="button"
            accessibilityLabel={isRevealed ? word : `শব্দ ${index + 1}, লুকানো`}
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
                    fontSize: BASE_SIZE * scale,
                    lineHeight: BASE_LINE_HEIGHT * scale,
                  },
                ]}
              >
                {word}
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
    blank: {
      height: 20,
      borderRadius: radius.sm,
      backgroundColor: colors.line,
    },
  };
}
