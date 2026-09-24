import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import '@/index.css';
import { initAppearance } from '@/theme/theme';

import { App } from './App';

initAppearance();

const container = document.getElementById('root');
if (!container) {
  throw new Error('Missing #root container');
}

createRoot(container).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
