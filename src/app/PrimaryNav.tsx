import { Settings } from 'lucide-react';
import { NavLink } from 'react-router';

import { TABS } from './routes';

const linkClass =
  'spring flex min-h-11 flex-col items-center justify-center gap-1 px-1 py-2 text-xs font-medium text-label-secondary ' +
  'aria-[current=page]:text-accent ' +
  'md:min-h-11 md:flex-row md:justify-start md:gap-2 md:rounded-card md:px-4 md:text-base ' +
  'md:aria-[current=page]:bg-card-surface-secondary md:aria-[current=page]:text-label-primary';

/**
 * The six-tab primary navigation: a bottom bar at phone/tablet widths, a sidebar on desktop.
 * One element, so assistive tech sees one "Primary" landmark whatever the viewport.
 */
export function PrimaryNav() {
  return (
    <nav
      aria-label="Primary"
      className={
        'fixed inset-x-0 bottom-0 z-40 border-t border-card-border bg-card-surface pb-[env(safe-area-inset-bottom)] ' +
        'md:sticky md:inset-auto md:top-0 md:flex md:h-dvh md:w-56 md:shrink-0 md:flex-col md:border-t-0 md:border-r md:p-4 md:pb-4'
      }
    >
      <p className="mb-6 hidden px-4 text-lg font-bold tracking-tight md:block">ADHD LifeOS</p>
      <ul className="grid grid-cols-6 md:flex md:flex-col md:gap-1">
        {TABS.map((tab) => (
          <li key={tab.path}>
            <NavLink to={tab.path} className={linkClass}>
              <tab.icon aria-hidden="true" className="size-6" />
              <span>{tab.label}</span>
            </NavLink>
          </li>
        ))}
      </ul>
      <div className="mt-auto hidden md:block">
        <NavLink to="/settings" className={linkClass}>
          <Settings aria-hidden="true" className="size-6" />
          <span>Settings</span>
        </NavLink>
      </div>
    </nav>
  );
}
