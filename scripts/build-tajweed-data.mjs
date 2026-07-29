#!/usr/bin/env node
// Fetches tajweed (recitation-rule) color markup from the alquran.cloud
// "quran-tajweed" edition and overlays it onto this app's existing Arabic
// verse text for Juz Amma (surahs 78-114).
//
// Safety rule: a verse's colored segments are only kept if the tajweed
// source's text has the same consonant skeleton (rasm) as this app's
// existing `arabic` field for that (surah, ayah) key -- see rasmOf() below
// for why that's a safe equivalence check, not a loosening of accuracy.
// Any mismatch is skipped (that ayah falls back to plain, uncolored text)
// rather than risk misrepresenting a tajweed rule or silently altering
// verse text -- see the Al-Ikhlas immutability guard in quran-pack.test.ts,
// which this script must never touch.
//
// Bracket format from the API, e.g. "عَنِ [h:14239[ٱ][l[ل]...":
//   [<code>[<text>]   -- code is one of "hslnpmqocfwiaudbg", optionally
//                        suffixed with ":<id>" (an internal reference id,
//                        ignored here). <text> gets colored by rule.
// Algorithm and color values verified against two independent sources:
// alquran.cloud's own tajweed-guide legend, and the open-source
// vipafattal/TajweedParser Kotlin implementation (matching hex values).
import { writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

import generatedPack from '../src/data/quran-pack-data.json' with { type: 'json' };

const SURAH_START = 78;
const SURAH_END = 114;

// Hand-reviewed pilot text (must stay byte-identical to src/data/quran-pack.ts).
const AL_IKHLAS_ARABIC = {
  '112:1': 'قُلْ هُوَ ٱللَّهُ أَحَدٌ',
  '112:2': 'ٱللَّهُ ٱلصَّمَدُ',
  '112:3': 'لَمْ يَلِدْ وَلَمْ يُولَدْ',
  '112:4': 'وَلَمْ يَكُن لَّهُۥ كُفُوًا أَحَدٌ',
};

const RULES_BY_CODE = {
  h: 'hsl',
  l: 'hsl',
  s: 'hsl',
  n: 'madda_normal',
  p: 'madda_permissible',
  m: 'madda_necessary',
  q: 'qalaqah',
  o: 'madda_obligatory',
  c: 'ikhafa_shafawi',
  f: 'ikhafa',
  w: 'idgham_shafawi',
  i: 'iqlab',
  a: 'idgham_ghunnah',
  u: 'idgham_no_ghunnah',
  d: 'idgham_mutajanisayn',
  b: 'idgham_mutaqaribayn',
  g: 'ghunnah',
};
const META_CHARS = Object.keys(RULES_BY_CODE).join('');

// Ports the validated split/apply algorithm from vipafattal/TajweedParser
// (Kotlin) to JS: strip brackets/digits/colons, tokenize around meta chars
// and "]", then color the token right after each meta char.
function parseTajweedText(rawText) {
  const stripped = rawText.replace(new RegExp(`[\\[0-9:]`, 'g'), '');
  const tokens = stripped.split(new RegExp(`(?<=[\\]${META_CHARS}])|(?=[\\]${META_CHARS}])`, 'g'));

  const segments = [];
  let pendingRule = null;
  for (const token of tokens) {
    if (token.length === 0) continue;
    if (token.length === 1 && META_CHARS.includes(token)) {
      pendingRule = RULES_BY_CODE[token];
      continue;
    }
    if (token === ']') continue;
    if (pendingRule) {
      segments.push({ text: token, rule: pendingRule });
      pendingRule = null;
    } else {
      segments.push({ text: token, rule: null });
    }
  }

  // Merge adjacent same-rule segments for a smaller, cleaner payload.
  const merged = [];
  for (const seg of segments) {
    const prev = merged[merged.length - 1];
    if (prev && prev.rule === seg.rule) {
      prev.text += seg.text;
    } else {
      merged.push({ ...seg });
    }
  }
  return merged;
}

function plainTextOf(segments) {
  return segments.map((seg) => seg.text).join('');
}

// The KFGQPC Uthmani source (this fetch) and this app's existing Tanzil-
// derived text are two independent digitizations of the same canonical
// Hafs-'an-'Asim mus-haf. They disagree on *which diacritic codepoint*
// renders a given mark (e.g. plain sukun U+0652 vs the small-high-rounded-
// zero U+06E1 KFGQPC uses in some contexts for tajweed cueing, or tanwin
// variants U+064B vs U+0657/U+065E) -- a font/typography convention, not a
// wording difference. Since both sides are keyed to the same fixed
// (surah, ayah) position of the same standard riwayah, a matching
// consonant skeleton (rasm) is sufficient proof it's the same verse text;
// only the base letters are load-bearing for that check. Diacritic marks
// are stripped for comparison ONLY -- the rendered segment text keeps
// every mark exactly as the tajweed source wrote it.
//
// Range covers U+064B-U+065F (harakat, tanwin, shadda, sukun and small
// Quranic marks), U+0670 (superscript/dagger alef), and U+06D6-U+06ED
// (Quranic annotation signs, incl. U+06E1 small-high-rounded-zero).
const ARABIC_DIACRITICS = /[ً-ٰٟۖ-ۭ]/g;
function rasmOf(text) {
  return text.normalize('NFC').replace(ARABIC_DIACRITICS, '');
}

async function fetchSurahTajweed(number) {
  const response = await fetch(`https://api.alquran.cloud/v1/surah/${number}/quran-tajweed`);
  if (!response.ok) throw new Error(`Failed to fetch surah ${number}: ${response.status}`);
  const json = await response.json();
  return json.data.ayahs;
}

async function main() {
  const existingArabic = new Map();
  for (const ayah of generatedPack.ayahs) {
    existingArabic.set(ayah.key, ayah.arabic);
  }
  for (const [key, arabic] of Object.entries(AL_IKHLAS_ARABIC)) {
    existingArabic.set(key, arabic);
  }

  const output = {};
  let matched = 0;
  let skipped = 0;
  const mismatches = [];

  for (let number = SURAH_START; number <= SURAH_END; number += 1) {
    const tajweedAyahs = await fetchSurahTajweed(number);
    tajweedAyahs.forEach((ayah, index) => {
      const key = `${number}:${index + 1}`;
      const existing = existingArabic.get(key);
      if (!existing) return;

      // NFC-normalize segment text: canonical-equivalence only (e.g. this
      // source may order shadda before fatha where our text orders fatha
      // first -- same codepoints, different combining-mark sequence), never
      // a content change.
      const segments = parseTajweedText(ayah.text).map((seg) => ({
        ...seg,
        text: seg.text.normalize('NFC'),
      }));
      const plain = plainTextOf(segments);
      const existingNfc = existing.normalize('NFC');

      // Hand-reviewed, immutable content (Al-Ikhlas, surah 112 -- see
      // quran-pack.test.ts) requires a byte-exact match. Everything else is
      // already-flagged "unreviewed" Juz Amma content, where a rasm-level
      // match (diacritic-convention differences only, see rasmOf() above)
      // is an acceptable bar for showing tajweed color.
      const isHandReviewed = number === 112;
      const isSafeMatch = isHandReviewed
        ? plain === existingNfc
        : rasmOf(plain) === rasmOf(existingNfc);

      if (isSafeMatch) {
        output[key] = segments.map((seg) => (seg.rule ? seg : { text: seg.text }));
        matched += 1;
      } else {
        skipped += 1;
        mismatches.push(key);
      }
    });
  }

  const outPath = new URL('../src/data/quran-tajweed-data.json', import.meta.url);
  await writeFile(outPath, JSON.stringify(output, null, 2) + '\n', 'utf8');

  console.log(`Tajweed coverage: ${matched} matched, ${skipped} skipped (rasm mismatch).`);
  if (mismatches.length) {
    console.log('Skipped keys (fallback to plain text):', mismatches.join(', '));
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
