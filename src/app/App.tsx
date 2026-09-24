import { createBrowserRouter, RouterProvider } from 'react-router';

import { AuthProvider } from './auth/AuthProvider';
import { appRoutes } from './router';

const router = createBrowserRouter(appRoutes);

export function App() {
  return (
    <AuthProvider>
      <RouterProvider router={router} />
    </AuthProvider>
  );
}
