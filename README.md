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

Surah Al-Ikhlas is the only hand-reviewed, scholar-mapped 13-line content in
the pack (see `lineDataVerified` on each ayah and the immutability checksum
test in `src/data/quran-pack.test.ts`). The rest of Juz Amma uses Tanzil-
derived Arabic text and Bengali translation with an evenly-split, unreviewed
line/page layout — the app surfaces an in-app notice on those surahs and
must not be described as having a scholar-reviewed full 13-line mushaf until
that mapping is independently verified. Regenerate the Juz Amma data with
`node scripts/build-quran-pack.mjs`.

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
