/** `Capture/CaptureTriage.swift`: the staged area pick and whether Sorted can fire. */
import type { Capture, LifeArea } from '@/domain/types';

export interface StagedSelection {
  readonly captureId: string;
  readonly lifeAreaId: string | undefined;
}

/** A staged pick (or a staged clear) for THIS capture wins; otherwise the capture's own area. */
export function triageArea(
  staged: StagedSelection | undefined,
  capture: Pick<Capture, 'id' | 'lifeAreaId'>,
): string | undefined {
  if (!staged || staged.captureId !== capture.id) return capture.lifeAreaId;
  return staged.lifeAreaId;
}

export function canSort(area: string | undefined): boolean {
  return area !== undefined;
}

export type SortedEmphasis = 'waiting' | 'ready';

export function sortedEmphasis(area: string | undefined): SortedEmphasis {
  return canSort(area) ? 'ready' : 'waiting';
}

export function triageAreaLabel(
  id: string | undefined,
  lifeAreas: readonly LifeArea[],
): string | undefined {
  const area = id ? lifeAreas.find((a) => a.id === id) : undefined;
  return area ? `${area.colour} ${area.name}` : undefined;
}

/** `CaptureSkipOrdering`: skipped captures go to the back, in skip order; stale ids are ignored. */
export function applySkipOrdering<T extends { readonly id: string }>(
  captures: readonly T[],
  skippedIds: readonly string[],
): T[] {
  if (skippedIds.length === 0) return [...captures];
  const byId = new Map(captures.map((c) => [c.id, c]));
  const skipped = new Set(skippedIds);
  return [
    ...captures.filter((c) => !skipped.has(c.id)),
    ...skippedIds.flatMap((id) => {
      const c = byId.get(id);
      return c ? [c] : [];
    }),
  ];
}

/** `CaptureListRefinement`: the kind filter and the sort direction, composed. */
export function refineCaptures(
  captures: readonly Capture[],
  newestFirst: boolean,
  kind: Capture['kind'] | undefined,
): Capture[] {
  return captures
    .filter((c) => kind === undefined || c.kind === kind)
    .sort((a, b) =>
      newestFirst
        ? b.createdAt.getTime() - a.createdAt.getTime()
        : a.createdAt.getTime() - b.createdAt.getTime(),
    );
}
