/** `LifeAreaDetail/AreaDetailPresentation.swift`. */

export type AreaDetailFilter = 'tasks' | 'journal' | 'captures' | 'all';
export const AREA_DETAIL_FILTERS: readonly AreaDetailFilter[] = [
  'tasks',
  'journal',
  'captures',
  'all',
];

export function areaDetailFilterTitle(filter: AreaDetailFilter, count: number): string {
  switch (filter) {
    case 'tasks':
      return `Tasks ${count}`;
    case 'journal':
      return `Journal ${count}`;
    case 'captures':
      return `Captures ${count}`;
    case 'all':
      return 'All';
  }
}

export function ringLine(rate: number | undefined, areaName: string): string {
  if (rate === undefined) return 'Nothing here has moved this week';
  if (rate >= 1) return `All of this week's ${areaName} items closed`;
  return `${Math.round(rate * 100)}% of this week's ${areaName} items closed`;
}

/** Only captures filed to THIS area; an unfiled capture belongs to the inbox, not to every area. */
export function capturesFiledHere<T extends { readonly lifeAreaId?: string }>(
  captures: readonly T[],
  areaId: string,
): T[] {
  return captures.filter((c) => c.lifeAreaId === areaId);
}
