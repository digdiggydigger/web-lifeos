/** `HomeClientAdapting` plus the scoreboard's side inputs (captures, nudges, focus history), over the repos. */
import type { Firestore } from 'firebase/firestore';

import * as captures from '@/data/repos/capturesRepo';
import * as focus from '@/data/repos/focusSessionsRepo';
import * as areas from '@/data/repos/lifeAreasRepo';
import * as nudges from '@/data/repos/nudgesRepo';
import * as tasks from '@/data/repos/tasksRepo';
import type {
  Capture,
  CompletedFocusSession,
  LifeArea,
  Nudge,
  Task,
  TaskStatus,
} from '@/domain/types';

export interface HomeClient {
  /** Every area, archived ones included: the reorder payload and the pickers need them. */
  fetchLifeAreas(): Promise<LifeArea[]>;
  fetchOpenTasks(): Promise<Task[]>;
  /** Every task, closed ones included: the scoreboard's raw material. */
  fetchAllTasks(): Promise<Task[]>;
  /** One bulk write of the COMPLETE ordering, active first then archived. */
  reorder(orderedIds: readonly string[]): Promise<void>;
  setStatus(taskId: string, status: TaskStatus): Promise<void>;
  fetchUnprocessedCaptures(): Promise<Capture[]>;
  fetchSeenCaptures(): Promise<Capture[]>;
  fetchProcessedCaptures(): Promise<Capture[]>;
  fetchNudges(): Promise<Nudge[]>;
  fetchFocusSessions(): Promise<CompletedFocusSession[]>;
}

export function firebaseHomeClient(
  db: Firestore,
  uid: string,
  now: () => Date = () => new Date(),
): HomeClient {
  return {
    fetchLifeAreas: async () =>
      (await areas.fetchLifeAreas(db, uid, { includeArchived: true })).items.slice(),
    fetchOpenTasks: async () => (await tasks.fetchOpenTasks(db, uid)).items.slice(),
    fetchAllTasks: async () => (await tasks.fetchTasks(db, uid)).items.slice(),
    reorder: (orderedIds) => areas.reorderLifeAreas(db, uid, orderedIds),
    setStatus: (taskId, status) => tasks.setTaskStatus(db, uid, taskId, status, now()),
    fetchUnprocessedCaptures: () => captures.fetchUnprocessedCaptures(db, uid),
    fetchSeenCaptures: () => captures.fetchSeenCaptures(db, uid),
    fetchProcessedCaptures: () => captures.fetchProcessedCaptures(db, uid),
    fetchNudges: async () => (await nudges.fetchNudges(db, uid)).items.slice(),
    fetchFocusSessions: async () => (await focus.fetchFocusSessions(db, uid)).items.slice(),
  };
}
