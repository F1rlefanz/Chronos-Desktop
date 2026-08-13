import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { DesktopHeader } from './DesktopHeader';
import { DEFAULT_APP_SETTINGS } from '../constants/defaultConfig';

function renderHeader() {
  return render(
    <DesktopHeader
      settings={DEFAULT_APP_SETTINGS}
      onUpdateSettings={() => {}}
      onOpenSettings={() => {}}
      onOpenExport={() => {}}
      onOpenArchitecture={() => {}}
      activeEntriesCount={0}
    />
  );
}

describe('DesktopHeader', () => {
  // The badge used to carry a hardcoded "v1.2.0" while package.json said 0.1.0.
  // Nothing caught it because nothing asserted the two were related.
  it('shows the version the build was stamped with', () => {
    renderHeader();

    expect(screen.getByText(`v${__APP_VERSION__}`)).toBeInTheDocument();
  });

  it('stamps a plain semantic version, not a placeholder', () => {
    expect(__APP_VERSION__).toMatch(/^\d+\.\d+\.\d+/);
  });
});
