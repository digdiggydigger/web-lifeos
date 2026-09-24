/**
 * First-login starter content (`Firebase/FirebaseManager+Seed.swift`), as pure data: six life
 * areas (emoji in `colour`), five baseline tags, three starter tasks (one due tomorrow, one
 * pre-tagged), one welcome journal entry. The data layer writes it in one batch, marker last.
 */
import type { LifeArea, Log, Tag, Task } from '@/domain/types';

export interface SeedTask extends Task {
  readonly createdAt: Date;
  /** Membership written beside the document at create, the one place `tag_ids` is set on a seed task. */
  readonly tagIds: readonly string[];
}

export interface SeedContent {
  readonly areas: readonly LifeArea[];
  readonly tags: readonly Tag[];
  readonly tasks: readonly SeedTask[];
  readonly welcome: Log;
}

export const SEED_AREAS: ReadonlyArray<readonly [name: string, emoji: string]> = [
  ['Health', '🫀'],
  ['Work', '💼'],
  ['Home', '🏠'],
  ['Money', '💰'],
  ['Relationships', '💬'],
  ['Growth', '🌱'],
];

export const SEED_TAGS: readonly string[] = [
  'urgent',
  'focus',
  'quick-win',
  'waiting-on',
  'someday',
];

export const SEED_WELCOME_BODY =
  'Welcome to ADHD LifeOS. This journal is append-only on purpose — ' +
  'write things down, let them stand, move forward.';

const DAY_MS = 24 * 60 * 60 * 1000;

export function buildSeedContent(now: Date, newId: () => string): SeedContent {
  const areas: LifeArea[] = SEED_AREAS.map(([name, colour], index) => ({
    id: newId(),
    name,
    colour,
    sortOrder: index,
    archived: false,
  }));
  const tags: Tag[] = SEED_TAGS.map((name) => ({ id: newId(), name }));

  const health = areas.find((a) => a.name === 'Health');
  const growth = areas.find((a) => a.name === 'Growth');
  const quickWin = tags.find((t) => t.name === 'quick-win');

  const firstTask: SeedTask = {
    id: newId(),
    title: 'Check off your first task',
    notes: 'Tap the circle to mark this done — small wins count.',
    status: 'open',
    priority: 'p4',
    createdAt: now,
    tagIds: quickWin ? [quickWin.id] : [],
    ...(growth ? { lifeAreaId: growth.id } : {}),
  };
  const walk: SeedTask = {
    id: newId(),
    title: 'Take a 10-minute walk',
    status: 'open',
    priority: 'p3',
    dueDate: new Date(now.getTime() + DAY_MS),
    createdAt: now,
    tagIds: [],
    ...(health ? { lifeAreaId: health.id } : {}),
  };
  const capture: SeedTask = {
    id: newId(),
    title: 'Capture three things on your mind',
    notes: 'Use Quick Capture — get them out of your head and into the inbox.',
    status: 'open',
    priority: 'p4',
    createdAt: now,
    tagIds: [],
  };

  const welcome: Log = {
    id: newId(),
    type: 'journal',
    body: SEED_WELCOME_BODY,
    entryDate: now,
    createdAt: now,
  };

  return { areas, tags, tasks: [firstTask, walk, capture], welcome };
}
