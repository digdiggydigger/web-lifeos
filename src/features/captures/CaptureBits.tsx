import { Check, Image as ImageIcon, Link2, Mic, StickyNote } from 'lucide-react';

import { captureKindClasses, capturePrimaryText, tagsForCapture } from '@/domain/captures';
import type { Capture, CaptureKind, LifeArea, Tag } from '@/domain/types';

const ICONS: Record<CaptureKind, typeof StickyNote> = {
  note: StickyNote,
  task: Check,
  link: Link2,
  voice: Mic,
  photo: ImageIcon,
};

export function CaptureKindGlyph({
  kind,
  className = 'size-4',
}: {
  readonly kind: CaptureKind;
  readonly className?: string;
}) {
  const Icon = ICONS[kind];
  return (
    <Icon aria-hidden="true" className={`${className} shrink-0 ${captureKindClasses(kind).text}`} />
  );
}

export function TagChips({ tags }: { readonly tags: readonly Tag[] }) {
  if (tags.length === 0) return null;
  return (
    <ul className="flex flex-wrap gap-2" aria-label={`Tags: ${tags.map((t) => t.name).join(', ')}`}>
      {tags.map((tag) => (
        <li
          key={tag.id}
          className="rounded-card bg-card-surface-secondary px-2 py-1 text-xs font-semibold text-label-secondary"
        >
          {tag.name}
        </li>
      ))}
    </ul>
  );
}

/** `CaptureRowView`: glyph, primary text, area, tags, and a Sorted / Promoted chip on the archive slices. */
export function CaptureRowSummary({
  capture,
  lifeAreas,
  allTags,
}: {
  readonly capture: Capture;
  readonly lifeAreas: readonly LifeArea[];
  readonly allTags: readonly Tag[];
}) {
  const area = capture.lifeAreaId ? lifeAreas.find((a) => a.id === capture.lifeAreaId) : undefined;
  const tags = tagsForCapture(capture, allTags);
  return (
    <div className="flex min-w-0 flex-1 items-start gap-2">
      <span className="pt-1">
        <CaptureKindGlyph kind={capture.kind} />
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <p className="line-clamp-2 text-sm font-medium">{capturePrimaryText(capture)}</p>
        {area ? (
          <p className="text-xs text-label-secondary" aria-label={`Life area ${area.name}`}>
            {area.colour} {area.name}
          </p>
        ) : null}
        <TagChips tags={tags} />
      </div>
      {capture.processed ? (
        <span className="shrink-0 rounded-card bg-state-go px-2 py-1 text-xs font-semibold text-on-state-go">
          Promoted
        </span>
      ) : capture.seen ? (
        <span className="shrink-0 rounded-card bg-card-surface-secondary px-2 py-1 text-xs font-semibold text-label-secondary">
          Sorted
        </span>
      ) : null}
    </div>
  );
}
