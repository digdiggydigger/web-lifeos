/** `HomeAccessoryStrips.nudgesSection`: the due cards, the door, the upcoming rows, and the first-run door. */
import { Link } from 'react-router';
import { useStore } from 'zustand';

import {
  FIRST_NUDGE_DIRECTIVE,
  nudgeCards,
  nudgeChipText,
  nudgeDoorSubtitle,
  nudgeNextFireLine,
  nudgeOverflowLine,
  nudgeScheduledCount,
  nudgesUpcoming,
  nudgeUpcomingOverflowLine,
  shouldRenderNudgesSection,
} from '@/domain/momentum';
import { hasEverHadNudges } from '@/domain/nudges';
import { NudgeDueCard } from '@/features/nudges/NudgeDueCard';
import { dueNudges, nudgesOf } from '@/features/nudges/nudgesStore';
import { useNudgesStore, useUid } from '@/features/nudges/useNudgesStore';
import { preferencesStore } from '@/features/settings/preferencesStore';

function storage(): Storage | undefined {
  try {
    return globalThis.localStorage;
  } catch {
    return undefined;
  }
}

export function NudgesSection({ now }: { readonly now: Date }) {
  const uid = useUid();
  const store = useNudgesStore();
  const state = useStore(store, (s) => s.state);
  const errorMessage = useStore(store, (s) => s.errorMessage);
  const prefs = useStore(preferencesStore, (s) => s.preferences);

  if (state.kind === 'loading') return null;
  if (state.kind === 'failed') {
    return (
      <p role="alert" className="text-sm font-semibold text-state-warn">
        Couldn&apos;t load your nudges
      </p>
    );
  }
  const nudges = nudgesOf({ state });
  const hasAny = nudges.length > 0;
  if (!shouldRenderNudgesSection(hasAny, hasAny || hasEverHadNudges(uid, storage()))) return null;
  const due = dueNudges(nudges, now);
  const scheduled = nudgeScheduledCount(nudges, due);
  const upcoming = nudgesUpcoming(nudges, due, now);
  const chip = nudgeChipText(due.length, scheduled);
  const overflow = nudgeOverflowLine(due.length);
  const upcomingOverflow = nudgeUpcomingOverflowLine(scheduled);

  return (
    <section aria-label="Nudges" className="flex flex-col gap-2">
      {errorMessage ? (
        <p role="alert" className="text-sm text-state-risk">
          {errorMessage}
        </p>
      ) : null}
      {nudgeCards(due).map((nudge) => (
        <NudgeDueCard
          key={nudge.id}
          nudge={nudge}
          showStreaks={prefs.showStreaks}
          now={now}
          onDismiss={() => void store.getState().dismiss(nudge)}
        />
      ))}
      {overflow ? <p className="text-xs text-label-tertiary">{overflow}</p> : null}
      <div
        className={`rounded-card border border-card-border bg-card-surface shadow-card ${hasAny ? '' : 'opacity-70'}`}
      >
        <Link
          to="/nudges"
          aria-label={`Nudges, ${chip}`}
          className="spring flex min-h-11 items-center gap-2 p-4"
        >
          <span aria-hidden="true" className="text-xl">
            ⏰
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-base font-semibold">Nudges</span>
            <span className="block text-sm text-label-secondary">
              {nudgeDoorSubtitle(due.length, scheduled)}
            </span>
          </span>
          <span
            className={`inline-flex min-h-6 items-center rounded-card px-2 text-xs font-semibold ${due.length > 0 ? 'bg-state-warn/16 text-state-warn' : 'bg-card-surface-secondary text-label-secondary'}`}
          >
            {chip}
          </span>
        </Link>
        {upcoming.length > 0 ? (
          <ul className="divide-y divide-card-border border-t border-card-border">
            {upcoming.map((nudge) => (
              <li key={nudge.id} className="flex min-h-11 items-center gap-2 px-4 py-2 text-sm">
                <span className="min-w-0 flex-1 truncate">{nudge.label}</span>
                <span className="shrink-0 text-label-secondary tabular-nums">
                  {nudgeNextFireLine(nudge, now)}
                </span>
              </li>
            ))}
          </ul>
        ) : null}
        {upcomingOverflow ? (
          <p className="px-4 pb-4 text-xs text-label-tertiary">{upcomingOverflow}</p>
        ) : null}
        {!hasAny ? (
          <div className="px-4 pb-4">
            <Link
              to="/nudges?new=1"
              className="spring flex min-h-11 items-center justify-center rounded-card bg-accent text-base font-semibold text-on-area-work opacity-100"
            >
              {FIRST_NUDGE_DIRECTIVE}
            </Link>
          </div>
        ) : null}
      </div>
    </section>
  );
}
