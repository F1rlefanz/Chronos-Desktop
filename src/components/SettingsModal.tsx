import React, { useState, useRef } from 'react';
import { AppSettings, Project } from '../types';
import { importFromJsonFile, ImportedData } from '../utils/dataExporter';
import { TIMER_INTERVAL_OPTIONS } from '../constants/defaultConfig';
import { Settings, Plus, Trash2, Upload, X, FolderOpen, FileWarning } from 'lucide-react';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: AppSettings;
  onUpdateSettings: (newSettings: Partial<AppSettings>) => void;
  projects: Project[];
  onUpdateProjects: (projects: Project[]) => void;
  onImportData: (data: ImportedData) => void;
  /** Absent when the backend keeps no snapshots, which hides the row. */
  onRevealBackups?: () => void;
  /** Absent when logs only go to the console, which hides the row. */
  onRevealLogs?: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  settings,
  onUpdateSettings,
  projects,
  onUpdateProjects,
  onImportData,
  onRevealBackups,
  onRevealLogs,
}) => {
  const [newProjectName, setNewProjectName] = useState('');
  const [newProjectColor, setNewProjectColor] = useState('#3b82f6');
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleAddProject = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProjectName.trim()) return;

    const newProj: Project = {
      id: `proj-${Date.now()}`,
      name: newProjectName.trim(),
      color: newProjectColor,
    };

    onUpdateProjects([...projects, newProj]);
    setNewProjectName('');
  };

  const handleDeleteProject = (id: string) => {
    if (projects.length <= 1) {
      alert('Es muss mindestens ein Projekt übrig bleiben.');
      return;
    }

    const remaining = projects.filter((p) => p.id !== id);
    onUpdateProjects(remaining);

    // Deleting the default would leave the setting pointing at a project that
    // no longer exists — the dropdown would show a value it has no option for.
    if (settings.defaultProject === id) {
      onUpdateSettings({ defaultProject: remaining[0].id });
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const input = e.target;
    const file = input.files?.[0];
    if (!file) return;

    try {
      const data = await importFromJsonFile(file);
      onImportData(data);
      alert(`Imported ${data.entries.length} session(s) and ${data.projects.length} project(s).`);
    } catch (err: unknown) {
      const reason = err instanceof Error ? err.message : 'Invalid file format';
      alert(`Import failed: ${reason}`);
    } finally {
      // Clear the input so picking the same file again fires another change event.
      input.value = '';
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/30 backdrop-blur-xs animate-fade-in">
      <div className="bg-white border border-gray-200/90 rounded-3xl w-full max-w-xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col text-gray-900">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 bg-gray-50/80 border-b border-gray-200 shrink-0">
          <div className="flex items-center gap-2 text-[#2D5BFF] font-semibold text-base">
            <Settings className="w-5 h-5 text-[#2D5BFF]" />
            <span>Einstellungen</span>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-full text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Scrollable Body */}
        <div className="p-6 space-y-6 overflow-y-auto custom-scrollbar">
          {/* Section: Display & Precision */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-gray-400 border-b border-gray-100 pb-1">
              Anzeige
            </h3>

            <label className="flex items-center justify-between p-3.5 rounded-2xl bg-gray-50 border border-gray-200/80 cursor-pointer">
              <div>
                <span className="text-xs font-semibold text-gray-800 block">
                  Millisekunden anzeigen (.00)
                </span>
                <span className="text-[11px] text-gray-400">
                  Hundertstelsekunden in der laufenden Anzeige
                </span>
              </div>
              <input
                type="checkbox"
                checked={settings.showMilliseconds}
                onChange={(e) => onUpdateSettings({ showMilliseconds: e.target.checked })}
                className="w-4 h-4 rounded bg-white border-gray-300 text-[#2D5BFF] focus:ring-0"
              />
            </label>

            <label className="flex items-center justify-between p-3.5 rounded-2xl bg-gray-50 border border-gray-200/80 cursor-pointer">
              <div>
                <span className="text-xs font-semibold text-gray-800 block">
                  Eigene Fensterleiste
                </span>
                <span className="text-[11px] text-gray-400">
                  Eigene Titelleiste statt der des Betriebssystems
                </span>
              </div>
              <input
                type="checkbox"
                checked={settings.desktopWindowFrame}
                onChange={(e) => onUpdateSettings({ desktopWindowFrame: e.target.checked })}
                className="w-4 h-4 rounded bg-white border-gray-300 text-[#2D5BFF] focus:ring-0"
              />
            </label>

            <label className="flex items-center justify-between p-3.5 rounded-2xl bg-gray-50 border border-gray-200/80 cursor-pointer">
              <div>
                <span className="text-xs font-semibold text-gray-800 block">
                  Aktualisierungsrate
                </span>
                <span className="text-[11px] text-gray-400">
                  Wie oft die Anzeige neu gezeichnet wird. Die erfasste Zeit bleibt gleich.
                </span>
              </div>
              <select
                value={settings.timerIntervalMs}
                onChange={(e) => onUpdateSettings({ timerIntervalMs: Number(e.target.value) })}
                className="bg-white border border-gray-200 text-xs font-semibold text-gray-800 rounded-full px-3.5 py-1.5 focus:outline-none focus:border-[#2D5BFF] cursor-pointer"
              >
                {TIMER_INTERVAL_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="flex items-center justify-between p-3.5 rounded-2xl bg-gray-50 border border-gray-200/80 cursor-pointer">
              <div>
                <span className="text-xs font-semibold text-gray-800 block">Tastenkürzel</span>
                <span className="text-[11px] text-gray-400">
                  Leertaste (Start/Pause), S (Beenden), R (Verwerfen)
                </span>
              </div>
              <input
                type="checkbox"
                checked={settings.keyShortcutsEnabled}
                onChange={(e) => onUpdateSettings({ keyShortcutsEnabled: e.target.checked })}
                className="w-4 h-4 rounded bg-white border-gray-300 text-[#2D5BFF] focus:ring-0"
              />
            </label>
          </div>

          {/* Section: Project Categories */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-gray-400 border-b border-gray-100 pb-1">
              Projekte
            </h3>

            <label className="flex items-center justify-between p-3.5 rounded-2xl bg-gray-50 border border-gray-200/80 cursor-pointer">
              <div>
                <span className="text-xs font-semibold text-gray-800 block">Standardprojekt</span>
                <span className="text-[11px] text-gray-400">
                  Womit die Projektauswahl beim Start der App vorbelegt wird.
                </span>
              </div>
              <select
                value={settings.defaultProject}
                onChange={(e) => onUpdateSettings({ defaultProject: e.target.value })}
                className="bg-white border border-gray-200 text-xs font-semibold text-gray-800 rounded-full px-3.5 py-1.5 focus:outline-none focus:border-[#2D5BFF] cursor-pointer"
              >
                {projects.map((proj) => (
                  <option key={proj.id} value={proj.id}>
                    {proj.name}
                  </option>
                ))}
              </select>
            </label>

            <div className="space-y-2">
              {projects.map((proj) => (
                <div
                  key={proj.id}
                  className="flex items-center justify-between p-3 rounded-2xl bg-gray-50 border border-gray-200/80"
                >
                  <div className="flex items-center gap-2">
                    <span
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: proj.color }}
                    />
                    <span className="text-xs font-semibold text-gray-800">{proj.name}</span>
                  </div>
                  <button
                    onClick={() => handleDeleteProject(proj.id)}
                    className="p-1 text-gray-400 hover:text-rose-500 transition-colors cursor-pointer"
                    title="Projekt löschen"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>

            {/* Add Project Form */}
            <form onSubmit={handleAddProject} className="flex gap-2 pt-1">
              <input
                type="text"
                value={newProjectName}
                onChange={(e) => setNewProjectName(e.target.value)}
                placeholder="Name des neuen Projekts…"
                className="flex-1 bg-gray-50 border border-gray-200 rounded-full px-4 py-2 text-xs text-gray-800 placeholder-gray-400 focus:outline-none focus:border-[#2D5BFF] focus:bg-white"
              />
              <input
                type="color"
                value={newProjectColor}
                onChange={(e) => setNewProjectColor(e.target.value)}
                className="w-9 h-8 bg-gray-50 border border-gray-200 rounded-full p-0.5 cursor-pointer"
              />
              <button
                type="submit"
                className="px-4 py-2 rounded-full bg-[#2D5BFF] hover:bg-blue-600 text-white font-bold text-xs flex items-center gap-1 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Anlegen</span>
              </button>
            </form>
          </div>

          {/* Section: Backup & Import */}
          <div className="space-y-3 pt-2">
            <h3 className="text-xs font-bold uppercase tracking-wider text-gray-400 border-b border-gray-100 pb-1">
              Daten & Sicherungen
            </h3>

            <div className="flex items-center justify-between p-3.5 rounded-2xl bg-gray-50 border border-gray-200/80">
              <div>
                <span className="text-xs font-semibold text-gray-800 block">
                  Aus JSON-Sicherung wiederherstellen
                </span>
                <span className="text-[11px] text-gray-400">
                  Zuvor exportierte Daten wieder einlesen
                </span>
              </div>
              <button
                onClick={() => fileInputRef.current?.click()}
                className="px-3.5 py-1.5 rounded-full bg-white border border-gray-200 hover:bg-gray-100 text-gray-700 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer shadow-2xs"
              >
                <Upload className="w-3.5 h-3.5 text-[#2D5BFF]" />
                <span>Datei wählen</span>
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept=".json"
                onChange={handleFileChange}
                className="hidden"
              />
            </div>

            {/* Only the desktop build keeps snapshots; the browser has no room
                for a second copy, so the row is absent rather than disabled. */}
            {onRevealBackups && (
              <div className="flex items-center justify-between p-3.5 rounded-2xl bg-gray-50 border border-gray-200/80">
                <div>
                  <span className="text-xs font-semibold text-gray-800 block">
                    Automatische Sicherungen
                  </span>
                  <span className="text-[11px] text-gray-400">
                    Täglich sowie vor dem Löschen und vor einem Import. Wiederherstellen über „Datei
                    wählen" oben.
                  </span>
                </div>
                <button
                  onClick={onRevealBackups}
                  className="px-3.5 py-1.5 rounded-full bg-white border border-gray-200 hover:bg-gray-100 text-gray-700 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer shadow-2xs shrink-0"
                >
                  <FolderOpen className="w-3.5 h-3.5 text-[#2D5BFF]" />
                  <span>Ordner öffnen</span>
                </button>
              </div>
            )}

            {onRevealLogs && (
              <div className="flex items-center justify-between p-3.5 rounded-2xl bg-gray-50 border border-gray-200/80">
                <div>
                  <span className="text-xs font-semibold text-gray-800 block">Protokolldatei</span>
                  <span className="text-[11px] text-gray-400">
                    Was die App über fehlgeschlagene Speichervorgänge und Fehler notiert hat.
                  </span>
                </div>
                <button
                  onClick={onRevealLogs}
                  className="px-3.5 py-1.5 rounded-full bg-white border border-gray-200 hover:bg-gray-100 text-gray-700 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer shadow-2xs shrink-0"
                >
                  <FileWarning className="w-3.5 h-3.5 text-[#2D5BFF]" />
                  <span>Ordner öffnen</span>
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 bg-gray-50/80 border-t border-gray-200 flex justify-end shrink-0">
          <button
            onClick={onClose}
            className="px-6 py-2 rounded-full bg-[#2D5BFF] hover:bg-blue-600 text-white font-bold text-xs cursor-pointer"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
