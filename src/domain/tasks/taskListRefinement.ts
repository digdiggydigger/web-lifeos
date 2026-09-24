/** `TaskListRefinement`: a trimmed, case-insensitive title substring search that keeps input order. */
import type { Task } from '@/domain/types';

export function applySearch(tasks: readonly Task[], searchText: string): Task[] {
  const query = searchText.trim().toLocaleLowerCase();
  if (query.length === 0) return [...tasks];
  return tasks.filter((t) => t.title.toLocaleLowerCase().includes(query));
}

/** `TaskSearchCopy.resultCount`. */
export function searchResultCount(count: number): string {
  return count === 1 ? '1 match' : `${count} matches`;
}
