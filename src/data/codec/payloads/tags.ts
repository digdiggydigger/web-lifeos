/**
 * A tag's soft delete is the stamp and ONLY the stamp (snake_case, siding with tasks): every
 * `tag_ids` array keeps the id, which is what makes restore true without re-attaching anything.
 * The links are stripped only by the 30-day purge.
 */
import { arrayRemove, arrayUnion } from 'firebase/firestore';

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

/** Membership on tasks and captures is `arrayUnion` / `arrayRemove` on `tag_ids`, one of the two snake_case keys captures keep. */
export function tagIdsUnion(tagId: string): Fields {
  return { tag_ids: arrayUnion(tagId) };
}

export function tagIdsRemove(tagId: string): Fields {
  return { tag_ids: arrayRemove(tagId) };
}
