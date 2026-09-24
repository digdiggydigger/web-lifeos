/** `ComposerDraftFiler`: a closed composer with text in it keeps that text as a note in the inbox. */
import { draftSubject, normalizeCreateCaptureInput, shouldFileDraft } from '@/domain/captures';
import type { RecentAction } from '@/domain/undo/recentAction';

import type { CaptureClient } from './captureClient';

export async function fileDraftIfNeeded(
  client: Pick<CaptureClient, 'createCapture'>,
  text: string,
  record: (action: RecentAction) => void,
  openCapture: (id: string) => void,
): Promise<boolean> {
  if (!shouldFileDraft(text)) return false;
  const validation = normalizeCreateCaptureInput({ content: text, kind: 'note' });
  if (validation.kind !== 'ok') return false;
  let capture;
  try {
    capture = await client.createCapture(validation.input);
  } catch {
    return false;
  }
  const id = capture.id;
  record({
    kind: 'draftKeptInInbox',
    subject: draftSubject(text),
    undo: () => {
      openCapture(id);
      return Promise.resolve(true);
    },
  });
  return true;
}
