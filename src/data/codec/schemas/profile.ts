/** `users/{uid}` (`FirebaseManager.signUp`, `+Seed`). */
import { z } from 'zod';

import type { Profile } from '@/domain/types';

import { omitUndefined } from '../fields';
import { timestamp } from './common';
import type { DocumentData } from './common';

export const profileDocument = z.object({
  email: z.string().optional(),
  created_at: timestamp.optional(),
  display_name: z.string().optional(),
  seeded_at: timestamp.optional(),
});

export function decodeProfile(data: DocumentData): Profile {
  const doc = profileDocument.parse(data);
  return omitUndefined({
    email: doc.email,
    createdAt: doc.created_at,
    displayName: doc.display_name,
    seededAt: doc.seeded_at,
  });
}
