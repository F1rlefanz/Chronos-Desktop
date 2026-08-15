import React from 'react';
import { Volume2, VolumeX, Settings, FileText, Code2 } from 'lucide-react';
import { AppSettings } from '../types';

export type MainTab = 'tracking' | 'insights';

const TABS: { id: MainTab; label: string }[] = [
  { id: 'tracking', label: 'Erfassen' },
  { id: 'insights', label: 'Auswertung' },
];

interface DesktopHeaderProps {
  settings: AppSettings;
  onUpdateSettings: (newSettings: Partial<AppSettings>) => void;
  onOpenSettings: () => void;
  onOpenExport: () => void;
  onOpenArchitecture: () => void;
  activeTab: MainTab;
  onSelectTab: (tab: MainTab) => void;
}

/**
 * One slim bar: which view is showing, and the four things you can do from
 * anywhere.
 *
 * There used to be two rows above the app — a fake title bar with the product
 * name, a version badge and three coloured dots that looked like window
 * controls but had no click handler at all, and below it a second row repeating
 * "CHRONOS DESKTOP". Both duplicated what Windows already draws in its own
 * title bar. The version moved to the footer, and the tabs took the space.
 */
export const DesktopHeader: React.FC<DesktopHeaderProps> = ({
  settings,
  onUpdateSettings,
  onOpenSettings,
  onOpenExport,
  onOpenArchitecture,
  activeTab,
  onSelectTab,
}) => {
  return (
    <header className="bg-white border-b border-gray-200 text-[#1A1C1E] select-none shadow-xs pt-[env(safe-area-inset-top)]">
      {/* Wraps rather than overflows. A Fairphone 6 reports a 320 px wide
          viewport — 1116 physical pixels at a display density of 558 — and at
          that width the two tabs and four buttons do not fit on one line. They
          did not shrink, they ran off the right edge: the sound toggle and the
          settings button were simply gone, and with them every way into the
          settings. Tightening the spacing alone would have bought thirty pixels
          and left the next narrow phone to find the same bug. */}
      <div className="app-shell px-3 sm:px-4 py-2 flex flex-wrap items-center justify-between gap-2 sm:gap-4">
        <nav className="flex items-center gap-1" aria-label="Ansicht">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => onSelectTab(tab.id)}
              aria-current={activeTab === tab.id ? 'page' : undefined}
              className={`px-3 sm:px-4 py-1.5 rounded-full text-sm font-semibold transition-all cursor-pointer ${
                activeTab === tab.id
                  ? 'bg-[#2D5BFF] text-white shadow-xs'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </nav>

        {/* `ml-auto` keeps this at the right edge on the line it lands on,
            whether that is beside the tabs or below them. */}
        <div className="flex items-center gap-1.5 sm:gap-2 ml-auto">
          <button
            onClick={onOpenArchitecture}
            className="p-2 rounded-full bg-white text-gray-600 hover:text-gray-900 hover:bg-gray-50 border border-gray-200 shadow-xs transition-all cursor-pointer"
            title="Aufbau der App ansehen"
            aria-label="Aufbau der App ansehen"
          >
            <Code2 className="w-4 h-4" />
          </button>

          <button
            onClick={onOpenExport}
            className="p-2 rounded-full bg-white text-gray-600 hover:text-gray-900 hover:bg-gray-50 border border-gray-200 shadow-xs transition-all cursor-pointer"
            title="Export & Berichte"
            aria-label="Export & Berichte"
          >
            <FileText className="w-4 h-4" />
          </button>

          <button
            onClick={() => onUpdateSettings({ soundEnabled: !settings.soundEnabled })}
            className={`p-2 rounded-full border text-xs transition-all cursor-pointer ${
              settings.soundEnabled
                ? 'bg-blue-50 text-[#2D5BFF] border-blue-200'
                : 'bg-white text-gray-400 border-gray-200 hover:bg-gray-50'
            }`}
            title={settings.soundEnabled ? 'Signaltöne an' : 'Signaltöne aus'}
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
            title="Einstellungen"
            aria-label="Einstellungen"
          >
            <Settings className="w-4 h-4" />
          </button>
        </div>
      </div>
    </header>
  );
};
