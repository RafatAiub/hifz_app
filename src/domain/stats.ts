import type {
  AyahKey,
  HifzVelocity,
  Milestone,
  QuranContentPack,
  SessionEvent,
  StreakState,
  SurahForecast,
  SurahProgress,
} from './types';

const DAY_MS = 24 * 60 * 60 * 1000;
const STREAK_MILESTONE_DAYS = [3, 7, 14, 30, 60, 100];
const AYAH_MILESTONE_COUNTS = [10, 25, 50, 100, 250, 500];
const VELOCITY_WINDOW_DAYS = 14;

function toDateKey(iso: string): string {
  return iso.slice(0, 10);
}

function daysBetween(a: string, b: string): number {
  return Math.round((new Date(`${b}T00:00:00.000Z`).getTime() -
    new Date(`${a}T00:00:00.000Z`).getTime()) / DAY_MS);
}

export function computeStreak(events: SessionEvent[], now: Date = new Date()): StreakState {
  const dateKeys = Array.from(new Set(events.map((event) => toDateKey(event.occurredAt)))).sort();
  if (dateKeys.length === 0) {
    return { currentStreak: 0, longestStreak: 0, lastCompletedDate: null };
  }

  let longestStreak = 1;
  let runLength = 1;
  for (let i = 1; i < dateKeys.length; i += 1) {
    const gap = daysBetween(dateKeys[i - 1]!, dateKeys[i]!);
    runLength = gap === 1 ? runLength + 1 : 1;
    longestStreak = Math.max(longestStreak, runLength);
  }

  const lastCompletedDate = dateKeys[dateKeys.length - 1]!;
  const todayKey = toDateKey(now.toISOString());
  const gapFromToday = daysBetween(lastCompletedDate, todayKey);

  let currentStreak = 0;
  if (gapFromToday <= 1) {
    currentStreak = 1;
    for (let i = dateKeys.length - 1; i > 0; i -= 1) {
      if (daysBetween(dateKeys[i - 1]!, dateKeys[i]!) === 1) {
        currentStreak += 1;
      } else {
        break;
      }
    }
  }

  return { currentStreak, longestStreak, lastCompletedDate };
}

export function computeSurahProgress(
  memorizedKeys: AyahKey[],
  contentPack: QuranContentPack,
): SurahProgress[] {
  const memorized = new Set(memorizedKeys);
  return contentPack.surahs.map((surah) => {
    const surahAyahs = contentPack.ayahs.filter((ayah) => ayah.surahNumber === surah.number);
    const memorizedCount = surahAyahs.filter((ayah) => memorized.has(ayah.key)).length;
    return {
      surahNumber: surah.number,
      nameBn: surah.nameBn,
      nameArabic: surah.nameArabic,
      memorizedCount,
      totalCount: surah.ayahCount,
    };
  });
}

/**
 * Average newly-memorized ayahs per day over the trailing window. Uses
 * `newAyahKeys` (ayahs from 'new' hifz steps only) so review sessions don't
 * inflate the pace -- see the SessionResult.newAyahKeys doc comment.
 */
export function computeVelocity(
  events: SessionEvent[],
  now: Date = new Date(),
  windowDays: number = VELOCITY_WINDOW_DAYS,
): HifzVelocity {
  const cutoff = now.getTime() - windowDays * DAY_MS;
  const newAyahsInWindow = new Set<AyahKey>();
  for (const event of events) {
    if (new Date(event.occurredAt).getTime() < cutoff) continue;
    for (const key of event.payload.newAyahKeys ?? []) {
      newAyahsInWindow.add(key);
    }
  }
  return {
    ayahsPerDay: newAyahsInWindow.size / windowDays,
    windowDays,
  };
}

/**
 * Forecasts days remaining for every surah that's partially (but not
 * fully) memorized, using the current velocity. Returns null for
 * `daysLeft` when velocity is 0 -- not enough recent data, not "never".
 */
export function computeSurahForecasts(
  surahProgress: SurahProgress[],
  velocity: HifzVelocity,
): SurahForecast[] {
  return surahProgress
    .filter((surah) => surah.memorizedCount > 0 && surah.memorizedCount < surah.totalCount)
    .map((surah) => {
      const remainingAyahs = surah.totalCount - surah.memorizedCount;
      const daysLeft =
        velocity.ayahsPerDay > 0 ? Math.ceil(remainingAyahs / velocity.ayahsPerDay) : null;
      return {
        surahNumber: surah.surahNumber,
        nameBn: surah.nameBn,
        remainingAyahs,
        daysLeft,
      };
    });
}

export function computeMilestones(
  events: SessionEvent[],
  memorizedKeys: AyahKey[],
  contentPack: QuranContentPack,
  streak: StreakState,
): Milestone[] {
  const achievedAt = events[0]?.occurredAt ?? new Date().toISOString();
  const milestones: Milestone[] = [];

  const surahProgress = computeSurahProgress(memorizedKeys, contentPack);
  for (const surah of surahProgress) {
    if (surah.totalCount > 0 && surah.memorizedCount >= surah.totalCount) {
      milestones.push({
        id: `surah-complete-${surah.surahNumber}`,
        kind: 'surah-complete',
        titleBn: `সূরা ${surah.nameBn} সম্পূর্ণ মুখস্থ`,
        achievedAt,
      });
    }
  }

  for (const days of STREAK_MILESTONE_DAYS) {
    if (streak.longestStreak >= days) {
      milestones.push({
        id: `streak-${days}`,
        kind: 'streak',
        titleBn: `${days} দিনের ধারাবাহিকতা`,
        achievedAt,
      });
    }
  }

  for (const count of AYAH_MILESTONE_COUNTS) {
    if (memorizedKeys.length >= count) {
      milestones.push({
        id: `ayah-count-${count}`,
        kind: 'ayah-count',
        titleBn: `${count}টি আয়াত মুখস্থ`,
        achievedAt,
      });
    }
  }

  return milestones;
}
