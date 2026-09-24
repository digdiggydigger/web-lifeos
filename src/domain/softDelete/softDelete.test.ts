import { describe, expect, it } from 'vitest';

import {
  deleted,
  isLive,
  isPurgeable,
  ItemIsDeletedError,
  live,
  RETENTION_DAYS,
  requireLive,
} from './softDelete';

const now = new Date('2026-09-24T12:00:00Z');
const days = (n: number) => n * 24 * 60 * 60 * 1000;

describe('isLive', () => {
  it('treats an absent stamp as live and any stamp, even a future one, as deleted', () => {
    expect(isLive(undefined)).toBe(true);
    expect(isLive(new Date(now.getTime() - days(1)))).toBe(false);
    expect(isLive(new Date(now.getTime() + days(1)))).toBe(false);
  });
});

describe('isPurgeable', () => {
  it('purges only after the retention window, never a live item, never a future stamp', () => {
    expect(RETENTION_DAYS).toBe(30);
    expect(isPurgeable(undefined, now)).toBe(false);
    expect(isPurgeable(new Date(now.getTime() - days(29)), now)).toBe(false);
    expect(isPurgeable(new Date(now.getTime() - days(30)), now)).toBe(false);
    expect(isPurgeable(new Date(now.getTime() - days(30) - 1), now)).toBe(true);
    expect(isPurgeable(new Date(now.getTime() + days(1)), now)).toBe(false);
  });
});

describe('live / deleted / requireLive', () => {
  const items = [{ id: 'A' }, { id: 'B', deletedAt: now }];

  it('splits a list into the rows a list shows and the rows Recently Deleted shows', () => {
    expect(live(items).map((i) => i.id)).toEqual(['A']);
    expect(deleted(items).map((i) => i.id)).toEqual(['B']);
  });

  it('refuses to hand back a deleted item, saying where it went', () => {
    expect(requireLive(items[0]!)).toBe(items[0]);
    expect(() => requireLive(items[1]!)).toThrow(ItemIsDeletedError);
    expect(() => requireLive(items[1]!)).toThrow(/Recently Deleted/);
  });
});
