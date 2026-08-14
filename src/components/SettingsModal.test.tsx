import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SettingsModal, SyncControls } from './SettingsModal';
import { DEFAULT_APP_SETTINGS } from '../constants/defaultConfig';
import { AppSettings, Project } from '../types';

const projects: Project[] = [
  { id: 'proj-work', name: 'Arbeit', color: '#3b82f6' },
  { id: 'proj-study', name: 'Lernen', color: '#8b5cf6' },
];

const onUpdateSettings = vi.fn();
const onUpdateProjects = vi.fn();

function renderModal(settings: Partial<AppSettings> = {}, sync?: SyncControls) {
  return render(
    <SettingsModal
      isOpen
      onClose={() => {}}
      settings={{ ...DEFAULT_APP_SETTINGS, ...settings }}
      onUpdateSettings={onUpdateSettings}
      projects={projects}
      onUpdateProjects={onUpdateProjects}
      onImportData={() => {}}
      sync={sync}
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

describe('SettingsModal syncing', () => {
  const controls = (over: Partial<SyncControls> = {}): SyncControls => ({
    folder: '',
    status: { state: 'idle' },
    onChooseFolder: vi.fn(),
    onStopSyncing: vi.fn(),
    onSyncNow: vi.fn(),
    ...over,
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  // The browser and the phone cannot reach a folder at all. A disabled switch
  // would tell the user the feature exists and is broken; absence is honest.
  it('says nothing about syncing on a build that cannot', () => {
    renderModal();

    expect(screen.queryByText(/Geteilter Ordner/)).not.toBeInTheDocument();
  });

  it('offers to choose a folder before one is set, and nothing else', () => {
    renderModal({}, controls());

    expect(screen.getByRole('button', { name: /Ordner wählen/ })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Jetzt abgleichen/ })).not.toBeInTheDocument();
  });

  it('shows the folder in use and syncs on request', async () => {
    const user = userEvent.setup();
    const onSyncNow = vi.fn();
    renderModal({}, controls({ folder: 'D:/OneDrive/Chronos', onSyncNow }));

    expect(screen.getByText('D:/OneDrive/Chronos')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /Jetzt abgleichen/ }));

    expect(onSyncNow).toHaveBeenCalled();
  });

  it('reports what the last sync did, so a folder nobody writes to is visible', () => {
    renderModal(
      {},
      controls({
        folder: 'D:/Chronos',
        status: { state: 'done', message: '2 neu, 0 aktualisiert' },
      })
    );

    expect(screen.getByRole('status')).toHaveTextContent('2 neu, 0 aktualisiert');
  });

  it('does not let a second sync be started while one is running', () => {
    renderModal({}, controls({ folder: 'D:/Chronos', status: { state: 'running' } }));

    expect(screen.getByRole('button', { name: /Jetzt abgleichen/ })).toBeDisabled();
  });
});
