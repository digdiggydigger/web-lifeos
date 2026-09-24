/** `NudgesService` (`Nudges/NudgesService.swift`): the list, the composer, Done for now with its undo, edits and the notification reconcile. */
import { createStore } from 'zustand/vanilla';
import type { StoreApi } from 'zustand/vanilla';

import {
  DEFAULT_NUDGE_SCHEDULE,
  isEmptyNudgeUpdate,
  isNudgeDue,
  landsOnSeven,
  normalizeCreateNudgeInput,
  normalizeUpdateNudgeInput,
  NUDGE_VALIDATION_MESSAGES,
  parseSchedule,
} from '@/domain/nudges';
import type { NudgeSchedule, NudgeUpdatePayload } from '@/domain/nudges';
import type { Nudge } from '@/domain/types';
import type { RecentAction } from '@/domain/undo/recentAction';
import { errorText } from '@/features/tasks/tasksClient';

import type { NudgeNotifier, NudgesClient } from './nudgesClient';

export type NudgesListState =
  | { readonly kind: 'loading' }
  | { readonly kind: 'loaded'; readonly nudges: readonly Nudge[] }
  | { readonly kind: 'failed'; readonly message: string };

export const NOTIFICATIONS_DENIED_WARNING =
  'Notifications permission denied — nudge notifications were not scheduled.';
export const CREATED_BUT_NOTIFICATIONS_DENIED_WARNING =
  'Nudge created, but notifications permission was denied — nudge notifications were not scheduled.';

export interface NudgesState {
  readonly state: NudgesListState;
  readonly newLabel: string;
  readonly newSchedule: NudgeSchedule;
  readonly isCreating: boolean;
  readonly createErrorMessage: string | undefined;
  readonly errorMessage: string | undefined;
  readonly setNewLabel: (label: string) => void;
  readonly setNewSchedule: (schedule: NudgeSchedule) => void;
  readonly load: () => Promise<void>;
  readonly createNudge: () => Promise<boolean>;
  /** Done for now: stamps the firing, then records the undo that restores the nudge as it stood. */
  readonly dismiss: (nudge: Nudge) => Promise<boolean>;
  readonly restore: (nudge: Nudge) => Promise<boolean>;
  readonly update: (
    nudge: Nudge,
    editedLabel: string,
    editedSchedule: NudgeSchedule,
  ) => Promise<boolean>;
  readonly toggleActive: (nudge: Nudge) => Promise<boolean>;
  readonly clearErrors: () => void;
}

export type NudgesStore = StoreApi<NudgesState>;

export type NudgeMilestone = 'streakSeven';

export interface NudgesStoreOptions {
  readonly notifier: NudgeNotifier;
  readonly record?: (action: RecentAction) => void;
  /** The streak milestone's door (M2.4 draws it). */
  readonly celebrate?: (milestone: NudgeMilestone) => void;
  readonly now?: () => Date;
}

export function nudgesOf(state: Pick<NudgesState, 'state'>): readonly Nudge[] {
  return state.state.kind === 'loaded' ? state.state.nudges : [];
}

export function dueNudges(nudges: readonly Nudge[], now: Date): Nudge[] {
  return nudges.filter((n) => isNudgeDue(n, now));
}

export function isNewNudgeValid(state: Pick<NudgesState, 'newLabel' | 'newSchedule'>): boolean {
  return normalizeCreateNudgeInput(state.newLabel, state.newSchedule).ok;
}

