/** `HomeLifeAreasSections` + `AreaMomentumList`: the collapsible list with Arrange, one row per active area. */
import { ChevronDown, ChevronRight, ChevronUp } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router';

import {
  areaRate,
  areaStatusLine,
  lifeAreasCollapsedLine,
  showsArrangeControl,
} from '@/domain/momentum';
import type { AreaMomentum, AreaStatusTone } from '@/domain/momentum';
import { areaClasses } from '@/features/areas/AreaWash';

const COLLAPSED_KEY = 'today.lifeAreas.collapsed';

function readCollapsed(): boolean {
  try {
    return globalThis.localStorage.getItem(COLLAPSED_KEY) === 'true';
  } catch {
    return false;
  }
}

function writeCollapsed(collapsed: boolean): void {
  try {
    globalThis.localStorage.setItem(COLLAPSED_KEY, String(collapsed));
  } catch {
    // Per-viewer convenience only.
  }
}

interface LifeAreasSectionProps {
  readonly items: readonly AreaMomentum[];
  readonly now: Date;
  readonly onMove: (id: string, direction: -1 | 1) => void;
}

export function LifeAreasSection({ items, now, onMove }: LifeAreasSectionProps) {
  const [collapsed, setCollapsed] = useState(readCollapsed);
  const [arranging, setArranging] = useState(false);
  const expanded = !collapsed || arranging;
  const summary = lifeAreasCollapsedLine(items);

  function toggle(): void {
    const next = !collapsed;
    setCollapsed(next);
    writeCollapsed(next);
    if (next) setArranging(false);
  }

  return (
    <section aria-labelledby="life-areas-heading">
      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          aria-expanded={expanded}
          aria-label={expanded ? 'Your life areas' : `Your life areas, ${summary}`}
          onClick={toggle}
          className="flex min-h-11 min-w-0 flex-1 items-center gap-2 text-left"
        >
          <span className="min-w-0">
            <span
              id="life-areas-heading"
              className="block text-xs font-bold tracking-widest text-label-secondary uppercase"
            >
              Your life areas
            </span>
            {!expanded ? (
              <span className="block truncate text-sm text-label-secondary">{summary}</span>
            ) : null}
          </span>
          {expanded ? (
            <ChevronDown aria-hidden="true" className="size-4 shrink-0 text-label-tertiary" />
          ) : (
            <ChevronUp aria-hidden="true" className="size-4 shrink-0 text-label-tertiary" />
          )}
        </button>
        {showsArrangeControl(items.length, expanded) ? (
          <button
            type="button"
            aria-pressed={arranging}
            onClick={() => setArranging((a) => !a)}
            className="spring min-h-11 rounded-card border border-card-border px-4 text-sm font-semibold text-accent"
          >
            {arranging ? 'Done' : 'Arrange'}
          </button>
        ) : null}
      </div>
      {expanded ? (
        <>
          <p className="mt-1 mb-2 text-xs text-label-tertiary">
            How many of each area&apos;s tasks you have closed this week. Tap one to work inside it.
          </p>
          {items.length === 0 ? (
            <p className="rounded-card border border-card-border bg-card-surface p-4 text-sm text-label-secondary">
              No areas yet.{' '}
              <Link to="/areas/editor" className="font-semibold text-accent">
                Add an area
              </Link>
            </p>
          ) : (
            <ul
              aria-label="Life areas"
              className="divide-y divide-card-border rounded-card border border-card-border bg-card-surface"
            >
              {items.map((item, index) => (
                <AreaRow
                  key={item.area.id}
                  item={item}
                  now={now}
                  arranging={arranging}
                  isFirst={index === 0}
                  isLast={index === items.length - 1}
                  onMove={onMove}
                />
              ))}
            </ul>
          )}
        </>
      ) : null}
    </section>
  );
}

const toneClass = (tone: AreaStatusTone, familyText: string): string =>
  tone === 'plain' ? 'text-label-secondary' : tone === 'clear' ? familyText : 'text-state-warn';

function AreaRow(props: {
  readonly item: AreaMomentum;
  readonly now: Date;
  readonly arranging: boolean;
  readonly isFirst: boolean;
  readonly isLast: boolean;
  readonly onMove: (id: string, direction: -1 | 1) => void;
}) {
  const { item, now, arranging, isFirst, isLast, onMove } = props;
  const { area, closedThisWeek, open, lastClosedAt } = item;
  const status = areaStatusLine(closedThisWeek, open, lastClosedAt, now);
  const c = areaClasses(area);
  const rate = areaRate(closedThisWeek, open) ?? 0;
  const body = (
    <>
      <span
        aria-hidden="true"
        className={`flex size-11 shrink-0 items-center justify-center rounded-card text-xl ${c.tint}`}
      >
        {area.colour}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-base font-medium">{area.name}</span>
        <span className={`block text-sm ${toneClass(status.tone, c.text)}`}>{status.text}</span>
      </span>
      <span
        aria-hidden="true"
        className="h-2 w-16 shrink-0 overflow-hidden rounded-full bg-track-neutral"
      >
        <span className={`block h-full ${c.rail}`} style={{ width: `${rate * 100}%` }} />
      </span>
    </>
  );
  return (
    <li className="flex items-center gap-2 px-4">
      {arranging ? (
        <>
          <div className="flex min-h-18 min-w-0 flex-1 items-center gap-2 py-2">{body}</div>
          <button
            type="button"
            aria-label={`Move ${area.name} up`}
            disabled={isFirst}
            onClick={() => onMove(area.id, -1)}
            className="flex size-11 items-center justify-center text-accent disabled:text-label-tertiary"
          >
            <ChevronUp aria-hidden="true" className="size-6" />
          </button>
          <button
            type="button"
            aria-label={`Move ${area.name} down`}
            disabled={isLast}
            onClick={() => onMove(area.id, 1)}
            className="flex size-11 items-center justify-center text-accent disabled:text-label-tertiary"
          >
            <ChevronDown aria-hidden="true" className="size-6" />
          </button>
        </>
      ) : (
        <Link
          to={`/areas/${area.id}`}
          aria-label={`${area.name}, ${closedThisWeek} closed this week, ${open} open`}
          className="spring flex min-h-18 min-w-0 flex-1 items-center gap-2 py-2"
        >
          {body}
          <ChevronRight aria-hidden="true" className="size-4 shrink-0 text-label-tertiary" />
        </Link>
      )}
    </li>
  );
}
