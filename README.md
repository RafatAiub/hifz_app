# Hifz

Mobile-first, local-first Quran memorization companion built with Expo, React
Native and TypeScript.

## What works

- Zero-decision daily plan with calibration and gentle recovery
- Guided listen, repeat, hidden recall, record, self-review and rating flow
- Integrated IndoPak 13-line content pack interface
- Native SQLite and web IndexedDB storage behind one repository contract
- Downloadable ayah audio cache for native and web
- Guest-first onboarding, optional Supabase email OTP and event sync
- Native reminders, PWA manifest and service worker
- Recording export through the system share sheet

The checked-in content pack intentionally contains only Surah Al-Ikhlas as a
reviewable pilot. Do not label the app as a full Quran release until a
scholar-reviewed 13-line mapping and immutable full content pack have passed the
same integrity tests.

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
