/**
 * `life_areas/{id}` (`Home/HomeModels.swift`): single-word keys plus `sort_order`. `archived`
 * defaults to false on read (seeded rows predate it); `palette` absent means automatic.
 */
import { z } from 'zod';

import type { LifeArea } from '@/domain/types';

import { omitUndefined } from '../fields';
import { documentId } from './common';
import type { DocumentData } from './common';

export const lifeAreaDocument = z.object({
  id: documentId,
  name: z.string(),
  colour: z.string(),
  sort_order: z.number().int(),
  archived: z.boolean().optional(),
  palette: z.string().optional(),
});

export function decodeLifeArea(data: DocumentData): LifeArea {
  const doc = lifeAreaDocument.parse(data);
  return omitUndefined({
    id: doc.id,
    name: doc.name,
    colour: doc.colour,
    sortOrder: doc.sort_order,
    archived: doc.archived ?? false,
    palette: doc.palette,
  });
}

/** Whole-document encode: iOS `saveLifeArea` uses `setData` without merge, so every field is written every time. */
export function encodeLifeArea(area: LifeArea): DocumentData {
  return omitUndefined({
    id: area.id,
    name: area.name,
    colour: area.colour,
    sort_order: area.sortOrder,
    archived: area.archived,
    palette: area.palette,
  });
}
