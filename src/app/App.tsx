import { createBrowserRouter, RouterProvider } from 'react-router';

import { appRoutes } from './router';

const router = createBrowserRouter(appRoutes);

export function App() {
  return <RouterProvider router={router} />;
}
