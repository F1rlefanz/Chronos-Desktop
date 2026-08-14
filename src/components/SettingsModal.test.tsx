import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SettingsModal } from './SettingsModal';
import { DEFAULT_APP_SETTINGS } from '../constants/defaultConfig';
import { AppSettings, Project } from '../types';

const projects: Project[] = [
  { id: 'proj-work', name: 'Arbeit', color: '#3b82f6' },
  { id: 'proj-study', name: 'Lernen', color: '#8b5cf6' },
];

const onUpdateSettings = vi.fn();
const onUpdateProjects = vi.fn();

function renderModal(settings: Partial<AppSettings> = {}) {
  return render(
    <SettingsModal
      isOpen
      onClose={() => {}}
      settings={{ ...DEFAULT_APP_SETTINGS, ...settings }}
      onUpdateSettings={onUpdateSettings}
      projects={projects}
      onUpdateProjects={onUpdateProjects}
      onImportData={() => {}}
    />
  );
}

/** The default-project control, found the way a user finds it. */
function defaultProjectSelect() {
  return screen.getByRole('combobox', { name: /Standardprojekt/ });
}

describe('SettingsModal default project', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // defaultProject was read by App but written by nothing: a setting the user
  // could not reach, which is the same dead switch as a setting nobody reads.
  it('offers every project as the default', () => {
    renderModal();

    const options = screen.getAllByRole('option').map((option) => option.textContent);
    expect(options).toEqual(expect.arrayContaining(['Arbeit', 'Lernen']));
  });

  it('shows the project that is currently the default', () => {
    renderModal({ defaultProject: 'proj-study' });

    expect(defaultProjectSelect()).toHaveValue('proj-study');
  });

  it('saves the chosen default', async () => {
    const user = userEvent.setup();
    renderModal({ defaultProject: 'proj-work' });

    await user.selectOptions(defaultProjectSelect(), 'proj-study');

    expect(onUpdateSettings).toHaveBeenCalledWith({ defaultProject: 'proj-study' });
  });

  it('moves the default on when its project is deleted', async () => {
    // Otherwise the setting points at a project that no longer exists and the
    // dropdown shows a value it has no option for.
    const user = userEvent.setup();
    renderModal({ defaultProject: 'proj-study' });

    const deleteButtons = screen.getAllByTitle('Projekt löschen');
    await user.click(deleteButtons[1]);

    expect(onUpdateProjects).toHaveBeenCalledWith([projects[0]]);
    expect(onUpdateSettings).toHaveBeenCalledWith({ defaultProject: 'proj-work' });
  });

  it('leaves the default alone when another project is deleted', async () => {
    const user = userEvent.setup();
    renderModal({ defaultProject: 'proj-work' });

    const deleteButtons = screen.getAllByTitle('Projekt löschen');
    await user.click(deleteButtons[1]);

    expect(onUpdateProjects).toHaveBeenCalled();
    expect(onUpdateSettings).not.toHaveBeenCalled();
  });
});
