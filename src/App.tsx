import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useBackupOnClose } from './hooks/useBackupOnClose';
import { pruneTombstones, tombstoneFor } from './domain/merge';
import { useLiveDuration } from './hooks/useLiveDuration';
import { useNow } from './hooks/useNow';
import { AppSettings, Project, TimeEntry, TimerState, Tombstone } from './types';
import { closeOpenBreak, hasRunningBreak, isRunning } from './domain/timeEntry';
import {
  monthlySeries,
  summarise,
  weekdayTotals,
  weeklySeries,
  WEEKDAY_LABELS,
} from './domain/stats';
import { ImportedData, buildBackupPayload } from './utils/dataExporter';
import { logInfo, logWarn, loggingToFile, revealLogs } from './utils/logging/logger';
import { isMobilePlatform } from './utils/platform';
import {
  saveSettings,
  saveTimeEntries,
  saveProjects,
  migrateSettings,
  saveTombstones,
  backupsAvailable,
  ensureDailyBackup,
  writeBackup,
  revealBackups,
  BackupReason,
  PersistedState,
  WriteResult,
} from './utils/storage';

import { DesktopHeader, MainTab } from './components/DesktopHeader';
import { StopwatchDisplay } from './components/StopwatchDisplay';
import { ControlPanel } from './components/ControlPanel';
import { BreakList } from './components/BreakList';
import { RecoveryPrompt } from './components/RecoveryPrompt';
import { StatCards } from './components/StatCards';
import { MonthCalendar } from './components/MonthCalendar';
import { TimeBarChart } from './components/TimeBarChart';
import { SessionSaverModal } from './components/SessionSaverModal';
import { EntryFormModal, EntryDraft } from './components/EntryFormModal';
import { SessionHistory } from './components/SessionHistory';
import { ExportModal } from './components/ExportModal';
import { SettingsModal } from './components/SettingsModal';
import { ArchitectureModal } from './components/ArchitectureModal';

interface AppProps {
  /** Read from storage in `main.tsx` before the first render. */
  initialState: PersistedState;
}

