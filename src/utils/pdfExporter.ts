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
import { DeliveryResult, deliverFile } from './fileTarget';

/**
 * Generates a clean, professional PDF report of tracked time and delivers it.
 *
 * `entries` arrive already filtered by `selectEntriesForExport`, so the report
 * and every other export answer the same question about the same period —
 * this function used to re-derive its own rolling windows, which is how "past
 * 30 days" ended up meaning something different here than anywhere else.
 */
export function generatePdfReport(
  entries: TimeEntry[],
  projects: Project[],
  options: PdfExportOptions,
  period: { label: string; slug: string }
): Promise<DeliveryResult> {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const projectMap = new Map<string, Project>(projects.map((p) => [p.id, p]));

  const now = Date.now();

  // Document Header
  doc.setFillColor(15, 23, 42); // slate-900
  doc.rect(0, 0, 210, 36, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(20);
  doc.setFont('helvetica', 'bold');
  doc.text(options.title || 'Zeiterfassung', 14, 18);

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(203, 213, 225); // slate-300
  doc.text(`Erstellt: ${formatDateTime(now)} | ${options.author || 'Chronos'}`, 14, 28);
  doc.text(`Einträge: ${entries.length}`, 196, 28, { align: 'right' });

  let currentY = 44;

  // Summary Card Section
  const totalMs = totalNetMs(entries, now);
  const totalHoursFormatted = (totalMs / (1000 * 60 * 60)).toFixed(2);

  if (options.includeSummary) {
    doc.setFillColor(248, 250, 252); // slate-50
    doc.setDrawColor(226, 232, 240); // slate-200
    doc.roundedRect(14, currentY, 182, 24, 3, 3, 'FD');

    doc.setTextColor(15, 23, 42);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text('ZUSAMMENFASSUNG', 20, currentY + 8);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(71, 85, 105);
    doc.text(
      `Gesamt: ${formatDurationHuman(totalMs)} (${totalHoursFormatted} Stunden)`,
      20,
      currentY + 16
    );
    doc.text(`Zeitraum: ${period.label}`, 110, currentY + 16);

    currentY += 32;
  }

  // Sessions Table — the Notes column is opt-out via export options.
  const tableHead = ['Titel', 'Projekt', 'Datum', 'Arbeitszeit'];
  if (options.includeNotes) tableHead.push('Notiz');

  const tableData = entries.map((entry) => {
    const proj = projectMap.get(entry.project);
    const projName = proj ? proj.name : entry.project || 'Allgemein';
    const { mainTime, subTime } = formatTimeDisplay(netMs(entry, now), {
      includeMilliseconds: true,
    });

    const row = [
      entry.title || 'Ohne Titel',
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
    doc.text(`Chronos — ${period.label} — Seite ${i} von ${pageCount}`, 105, 287, {
      align: 'center',
    });
  }

  // Deliberately not `doc.save()`: that is an `<a download>` click underneath,
  // which a Tauri WebView ignores. Handing the bytes to `deliverFile` lets the
  // one place that knows about this build decide download or write-to-disk.
  const sanitizedTitle = (options.title || 'zeiterfassung')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '_');

  const bytes = new Uint8Array(doc.output('arraybuffer'));
  return deliverFile(`${sanitizedTitle}_${period.slug}.pdf`, bytes, 'application/pdf');
}
