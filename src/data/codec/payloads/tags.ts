/**
 * A tag's soft delete is the stamp and ONLY the stamp (snake_case, siding with tasks): every
 * `tag_ids` array keeps the id, which is what makes restore true without re-attaching anything.
 * The links are stripped only by the 30-day purge.
 */
import { clear } from '../fields';
import type { Fields } from '../fields';
import { toTimestamp } from '../time';

export function tagSoftDelete(now: Date): Fields {
  return { deleted_at: toTimestamp(now) };
}

export function tagRestore(): Fields {
  return { deleted_at: clear() };
}

export function tagRename(name: string): Fields {
  return { name };
}
