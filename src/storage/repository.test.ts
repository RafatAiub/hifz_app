import { describe, expect, it } from 'vitest';

import type { SessionEvent, StudentProfile } from '@/domain/types';
import { MemoryStorageRepository } from '@/storage/repository';

describe('StorageRepository contract', () => {
  it('persists profile and idempotently marks queued events', async () => {
    const repository = new MemoryStorageRepository();
    await repository.initialize();
    const profile: StudentProfile = {
      id: '00000000-0000-4000-8000-000000000001',
      availableMinutes: 20,
      preferredTime: '06:30',
      capacityLinesPerMinute: 0.6,
      calibrationSessions: 0,
      memorizedAyahKeys: [],
      recoveryPreference: 'gentle',
      mushafLayout: 'indopak-13',
      themePreference: 'system',
      lastActiveAt: null,
      createdAt: '2026-07-28T00:00:00.000Z',
      updatedAt: '2026-07-28T00:00:00.000Z',
    };
    await repository.saveProfile(profile);
    expect(await repository.getProfile()).toEqual(profile);

    const event = {
      id: '00000000-0000-4000-8000-000000000002',
      profileId: profile.id,
      type: 'session.completed',
      occurredAt: '2026-07-28T01:00:00.000Z',
      payload: {
        id: '00000000-0000-4000-8000-000000000003',
        planId: 'plan-1',
        profileId: profile.id,
        completedAt: '2026-07-28T01:00:00.000Z',
        completedAyahKeys: ['112:1'],
        repetitions: 5,
        hints: 0,
        rating: 'good',
        recordingUri: null,
        wasInterrupted: false,
      },
      syncState: 'pending',
    } satisfies SessionEvent;
    await repository.appendSessionEvent(event);
    expect(await repository.getPendingEvents()).toHaveLength(1);
    await repository.markEventsSynced([event.id]);
    expect(await repository.getPendingEvents()).toHaveLength(0);
  });
});
