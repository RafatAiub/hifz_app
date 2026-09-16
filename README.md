# Hifz

Mobile-first, local-first Quran memorization companion built with Expo, React
Native and TypeScript.

## What works

- SM-2 derived spaced-repetition scheduler with per-item ease factor,
  growing review intervals, and leech detection for stuck ayahs
- Zero-decision daily plan with calibration and gentle recovery
- Guided listen, repeat, hidden recall, record, self-review and rating flow
- Recording review tools: live waveform while recording, A/B toggle against
  the reference recitation, and 0.75x/1x playback speed
- Content pack covering Juz Amma (surahs 78-114) plus the hand-reviewed
  Al-Ikhlas pilot
- Streaks, a per-surah "hifz map," and milestone badges on the progress tab
- Native SQLite and web IndexedDB storage behind one repository contract
- Downloadable ayah audio cache for native and web (service worker on web)
- Guest-first onboarding, optional Supabase email OTP and event sync
- Native reminders, PWA manifest and service worker
- Recording export through the system share sheet

Every ayah in the pack traces to a recognised international source, so each
one ships with `lineDataVerified: true` and the app shows no "unverified"
disclaimer. Surah Al-Ikhlas is the hand-reviewed 13-line pilot
(`lineDataSource: hand-reviewed-tanzil`, guarded by the immutability
checksum test in `src/data/quran-pack.test.ts`). The rest of Juz Amma uses
Tanzil / KFGQPC verse text with Bengali translation, and its line/page
layout comes from the Quran Foundation Content API — the published IndoPak
16-line mushaf (mushaf id 7), the same layout quran.com serves
(`lineDataSource: quran-foundation-indopak-16`). Regenerate the Juz Amma
data with `node scripts/build-quran-pack.mjs`, then re-run
`node scripts/build-quran-pack-layout.mjs` and
`node scripts/merge-quran-pack-layout.mjs` so the shipped layout numbers
stay tied to that mushaf and not the build-time placeholder.

## Run

Node 22.13 or newer is recommended.

```powershell
npm install
npm run web
```

For Android development:

```powershell
npm run android
```

Optional cloud backup uses the values from `.env.example`. The app remains
fully usable without them.
