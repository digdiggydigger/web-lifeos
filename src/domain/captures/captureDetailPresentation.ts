/** `Capture/CaptureDetailPresentation.swift`. */
import type { Capture, CaptureKind } from '@/domain/types';

import { capturePrimaryText } from './captureRowPresentation';
import { canSort } from './captureTriage';

export function captureDetailHeadline(capture: Capture): string {
  if (capture.kind === 'voice' && !(capture.title?.trim().length ?? 0)) return 'Voice note';
  return capturePrimaryText(capture);
}

export function captureTranscript(capture: Capture): string | undefined {
  if (capture.kind !== 'voice') return undefined;
  const trimmed = capture.content.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

export function captureNavTitle(kind: CaptureKind): string {
  return {
    note: '📝 Note',
    task: '✅ Task',
    link: '🌐 Link',
    voice: '🗣️ Voice',
    photo: '📸 Photo',
  }[kind];
}

export function captureTimestamp(date: Date, locale?: string): string {
  return date.toLocaleString(locale, {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export function detailCanSort(selectedLifeAreaId: string | undefined): boolean {
  return canSort(selectedLifeAreaId);
}

export function sortHint(canSortNow: boolean): string {
  return canSortNow
    ? 'Files this capture in the chosen area and clears it from your inbox.'
    : 'Choose a life area above first.';
}

export function canReturnToInbox(capture: Pick<Capture, 'seen' | 'processed'>): boolean {
  return capture.seen === true && !capture.processed;
}

export function captureSourceURL(capture: Capture): URL | undefined {
  if (capture.kind !== 'link') return undefined;
  const raw = (capture.linkPreview?.url ?? capture.content).trim();
  try {
    const url = new URL(raw);
    return url.hostname ? url : undefined;
  } catch {
    return undefined;
  }
}

export function captureSourceDomain(capture: Capture): string | undefined {
  const host = captureSourceURL(capture)?.hostname;
  if (!host) return undefined;
  return host.startsWith('www.') ? host.slice(4) : host;
}
