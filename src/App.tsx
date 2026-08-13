import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useStopwatch } from './hooks/useStopwatch';
import { AppSettings, Project, TimeEntry, Lap } from './types';
import { ImportedData } from './utils/dataExporter';
import {
  loadSettings,
  saveSettings,
  loadTimeEntries,
  saveTimeEntries,
  loadProjects,
  saveProjects,
} from './utils/storage';

import { DesktopHeader } from './components/DesktopHeader';
import { StopwatchDisplay } from './components/StopwatchDisplay';
import { ControlPanel } from './components/ControlPanel';
import { LapList } from './components/LapList';
import { SessionSaverModal } from './components/SessionSaverModal';
import { SessionHistory } from './components/SessionHistory';
import { ExportModal } from './components/ExportModal';
import { SettingsModal } from './components/SettingsModal';
import { ArchitectureModal } from './components/ArchitectureModal';

export default function App() {
  // Application Data Persistence States
  const [settings, setSettings] = useState<AppSettings>(loadSettings);
  const [timeEntries, setTimeEntries] = useState<TimeEntry[]>(loadTimeEntries);
  const [projects, setProjects] = useState<Project[]>(loadProjects);

  // Selected Active Project for current timer session
  const [selectedProjectId, setSelectedProjectId] = useState<string>(
    settings.defaultProject || projects[0]?.id || 'proj-work'
  );

  // Modal Visibility States
  const [isSaverOpen, setIsSaverOpen] = useState<boolean>(false);
  const [isExportOpen, setIsExportOpen] = useState<boolean>(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState<boolean>(false);
  const [isArchitectureOpen, setIsArchitectureOpen] = useState<boolean>(false);

  // Stopped Session Pending Save State
  const [pendingSaveData, setPendingSaveData] = useState<{
    recordedMs: number;
    recordedLaps: Lap[];
    startTime: number;
    endTime: number;
  } | null>(null);

  // High-Precision Stopwatch Hook
  const {
    elapsedTimeMs,
    timerState,
    laps,
    start,
    pause,
    resume,
    recordLap,
    stop,
    reset,
  } = useStopwatch(settings.timerIntervalMs);

  // A single AudioContext is reused for every cue: browsers cap the number of
  // concurrent contexts (Chrome allows six), so creating one per cue would
  // permanently kill audio after a handful of laps.
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
    (type: 'start' | 'pause' | 'lap' | 'stop') => {
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
        } else if (type === 'lap') {
          osc.frequency.setValueAtTime(1046.5, audioCtx.currentTime); // C6
          gain.gain.setValueAtTime(0.1, audioCtx.currentTime);
          gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.12);
          osc.start();
          osc.stop(audioCtx.currentTime + 0.12);
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

  // Handlers. These are memoized because the keyboard shortcut effect below
  // depends on them — without it the listener would be torn down and
  // re-attached on every single render.
  const handleStart = useCallback(() => {
    playAudioCue('start');
    start();
  }, [playAudioCue, start]);

  const handlePause = useCallback(() => {
    playAudioCue('pause');
    pause();
  }, [playAudioCue, pause]);

  const handleResume = useCallback(() => {
    playAudioCue('start');
    resume();
  }, [playAudioCue, resume]);

  const handleLap = useCallback(() => {
    const lap = recordLap();
    if (lap) {
      playAudioCue('lap');
    }
  }, [playAudioCue, recordLap]);

  const handleStopAndOpenSaver = useCallback(() => {
    playAudioCue('stop');
    const result = stop();
    setPendingSaveData({
      recordedMs: result.totalMs,
      recordedLaps: result.laps,
      startTime: result.startTime,
      endTime: result.endTime,
    });
    setIsSaverOpen(true);
  }, [playAudioCue, stop]);

  const handleSaveEntry = (entryData: Omit<TimeEntry, 'id' | 'createdAt'>) => {
    const newEntry: TimeEntry = {
      ...entryData,
      id: `entry-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      createdAt: Date.now(),
    };

    const updated = [newEntry, ...timeEntries];
    setTimeEntries(updated);
    saveTimeEntries(updated);
    setPendingSaveData(null);
    reset();
  };

  const handleDeleteEntry = (id: string) => {
    const updated = timeEntries.filter((e) => e.id !== id);
    setTimeEntries(updated);
    saveTimeEntries(updated);
  };

  const handleClearAllHistory = () => {
    setTimeEntries([]);
    saveTimeEntries([]);
  };

  const handleUpdateSettings = (newSettings: Partial<AppSettings>) => {
    const updated = { ...settings, ...newSettings };
    setSettings(updated);
    saveSettings(updated);
  };

  const handleUpdateProjects = (updatedProjects: Project[]) => {
    setProjects(updatedProjects);
    saveProjects(updatedProjects);
  };

  const handleImportData = (data: ImportedData) => {
    if (Array.isArray(data.entries) && data.entries.length > 0) {
      setTimeEntries(data.entries);
      saveTimeEntries(data.entries);
    }
    if (Array.isArray(data.projects) && data.projects.length > 0) {
      setProjects(data.projects);
      saveProjects(data.projects);
    }
    if (data.settings && typeof data.settings === 'object') {
      const updated = { ...settings, ...(data.settings as AppSettings) };
      setSettings(updated);
      saveSettings(updated);
    }
  };

  // The active project is derived, not stored a second time: deleting the
  // selected project (or importing a different project list) must not leave the
  // dropdown showing one project while saved entries carry a vanished id and
  // get labelled "General". Deriving it also avoids a repair effect that would
  // cascade an extra render.
  const currentProject = useMemo(() => {
    return (
      projects.find((p) => p.id === selectedProjectId) ||
      projects[0] || { id: 'proj-work', name: 'General', color: '#10b981' }
    );
  }, [projects, selectedProjectId]);

  const activeProjectId = currentProject.id;

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
      } else if (e.code === 'KeyL') {
        e.preventDefault();
        if (timerState === 'RUNNING' || timerState === 'PAUSED') handleLap();
      } else if (e.code === 'KeyS') {
        e.preventDefault();
        if (timerState === 'RUNNING' || timerState === 'PAUSED') handleStopAndOpenSaver();
      } else if (e.code === 'KeyR') {
        e.preventDefault();
        if (timerState !== 'IDLE') reset();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [timerState, settings.keyShortcutsEnabled, handleStart, handlePause, handleResume, handleLap, handleStopAndOpenSaver, reset]);

  return (
    <div className="min-h-screen bg-[#F4F7F9] text-[#1A1C1E] font-sans antialiased flex flex-col selection:bg-blue-500 selection:text-white">
      {/* Desktop App Window Header */}
      <DesktopHeader
        settings={settings}
        onUpdateSettings={handleUpdateSettings}
        onOpenSettings={() => setIsSettingsOpen(true)}
        onOpenExport={() => setIsExportOpen(true)}
        onOpenArchitecture={() => setIsArchitectureOpen(true)}
        activeEntriesCount={timeEntries.length}
      />

      {/* Main Container */}
      <main className="flex-1 max-w-4xl w-full mx-auto px-4 py-6 md:py-8 space-y-6">
        {/* Project Selector Bar */}
        <div className="flex items-center justify-between bg-white p-3 px-5 rounded-2xl border border-gray-200/80 shadow-2xs">
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500 font-medium">Tracking Category:</span>
            <select
              value={activeProjectId}
              onChange={(e) => setSelectedProjectId(e.target.value)}
              className="bg-gray-50 border border-gray-200 text-xs font-semibold text-gray-800 rounded-full px-3.5 py-1.5 focus:outline-none focus:border-[#2D5BFF] cursor-pointer"
            >
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>

          <div className="text-xs text-gray-400 hidden sm:block">
            Precision: <strong className="text-[#2D5BFF]">10ms (0.01s)</strong>
          </div>
        </div>

        {/* Stopwatch Main Display */}
        <StopwatchDisplay
          elapsedTimeMs={elapsedTimeMs}
          timerState={timerState}
          showMilliseconds={settings.showMilliseconds}
          lapCount={laps.length}
          selectedProjectName={currentProject.name}
          selectedProjectColor={currentProject.color}
        />

        {/* Stopwatch Control Panel */}
        <ControlPanel
          timerState={timerState}
          onStart={handleStart}
          onPause={handlePause}
          onResume={handleResume}
          onLap={handleLap}
          onStop={handleStopAndOpenSaver}
          onReset={reset}
          shortcutsEnabled={settings.keyShortcutsEnabled}
        />

        {/* Real-time Lap Splits */}
        <LapList laps={laps} />

        {/* Session History Log & Export Table */}
        <SessionHistory
          entries={timeEntries}
          projects={projects}
          onDeleteEntry={handleDeleteEntry}
          onClearAll={handleClearAllHistory}
          onExportPdf={() => setIsExportOpen(true)}
        />
      </main>

      {/* Footer */}
      <footer className="border-t border-gray-200/80 bg-white py-4 text-center text-xs text-gray-400">
        <p>Chronos Desktop • Modular Desktop Time Engine • High Precision</p>
      </footer>

      {/* Modals */}
      {pendingSaveData && (
        <SessionSaverModal
          isOpen={isSaverOpen}
          onClose={() => {
            setIsSaverOpen(false);
            setPendingSaveData(null);
          }}
          onSave={handleSaveEntry}
          recordedMs={pendingSaveData.recordedMs}
          recordedLaps={pendingSaveData.recordedLaps}
          startTime={pendingSaveData.startTime}
          endTime={pendingSaveData.endTime}
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
      />

      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        settings={settings}
        onUpdateSettings={handleUpdateSettings}
        projects={projects}
        onUpdateProjects={handleUpdateProjects}
        onImportData={handleImportData}
      />

      <ArchitectureModal
        isOpen={isArchitectureOpen}
        onClose={() => setIsArchitectureOpen(false)}
      />
    </div>
  );
}
