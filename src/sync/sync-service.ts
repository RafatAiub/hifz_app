import { createClient } from '@supabase/supabase-js';

import type { StorageRepository } from '@/storage/repository';

export async function syncPendingEvents(repository: StorageRepository) {
  const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
  const key = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return { configured: false, synced: 0 };

  const supabase = createClient(url, key);
  const events = await repository.getPendingEvents();
  if (events.length === 0) return { configured: true, synced: 0 };

  const { error } = await supabase.from('session_events').upsert(
    events.map((event) => ({
      id: event.id,
      profile_id: event.profileId,
      event_type: event.type,
      occurred_at: event.occurredAt,
      payload: event.payload,
    })),
    { onConflict: 'id' },
  );
  if (error) throw error;
  await repository.markEventsSynced(events.map((event) => event.id));
  return { configured: true, synced: events.length };
}
