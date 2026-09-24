import { describe, expect, it, vi } from 'vitest';

import { decodeList } from './decodeList';
import { decodeTag } from './schemas';

const good = { id: '7F3C2A10-1B2C-4D5E-8F90-1234567890AB', name: 'errand' };
const bad = { id: 'lowercase-is-not-an-id', name: 'oops' };

describe('decodeList', () => {
  it('keeps the good documents and skips the bad one, counting and logging it', () => {
    const log = vi.fn();
    const result = decodeList(
      [
        { id: good.id, data: () => good },
        { id: bad.id, data: () => bad },
      ],
      decodeTag,
      log,
    );
    expect(result.items).toEqual([good]);
    expect(result.skipped).toHaveLength(1);
    expect(result.skipped[0]?.id).toBe(bad.id);
    expect(log).toHaveBeenCalledTimes(1);
    expect(log.mock.calls[0]?.[0]).toMatch(/Skipped document lowercase-is-not-an-id/);
  });

  it('never throws for a list, even when every document is bad', () => {
    const result = decodeList([{ id: 'x', data: () => ({}) }], decodeTag, () => undefined);
    expect(result.items).toEqual([]);
    expect(result.skipped).toHaveLength(1);
  });
});
