/** `Capture/CaptureRowPresentation.swift`: what a capture row says. */
import type { Capture, CaptureKind } from '@/domain/types';

function isNonEmpty(text: string | undefined): text is string {
  return text !== undefined && text.trim().length > 0;
}

export function capturePrimaryText(capture: Capture): string {
  if (isNonEmpty(capture.title)) return capture.title;
  if (capture.kind === 'link' && isNonEmpty(capture.linkPreview?.title))
    return capture.linkPreview.title;
  if (isNonEmpty(capture.content)) return capture.content;
  return capture.kind === 'photo' ? 'Photo capture' : 'Untitled capture';
}

export function captureKindLabel(kind: CaptureKind): string {
  return kind.charAt(0).toUpperCase() + kind.slice(1);
}
