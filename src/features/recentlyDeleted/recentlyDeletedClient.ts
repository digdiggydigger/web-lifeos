/** `RecentlyDeletedClientAdapting` + `FirebaseRecentlyDeletedClientAdapter`: three collections as one list. */
import type { Firestore } from 'firebase/firestore';

import * as captures from '@/data/repos/capturesRepo';
import * as tags from '@/data/repos/tagsRepo';
import * as tasks from '@/data/repos/tasksRepo';
import { captureDetailHeadline } from '@/domain/captures';
import type { RecentlyDeletedItem } from '@/domain/recentlyDeleted';
import type { Capture, Tag, Task } from '@/domain/types';

export interface RecentlyDeletedClient {
  fetchDeleted(): Promise<RecentlyDeletedItem[]>;
  restore(item: RecentlyDeletedItem): Promise<void>;
  /** A colliding tag: keep the restored spelling (absorbing the live tag) or the live one. */
  restoreResolving(item: RecentlyDeletedItem, keepingRestored: boolean): Promise<void>;
  deleteForever(item: RecentlyDeletedItem): Promise<void>;
}

function fromTasks(list: readonly Task[]): RecentlyDeletedItem[] {
  return list.flatMap((task) =>
    task.deletedAt
      ? [{ itemId: task.id, kind: 'task' as const, title: task.title, deletedAt: task.deletedAt }]
      : [],
  );
}

function fromCaptures(list: readonly Capture[]): RecentlyDeletedItem[] {
  return list.flatMap((capture) =>
    capture.deletedAt
      ? [
          {
            itemId: capture.id,
            kind: 'capture' as const,
            title: captureDetailHeadline(capture),
            deletedAt: capture.deletedAt,
          },
        ]
      : [],
  );
}

/** A deleted tag whose name a LIVE tag holds (folding case, as the dedup does) carries the collision. */
function fromTags(list: readonly Tag[], liveTags: readonly Tag[]): RecentlyDeletedItem[] {
  return list.flatMap((tag) => {
    if (!tag.deletedAt) return [];
    const live = liveTags.find((t) => t.name.toLocaleLowerCase() === tag.name.toLocaleLowerCase());
    return [
      {
        itemId: tag.id,
        kind: 'tag' as const,
        title: tag.name,
        deletedAt: tag.deletedAt,
        ...(live ? { collision: { liveId: live.id, liveName: live.name } } : {}),
      },
    ];
  });
}

export function itemsFrom(input: {
  readonly tasks: readonly Task[];
  readonly captures: readonly Capture[];
  readonly tags: readonly Tag[];
  readonly liveTags: readonly Tag[];
}): RecentlyDeletedItem[] {
  return [
    ...fromTasks(input.tasks),
    ...fromCaptures(input.captures),
    ...fromTags(input.tags, input.liveTags),
  ];
}

export function firebaseRecentlyDeletedClient(db: Firestore, uid: string): RecentlyDeletedClient {
  return {
    fetchDeleted: async () => {
      const [t, c, g, live] = await Promise.all([
        tasks.fetchDeletedTasks(db, uid),
        captures.fetchDeletedCaptures(db, uid),
        tags.fetchDeletedTags(db, uid),
        tags.fetchTags(db, uid),
      ]);
      return itemsFrom({ tasks: t.items, captures: c.items, tags: g.items, liveTags: live.items });
    },
    restore: (item) => {
      switch (item.kind) {
        case 'task':
          return tasks.restoreTask(db, uid, item.itemId);
        case 'capture':
          return captures.restoreCapture(db, uid, item.itemId);
        case 'tag':
          return tags.restoreTag(db, uid, item.itemId);
      }
    },
    restoreResolving: async (item, keepingRestored) => {
      if (!item.collision) {
        await (item.kind === 'tag' ? tags.restoreTag(db, uid, item.itemId) : Promise.resolve());
        return;
      }
      if (keepingRestored)
        await tags.mergeTagsRestoring(db, uid, item.itemId, item.collision.liveId);
      else await tags.mergeTagIntoId(db, uid, item.itemId, item.collision.liveId);
    },
    deleteForever: (item) => {
      switch (item.kind) {
        case 'task':
          return tasks.hardDeleteTask(db, uid, item.itemId);
        case 'capture':
          return captures.hardDeleteCapture(db, uid, item.itemId);
        case 'tag':
          return tags.purgeTag(db, uid, item.itemId);
      }
    },
  };
}
