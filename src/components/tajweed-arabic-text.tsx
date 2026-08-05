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
export function TajweedArabicText({
  ayahKey,
  text,
  style,
  trailing,
  trailingStyle,
}: {
  ayahKey: string;
  text: string;
  style: StyleProp<TextStyle>;
  /** Rendered as one more inline run at the end of the verse, e.g. the
   * traditional ۝ end-of-ayah ornament with its verse number. */
  trailing?: string;
  trailingStyle?: StyleProp<TextStyle>;
}) {
  const segments = segmentsByAyah[ayahKey];
  if (!segments) {
    return (
      <Text selectable style={style}>
        {text}
        {trailing ? <Text style={trailingStyle}>{trailing}</Text> : null}
      </Text>
    );
  }

  return (
    <Text selectable style={style}>
      {segments.map((segment, index) => (
        <Fragment key={index}>
          {segment.rule ? (
            <Text style={{ color: tajweedColors[segment.rule] }}>{segment.text}</Text>
          ) : (
            segment.text
          )}
        </Fragment>
      ))}
      {trailing ? <Text style={trailingStyle}>{trailing}</Text> : null}
    </Text>
  );
}
