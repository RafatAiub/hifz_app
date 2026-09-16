import type {
  MemoryState,
  MistakeRecord,
  RecitationTestSummary,
  SessionEvent,
  StudentProfile,
} from '@/domain/types';

export interface StorageRepository {
  initialize(): Promise<void>;
  getProfile(): Promise<StudentProfile | null>;
  saveProfile(profile: StudentProfile): Promise<void>;
  getMemoryStates(): Promise<MemoryState[]>;
  saveMemoryStates(states: MemoryState[]): Promise<void>;
  getMistakes(): Promise<MistakeRecord[]>;
  saveMistakes(mistakes: MistakeRecord[]): Promise<void>;
  getRecitationTests(): Promise<RecitationTestSummary[]>;
  saveRecitationTests(tests: RecitationTestSummary[]): Promise<void>;
  getSessionEvents(): Promise<SessionEvent[]>;
  appendSessionEvent(event: SessionEvent): Promise<void>;
  getPendingEvents(): Promise<SessionEvent[]>;
  markEventsSynced(ids: string[]): Promise<void>;
}

export class MemoryStorageRepository implements StorageRepository {
  private profile: StudentProfile | null = null;
  private memoryStates: MemoryState[] = [];
  private mistakes: MistakeRecord[] = [];
  private recitationTests: RecitationTestSummary[] = [];
  private events: SessionEvent[] = [];

  async initialize() {}

  async getProfile() {
    return this.profile;
  }

  async saveProfile(profile: StudentProfile) {
    this.profile = profile;
  }

  async getMemoryStates() {
    return this.memoryStates;
  }

  async saveMemoryStates(states: MemoryState[]) {
    this.memoryStates = states;
  }

  async getMistakes() {
    return this.mistakes;
  }

  async saveMistakes(mistakes: MistakeRecord[]) {
    this.mistakes = mistakes;
  }

  async getRecitationTests() {
    return this.recitationTests;
  }

  async saveRecitationTests(tests: RecitationTestSummary[]) {
    this.recitationTests = tests;
  }

  async getSessionEvents() {
    return this.events;
  }

  async appendSessionEvent(event: SessionEvent) {
    if (!this.events.some((item) => item.id === event.id)) {
      this.events.push(event);
    }
  }

  async getPendingEvents() {
    return this.events.filter((event) => event.syncState === 'pending');
  }

  async markEventsSynced(ids: string[]) {
    const syncedIds = new Set(ids);
    this.events = this.events.map((event) =>
      syncedIds.has(event.id) ? { ...event, syncState: 'synced' } : event,
    );
  }
}
