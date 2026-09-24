/**
 * The seams `FocusSessionService` is tested through (`FocusSessionLogging`, `FocusSprintPersisting`,
 * `FocusNotificationScheduling`) and their web implementations: Firestore, localStorage keyed by
 * account, and in-tab timers over the Notification API.
 */
import type { Firestore } from 'firebase/firestore';

import { saveFocusSession } from '@/data/repos/focusSessionsRepo';
import {
  FOCUS_STORAGE_KEYS,
  parseCompletedSessions,
  parsePersistedSprint,
  serializeCompletedSessions,
  serializePersistedSprint,
} from '@/domain/focus';
import type { PersistedFocusSprint, ScheduledFocusNotification } from '@/domain/focus';
import type { CompletedFocusSession } from '@/domain/types';

export interface FocusLogger {
  logCompletedSession(record: CompletedFocusSession): Promise<void>;
}

export interface FocusSprintStore {
  read(): PersistedFocusSprint | undefined;
  write(state: PersistedFocusSprint): void;
  clear(): void;
  readUnacknowledgedCompletion(): CompletedFocusSession | undefined;
  writeUnacknowledgedCompletion(record: CompletedFocusSession): void;
  clearUnacknowledgedCompletion(): void;
  readCardCollapsed(): boolean;
  writeCardCollapsed(collapsed: boolean): void;
  readUnconfirmedCompletions(): CompletedFocusSession[];
  writeUnconfirmedCompletions(records: readonly CompletedFocusSession[]): void;
}

export interface FocusNotifier {
  requestAuthorizationIfNeeded(): Promise<boolean>;
  /** Cancels everything scheduled and arms exactly this plan. */
  replaceScheduled(notifications: readonly ScheduledFocusNotification[]): void;
}

export function firebaseFocusLogger(db: Firestore, uid: string): FocusLogger {
  return { logCompletedSession: (record) => saveFocusSession(db, uid, record) };
}

type StorageLike = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

function defaultStorage(): StorageLike | undefined {
  try {
    return globalThis.localStorage;
  } catch {
    return undefined;
  }
}

/** Keyed by uid, unlike the phone's per-device defaults: a sprint must never be logged into another account's history. */
export function localStorageFocusSprintStore(
  uid: string,
  storage: StorageLike | undefined = defaultStorage(),
): FocusSprintStore {
  const key = (name: string) => `${name}.${uid}`;
  const get = (name: string): string | null => {
    try {
      return storage?.getItem(key(name)) ?? null;
    } catch {
      return null;
    }
  };
  const put = (name: string, value: string | undefined): void => {
    try {
      if (value === undefined) storage?.removeItem(key(name));
      else storage?.setItem(key(name), value);
    } catch {
      // Storage can be unavailable; the in-memory state still applies for the session.
    }
  };
  return {
    read: () => parsePersistedSprint(get(FOCUS_STORAGE_KEYS.running)),
    write: (state) => put(FOCUS_STORAGE_KEYS.running, serializePersistedSprint(state)),
    clear: () => put(FOCUS_STORAGE_KEYS.running, undefined),
    readUnacknowledgedCompletion: () =>
      parseCompletedSessions(get(FOCUS_STORAGE_KEYS.unacknowledgedCompletion))[0],
    writeUnacknowledgedCompletion: (record) =>
      put(FOCUS_STORAGE_KEYS.unacknowledgedCompletion, serializeCompletedSessions([record])),
    clearUnacknowledgedCompletion: () =>
      put(FOCUS_STORAGE_KEYS.unacknowledgedCompletion, undefined),
    readCardCollapsed: () => get(FOCUS_STORAGE_KEYS.cardCollapsed) === 'true',
    writeCardCollapsed: (collapsed) => put(FOCUS_STORAGE_KEYS.cardCollapsed, String(collapsed)),
    readUnconfirmedCompletions: () =>
      parseCompletedSessions(get(FOCUS_STORAGE_KEYS.unconfirmedCompletions)),
    writeUnconfirmedCompletions: (records) =>
      put(FOCUS_STORAGE_KEYS.unconfirmedCompletions, serializeCompletedSessions(records)),
  };
}

export function memoryFocusSprintStore(): FocusSprintStore & {
  stored: PersistedFocusSprint | undefined;
  unacknowledged: CompletedFocusSession | undefined;
  cardCollapsed: boolean;
  unconfirmed: CompletedFocusSession[];
  writeCount: number;
  clearCount: number;
} {
  const store = {
    stored: undefined as PersistedFocusSprint | undefined,
    unacknowledged: undefined as CompletedFocusSession | undefined,
    cardCollapsed: false,
    unconfirmed: [] as CompletedFocusSession[],
    writeCount: 0,
    clearCount: 0,
    read: () => store.stored,
    write: (state: PersistedFocusSprint) => {
      store.stored = state;
      store.writeCount += 1;
    },
    clear: () => {
      store.stored = undefined;
      store.clearCount += 1;
    },
    readUnacknowledgedCompletion: () => store.unacknowledged,
    writeUnacknowledgedCompletion: (record: CompletedFocusSession) => {
      store.unacknowledged = record;
    },
    clearUnacknowledgedCompletion: () => {
      store.unacknowledged = undefined;
    },
    readCardCollapsed: () => store.cardCollapsed,
    writeCardCollapsed: (collapsed: boolean) => {
      store.cardCollapsed = collapsed;
    },
    readUnconfirmedCompletions: () => store.unconfirmed.slice(),
    writeUnconfirmedCompletions: (records: readonly CompletedFocusSession[]) => {
      store.unconfirmed = records.slice();
    },
  };
  return store;
}

const MAX_TIMEOUT_MS = 2 ** 31 - 1;

/** In-tab only: a timer per planned moment, shown through the Notification API when the tab may. The phone owns the Lock Screen. */
export function browserFocusNotifier(): FocusNotifier {
  const timers: ReturnType<typeof setTimeout>[] = [];
  const supported = () => typeof Notification !== 'undefined';
  return {
    requestAuthorizationIfNeeded: async () => {
      if (!supported()) return false;
      if (Notification.permission === 'granted') return true;
      if (Notification.permission === 'denied') return false;
      try {
        return (await Notification.requestPermission()) === 'granted';
      } catch {
        return false;
      }
    },
    replaceScheduled: (notifications) => {
      for (const timer of timers.splice(0)) clearTimeout(timer);
      if (!supported() || Notification.permission !== 'granted') return;
      for (const notification of notifications) {
        const delay = Math.min(
          Math.max(notification.fireDate.getTime() - Date.now(), 0),
          MAX_TIMEOUT_MS,
        );
        timers.push(
          setTimeout(() => {
            try {
              new Notification(notification.title, {
                body: notification.body,
                tag: notification.identifier,
              });
            } catch {
              // A notification that cannot be shown is not a failed sprint.
            }
          }, delay),
        );
      }
    },
  };
}
