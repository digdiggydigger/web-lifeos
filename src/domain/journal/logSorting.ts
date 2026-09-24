/** `Journal/LogSorting.swift`: newest first, and the life-area filter (`undefined` means All). */
import type { Log } from '@/domain/types';

export function sortByEntryDateDescending(logs: readonly Log[]): Log[] {
  return [...logs].sort((a, b) => b.entryDate.getTime() - a.entryDate.getTime());
}

export function filterByLifeArea(logs: readonly Log[], lifeAreaId: string | undefined): Log[] {
  if (lifeAreaId === undefined) return [...logs];
  return logs.filter((log) => log.lifeAreaId === lifeAreaId);
}
