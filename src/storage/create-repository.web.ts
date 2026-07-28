import { openDB, type IDBPDatabase } from 'idb';

import type { MemoryState, SessionEvent, StudentProfile } from '@/domain/types';
import type { StorageRepository } from './repository';

interface HifzDatabase {
  kv: {
    key: string;
    value: unknown;
  };
  events: {
    key: string;
    value: SessionEvent;
    indexes: { 'by-sync-state': string };
  };
}

class WebStorageRepository implements StorageRepository {
  private database: IDBPDatabase<HifzDatabase> | null = null;

  private async db() {
    if (!this.database) {
      this.database = await openDB<HifzDatabase>('hifz', 1, {
        upgrade(database) {
          database.createObjectStore('kv');
          const events = database.createObjectStore('events', { keyPath: 'id' });
          events.createIndex('by-sync-state', 'syncState');
        },
      });
    }
    return this.database;
  }

  async initialize() {
    await this.db();
  }

  async getProfile() {
    return ((await (await this.db()).get('kv', 'profile')) as StudentProfile | undefined) ?? null;
  }

  async saveProfile(profile: StudentProfile) {
    await (await this.db()).put('kv', profile, 'profile');
  }

  async getMemoryStates() {
    return ((await (await this.db()).get('kv', 'memory-states')) as MemoryState[] | undefined) ?? [];
  }

  async saveMemoryStates(states: MemoryState[]) {
    await (await this.db()).put('kv', states, 'memory-states');
  }

  async getSessionEvents() {
    const events = await (await this.db()).getAll('events');
    return events.sort((a, b) => b.occurredAt.localeCompare(a.occurredAt));
  }

  async appendSessionEvent(event: SessionEvent) {
    const db = await this.db();
    if (!(await db.get('events', event.id))) {
      await db.add('events', event);
    }
  }

  async getPendingEvents() {
    return (await this.db()).getAllFromIndex('events', 'by-sync-state', 'pending');
  }

  async markEventsSynced(ids: string[]) {
    const db = await this.db();
    const transaction = db.transaction('events', 'readwrite');
    for (const id of ids) {
      const event = await transaction.store.get(id);
      if (event) {
        await transaction.store.put({ ...event, syncState: 'synced' });
      }
    }
    await transaction.done;
  }
}

export function createStorageRepository() {
  return new WebStorageRepository();
}
