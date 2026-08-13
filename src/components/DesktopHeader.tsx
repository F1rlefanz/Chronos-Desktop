import React from 'react';
import { Timer, Volume2, VolumeX, Settings, FileText, Code2 } from 'lucide-react';
import { AppSettings } from '../types';

interface DesktopHeaderProps {
  settings: AppSettings;
  onUpdateSettings: (newSettings: Partial<AppSettings>) => void;
  onOpenSettings: () => void;
  onOpenExport: () => void;
  onOpenArchitecture: () => void;
  activeEntriesCount: number;
}

export const DesktopHeader: React.FC<DesktopHeaderProps> = ({
  settings,
  onUpdateSettings,
  onOpenSettings,
  onOpenExport,
  onOpenArchitecture,
  activeEntriesCount,
}) => {
  return (
    <header className="bg-white border-b border-gray-200 text-[#1A1C1E] select-none shadow-xs">
      {/* Top Window Title Bar */}
      {settings.desktopWindowFrame && (
        <div className="flex items-center justify-between px-6 py-2 bg-gray-50/80 text-xs text-gray-500 border-b border-gray-200">
          <div className="flex items-center gap-2">
            <Timer className="w-3.5 h-3.5 text-[#2D5BFF]" />
            <span className="font-semibold tracking-wide text-gray-700">Chronos Desktop</span>
            <span className="text-[10px] bg-gray-200/80 px-2 py-0.5 rounded-full text-gray-600 font-mono">
              v{__APP_VERSION__}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <div
              className="w-3 h-3 rounded-full bg-[#FF5F57] hover:opacity-80 transition-opacity cursor-pointer"
              title="Close"
            />
            <div
              className="w-3 h-3 rounded-full bg-[#FEBC2E] hover:opacity-80 transition-opacity cursor-pointer"
              title="Minimize"
            />
            <div
              className="w-3 h-3 rounded-full bg-[#28C840] hover:opacity-80 transition-opacity cursor-pointer"
              title="Maximize"
            />
          </div>
        </div>
      )}

      {/* Main Navigation & App Bar */}
      <div className="max-w-6xl mx-auto px-6 py-3 flex flex-wrap items-center justify-between gap-4">
        {/* Brand */}
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-[#2D5BFF] rounded-xl flex items-center justify-center text-white shadow-md shadow-blue-500/20">
            <div className="w-4 h-4 border-2 border-white rounded-full border-t-transparent animate-spin-slow"></div>
          </div>
          <div>
            <h1 className="text-lg font-bold tracking-tight text-gray-900 flex items-center gap-2">
              CHRONOS <span className="font-light text-gray-400">DESKTOP</span>
            </h1>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2">
          <button
            onClick={onOpenArchitecture}
            className="flex items-center gap-1.5 text-xs font-medium px-3.5 py-1.5 rounded-full bg-gray-100 text-gray-700 hover:bg-gray-200/80 border border-gray-200/60 transition-all cursor-pointer"
            title="Inspect Architecture"
          >
            <Code2 className="w-3.5 h-3.5 text-[#2D5BFF]" />
            <span>Architecture & Specs</span>
          </button>

          <button
            onClick={onOpenExport}
            className="flex items-center gap-1.5 text-xs font-medium px-3.5 py-1.5 rounded-full bg-white text-gray-700 hover:bg-gray-50 border border-gray-200 shadow-xs transition-all cursor-pointer relative"
          >
            <FileText className="w-3.5 h-3.5 text-[#2D5BFF]" />
            <span>Export</span>
            {activeEntriesCount > 0 && (
              <span className="ml-1 bg-[#2D5BFF] text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                {activeEntriesCount}
              </span>
            )}
          </button>

          <button
            onClick={() => onUpdateSettings({ soundEnabled: !settings.soundEnabled })}
            className={`p-2 rounded-full border text-xs transition-all cursor-pointer ${
              settings.soundEnabled
                ? 'bg-blue-50 text-[#2D5BFF] border-blue-200'
                : 'bg-white text-gray-400 border-gray-200 hover:bg-gray-50'
            }`}
            title={settings.soundEnabled ? 'Audio cues enabled' : 'Audio cues muted'}
          >
            {settings.soundEnabled ? (
              <Volume2 className="w-4 h-4" />
            ) : (
              <VolumeX className="w-4 h-4" />
            )}
          </button>

          <button
            onClick={onOpenSettings}
            className="p-2 rounded-full bg-white text-gray-600 hover:text-gray-900 hover:bg-gray-50 border border-gray-200 shadow-xs transition-all cursor-pointer"
            title="Settings & Config"
          >
            <Settings className="w-4 h-4" />
          </button>
        </div>
      </div>
    </header>
  );
};
