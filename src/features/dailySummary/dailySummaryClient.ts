/**
 * The daily summary's adapters: `FirebaseDailySummaryDataAdapter` (every collection read once, in
 * parallel; any failed read fails the whole request), `FirebaseDailySummaryGenerator` (POST with a
 * Firebase ID token, 90 s timeout) and the local snapshot store (`UserDefaultsDailySummaryStore`).
 *
 * **The endpoint is same-origin on purpose.** The iOS repo deploys `dailySummary` with CORS off,
 * so the browser posts to `/api/daily-summary` and Firebase Hosting rewrites it to the Cloud Run
 * service (`firebase.json`). The function itself is the iOS repo's; nothing here changes it.
 */
import type { Firestore } from 'firebase/firestore';

import * as captures from '@/data/repos/capturesRepo';
import * as focus from '@/data/repos/focusSessionsRepo';
import * as areas from '@/data/repos/lifeAreasRepo';
import * as logs from '@/data/repos/logsRepo';
import * as tasks from '@/data/repos/tasksRepo';
import {
  DAILY_SUMMARY_SNAPSHOT_KEY,
  DailySummaryEndpointError,
  buildDailySummaryRequest,
  dailySummaryRequestBody,
  decodeDailySummaryResponse,
  parseDailySummarySnapshot,
  serializeDailySummarySnapshot,
  stubDailySummary,
} from '@/domain/dailySummary';
import type { Capture, CompletedFocusSession, LifeArea, Log, Task } from '@/domain/types';

import type {
  DailySummaryGenerator,
  DailySummaryProvider,
  DailySummaryStorage,
} from './dailySummaryStore';

/** Same-origin path the hosting rewrite forwards to the `dailysummary` Cloud Run service. */
export const DAILY_SUMMARY_ENDPOINT = '/api/daily-summary';
export const DAILY_SUMMARY_TIMEOUT_MS = 90_000;

export interface DailySummaryBackingStore {
  fetchTasks(): Promise<Task[]>;
  fetchLogs(): Promise<Log[]>;
  fetchFocusSessions(): Promise<CompletedFocusSession[]>;
  fetchCaptures(): Promise<Capture[]>;
  /** Archived included, so a task under a retired area keeps that area's name. */
  fetchLifeAreas(): Promise<LifeArea[]>;
}

export function firebaseDailySummaryBackingStore(
  db: Firestore,
  uid: string,
): DailySummaryBackingStore {
  return {
    fetchTasks: async () => (await tasks.fetchTasks(db, uid)).items.slice(),
    fetchLogs: async () => (await logs.fetchLogs(db, uid)).items.slice(),
    fetchFocusSessions: async () => (await focus.fetchFocusSessions(db, uid)).items.slice(),
    fetchCaptures: async () => (await captures.fetchCaptures(db, uid)).items.slice(),
    fetchLifeAreas: async () =>
      (await areas.fetchLifeAreas(db, uid, { includeArchived: true })).items.slice(),
  };
}

/** `FirebaseDailySummaryDataAdapter.loadRequest`. The captures count is the untriaged ones only. */
export function dailySummaryProvider(store: DailySummaryBackingStore): DailySummaryProvider {
  return {
    async loadRequest(tone, date) {
      const [loadedTasks, loadedLogs, sessions, loadedCaptures, lifeAreas] = await Promise.all([
        store.fetchTasks(),
        store.fetchLogs(),
        store.fetchFocusSessions(),
        store.fetchCaptures(),
        store.fetchLifeAreas(),
      ]);
      const lifeAreaNames = new Map<string, string>();
      // Duplicate ids keep the first name, as `uniquingKeysWith: { first, _ in first }`.
      for (const area of lifeAreas)
        if (!lifeAreaNames.has(area.id)) lifeAreaNames.set(area.id, area.name);
      return buildDailySummaryRequest({
        date,
        tone,
        tasks: loadedTasks,
        focusSessions: sessions,
        journalEntries: loadedLogs,
        capturesCount: loadedCaptures.filter((c) => !c.processed).length,
        lifeAreaNames,
      });
    },
  };
}

/** `StubDailySummaryGenerator`: honest on-device synthesis, and the fallback when the model fails. */
export const stubDailySummaryGenerator: DailySummaryGenerator = {
  source: 'localSynthesis',
  generate: (request) => Promise.resolve(stubDailySummary(request)),
};

export interface EndpointGeneratorDeps {
  /** The signed-in user's Firebase ID token, or `undefined` when signed out. */
  readonly idToken: () => Promise<string | undefined>;
  readonly fetch?: typeof globalThis.fetch;
  readonly endpoint?: string;
  readonly timeoutMs?: number;
}

/** `FirebaseDailySummaryGenerator`: the Claude-backed Cloud Function, through the hosting rewrite. */
export function endpointDailySummaryGenerator(deps: EndpointGeneratorDeps): DailySummaryGenerator {
  const send = deps.fetch ?? globalThis.fetch.bind(globalThis);
  return {
    source: 'model',
    async generate(request) {
      const token = await deps.idToken();
      if (!token) throw new DailySummaryEndpointError('notSignedIn');
      const response = await send(deps.endpoint ?? DAILY_SUMMARY_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: dailySummaryRequestBody(request),
        signal: AbortSignal.timeout(deps.timeoutMs ?? DAILY_SUMMARY_TIMEOUT_MS),
      });
      return decodeDailySummaryResponse(response.status, await response.text());
    },
  };
}

type StorageLike = Pick<Storage, 'getItem' | 'setItem'>;

/** One snapshot per browser, owned by the account that wrote it (read back only for that account). */
export function localDailySummaryStorage(storage: StorageLike | undefined): DailySummaryStorage {
  return {
    read() {
      try {
        return parseDailySummarySnapshot(storage?.getItem(DAILY_SUMMARY_SNAPSHOT_KEY));
      } catch {
        return null;
      }
    },
    write(snapshot) {
      try {
        storage?.setItem(DAILY_SUMMARY_SNAPSHOT_KEY, serializeDailySummarySnapshot(snapshot));
      } catch {
        // A summary that is not remembered is regenerated next time; nothing is lost.
      }
    },
  };
}
