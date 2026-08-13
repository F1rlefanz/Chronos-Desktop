import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { TimeEntry, Project, PdfExportOptions } from '../types';
import { netMs, totalNetMs } from '../domain/timeEntry';
import {
  formatTimeDisplay,
  formatDateTime,
  formatDateOnly,
  formatDurationHuman,
} from './timeFormatters';

/**
 * Generates and downloads a clean, professional PDF report of tracked time sessions.
 */
export function generatePdfReport(
  entries: TimeEntry[],
  projects: Project[],
  options: PdfExportOptions
): void {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const projectMap = new Map<string, Project>(projects.map((p) => [p.id, p]));

  // Filter entries according to dateRange and selectedProject
  const now = Date.now();
  let filteredEntries = [...entries];

  if (options.selectedProject !== 'all') {
    filteredEntries = filteredEntries.filter((e) => e.project === options.selectedProject);
  }

  if (options.dateRange === 'today') {
    const todayStart = new Date().setHours(0, 0, 0, 0);
    filteredEntries = filteredEntries.filter((e) => e.startTime >= todayStart);
  } else if (options.dateRange === 'week') {
    const weekAgo = now - 7 * 24 * 60 * 60 * 1000;
    filteredEntries = filteredEntries.filter((e) => e.startTime >= weekAgo);
  } else if (options.dateRange === 'month') {
    const monthAgo = now - 30 * 24 * 60 * 60 * 1000;
    filteredEntries = filteredEntries.filter((e) => e.startTime >= monthAgo);
  }

  // Document Header
  doc.setFillColor(15, 23, 42); // slate-900
  doc.rect(0, 0, 210, 36, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(20);
  doc.setFont('helvetica', 'bold');
  doc.text(options.title || 'Time Tracking & Stopwatch Report', 14, 18);

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(203, 213, 225); // slate-300
  doc.text(
    `Generated: ${formatDateTime(now)} | Author: ${options.author || 'Stopwatch App'}`,
    14,
    28
  );
  doc.text(`Total Records: ${filteredEntries.length}`, 196, 28, { align: 'right' });

  let currentY = 44;

  // Summary Card Section
  const totalMs = totalNetMs(filteredEntries, now);
  const totalHoursFormatted = (totalMs / (1000 * 60 * 60)).toFixed(2);

  if (options.includeSummary) {
    doc.setFillColor(248, 250, 252); // slate-50
    doc.setDrawColor(226, 232, 240); // slate-200
    doc.roundedRect(14, currentY, 182, 24, 3, 3, 'FD');

    doc.setTextColor(15, 23, 42);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text('REPORT SUMMARY', 20, currentY + 8);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(71, 85, 105);
    doc.text(
      `Total Duration: ${formatDurationHuman(totalMs)} (${totalHoursFormatted} hours)`,
      20,
      currentY + 16
    );
    doc.text(`Filter Period: ${options.dateRange.toUpperCase()}`, 110, currentY + 16);

    currentY += 32;
  }

  // Sessions Table — the Notes column is opt-out via export options.
  const tableHead = ['Session Title', 'Project', 'Date', 'Duration'];
  if (options.includeNotes) tableHead.push('Notes');

  const tableData = filteredEntries.map((entry) => {
    const proj = projectMap.get(entry.project);
    const projName = proj ? proj.name : entry.project || 'General';
    const { mainTime, subTime } = formatTimeDisplay(netMs(entry, now), {
      includeMilliseconds: true,
    });

    const row = [
      entry.title || 'Untitled Session',
      projName,
      formatDateOnly(entry.startTime),
      `${mainTime}${subTime}`,
    ];

    if (options.includeNotes) {
      row.push(
        entry.notes ? entry.notes.substring(0, 35) + (entry.notes.length > 35 ? '...' : '') : '-'
      );
    }

    return row;
  });

  autoTable(doc, {
    startY: currentY,
    head: [tableHead],
    body: tableData,
    theme: 'grid',
    headStyles: {
      fillColor: [30, 41, 59], // slate-800
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 9,
    },
    bodyStyles: {
      fontSize: 8,
      textColor: [51, 65, 85],
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252],
    },
    margin: { left: 14, right: 14 },
  });

  // Footer on each page
  const pageCount = (
    doc as unknown as { internal: { getNumberOfPages: () => number } }
  ).internal.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(148, 163, 184);
    doc.text(`Stopwatch & Time Tracker — Page ${i} of ${pageCount}`, 105, 287, { align: 'center' });
  }

  // Trigger download
  const sanitizedTitle = (options.title || 'time_tracking_report')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '_');
  doc.save(`${sanitizedTitle}_${Date.now()}.pdf`);
}
