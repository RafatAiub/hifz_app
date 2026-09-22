import { Fragment } from 'react';
import { Text, type StyleProp, type TextStyle } from 'react-native';

import tajweedData from '@/data/quran-tajweed-data.json';
import { tajweedColors, type TajweedRule } from '@/theme/tokens';

type TajweedSegment = { text: string; rule?: TajweedRule };
const segmentsByAyah = tajweedData as Record<string, TajweedSegment[]>;

/**
 * Renders an ayah's Arabic text with tajweed (recitation-rule) coloring
 * where available. Falls back to plain text for ayahs whose consonant
 * skeleton didn't verify against this app's existing verse text -- see
 * scripts/build-tajweed-data.mjs for why some ayahs don't have coverage.
 */
function sanitizeArabic(str: string): string {
  if (!str) return str;
  return str
    .replace(/\u065E/g, '\u064C')
    .replace(/\u0657/g, '\u064B')
    .replace(/\u0656/g, '\u064D');
}

export function TajweedArabicText({
  ayahKey,
  text,
  style,
  suffix,
}: {
  ayahKey: string;
  text: string;
  style: StyleProp<TextStyle>;
  suffix?: React.ReactNode;
}) {
  const segments = segmentsByAyah[ayahKey];
  if (!segments) {
    return (
      <Text selectable style={style}>
        {sanitizeArabic(text)}
        {suffix}
      </Text>
    );
  }

  return (
    <Text selectable style={style}>
      {segments.map((segment, index) => (
        <Fragment key={index}>
          {segment.rule ? (
            <Text style={{ color: tajweedColors[segment.rule] }}>{sanitizeArabic(segment.text)}</Text>
          ) : (
            sanitizeArabic(segment.text)
          )}
        </Fragment>
      ))}
      {suffix}
    </Text>
  );
}