export default function App({ initialState }: AppProps) {
  // Application Data Persistence States
  const [settings, setSettings] = useState<AppSettings>(initialState.settings);
  const [timeEntries, setTimeEntries] = useState<TimeEntry[]>(initialState.entries);
  // What has been deleted. Kept so a second device can be told; without it a
  // merge cannot tell a deletion from an entry the other side never had.
  const [tombstones, setTombstones] = useState<Tombstone[]>(initialState.tombstones);
  const [projects, setProjects] = useState<Project[]>(initialState.projects);

  // Selected Active Project for current timer session
  const [selectedProjectId, setSelectedProjectId] = useState<string>(
    settings.defaultProject || projects[0]?.id || 'proj-work'
  );

  // Which half of the app is showing. Local state on purpose: putting it in
  // AppSettings would create a stored field to migrate and keep a reader for,
  // and reopening on the view you last used is not worth that.
  const [activeTab, setActiveTab] = useState<MainTab>('tracking');

  // Modal Visibility States
  const [isSaverOpen, setIsSaverOpen] = useState<boolean>(false);
  const [isExportOpen, setIsExportOpen] = useState<boolean>(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState<boolean>(false);
  const [isArchitectureOpen, setIsArchitectureOpen] = useState<boolean>(false);

  // Set when a write to storage failed — usually the browser's 5 MB quota,
  // which a long history plus a large import can reach. The write is the only
  // copy of the data, so failing silently means the entry is gone on the next
  // reload. `detail` is the backend's own explanation.
  const [persistenceError, setPersistenceError] = useState<{
    what: string;
    detail: string;
  } | null>(null);

  // The just-stopped entry awaiting a title. It is already saved by the time
  // this is set, so only the id is held here.
  const [pendingSaveEntryId, setPendingSaveEntryId] = useState<string | null>(null);

  // The entry form doubles as "add" and "edit": `null` means a new entry that
  // never saw the stopwatch, which is the whole point of having the form.
  const [entryUnderEdit, setEntryUnderEdit] = useState<TimeEntry | null>(null);
  const [isEntryFormOpen, setIsEntryFormOpen] = useState<boolean>(false);

  // A measurement found already running in storage was started by an earlier
  // run of the app — after a crash, a reboot, or a closed window. It is only
  // ever asked about once, at startup, so this is seeded from the initial state
  // rather than watched: a measurement started in *this* session must not
  // trigger the prompt.
  const [recoveryEntryId, setRecoveryEntryId] = useState<string | null>(
    () => initialState.entries.find(isRunning)?.id ?? null
  );

  // The active project is derived, not stored a second time: deleting the
  // selected project (or importing a different project list) must not leave the
  // dropdown showing one project while saved entries carry a vanished id and
  // get labelled "General". Deriving it also avoids a repair effect that would
  // cascade an extra render.
  const currentProject = useMemo(() => {
    return (
      projects.find((p) => p.id === selectedProjectId) ||
      projects[0] || { id: 'proj-work', name: 'Allgemein', color: '#10b981' }
    );
  }, [projects, selectedProjectId]);

  const activeProjectId = currentProject.id;

  /**
   * The measurement in progress, if any — a normal entry with no end yet.
   *
   * There is no separate timer state to keep in step with it: what the
   * stopwatch is doing is a fact about the stored data, so it is read back out
   * rather than tracked alongside. That is also why a crash cannot desynchronise
   * the two.
   */
  const runningEntry = useMemo(() => timeEntries.find(isRunning) ?? null, [timeEntries]);

  const timerState: TimerState = pendingSaveEntryId
    ? 'STOPPED'
    : runningEntry
      ? hasRunningBreak(runningEntry)
        ? 'PAUSED'
        : 'RUNNING'
      : 'IDLE';

  const elapsedTimeMs = useLiveDuration(runningEntry, settings.timerIntervalMs);

  // A second, slower clock for everything that only needs to look live: the
  // break list and every aggregate, both of which count a running entry up to
  // this instant. It keeps ticking once a minute when nothing is running, and
  // that is not idle churn — "today" is a range, so an app left open across
  // midnight would otherwise go on totalling yesterday.
  const now = useNow(runningEntry ? 1000 : 60_000);

  // Recomputed from the entries on every change rather than maintained
  // alongside them: an edited entry moves its day, its week, its month and
  // every chart at once, with no total left behind to go stale.
  const summary = useMemo(() => summarise(timeEntries, now), [timeEntries, now]);

  const weekdaySeries = useMemo(
    () =>
      weekdayTotals(timeEntries, now).map((value, index) => ({
        label: WEEKDAY_LABELS[index],
        value,
      })),
    [timeEntries, now]
  );

  const lastTwelveWeeks = useMemo(() => weeklySeries(timeEntries, 12, now), [timeEntries, now]);

  const thisYearByMonth = useMemo(
    () => monthlySeries(timeEntries, new Date(now).getFullYear(), now),
    [timeEntries, now]
  );

  // The other half of the daily snapshot: that one captures the state at
  // startup, so without this the current session's work is in no snapshot until
  // the next launch.
  useBackupOnClose(() => buildBackupPayload(timeEntries, projects, settings));

  // One snapshot per day, of the state as it was found on disk — the slow
  // counterpart to the snapshots taken before a destructive action. It is
  // deliberately quiet: a missing daily backup loses nothing the user just did,
  // so a banner on startup would only alarm without offering an action.
  const dailyBackupRef = useRef(false);

  useEffect(() => {
    if (dailyBackupRef.current || !backupsAvailable()) return;
    dailyBackupRef.current = true;

    void ensureDailyBackup(() =>
      buildBackupPayload(initialState.entries, initialState.projects, initialState.settings)
    ).then((result) => {
      if (!result) return; // already taken today
      if (result.ok) {
        logInfo('[Backup] Daily snapshot written.');
      } else {
        logWarn(`[Backup] Daily snapshot failed: ${result.message}`);
      }
    });
  }, [initialState]);

  // A single AudioContext is reused for every cue: browsers cap the number of
  // concurrent contexts (Chrome allows six), so creating one per cue would
  // permanently kill audio after a handful of start/pause/stop transitions.
  const audioCtxRef = useRef<AudioContext | null>(null);

  const getAudioContext = useCallback((): AudioContext | null => {
    // Safari below 14.1 only exposes the prefixed constructor.
    const legacyWindow = window as Window & { webkitAudioContext?: typeof AudioContext };
    const Ctor = window.AudioContext || legacyWindow.webkitAudioContext;
    if (!Ctor) return null;

    if (!audioCtxRef.current || audioCtxRef.current.state === 'closed') {
      audioCtxRef.current = new Ctor();
    }
    // Autoplay policies suspend the context until a user gesture occurs.
    if (audioCtxRef.current.state === 'suspended') {
      void audioCtxRef.current.resume();
    }
    return audioCtxRef.current;
  }, []);

  // Release the shared context when the app unmounts.
  useEffect(() => {
    return () => {
      audioCtxRef.current?.close().catch(() => {
        /* context may already be closed */
      });
      audioCtxRef.current = null;
    };
  }, []);

  // Synthesized Web Audio API sound cue generator
  const playAudioCue = useCallback(
    (type: 'start' | 'pause' | 'stop') => {
      if (!settings.soundEnabled) return;
      try {
        const audioCtx = getAudioContext();
        if (!audioCtx) return;

        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();

        osc.connect(gain);
        gain.connect(audioCtx.destination);

        if (type === 'start') {
          osc.frequency.setValueAtTime(587.33, audioCtx.currentTime); // D5
          osc.frequency.setValueAtTime(880, audioCtx.currentTime + 0.08); // A5
          gain.gain.setValueAtTime(0.15, audioCtx.currentTime);
          gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.2);
          osc.start();
          osc.stop(audioCtx.currentTime + 0.2);
        } else if (type === 'pause') {
          osc.frequency.setValueAtTime(440, audioCtx.currentTime);
          gain.gain.setValueAtTime(0.12, audioCtx.currentTime);
          gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.15);
          osc.start();
          osc.stop(audioCtx.currentTime + 0.15);
        } else if (type === 'stop') {
          osc.frequency.setValueAtTime(349.23, audioCtx.currentTime); // F4
          gain.gain.setValueAtTime(0.15, audioCtx.currentTime);
          gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.25);
          osc.start();
          osc.stop(audioCtx.currentTime + 0.25);
        }
      } catch {
        // Fallback silently if web audio is restricted
      }
    },
    [settings.soundEnabled, getAudioContext]
  );

  // Every persisting handler routes its result through here, so a rejected
  // write surfaces in the UI instead of only in the console. A later successful
  // write clears the warning again.
  const writeSeqRef = useRef(0);

  // Stable across renders: the timer handlers below are memoised so the
  // keyboard listener is not torn down on every keystroke, and they can only
  // stay stable if what they call does too.
  const persist = useCallback(async (write: Promise<WriteResult>, what: string): Promise<void> => {
    const seq = ++writeSeqRef.current;
    const result = await write;

    // Only the newest write may touch the banner. Writes were synchronous
    // before storage went behind an adapter; now a slow failing write can
    // resolve after a later successful one and would otherwise resurrect a
    // warning for data that is safely stored.
    if (seq !== writeSeqRef.current) return;

    setPersistenceError(result.ok ? null : { what, detail: result.message });
  }, []);

  /**
   * Removes entries and records that they were removed.
   *
   * Both halves matter: dropping the entry is what the user asked for, the
   * tombstone is what lets another device learn about it instead of handing
   * the entry back on the next merge.
   */
  const removeEntries = (doomed: TimeEntry[], what: string) => {
    if (doomed.length === 0) return;

    const at = Date.now();
    const goneIds = new Set(doomed.map((entry) => entry.id));
    const remaining = timeEntries.filter((entry) => !goneIds.has(entry.id));
    const recorded = pruneTombstones(
      [...tombstones, ...doomed.map((entry) => tombstoneFor(entry.id, at))],
      remaining
    );

    setTimeEntries(remaining);
    setTombstones(recorded);
    void persist(saveTimeEntries(remaining), what);
    void saveTombstones(recorded);
  };

  const handleDeleteEntry = (id: string) => {
    removeEntries(
      timeEntries.filter((entry) => entry.id === id),
      'die Änderung'
    );
  };

  const openEntryForm = (entry: TimeEntry | null) => {
    setEntryUnderEdit(entry);
    setIsEntryFormOpen(true);
  };

  /**
   * Stores what the entry form produced — a correction to an existing entry, or
   * one that was typed in from scratch.
   *
   * No backup is taken first: unlike clearing the history or importing, editing
   * one entry does not replace the data set, and a confirmation on every
   * correction would train the user to click through it.
   */
  const handleSaveEntryDraft = (draft: EntryDraft) => {
    const now = Date.now();

    const updated = entryUnderEdit
      ? timeEntries.map((entry) =>
          entry.id === entryUnderEdit.id ? { ...entryUnderEdit, ...draft, updatedAt: now } : entry
        )
      : [
          {
            ...draft,
            id: `entry-${now}-${Math.random().toString(36).substring(2, 6)}`,
            createdAt: now,
            updatedAt: now,
            source: 'manual' as const,
          },
          ...timeEntries,
        ];

    setTimeEntries(updated);
    void persist(saveTimeEntries(updated), entryUnderEdit ? 'die Änderung' : 'den neuen Eintrag');
    setEntryUnderEdit(null);
  };

  /* ---------------------------------------------------------------------- */
  /* The running measurement                                                */
  /* ---------------------------------------------------------------------- */

  /**
   * Applies a change to the entry currently being measured and writes it out.
   *
   * Every transition of the stopwatch goes through here, which is what makes a
   * measurement survive a crash: the open entry is a normal, persisted entry
   * from the moment it starts, not state living in a hook that dies with the
   * process. Memoised because the keyboard shortcut effect depends on the
   * handlers built on top of it.
   */
  const patchRunningEntry = useCallback(
    (patch: (entry: TimeEntry) => TimeEntry, what: string): void => {
      const changedAt = Date.now();

      setTimeEntries((current) => {
        const updated = current.map((entry) =>
          isRunning(entry) ? { ...patch(entry), updatedAt: changedAt } : entry
        );
        void persist(saveTimeEntries(updated), what);
        return updated;
      });
    },
    [persist]
  );

  const handleStart = useCallback(() => {
    playAudioCue('start');

    const startedAt = Date.now();
    const entry: TimeEntry = {
      id: `entry-${startedAt}-${Math.random().toString(36).substring(2, 6)}`,
      title: '',
      project: activeProjectId,
      tags: [],
      startTime: startedAt,
      endTime: null,
      breaks: [],
      createdAt: startedAt,
      updatedAt: startedAt,
      source: 'stopwatch',
    };

    setTimeEntries((current) => {
      const updated = [entry, ...current];
      void persist(saveTimeEntries(updated), 'die gestartete Erfassung');
      return updated;
    });
  }, [playAudioCue, persist, activeProjectId]);

  const handlePause = useCallback(() => {
    playAudioCue('pause');
    patchRunningEntry(
      (entry) => ({
        ...entry,
        breaks: [
          ...entry.breaks,
          {
            id: `break-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
            startTime: Date.now(),
            endTime: null,
          },
        ],
      }),
      'die Pause'
    );
  }, [playAudioCue, patchRunningEntry]);

  const handleResume = useCallback(() => {
    playAudioCue('start');
    patchRunningEntry((entry) => ({ ...entry, breaks: closeOpenBreak(entry.breaks) }), 'die Pause');
  }, [playAudioCue, patchRunningEntry]);

  /**
   * Ends the measurement, then asks what it was.
   *
   * The entry is closed and written *before* the naming dialog opens, so
   * dismissing that dialog — or losing the window at that moment — costs a
   * title, not the recorded time.
   */
  const handleStopAndOpenSaver = useCallback(() => {
    playAudioCue('stop');

    const stoppedAt = Date.now();
    let stoppedId: string | null = null;

    setTimeEntries((current) => {
      const updated = current.map((entry) => {
        if (!isRunning(entry)) return entry;
        stoppedId = entry.id;
        return { ...entry, endTime: stoppedAt, breaks: closeOpenBreak(entry.breaks, stoppedAt) };
      });
      void persist(saveTimeEntries(updated), 'die beendete Erfassung');
      return updated;
    });

    setPendingSaveEntryId(stoppedId);
    setIsSaverOpen(true);
  }, [playAudioCue, persist]);

  /* ---------------------------------------------------------------------- */
  /* Naming a finished measurement                                          */
  /* ---------------------------------------------------------------------- */

  const pendingSaveEntry = useMemo(
    () => timeEntries.find((entry) => entry.id === pendingSaveEntryId) ?? null,
    [timeEntries, pendingSaveEntryId]
  );

  const closeSaver = useCallback(() => {
    setIsSaverOpen(false);
    setPendingSaveEntryId(null);
  }, []);

  /** Fills in what the stopwatch could not know: what this time was spent on. */
  const handleNamePendingEntry = (
    patch: Pick<TimeEntry, 'title' | 'project' | 'tags' | 'notes'>
  ) => {
    const updated = timeEntries.map((entry) =>
      entry.id === pendingSaveEntryId ? { ...entry, ...patch } : entry
    );
    setTimeEntries(updated);
    void persist(saveTimeEntries(updated), 'diesen Eintrag');
    closeSaver();
  };

  /** Deletes the entry the dialog is about — an explicit "that was not work". */
  const handleDiscardPendingEntry = () => {
    if (!window.confirm('Diesen Eintrag löschen? Die erfasste Zeit geht verloren.')) return;

    const updated = timeEntries.filter((entry) => entry.id !== pendingSaveEntryId);
    setTimeEntries(updated);
    void persist(saveTimeEntries(updated), 'das Löschen');
    closeSaver();
  };

  /* ---------------------------------------------------------------------- */
  /* Recovering a measurement from a previous run                           */
  /* ---------------------------------------------------------------------- */

  const recoveryEntry = useMemo(
    () => timeEntries.find((entry) => entry.id === recoveryEntryId && isRunning(entry)) ?? null,
    [timeEntries, recoveryEntryId]
  );

  const handleRecoveryStopNow = () => {
    const stoppedAt = Date.now();
    const updated = timeEntries.map((entry) =>
      entry.id === recoveryEntryId
        ? { ...entry, endTime: stoppedAt, breaks: closeOpenBreak(entry.breaks, stoppedAt) }
        : entry
    );
    setTimeEntries(updated);
    void persist(saveTimeEntries(updated), 'die wiederhergestellte Erfassung');
    setRecoveryEntryId(null);
  };

  const handleRecoveryEdit = () => {
    if (recoveryEntry) openEntryForm(recoveryEntry);
    setRecoveryEntryId(null);
  };

  /** Throws away the running measurement — the only destructive timer action. */
  const handleDiscardRunning = useCallback(() => {
    const confirmed = window.confirm(
      'Laufende Erfassung verwerfen? Die bisher erfasste Zeit wird gelöscht.'
    );
    if (!confirmed) return;

    setTimeEntries((current) => {
      const updated = current.filter((entry) => !isRunning(entry));
      void persist(saveTimeEntries(updated), 'das Verwerfen');
      return updated;
    });
  }, [persist]);

  /**
   * Snapshots the current state before something that replaces or destroys it.
   *
   * A failed backup does not veto the user's request, but it is not swallowed
   * either: this is the one moment where knowing there is no safety net can
   * change the decision, so it asks rather than warning afterwards.
   */
  const backupBefore = async (reason: BackupReason, action: string): Promise<boolean> => {
    if (!backupsAvailable()) return true;

    const result = await writeBackup(reason, buildBackupPayload(timeEntries, projects, settings));
    if (result.ok) {
      logInfo(`[Backup] Snapshot written before ${action} (${timeEntries.length} sessions).`);
      return true;
    }

    return window.confirm(
      `Es konnte keine Sicherung angelegt werden: ${result.message}\n\n${action} trotzdem fortsetzen?`
    );
  };

  const handleClearAllHistory = async () => {
    if (!(await backupBefore('before-clear', 'Das Löschen aller Einträge'))) return;

    removeEntries(timeEntries, 'das Leeren der Liste');
  };

  const handleUpdateSettings = (newSettings: Partial<AppSettings>) => {
    const updated = { ...settings, ...newSettings };
    setSettings(updated);
    void persist(saveSettings(updated), 'die Einstellungen');
  };

  const handleUpdateProjects = (updatedProjects: Project[]) => {
    setProjects(updatedProjects);
    void persist(saveProjects(updatedProjects), 'die Projekte');
  };

  const handleImportData = async (data: ImportedData) => {
    // An import overwrites everything at once, so the state it replaces is
    // snapshotted first — this is the accident a backup exists for.
    if (!(await backupBefore('before-import', 'Den Import'))) return;

    // An import is also the most likely way to hit the quota, and it replaces
    // everything at once — so all three writes are reported together rather
    // than letting a later success clear an earlier failure's warning.
    const writes: Promise<WriteResult>[] = [];

    if (Array.isArray(data.entries) && data.entries.length > 0) {
      setTimeEntries(data.entries);
      writes.push(saveTimeEntries(data.entries));
    }
    if (Array.isArray(data.projects) && data.projects.length > 0) {
      setProjects(data.projects);
      writes.push(saveProjects(data.projects));
    }
    if (data.settings) {
      // Imported settings run through the same migration as stored ones, so a
      // backup from an older build cannot smuggle removed or wrongly-typed
      // keys back into state.
      const updated = migrateSettings(data.settings);
      setSettings(updated);
      writes.push(saveSettings(updated));
    }

    const combined = Promise.all(writes).then(
      (results): WriteResult => results.find((result) => !result.ok) ?? { ok: true }
    );

    void persist(combined, 'die importierten Daten');
  };

  // Global Keyboard Shortcuts Listener
  useEffect(() => {
    if (!settings.keyShortcutsEnabled) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger shortcuts if typing inside input or textarea
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes((e.target as HTMLElement)?.tagName)) {
        return;
      }

      // Leave browser and OS combinations alone — otherwise Cmd/Ctrl+R would
      // reset a running session instead of reloading, and Cmd+S would stop it.
      if (e.ctrlKey || e.metaKey || e.altKey) {
        return;
      }

      if (e.code === 'Space') {
        e.preventDefault();
        if (timerState === 'IDLE') handleStart();
        else if (timerState === 'RUNNING') handlePause();
        else if (timerState === 'PAUSED') handleResume();
      } else if (e.code === 'KeyS') {
        e.preventDefault();
        if (timerState === 'RUNNING' || timerState === 'PAUSED') handleStopAndOpenSaver();
      } else if (e.code === 'KeyR') {
        e.preventDefault();
        if (timerState === 'RUNNING' || timerState === 'PAUSED') handleDiscardRunning();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    timerState,
    settings.keyShortcutsEnabled,
    handleStart,
    handlePause,
    handleResume,
    handleStopAndOpenSaver,
    handleDiscardRunning,
  ]);

  return (
    <div className="min-h-screen bg-[#F4F7F9] text-[#1A1C1E] font-sans antialiased flex flex-col selection:bg-blue-500 selection:text-white">
      {/* Desktop App Window Header */}
      <DesktopHeader
        settings={settings}
        onUpdateSettings={handleUpdateSettings}
        onOpenSettings={() => setIsSettingsOpen(true)}
        onOpenExport={() => setIsExportOpen(true)}
        onOpenArchitecture={() => setIsArchitectureOpen(true)}
        activeTab={activeTab}
        onSelectTab={setActiveTab}
      />

      {/* Main Container */}
      <main className="flex-1 max-w-4xl w-full mx-auto px-4 py-6 md:py-8 space-y-6">
        {/* Failed write warning — the only copy of the data is the one that
            just failed to save, so this cannot be a console message. */}
        {persistenceError && (
          <div
            role="alert"
            className="flex items-start justify-between gap-4 rounded-2xl border border-red-200 bg-red-50 p-4 px-5 text-sm text-red-800"
          >
            <p>
              <strong className="font-semibold">
                {persistenceError.what} konnte nicht gespeichert werden.
              </strong>{' '}
              {persistenceError.detail} Nach einem Neustart ist diese Änderung weg — solange sie
              noch am Bildschirm steht, lässt sie sich als JSON-Sicherung exportieren.
            </p>
            <button
              type="button"
              onClick={() => setPersistenceError(null)}
              aria-label="Hinweis schließen"
              className="shrink-0 rounded-full px-2 text-red-500 hover:text-red-700 focus:outline-none focus:ring-2 focus:ring-red-400"
            >
              ✕
            </button>
          </div>
        )}

        {/* Recording: everything needed while a measurement is running or
            about to be, and the list it lands in. */}
        {activeTab === 'tracking' && (
          <>
            <StopwatchDisplay
              elapsedTimeMs={elapsedTimeMs}
              timerState={timerState}
              showMilliseconds={settings.showMilliseconds}
              breakCount={runningEntry?.breaks.length ?? 0}
              projects={projects}
              activeProjectId={activeProjectId}
              onSelectProject={setSelectedProjectId}
            >
              <ControlPanel
                timerState={timerState}
                onStart={handleStart}
                onPause={handlePause}
                onResume={handleResume}
                onStop={handleStopAndOpenSaver}
                onDiscard={handleDiscardRunning}
                shortcutsEnabled={settings.keyShortcutsEnabled}
              />
            </StopwatchDisplay>

            {runningEntry && <BreakList breaks={runningEntry.breaks} now={now} />}

            <SessionHistory
              entries={timeEntries}
              projects={projects}
              onDeleteEntry={handleDeleteEntry}
              onEditEntry={(entry) => openEntryForm(entry)}
              onAddEntry={() => openEntryForm(null)}
              onClearAll={handleClearAllHistory}
              onExportPdf={() => setIsExportOpen(true)}
            />
          </>
        )}

        {/* Insights: totals, calendar and trends — all derived, nothing stored
            twice, so this view can never disagree with the one above. */}
        {activeTab === 'insights' && (
          <>
            <StatCards summary={summary} />

            <MonthCalendar entries={timeEntries} now={now} onEditEntry={(e) => openEntryForm(e)} />

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <TimeBarChart title="Letzte 12 Wochen" points={lastTwelveWeeks} />
              <TimeBarChart title="Nach Wochentag" points={weekdaySeries} />
            </div>

            <TimeBarChart
              title={`Monate ${new Date(now).getFullYear()}`}
              points={thisYearByMonth}
            />
          </>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-gray-200/80 bg-white py-4 pb-[calc(1rem+env(safe-area-inset-bottom))] text-center text-xs text-gray-400">
        <p>Chronos Desktop v{__APP_VERSION__} • Zeiterfassung</p>
      </footer>

      {/* Modals */}
      {pendingSaveEntry && (
        <SessionSaverModal
          isOpen={isSaverOpen}
          entry={pendingSaveEntry}
          projects={projects}
          onSave={handleNamePendingEntry}
          onDiscard={handleDiscardPendingEntry}
          onClose={closeSaver}
        />
      )}

      {/* Keyed so switching from one entry to another rebuilds the form state
          instead of showing the previous entry's values. */}
      {isEntryFormOpen && (
        <EntryFormModal
          key={entryUnderEdit?.id ?? 'new-entry'}
          isOpen={isEntryFormOpen}
          onClose={() => {
            setIsEntryFormOpen(false);
            setEntryUnderEdit(null);
          }}
          onSave={handleSaveEntryDraft}
          entry={entryUnderEdit}
          projects={projects}
          defaultProjectId={activeProjectId}
        />
      )}

      <ExportModal
        isOpen={isExportOpen}
        onClose={() => setIsExportOpen(false)}
        entries={timeEntries}
        projects={projects}
        settings={settings}
        now={now}
      />

      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        settings={settings}
        onUpdateSettings={handleUpdateSettings}
        projects={projects}
        onUpdateProjects={handleUpdateProjects}
        onImportData={handleImportData}
        onRevealBackups={
          backupsAvailable() && !isMobilePlatform() ? () => void revealBackups() : undefined
        }
        onRevealLogs={loggingToFile() && !isMobilePlatform() ? () => void revealLogs() : undefined}
      />

      <ArchitectureModal isOpen={isArchitectureOpen} onClose={() => setIsArchitectureOpen(false)} />

      {/* Asked once, at startup, and rendered last so it sits above everything
          else: the answer changes what the recorded time means. */}
      {recoveryEntry && (
        <RecoveryPrompt
          entry={recoveryEntry}
          onContinue={() => setRecoveryEntryId(null)}
          onStopNow={handleRecoveryStopNow}
          onEdit={handleRecoveryEdit}
        />
      )}
    </div>
  );
}
