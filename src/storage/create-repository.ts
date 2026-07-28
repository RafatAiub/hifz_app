import { MemoryStorageRepository } from './repository';

export function createStorageRepository() {
  return new MemoryStorageRepository();
}
