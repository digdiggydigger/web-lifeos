import { ChevronRight, LayoutGrid, MapPin, Smartphone, Tag, Trash2 } from 'lucide-react';
import { Link } from 'react-router';
import { useStore } from 'zustand';

import {
  SECTION_CAPTION,
  SECTION_TITLE,
  TOOLS_ROW_LOADING_SUBTITLE,
  toolsRowSubtitle,
} from '@/domain/recentlyDeleted';
import {
  PHONE_ONLY_BADGE,
  PHONE_ONLY_NOTE,
  ROUTINES_SECTION_TITLE,
  TOOLS_ENTRIES,
  toolsEntryId,
} from '@/domain/tools';
import type { ToolsEntry } from '@/domain/tools';
import { useRecentlyDeleted } from '@/features/recentlyDeleted/useRecentlyDeleted';
import { Card } from '@/shared/Card';
import { PageHeader } from '@/shared/PageHeader';
import { SectionLabel } from '@/shared/SectionLabel';

const GLYPHS: Record<ToolsEntry['glyph'], typeof MapPin> = { pin: MapPin, grid: LayoutGrid };

function EntryRow({ entry }: { readonly entry: ToolsEntry }) {
  const Glyph = GLYPHS[entry.glyph];
  const body = (
    <>
      <span className="flex size-11 shrink-0 items-center justify-center rounded-card bg-card-surface-secondary text-label-secondary">
        <Glyph aria-hidden="true" className="size-6" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2 text-base font-medium">
          {entry.title}
          {entry.availability.kind === 'phone' ? (
            <span className="rounded-card bg-card-surface-secondary px-2 py-1 text-xs font-semibold text-label-secondary">
              {PHONE_ONLY_BADGE}
            </span>
          ) : null}
        </span>
        <span className="block text-xs text-label-secondary">{entry.caption}</span>
      </span>
    </>
  );
  return (
    <li id={toolsEntryId(entry)}>
      {entry.availability.kind === 'route' ? (
        <Link to={entry.availability.path} className="flex min-h-14 items-center gap-2 px-4 py-2">
          {body}
          <ChevronRight aria-hidden="true" className="size-4 text-label-tertiary" />
        </Link>
      ) : (
        <div className="flex min-h-14 items-center gap-2 px-4 py-2">
          {body}
          <Smartphone aria-hidden="true" className="size-4 text-label-tertiary" />
        </div>
      )}
    </li>
  );
}

/** `ToolsView`: the catalog doors, the Tag Editor door, the Routines note, and Recently Deleted. */
export function ToolsPage() {
  const store = useRecentlyDeleted();
  const screen = useStore(store, (s) => s.screen);
  const items = useStore(store, (s) => s.items);
  const subtitle =
    screen.kind === 'loading' || screen.kind === 'failed'
      ? TOOLS_ROW_LOADING_SUBTITLE
      : toolsRowSubtitle(items, new Date());

  return (
    <>
      <PageHeader title="Tools" />
      <Card className="p-0">
        <ul className="divide-y divide-card-border" aria-label="Tools">
          {TOOLS_ENTRIES.map((entry) => (
            <EntryRow key={entry.destination} entry={entry} />
          ))}
          <li>
            <Link to="/tags" className="flex min-h-14 items-center gap-2 px-4 py-2">
              <span className="flex size-11 shrink-0 items-center justify-center rounded-card bg-card-surface-secondary text-label-secondary">
                <Tag aria-hidden="true" className="size-6" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-base font-medium">Tag Editor</span>
                <span className="block text-xs text-label-secondary">
                  Rename, merge, and delete tags.
                </span>
              </span>
              <ChevronRight aria-hidden="true" className="size-4 text-label-tertiary" />
            </Link>
          </li>
        </ul>
      </Card>
      <section aria-label={ROUTINES_SECTION_TITLE} className="mt-6">
        <SectionLabel className="mb-2">{ROUTINES_SECTION_TITLE}</SectionLabel>
        <Card className="flex items-start gap-2">
          <Smartphone aria-hidden="true" className="mt-1 size-4 shrink-0 text-label-secondary" />
          <p className="text-sm text-label-secondary">{PHONE_ONLY_NOTE}</p>
        </Card>
      </section>
      <section aria-label={SECTION_TITLE} className="mt-6">
        <SectionLabel className="mb-1">{SECTION_TITLE}</SectionLabel>
        <p className="mb-2 text-xs text-label-secondary">{SECTION_CAPTION}</p>
        <Card className="p-0">
          <Link to="/tools/recently-deleted" className="flex min-h-14 items-center gap-2 px-4 py-2">
            <span className="flex size-11 shrink-0 items-center justify-center rounded-card bg-card-surface-secondary text-label-secondary">
              <Trash2 aria-hidden="true" className="size-6" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-base font-medium">{SECTION_TITLE}</span>
              <span className="block text-xs text-label-secondary">{subtitle}</span>
            </span>
            <ChevronRight aria-hidden="true" className="size-4 text-label-tertiary" />
          </Link>
        </Card>
      </section>
    </>
  );
}
