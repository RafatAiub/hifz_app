#!/usr/bin/env node
// Fetches real per-ayah line/page data for the "IndoPak 16-line" mushaf
// (Quran Foundation content API, mushaf id 7, 548 pages) and writes
// scripts/quran-foundation-16line.json — an intermediate file merged into
// src/data/quran-pack-data.json by merge-quran-pack-layout.mjs.
//
// This replaces the previous placeholder in build-quran-pack.mjs
// (`lineCursor += 2` per ayah, cycling through 13 — no relationship to any
// real printed mushaf) with data traced to an actual 16-line mushaf print,
// confirmed against Quran Foundation's production Content API:
//   - page 1, mushaf=6 (IndoPak 15-line) tops out at line_number 15
//   - page 1, mushaf=7 (IndoPak 16-line) tops out at line_number 16
//   - page 548, mushaf=7 ends on verse_key 114:6 (confirmed last page)
//   - page 549 correctly 404s
//
// Requires QURAN_FOUNDATION_CLIENT_ID / QURAN_FOUNDATION_CLIENT_SECRET in a
// local .env (gitignored, never committed). This runs once, locally, at
// content-build time — the credential is never bundled into the shipped app.
import { writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const PRELIVE = process.env.QURAN_FOUNDATION_ENV !== 'production';
const OAUTH_BASE = PRELIVE
  ? 'https://prelive-oauth2.quran.foundation'
  : 'https://oauth2.quran.foundation';
const CONTENT_API_BASE = PRELIVE
  ? 'https://apis-prelive.quran.foundation'
  : 'https://apis.quran.foundation';

const MUSHAF_ID = 7; // IndoPak 16-line, 548 pages
// Surah 78 (An-Naba) confirmed to start after page 521 (verse_key check);
// scanning from 515 for safety margin through the real last page, 548.
const FIRST_PAGE = 515;
const LAST_PAGE = 548;

async function getAccessToken() {
  const clientId = process.env.QURAN_FOUNDATION_CLIENT_ID;
  const clientSecret = process.env.QURAN_FOUNDATION_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error(
      'Set QURAN_FOUNDATION_CLIENT_ID and QURAN_FOUNDATION_CLIENT_SECRET in your local .env first.',
    );
  }
  const response = await fetch(`${OAUTH_BASE}/oauth2/token`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`,
    },
    body: new URLSearchParams({ grant_type: 'client_credentials', scope: 'content' }),
  });
  if (!response.ok) {
    throw new Error(`Token exchange failed: ${response.status} ${await response.text()}`);
  }
  const { access_token } = await response.json();
  return access_token;
}

async function fetchPage(pageNumber, accessToken, clientId) {
  const url = `${CONTENT_API_BASE}/content/api/v4/verses/by_page/${pageNumber}?mushaf=${MUSHAF_ID}&words=true&word_fields=text_indopak,line_number,page_number`;
  const response = await fetch(url, {
    headers: { 'x-auth-token': accessToken, 'x-client-id': clientId },
  });
  if (!response.ok) {
    throw new Error(`Page ${pageNumber} fetch failed: ${response.status} ${await response.text()}`);
  }
  return response.json();
}

async function main() {
  const accessToken = await getAccessToken();
  const clientId = process.env.QURAN_FOUNDATION_CLIENT_ID;

  // "surah:ayah" -> { page, lineStart, lineEnd, words: [textIndopak...] }
  const lineByAyah = new Map();

  for (let page = FIRST_PAGE; page <= LAST_PAGE; page += 1) {
    const data = await fetchPage(page, accessToken, clientId);
    for (const verse of data.verses ?? []) {
      const [surah, ayah] = verse.verse_key.split(':').map(Number);
      if (surah < 78 || surah > 114 || surah === 112) continue;
      const words = verse.words ?? [];
      const lines = words.map((w) => w.line_number).filter((n) => typeof n === 'number');
      if (lines.length === 0) continue;
      lineByAyah.set(verse.verse_key, {
        page: verse.page_number,
        lineStart: Math.min(...lines),
        lineEnd: Math.max(...lines),
        textIndopak: words.map((w) => w.text_indopak).join(' '),
      });
    }
    await new Promise((resolve) => setTimeout(resolve, 60));
  }

  console.log(`Resolved line data for ${lineByAyah.size} Juz Amma ayahs (expect 564, incl. Al-Ikhlas).`);
  const outPath = new URL('./quran-foundation-16line.json', import.meta.url);
  await writeFile(outPath, JSON.stringify(Object.fromEntries(lineByAyah), null, 2) + '\n', 'utf8');
  console.log(`Wrote ${fileURLToPath(outPath)}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
