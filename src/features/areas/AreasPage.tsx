import { ArrowUpDown } from 'lucide-react';
import { useEffect, useMemo } from 'react';
import { Link } from 'react-router';
import { useStore } from 'zustand';

import { areasGridMetaLine, areasGridTaskCount, unfiledLine } from '@/domain/lifeAreas';
import type { AreasGridItem } from '@/domain/lifeAreas';
import { areaStatusLine } from '@/domain/momentum/momentumScoreboard';
import type { AreaStatusTone } from '@/domain/momentum/momentumScoreboard';
import { Card } from '@/shared/Card';
import { EmptyState } from '@/shared/EmptyState';
import { PageHeader } from '@/shared/PageHeader';
import { SectionLabel } from '@/shared/SectionLabel';

import { areaClasses } from './AreaWash';
import { createAreasStore } from './areasStore';
import { useAreaClients } from './useAreaClients';

const toneClass: Record<AreaStatusTone, string> = {
  plain: 'text-label-secondary',
  clear: 'text-state-go',
  quiet: 'text-state-warn',
};

function AreaCard({ item, now }: { readonly item: AreasGridItem; readonly now: Date }) {
  const { area, closedThisWeek, open, lastClosedAt } = item.momentum;
  const status = areaStatusLine(closedThisWeek, open, lastClosedAt, now);
  const c = areaClasses(area);
  return (
    <li>
      <Link
        to={`/areas/${area.id}`}
        aria-label={`${area.name}. ${status.text}`}
        className={`spring flex min-h-24 overflow-hidden rounded-card border border-card-border shadow-card ${c.tint}`}
      >
        <span aria-hidden="true" className={`w-2 shrink-0 ${c.rail}`} />
        <span className="flex min-w-0 flex-1 flex-col gap-1 p-4">
          <span className="flex items-center gap-2">
            <span aria-hidden="true" className="text-2xl">
              {area.colour}
            </span>
            <span className="truncate text-base font-semibold">{area.name}</span>
          </span>
          <span className={`text-sm ${toneClass[status.tone]}`}>{status.text}</span>
          <span className="text-xs text-label-tertiary">
            {areasGridMetaLine(areasGridTaskCount(item), item.logCount, item.captureCount)}
          </span>
        </span>
      </Link>
    </li>
  );
}

/** `AreasView`: one card per active area, the Unfiled card, the week-share bar, and the editor door. */
export function AreasPage() {
  const client = useAreaClients();
  const store = useMemo(() => createAreasStore(client), [client]);
  const state = useStore(store, (s) => s.state);
  const unfiled = useStore(store, (s) => s.unfiledCount);
  const share = useStore(store, (s) => s.weekShare);
  const now = new Date();

  useEffect(() => {
    void store.getState().load();
  }, [store]);

  return (
    <>
      <PageHeader
        title="Areas"
        subtitle="Where your attention goes, area by area"
        trailing={
          <Link
            to="/areas/editor"
            aria-label="Reorder or add an area"
            className="spring flex size-11 items-center justify-center rounded-card border border-card-border text-accent"
          >
            <ArrowUpDown aria-hidden="true" className="size-6" />
          </Link>
        }
      />
      {state.kind === 'loading' ? (
        <p role="status" className="text-sm text-label-secondary">
          Loading…
        </p>
      ) : null}
      {state.kind === 'failed' ? (
        <EmptyState title="Couldn't load your areas" body={state.message} />
      ) : null}
      {state.kind === 'loaded' && state.items.length === 0 ? (
        <EmptyState
          title="No life areas yet"
          body="Add one to start filing tasks and journal entries."
          action={
            <Link to="/areas/editor" className="min-h-11 font-semibold text-accent">
              Add an area
            </Link>
          }
        />
      ) : null}
      {state.kind === 'loaded' && state.items.length > 0 ? (
        <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2" aria-label="Life areas">
          {state.items.map((item) => (
            <AreaCard key={item.momentum.area.id} item={item} now={now} />
          ))}
        </ul>
      ) : null}
      {state.kind === 'loaded' ? (
        <>
          <SectionLabel className="mt-6 mb-2">Unfiled</SectionLabel>
          <Card>
            <p className="text-sm text-label-secondary">{unfiledLine(unfiled)}</p>
          </Card>
          {share ? (
            <section aria-label="This week" className="mt-6">
              <SectionLabel className="mb-2">This week</SectionLabel>
              <Card>
                <div className="flex h-4 overflow-hidden rounded-card" aria-hidden="true">
                  {share.segments.map((s) => (
                    <span
                      key={s.area.id}
                      className={areaClasses(s.area).solid}
                      style={{ width: `${s.fraction * 100}%` }}
                    />
                  ))}
                </div>
                <p className="mt-2 text-sm text-label-secondary">{share.caption}</p>
              </Card>
            </section>
          ) : null}
          <p className="mt-6 text-xs text-label-tertiary">
            <Link to="/areas/editor" className="text-accent">
              Reorder or add an area
            </Link>
          </p>
        </>
      ) : null}
    </>
  );
}
