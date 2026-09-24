import { BookOpen, Inbox, LayoutGrid, ListChecks, TrendingUp, Wrench } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

export interface TabDefinition {
  readonly path: string;
  readonly label: string;
  readonly icon: LucideIcon;
}

/** The iOS app's six tabs, in its order (Theme/AppTabBar.swift). */
export const TABS: readonly TabDefinition[] = [
  { path: '/today', label: 'Today', icon: TrendingUp },
  { path: '/tasks', label: 'Tasks', icon: ListChecks },
  { path: '/areas', label: 'Areas', icon: LayoutGrid },
  { path: '/journal', label: 'Journal', icon: BookOpen },
  { path: '/captures', label: 'Captures', icon: Inbox },
  { path: '/tools', label: 'Tools', icon: Wrench },
];

export const HOME_PATH = '/today';
