import { Navigate } from 'react-router';
import type { RouteObject } from 'react-router';

import { AreasPage } from '@/features/areas/AreasPage';
import { LifeAreaDetailPage } from '@/features/areas/LifeAreaDetailPage';
import { LoginPage } from '@/features/auth/LoginPage';
import { CaptureDetailPage } from '@/features/captures/CaptureDetailPage';
import { CapturesPage } from '@/features/captures/CapturesPage';
import { TokensPage } from '@/features/dev/TokensPage';
import { FocusSprintPage } from '@/features/focus/FocusSprintPage';
import { JournalPage } from '@/features/journal/JournalPage';
import { LifeAreaEditorDetailPage } from '@/features/lifeAreaEditor/LifeAreaEditorDetailPage';
import { LifeAreaEditorListPage } from '@/features/lifeAreaEditor/LifeAreaEditorListPage';
import { NudgesPage } from '@/features/nudges/NudgesPage';
import { RecentlyDeletedPage } from '@/features/recentlyDeleted/RecentlyDeletedPage';
import { SettingsPage } from '@/features/settings/SettingsPage';
import { TagEditorDetailPage } from '@/features/tagEditor/TagEditorDetailPage';
import { TagEditorListPage } from '@/features/tagEditor/TagEditorListPage';
import { TaskDetailPage } from '@/features/tasks/TaskDetailPage';
import { TasksPage } from '@/features/tasks/TasksPage';
import { TodayPage } from '@/features/today/TodayPage';
import { WeekReviewPage } from '@/features/today/WeekReviewPage';
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
          { path: 'today/week-review', element: <WeekReviewPage /> },
          { path: 'nudges', element: <NudgesPage /> },
          { path: 'focus', element: <FocusSprintPage /> },
          { path: 'tasks', element: <TasksPage /> },
          { path: 'tasks/:id', element: <TaskDetailPage /> },
          { path: 'areas', element: <AreasPage /> },
          { path: 'areas/editor', element: <LifeAreaEditorListPage /> },
          { path: 'areas/editor/:id', element: <LifeAreaEditorDetailPage /> },
          { path: 'areas/:id', element: <LifeAreaDetailPage /> },
          { path: 'tags', element: <TagEditorListPage /> },
          { path: 'tags/:id', element: <TagEditorDetailPage /> },
          { path: 'journal', element: <JournalPage /> },
          { path: 'captures', element: <CapturesPage /> },
          { path: 'captures/:id', element: <CaptureDetailPage /> },
          { path: 'tools', element: <ToolsPage /> },
          { path: 'tools/recently-deleted', element: <RecentlyDeletedPage /> },
          { path: 'settings', element: <SettingsPage /> },
          ...devRoutes,
          { path: '*', element: <NotFoundPage /> },
        ],
      },
    ],
  },
];
