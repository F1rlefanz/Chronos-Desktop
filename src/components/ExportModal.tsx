import React, { useState } from 'react';
import { TimeEntry, Project, PdfExportOptions } from '../types';
import { generatePdfReport } from '../utils/pdfExporter';
import { exportToCsv, exportToJsonBackup } from '../utils/dataExporter';
import { FileText, FileSpreadsheet, FileCode, Download, X, Check } from 'lucide-react';

interface ExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  entries: TimeEntry[];
  projects: Project[];
  settings: unknown;
}

export const ExportModal: React.FC<ExportModalProps> = ({
  isOpen,
  onClose,
  entries,
  projects,
  settings,
}) => {
  const [activeTab, setActiveTab] = useState<'pdf' | 'csv' | 'json'>('pdf');

  // PDF Export Customization Form State
  const [pdfOptions, setPdfOptions] = useState<PdfExportOptions>({
    title: 'Time Tracking Report',
    author: 'ChronoCraft User',
    includeLaps: true,
    includeNotes: true,
    includeSummary: true,
    dateRange: 'all',
    selectedProject: 'all',
  });

  if (!isOpen) return null;

  const handleGeneratePdf = () => {
    generatePdfReport(entries, projects, pdfOptions);
  };

  const handleExportCsv = () => {
    exportToCsv(entries, projects);
  };

  const handleExportJson = () => {
    exportToJsonBackup(entries, projects, settings);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/30 backdrop-blur-xs animate-fade-in">
      <div className="bg-white border border-gray-200/90 rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden text-gray-900">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 bg-gray-50/80 border-b border-gray-200">
          <div className="flex items-center gap-2 text-[#2D5BFF] font-semibold text-base">
            <Download className="w-5 h-5" />
            <span>Export & Data Reports</span>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-full text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Buttons */}
        <div className="flex border-b border-gray-200 bg-gray-50/50 p-2 gap-2">
          <button
            onClick={() => setActiveTab('pdf')}
            className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-full text-xs font-semibold transition-all cursor-pointer ${
              activeTab === 'pdf'
                ? 'bg-[#2D5BFF] text-white shadow-xs'
                : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
            }`}
          >
            <FileText className="w-4 h-4" />
            <span>PDF Document</span>
          </button>
          <button
            onClick={() => setActiveTab('csv')}
            className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-full text-xs font-semibold transition-all cursor-pointer ${
              activeTab === 'csv'
                ? 'bg-[#2D5BFF] text-white shadow-xs'
                : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
            }`}
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span>CSV Spreadsheet</span>
          </button>
          <button
            onClick={() => setActiveTab('json')}
            className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-full text-xs font-semibold transition-all cursor-pointer ${
              activeTab === 'json'
                ? 'bg-[#2D5BFF] text-white shadow-xs'
                : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
            }`}
          >
            <FileCode className="w-4 h-4" />
            <span>JSON Backup</span>
          </button>
        </div>

        {/* Tab Body */}
        <div className="p-6 space-y-4">
          {activeTab === 'pdf' && (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Report Title</label>
                <input
                  type="text"
                  value={pdfOptions.title}
                  onChange={(e) => setPdfOptions({ ...pdfOptions, title: e.target.value })}
                  className="w-full bg-gray-50 border border-gray-200 rounded-full px-4 py-2 text-xs text-gray-800 focus:outline-none focus:border-[#2D5BFF] focus:bg-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Project Filter</label>
                  <select
                    value={pdfOptions.selectedProject}
                    onChange={(e) => setPdfOptions({ ...pdfOptions, selectedProject: e.target.value })}
                    className="w-full bg-gray-50 border border-gray-200 rounded-full px-3.5 py-2 text-xs text-gray-700 focus:outline-none focus:border-[#2D5BFF]"
                  >
                    <option value="all">All Projects</option>
                    {projects.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Date Range</label>
                  <select
                    value={pdfOptions.dateRange}
                    onChange={(e) =>
                      setPdfOptions({ ...pdfOptions, dateRange: e.target.value as PdfExportOptions['dateRange'] })
                    }
                    className="w-full bg-gray-50 border border-gray-200 rounded-full px-3.5 py-2 text-xs text-gray-700 focus:outline-none focus:border-[#2D5BFF]"
                  >
                    <option value="all">All Time History</option>
                    <option value="today">Today Only</option>
                    <option value="week">Past 7 Days</option>
                    <option value="month">Past 30 Days</option>
                  </select>
                </div>
              </div>

              <div className="space-y-2 pt-2 border-t border-gray-100">
                <label className="flex items-center gap-2 text-xs text-gray-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={pdfOptions.includeSummary}
                    onChange={(e) => setPdfOptions({ ...pdfOptions, includeSummary: e.target.checked })}
                    className="rounded bg-gray-50 border-gray-300 text-[#2D5BFF] focus:ring-0"
                  />
                  <span>Include Summary Statistics Card</span>
                </label>

                <label className="flex items-center gap-2 text-xs text-gray-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={pdfOptions.includeNotes}
                    onChange={(e) => setPdfOptions({ ...pdfOptions, includeNotes: e.target.checked })}
                    className="rounded bg-gray-50 border-gray-300 text-[#2D5BFF] focus:ring-0"
                  />
                  <span>Include Session Notes Column</span>
                </label>
              </div>

              <button
                onClick={handleGeneratePdf}
                className="w-full mt-4 flex items-center justify-center gap-2 px-6 py-3 rounded-full bg-[#2D5BFF] hover:bg-blue-600 text-white font-bold text-sm shadow-lg shadow-blue-500/20 transition-all cursor-pointer"
              >
                <FileText className="w-4 h-4" />
                <span>Generate PDF Report Download</span>
              </button>
            </div>
          )}

          {activeTab === 'csv' && (
            <div className="space-y-4 text-center py-4">
              <div className="p-4 rounded-2xl bg-gray-50 border border-gray-200 text-gray-600 text-xs">
                Export all session records to an editable <strong>.CSV file</strong> compatible with Microsoft Excel, Google Sheets, or custom data processing software.
              </div>
              <button
                onClick={handleExportCsv}
                className="w-full flex items-center justify-center gap-2 px-6 py-3 rounded-full bg-[#2D5BFF] hover:bg-blue-600 text-white font-bold text-sm shadow-lg shadow-blue-500/20 transition-all cursor-pointer"
              >
                <FileSpreadsheet className="w-4 h-4" />
                <span>Download CSV File</span>
              </button>
            </div>
          )}

          {activeTab === 'json' && (
            <div className="space-y-4 text-center py-4">
              <div className="p-4 rounded-2xl bg-gray-50 border border-gray-200 text-gray-600 text-xs">
                Export your complete app state (settings, custom projects, time logs, and laps) to a portable <strong>.JSON file</strong> to share or move between PCs without losing data.
              </div>
              <button
                onClick={handleExportJson}
                className="w-full flex items-center justify-center gap-2 px-6 py-3 rounded-full bg-[#2D5BFF] hover:bg-blue-600 text-white font-bold text-sm shadow-lg shadow-blue-500/20 transition-all cursor-pointer"
              >
                <FileCode className="w-4 h-4" />
                <span>Download Portable JSON State</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
