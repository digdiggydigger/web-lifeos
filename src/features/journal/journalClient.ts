/** `JournalClientAdapting`, the seam `JournalService` is tested through, plus the Firebase conformance. */
import type { Firestore } from 'firebase/firestore';

import { newLog } from '@/data/codec/payloads/logs';
import * as captures from '@/data/repos/capturesRepo';
import * as focus from '@/data/repos/focusSessionsRepo';
import * as areas from '@/data/repos/lifeAreasRepo';
import * as logs from '@/data/repos/logsRepo';
import * as tags from '@/data/repos/tagsRepo';
import * as tasks from '@/data/repos/tasksRepo';
import type { NormalizedCreateLogInput } from '@/domain/journal';
import type { Capture, CompletedFocusSession, LifeArea, Log, Tag, Task } from '@/domain/types';

export interface JournalClient {
  fetchLifeAreas(): Promise<LifeArea[]>;
  fetchLogs(): Promise<Log[]>;
  /** Garnish streams: a failure leaves them empty rather than failing the journal. */
  fetchFocusSessions(): Promise<CompletedFocusSession[]>;
  fetchCaptures(): Promise<Capture[]>;
  fetchAllTasks(): Promise<Task[]>;
  fetchAllTags(): Promise<Tag[]>;
  createTag(name: string): Promise<Tag>;
  createLog(input: NormalizedCreateLogInput): Promise<Log>;
  deleteLog(id: string): Promise<void>;
}

export function firebaseJournalClient(
  db: Firestore,
  uid: string,
  now: () => Date = () => new Date(),
): JournalClient {
  return {
    fetchLifeAreas: async () =>
      (await areas.fetchLifeAreas(db, uid, { includeArchived: true })).items.slice(),
    fetchLogs: async () => (await logs.fetchLogs(db, uid)).items.slice(),
    fetchFocusSessions: async () => (await focus.fetchFocusSessions(db, uid)).items.slice(),
    fetchCaptures: async () => (await captures.fetchCaptures(db, uid)).items.slice(),
    fetchAllTasks: async () => (await tasks.fetchTasks(db, uid)).items.slice(),
    fetchAllTags: async () => (await tags.fetchTags(db, uid)).items.slice(),
    createTag: (name) => tags.createTagDeduplicating(db, uid, name),
    createLog: async (input) => {
      const log = newLog(input, now());
      await logs.appendLog(db, uid, log);
      return log;
    },
    deleteLog: (id) => logs.deleteLog(db, uid, id),
  };
}
