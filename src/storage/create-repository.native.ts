import { openDatabaseAsync, type SQLiteDatabase } from 'expo-sqlite';

import type { MemoryState, SessionEvent, StudentProfile } from '@/domain/types';
import type { StorageRepository } from './repository';

class NativeStorageRepository implements StorageRepository {
  private database: SQLiteDatabase | null = null;

  private async db() {
    if (!this.database) {
      this.database = await openDatabaseAsync('hifz.db');
    }
    return this.database;
  }

  async initialize() {
    const db = await this.db();
    await db.execAsync(`
      PRAGMA journal_mode = WAL;
      CREATE TABLE IF NOT EXISTS kv (
        key TEXT PRIMARY KEY NOT NULL,
        value TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS session_events (
        id TEXT PRIMARY KEY NOT NULL,
        occurred_at TEXT NOT NULL,
        sync_state TEXT NOT NULL,
        payload TEXT NOT NULL
      );
    `);
  }

  private async getValue<T>(key: string): Promise<T | null> {
    const db = await this.db();
    const row = await db.getFirstAsync<{ value: string }>(
      'SELECT value FROM kv WHERE key = ?',
      key,
    );
    return row ? (JSON.parse(row.value) as T) : null;
  }

  private async setValue(key: string, value: unknown) {
    const db = await this.db();
    await db.runAsync(
      `INSERT INTO kv (key, value, updated_at) VALUES (?, ?, ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
      key,
      JSON.stringify(value),
      new Date().toISOString(),
    );
  }

  getProfile() {
    return this.getValue<StudentProfile>('profile');
  }

  saveProfile(profile: StudentProfile) {
    return this.setValue('profile', profile);
  }

  async getMemoryStates() {
    return (await this.getValue<MemoryState[]>('memory-states')) ?? [];
  }

  saveMemoryStates(states: MemoryState[]) {
    return this.setValue('memory-states', states);
  }

  async getSessionEvents() {
    const db = await this.db();
    const rows = await db.getAllAsync<{ payload: string }>(
      'SELECT payload FROM session_events ORDER BY occurred_at DESC',
    );
    return rows.map((row) => JSON.parse(row.payload) as SessionEvent);
  }

  async appendSessionEvent(event: SessionEvent) {
    const db = await this.db();
    await db.runAsync(
      `INSERT OR IGNORE INTO session_events (id, occurred_at, sync_state, payload)
       VALUES (?, ?, ?, ?)`,
      event.id,
      event.occurredAt,
      event.syncState,
      JSON.stringify(event),
    );
  }

  async getPendingEvents() {
    const db = await this.db();
    const rows = await db.getAllAsync<{ payload: string }>(
      `SELECT payload FROM session_events
       WHERE sync_state = 'pending' ORDER BY occurred_at ASC`,
    );
    return rows.map((row) => JSON.parse(row.payload) as SessionEvent);
  }

  async markEventsSynced(ids: string[]) {
    if (ids.length === 0) return;
    const db = await this.db();
    await db.withTransactionAsync(async () => {
      for (const id of ids) {
        const row = await db.getFirstAsync<{ payload: string }>(
          'SELECT payload FROM session_events WHERE id = ?',
          id,
        );
        if (!row) continue;
        const event = JSON.parse(row.payload) as SessionEvent;
        const synced = { ...event, syncState: 'synced' as const };
        await db.runAsync(
          `UPDATE session_events SET sync_state = 'synced', payload = ? WHERE id = ?`,
          JSON.stringify(synced),
          id,
        );
      }
    });
  }
}

export function createStorageRepository() {
  return new NativeStorageRepository();
}
