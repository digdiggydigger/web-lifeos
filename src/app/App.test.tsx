import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { beforeEach, describe, expect, it } from 'vitest';

import { appRoutes } from './router';
import { TABS } from './routes';

function renderAt(path: string) {
  const router = createMemoryRouter(appRoutes, { initialEntries: [path] });
  render(<RouterProvider router={router} />);
  return router;
}

beforeEach(() => {
  localStorage.clear();
  document.documentElement.removeAttribute('data-theme');
});

describe('shell', () => {
  it('redirects the root to Today', async () => {
    const router = renderAt('/');
    expect(await screen.findByRole('heading', { level: 1, name: 'Today' })).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/today');
  });

  it('shows the six iOS tabs in order in one primary navigation landmark', async () => {
    renderAt('/today');
    await screen.findByRole('heading', { level: 1, name: 'Today' });
    const nav = screen.getByRole('navigation', { name: 'Primary' });
    const links = within(nav).getAllByRole('link');
    const tabNames = TABS.map((t) => t.label);
    expect(links.slice(0, 6).map((l) => l.textContent)).toEqual(tabNames);
    expect(tabNames).toEqual(['Today', 'Tasks', 'Areas', 'Journal', 'Captures', 'Tools']);
  });

  it('marks the current tab with aria-current', async () => {
    renderAt('/journal');
    await screen.findByRole('heading', { level: 1, name: 'Journal' });
    const nav = screen.getByRole('navigation', { name: 'Primary' });
    expect(within(nav).getByRole('link', { name: 'Journal' })).toHaveAttribute(
      'aria-current',
      'page',
    );
    expect(within(nav).getByRole('link', { name: 'Tasks' })).not.toHaveAttribute('aria-current');
  });

  it('renders Not found for an unknown path with a way back', async () => {
    renderAt('/nope');
    expect(await screen.findByRole('heading', { level: 1, name: 'Not found' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Back to Today' })).toHaveAttribute('href', '/today');
  });

  it('keeps login outside the shell', async () => {
    renderAt('/login');
    expect(await screen.findByRole('heading', { level: 1, name: 'Sign in' })).toBeInTheDocument();
    expect(screen.queryByRole('navigation', { name: 'Primary' })).not.toBeInTheDocument();
  });
});

describe('settings appearance', () => {
  it('applies and persists the chosen appearance', async () => {
    const user = userEvent.setup();
    renderAt('/settings');
    await screen.findByRole('heading', { level: 1, name: 'Settings' });
    const group = screen.getByRole('radiogroup', { name: 'Appearance' });
    expect(within(group).getByRole('radio', { name: 'System' })).toBeChecked();

    await user.click(within(group).getByRole('radio', { name: 'Dark' }));
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
    expect(localStorage.getItem('settings.appearance')).toBe('dark');

    await user.click(within(group).getByRole('radio', { name: 'System' }));
    expect(document.documentElement.hasAttribute('data-theme')).toBe(false);
    expect(localStorage.getItem('settings.appearance')).toBeNull();
  });
});
