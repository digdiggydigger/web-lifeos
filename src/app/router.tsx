import { Navigate } from 'react-router';
import type { RouteObject } from 'react-router';

import { AreasPage } from '@/features/areas/AreasPage';
import { LoginPage } from '@/features/auth/LoginPage';
import { CapturesPage } from '@/features/captures/CapturesPage';
import { TokensPage } from '@/features/dev/TokensPage';
import { JournalPage } from '@/features/journal/JournalPage';
import { SettingsPage } from '@/features/settings/SettingsPage';
import { TaskDetailPage } from '@/features/tasks/TaskDetailPage';
import { TasksPage } from '@/features/tasks/TasksPage';
import { TodayPage } from '@/features/today/TodayPage';
import { ToolsPage } from '@/features/tools/ToolsPage';

import { PublicOnly, RequireAuth } from './auth/AuthGate';
import { NotFoundPage } from './NotFoundPage';
import { HOME_PATH } from './routes';
import { Shell } from './Shell';

const devRoutes: RouteObject[] = import.meta.env.DEV
  ? [{ path: 'dev/tokens', element: <TokensPage /> }]
  : [];

export const appRoutes: RouteObject[] = [
  { element: <PublicOnly />, children: [{ path: '/login', element: <LoginPage /> }] },
  {
    element: <RequireAuth />,
    children: [
      {
        path: '/',
        element: <Shell />,
        children: [
          { index: true, element: <Navigate to={HOME_PATH} replace /> },
          { path: 'today', element: <TodayPage /> },
          { path: 'tasks', element: <TasksPage /> },
          { path: 'tasks/:id', element: <TaskDetailPage /> },
          { path: 'areas', element: <AreasPage /> },
          { path: 'journal', element: <JournalPage /> },
          { path: 'captures', element: <CapturesPage /> },
          { path: 'tools', element: <ToolsPage /> },
          { path: 'settings', element: <SettingsPage /> },
          ...devRoutes,
          { path: '*', element: <NotFoundPage /> },
        ],
      },
    ],
  },
];
