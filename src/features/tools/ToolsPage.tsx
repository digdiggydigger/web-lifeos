import { ChevronRight, Tag, Trash2 } from 'lucide-react';
import { Link } from 'react-router';
import { useStore } from 'zustand';

import {
  SECTION_CAPTION,
  SECTION_TITLE,
  TOOLS_ROW_LOADING_SUBTITLE,
  toolsRowSubtitle,
} from '@/domain/recentlyDeleted';
import { useRecentlyDeleted } from '@/features/recentlyDeleted/useRecentlyDeleted';
import { Card } from '@/shared/Card';
import { PageHeader } from '@/shared/PageHeader';
import { SectionLabel } from '@/shared/SectionLabel';

/** `ToolsView`, the part that exists so far: the editors' doors and the Recently Deleted section. M1.7 adds the rest. */
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
      <SectionLabel className="mb-2">Organise</SectionLabel>
      <Card className="p-0">
        <ul className="divide-y divide-card-border">
          <li>
            <Link
              to="/areas/editor"
              className="flex min-h-14 items-center gap-2 px-4 text-base font-medium"
            >
              <span className="flex-1">Life Areas</span>
              <ChevronRight aria-hidden="true" className="size-4 text-label-tertiary" />
            </Link>
          </li>
          <li>
            <Link
              to="/tags"
              className="flex min-h-14 items-center gap-2 px-4 text-base font-medium"
            >
              <Tag aria-hidden="true" className="size-4 text-label-secondary" />
              <span className="flex-1">Tag Editor</span>
              <ChevronRight aria-hidden="true" className="size-4 text-label-tertiary" />
            </Link>
          </li>
        </ul>
      </Card>
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
