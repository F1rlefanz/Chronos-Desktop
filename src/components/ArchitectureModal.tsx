import React from 'react';
import { Code2, Layers, FileCheck, CheckCircle2, Sparkles, X } from 'lucide-react';

interface ArchitectureModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ArchitectureModal: React.FC<ArchitectureModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/30 backdrop-blur-xs animate-fade-in">
      <div className="bg-white border border-gray-200/90 rounded-3xl w-full max-w-2xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col text-gray-900">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 bg-gray-50/80 border-b border-gray-200 shrink-0">
          <div className="flex items-center gap-2 text-[#2D5BFF] font-semibold text-base">
            <Code2 className="w-5 h-5" />
            <span>Software Architecture & Standards</span>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-full text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="p-6 space-y-6 overflow-y-auto custom-scrollbar text-gray-600 text-xs leading-relaxed">
          {/* Highlight Badge */}
          <div className="bg-blue-50/80 border border-blue-200 p-4 rounded-2xl flex items-start gap-3">
            <Sparkles className="w-5 h-5 text-[#2D5BFF] shrink-0 mt-0.5" />
            <div>
              <h3 className="font-bold text-gray-900 text-sm">
                State-of-the-Art & Zero Magic Numbers
              </h3>
              <p className="text-gray-600 mt-1">
                Built strictly following modern clean software architecture guidelines: complete
                modularity, custom hooks, typed schemas, decoupled exporters, and zero hardcoded
                magic numbers.
              </p>
            </div>
          </div>

          {/* Core Modules Breakdown */}
          <div className="space-y-3">
            <h4 className="font-bold text-gray-900 text-sm flex items-center gap-2">
              <Layers className="w-4 h-4 text-[#2D5BFF]" />
              <span>1. Modular File Architecture</span>
            </h4>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 font-mono text-[11px]">
              <div className="p-3 rounded-2xl bg-gray-50 border border-gray-200/80">
                <span className="text-[#2D5BFF] font-bold block mb-1">
                  /src/constants/defaultConfig.ts
                </span>
                Central configuration repository. All timing thresholds, default options, and
                storage keys defined as immutable constants.
              </div>
              <div className="p-3 rounded-2xl bg-gray-50 border border-gray-200/80">
                <span className="text-[#2D5BFF] font-bold block mb-1">
                  /src/hooks/useStopwatch.ts
                </span>
                Drift-free timing engine utilizing high-resolution performance.now() deltas with
                requestAnimationFrame.
              </div>
              <div className="p-3 rounded-2xl bg-gray-50 border border-gray-200/80">
                <span className="text-purple-600 font-bold block mb-1">
                  /src/utils/pdfExporter.ts
                </span>
                Dedicated report generator combining jsPDF and autoTable for formatted A4 document
                export.
              </div>
              <div className="p-3 rounded-2xl bg-gray-50 border border-gray-200/80">
                <span className="text-amber-600 font-bold block mb-1">
                  /src/utils/dataExporter.ts
                </span>
                Pure helper module for RFC-compliant CSV string building and JSON backup state
                serialization.
              </div>
            </div>
          </div>

          {/* Principles Checklist */}
          <div className="space-y-3">
            <h4 className="font-bold text-gray-900 text-sm flex items-center gap-2">
              <FileCheck className="w-4 h-4 text-[#2D5BFF]" />
              <span>2. Software Engineering Principles Complied With</span>
            </h4>

            <ul className="space-y-2">
              <li className="flex items-start gap-2 bg-gray-50 p-3 rounded-2xl border border-gray-200/80">
                <CheckCircle2 className="w-4 h-4 text-[#2D5BFF] shrink-0 mt-0.5" />
                <div>
                  <strong className="text-gray-900 block">
                    Zero Hardcoded Constants / Magic Numbers
                  </strong>
                  <p className="text-gray-500">
                    No raw numeric multipliers or magic string keys scattered in components. Every
                    constant is imported from <code>TIME_CONSTANTS</code> or{' '}
                    <code>DEFAULT_APP_SETTINGS</code>.
                  </p>
                </div>
              </li>

              <li className="flex items-start gap-2 bg-gray-50 p-3 rounded-2xl border border-gray-200/80">
                <CheckCircle2 className="w-4 h-4 text-[#2D5BFF] shrink-0 mt-0.5" />
                <div>
                  <strong className="text-gray-900 block">Drift-Free Precision Engine</strong>
                  <p className="text-gray-500">
                    Standard <code>setInterval</code> drifts when tabs are minimized or CPU
                    throttles. Chronos calculates delta time against monotonic{' '}
                    <code>performance.now()</code>.
                  </p>
                </div>
              </li>

              <li className="flex items-start gap-2 bg-gray-50 p-3 rounded-2xl border border-gray-200/80">
                <CheckCircle2 className="w-4 h-4 text-[#2D5BFF] shrink-0 mt-0.5" />
                <div>
                  <strong className="text-gray-900 block">
                    Universal Shareability & Portability
                  </strong>
                  <p className="text-gray-500">
                    Runs on any modern browser or PC out-of-the-box, or can be wrapped into Electron
                    / Tauri for native Windows/Mac/Linux deployment. Complete state import/export
                    JSON backup included.
                  </p>
                </div>
              </li>
            </ul>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 bg-gray-50/80 border-t border-gray-200 flex justify-end shrink-0">
          <button
            onClick={onClose}
            className="px-6 py-2 rounded-full bg-[#2D5BFF] hover:bg-blue-600 text-white font-bold text-xs cursor-pointer"
          >
            Close Specification
          </button>
        </div>
      </div>
    </div>
  );
};
