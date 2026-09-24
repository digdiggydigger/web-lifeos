/** `Capture/CaptureRowPresentation.swift` + `CaptureComposerCopy` + the fan slot colours. */
import { formatShortTime, isSameDay } from '@/domain/time/calendar';
import type { Capture, CaptureKind, Tag } from '@/domain/types';

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

export function captureSecondaryText(capture: Capture): string | undefined {
  const trimmed = capture.content.trim();
  if (trimmed.length === 0 || trimmed === capturePrimaryText(capture)) return undefined;
  return trimmed;
}

export function captureKindLabel(kind: CaptureKind): string {
  return kind.charAt(0).toUpperCase() + kind.slice(1);
}

function kindNoun(kind: CaptureKind): string {
  return { note: 'note', task: 'task', link: 'link', photo: 'photo note', voice: 'voice note' }[
    kind
  ];
}

export function captureCaption(capture: Capture, now: Date, locale?: string): string {
  const when = isSameDay(capture.createdAt, now)
    ? formatShortTime(capture.createdAt, locale)
    : `${capture.createdAt.toLocaleDateString(locale, { day: 'numeric', month: 'short', year: 'numeric' })}, ${formatShortTime(capture.createdAt, locale)}`;
  return `Captured ${when} · ${kindNoun(capture.kind)}`;
}

export function tagsForCapture(capture: Pick<Capture, 'tagIds'>, allTags: readonly Tag[]): Tag[] {
  if (!capture.tagIds) return [];
  return capture.tagIds.flatMap((id) => {
    const tag = allTags.find((t) => t.id === id);
    return tag ? [tag] : [];
  });
}

/** `CaptureFan.slot(for:)`: each kind's fill and on-colour, as token class names. */
export function captureKindClasses(kind: CaptureKind): {
  readonly fill: string;
  readonly on: string;
  readonly text: string;
} {
  return {
    note: { fill: 'bg-accent', on: 'text-on-area-work', text: 'text-accent' },
    voice: {
      fill: 'bg-area-growth-vivid',
      on: 'text-on-area-growth',
      text: 'text-area-growth-vivid',
    },
    photo: {
      fill: 'bg-area-health-vivid',
      on: 'text-on-area-health',
      text: 'text-area-health-vivid',
    },
    link: { fill: 'bg-area-admin-vivid', on: 'text-on-area-admin', text: 'text-area-admin-vivid' },
    task: { fill: 'bg-state-go-vivid', on: 'text-on-state-go', text: 'text-state-go-vivid' },
  }[kind];
}

export function captureComposerTitle(kind: CaptureKind): string {
  return { note: 'Note', voice: 'Voice note', photo: 'Photo', link: 'Link', task: 'Task' }[kind];
}

export function captureComposerHint(kind: CaptureKind): string {
  return {
    note: 'Get it out of your head. You can decide what it is later.',
    voice: "Say it all — stop when you're done.",
    photo: 'A whiteboard, a letter, a shelf you keep meaning to fix.',
    link: "Paste it in. You can decide what it's for later.",
    task: 'You already know this is a task. Give it an effort and it lands in Today.',
  }[kind];
}

export function captureComposerFooter(kind: CaptureKind): string {
  switch (kind) {
    case 'voice':
      return 'Audio and transcript both go to your inbox.';
    case 'task':
      return 'Skips the inbox — this one goes straight to your list.';
    default:
      return 'Saves to your inbox — nothing gets scheduled yet.';
  }
}

export function captureComposerPlaceholder(kind: CaptureKind): string {
  switch (kind) {
    case 'photo':
      return 'Caption (optional)';
    case 'link':
      return 'Paste a link';
    default:
      return "What's on your mind?";
  }
}