export function createNudgesStore(client: NudgesClient, options: NudgesStoreOptions): NudgesStore {
  const { notifier } = options;
  const now = options.now ?? (() => new Date());
  const record = options.record ?? (() => undefined);
  const celebrate = options.celebrate ?? (() => undefined);

  return createStore<NudgesState>((set, get) => {
    function replace(updated: Nudge): void {
      set({
        state: {
          kind: 'loaded',
          nudges: nudgesOf(get()).map((n) => (n.id === updated.id ? updated : n)),
        },
      });
    }

    /**
     * Active and parseable schedules notifications; anything else cancels. Returns false only when
     * a prompt was allowed and permission was refused: on load the browser cannot ask (no gesture),
     * so an undecided permission is left alone rather than reported.
     */
    async function scheduleOrCancel(nudge: Nudge, prompt: boolean): Promise<boolean> {
      const schedule = nudge.active ? parseSchedule(nudge.schedule) : undefined;
      if (!schedule) {
        notifier.cancel(nudge.id);
        return true;
      }
      if (!notifier.isAuthorized()) {
        if (!prompt) return true;
        if (!(await notifier.requestAuthorizationIfNeeded())) return false;
      }
      notifier.schedule(nudge.id, nudge.label, schedule);
      return true;
    }

    async function applyUpdate(id: string, payload: NudgeUpdatePayload): Promise<boolean> {
      try {
        const updated = await client.updateNudge(id, payload);
        replace(updated);
        if (!(await scheduleOrCancel(updated, true)))
          set({ errorMessage: NOTIFICATIONS_DENIED_WARNING });
        return true;
      } catch (error) {
        set({ errorMessage: errorText(error) });
        return false;
      }
    }

    return {
      state: { kind: 'loading' },
      newLabel: '',
      newSchedule: DEFAULT_NUDGE_SCHEDULE,
      isCreating: false,
      createErrorMessage: undefined,
      errorMessage: undefined,
      setNewLabel: (newLabel) => set({ newLabel }),
      setNewSchedule: (newSchedule) => set({ newSchedule }),
      load: async () => {
        if (get().state.kind !== 'loaded') set({ state: { kind: 'loading' } });
        try {
          const nudges = await client.fetchNudges();
          set({ state: { kind: 'loaded', nudges } });
          for (const nudge of nudges) await scheduleOrCancel(nudge, false);
        } catch (error) {
          set({ state: { kind: 'failed', message: errorText(error) } });
        }
      },
      createNudge: async () => {
        set({ createErrorMessage: undefined });
        const normalized = normalizeCreateNudgeInput(get().newLabel, get().newSchedule);
        if (!normalized.ok) {
          set({ createErrorMessage: NUDGE_VALIDATION_MESSAGES[normalized.error] });
          return false;
        }
        set({ isCreating: true });
        try {
          const created = await client.createNudge(normalized.value);
          set({ state: { kind: 'loaded', nudges: [...nudgesOf(get()), created] }, newLabel: '' });
          if (!(await scheduleOrCancel(created, true))) {
            set({ createErrorMessage: CREATED_BUT_NOTIFICATIONS_DENIED_WARNING });
          }
          return true;
        } catch (error) {
          set({ createErrorMessage: errorText(error) });
          return false;
        } finally {
          set({ isCreating: false });
        }
      },
      dismiss: async (nudge) => {
        set({ errorMessage: undefined });
        try {
          const updated = await client.markFired(nudge.id, nudge.completionDates ?? []);
          replace(updated);
          if (landsOnSeven(nudge.completionDates ?? [], updated.completionDates ?? [], now())) {
            celebrate('streakSeven');
          }
          // The nudge captured is the one from BEFORE the write, so the reversal restores rather than recomputes.
          record({
            kind: 'nudgeDismissed',
            subject: nudge.label,
            undo: () => get().restore(nudge),
          });
          return true;
        } catch (error) {
          set({ errorMessage: errorText(error) });
          return false;
        }
      },
      restore: async (nudge) => {
        set({ errorMessage: undefined });
        try {
          const updated = await client.unmarkFired(
            nudge.id,
            nudge.lastFiredAt,
            nudge.completionDates ?? [],
          );
          replace(updated);
          return true;
        } catch (error) {
          set({ errorMessage: errorText(error) });
          return false;
        }
      },
      update: async (nudge, editedLabel, editedSchedule) => {
        set({ errorMessage: undefined });
        const result = normalizeUpdateNudgeInput(nudge, editedLabel, editedSchedule);
        if (!result.ok) {
          set({ errorMessage: NUDGE_VALIDATION_MESSAGES[result.error] });
          return false;
        }
        if (isEmptyNudgeUpdate(result.value)) return true;
        return applyUpdate(nudge.id, result.value);
      },
      toggleActive: (nudge) => {
        set({ errorMessage: undefined });
        return applyUpdate(nudge.id, { active: !nudge.active });
      },
      clearErrors: () => set({ errorMessage: undefined, createErrorMessage: undefined }),
    };
  });
}
