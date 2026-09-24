/** `TagDedup`: the pure, exact-match half. The data layer's `createTagDeduplicating` is case-insensitive. */
import type { Tag } from '@/domain/types';

export function matchExistingTag(tags: readonly Tag[], name: string): Tag | undefined {
  return tags.find((t) => t.name === name);
}
