import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DesktopHeader, MainTab } from './DesktopHeader';
import { DEFAULT_APP_SETTINGS } from '../constants/defaultConfig';

function renderHeader(activeTab: MainTab = 'tracking', onSelectTab = vi.fn()) {
  render(
    <DesktopHeader
      settings={DEFAULT_APP_SETTINGS}
      onUpdateSettings={() => {}}
      onOpenSettings={() => {}}
      onOpenExport={() => {}}
      onOpenArchitecture={() => {}}
      activeTab={activeTab}
      onSelectTab={onSelectTab}
    />
  );
  return { onSelectTab };
}

describe('DesktopHeader', () => {
  it('offers both views', () => {
    renderHeader();

    expect(screen.getByRole('button', { name: 'Erfassen' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Auswertung' })).toBeInTheDocument();
  });

  it('marks the view that is showing', () => {
    renderHeader('insights');

    expect(screen.getByRole('button', { name: 'Auswertung' })).toHaveAttribute(
      'aria-current',
      'page'
    );
    expect(screen.getByRole('button', { name: 'Erfassen' })).not.toHaveAttribute('aria-current');
  });

  it('reports a switch', async () => {
    const user = userEvent.setup();
    const { onSelectTab } = renderHeader('tracking');

    await user.click(screen.getByRole('button', { name: 'Auswertung' }));

    expect(onSelectTab).toHaveBeenCalledWith('insights');
  });

  // The header used to repeat the product name and version that Windows
  // already draws in its own title bar, next to three coloured circles that
  // looked like window controls and had no click handler at all.
  it('does not repeat what the operating system already shows', () => {
    renderHeader();

    expect(screen.queryByText(/CHRONOS/i)).not.toBeInTheDocument();
    expect(screen.queryByText(new RegExp(`v${__APP_VERSION__}`))).not.toBeInTheDocument();
    expect(screen.queryByTitle('Schließen')).not.toBeInTheDocument();
    expect(screen.queryByTitle('Minimieren')).not.toBeInTheDocument();
    expect(screen.queryByTitle('Maximieren')).not.toBeInTheDocument();
  });

  // The count sat on the Export button while the export dialog already showed
  // the number of entries for the chosen period, which is the useful one.
  it('carries no entry count', () => {
    renderHeader();

    expect(screen.queryByText('0')).not.toBeInTheDocument();
  });
});
