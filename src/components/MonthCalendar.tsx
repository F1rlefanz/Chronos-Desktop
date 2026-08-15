import React, { useMemo, useState } from 'react';
import { TimeEntry } from '../types';
import {
  dailyTotals,
  entriesOnDay,
  monthGrid,
  MONTH_LABELS,
  WEEKDAY_LABELS,
} from '../domain/stats';
import { dayKeyOf, netMs } from '../domain/timeEntry';
import { formatDurationHuman } from '../utils/timeFormatters';
import { ChevronLeft, ChevronRight, CalendarDays } from 'lucide-react';

interface MonthCalendarProps {
  entries: TimeEntry[];
  now: number;
  onEditEntry: (entry: TimeEntry) => void;
}

/** Four steps of one hue: the cell shade encodes magnitude, not identity. */
function shadeFor(ratio: number): string {
  if (ratio <= 0) return 'transparent';
  if (ratio < 0.25) return 'rgba(45, 91, 255, 0.12)';
  if (ratio < 0.5) return 'rgba(45, 91, 255, 0.28)';
  if (ratio < 0.75) return 'rgba(45, 91, 255, 0.5)';
  return 'rgba(45, 91, 255, 0.78)';
}

export const MonthCalendar: React.FC<MonthCalendarProps> = ({ entries, now, onEditEntry }) => {
  const today = new Date(now);
  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth());
  const [selectedKey, setSelectedKey] = useState<string | null>(null);

  const totals = useMemo(
    () => dailyTotals(entries, viewYear, viewMonth, now),
    [entries, viewYear, viewMonth, now]
  );

  const cells = useMemo(() => monthGrid(viewYear, viewMonth), [viewYear, viewMonth]);
  const monthTotal = useMemo(
    () => [...totals.values()].reduce((sum, value) => sum + value, 0),
    [totals]
  );
  const busiest = useMemo(() => Math.max(0, ...totals.values()), [totals]);

  const selectedEntries = useMemo(() => {
    if (!selectedKey) return [];
    const [year, month, day] = selectedKey.split('-').map(Number);
    return entriesOnDay(entries, new Date(year, month - 1, day));
  }, [entries, selectedKey]);

  const step = (delta: number) => {
    const next = new Date(viewYear, viewMonth + delta, 1);
    setViewYear(next.getFullYear());
    setViewMonth(next.getMonth());
    setSelectedKey(null);
  };

  const todayKey = dayKeyOf(today);

  return (
    <div className="bg-white rounded-2xl border border-gray-200/90 shadow-2xs p-5">
      <div className="flex items-center justify-between gap-2 mb-4">
        {/* Wraps as two whole parts rather than mid-duration: on a 320px phone
            "· 1 Std. 0 Min." used to break after the "0" and leave "Min." on a
            line of its own. */}
        <h3 className="text-xs font-bold uppercase tracking-wider text-gray-800 flex flex-wrap items-center gap-x-2 min-w-0">
          <span className="flex items-center gap-2">
            <CalendarDays className="w-4 h-4 shrink-0 text-[#2D5BFF]" />
            <span className="whitespace-nowrap">
              {MONTH_LABELS[viewMonth]} {viewYear}
            </span>
          </span>
          {monthTotal > 0 && (
            <span className="font-normal normal-case tracking-normal whitespace-nowrap text-gray-400">
              · {formatDurationHuman(monthTotal)}
            </span>
          )}
        </h3>

        <div className="flex items-center gap-1">
          <button
            onClick={() => step(-1)}
            aria-label="Vorheriger Monat"
            className="p-1.5 rounded-full text-gray-400 hover:text-gray-800 hover:bg-gray-100 transition-colors cursor-pointer"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button
            onClick={() => step(1)}
            aria-label="Nächster Monat"
            className="p-1.5 rounded-full text-gray-400 hover:text-gray-800 hover:bg-gray-100 transition-colors cursor-pointer"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-[2px] mb-1">
        {WEEKDAY_LABELS.map((label) => (
          <span
            key={label}
            className="text-center text-[0.625rem] font-semibold uppercase tracking-wider text-gray-400"
          >
            {label}
          </span>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-[2px]">
        {cells.map((date, index) => {
          if (!date) return <span key={`pad-${index}`} className="aspect-square" />;

          const key = dayKeyOf(date);
          const total = totals.get(key) ?? 0;
          const isToday = key === todayKey;
          const isSelected = key === selectedKey;

          return (
            <button
              key={key}
              type="button"
              onClick={() => setSelectedKey(isSelected ? null : key)}
              title={total > 0 ? formatDurationHuman(total) : 'Nichts erfasst'}
              aria-label={`${date.getDate()} ${MONTH_LABELS[viewMonth]}: ${
                total > 0 ? formatDurationHuman(total) : 'nichts erfasst'
              }`}
              className={`aspect-square rounded-lg flex flex-col items-center justify-center transition-all cursor-pointer border ${
                isSelected
                  ? 'border-[#2D5BFF] ring-1 ring-[#2D5BFF]'
                  : isToday
                    ? 'border-gray-400'
                    : 'border-transparent hover:border-gray-300'
              }`}
              style={{ backgroundColor: shadeFor(busiest > 0 ? total / busiest : 0) }}
            >
              <span
                className={`text-[0.6875rem] tabular-nums ${
                  total / (busiest || 1) >= 0.5 ? 'text-white font-semibold' : 'text-gray-600'
                }`}
              >
                {date.getDate()}
              </span>
            </button>
          );
        })}
      </div>

      {/* The rule stated where it can actually mislead someone. */}
      <p className="mt-3 text-[0.625rem] text-gray-400">
        Ein Eintrag zählt zu dem Tag, an dem er begonnen hat — Arbeit über Mitternacht bleibt beim
        früheren Tag.
      </p>

      {selectedKey && (
        <div className="mt-4 pt-4 border-t border-gray-100">
          {selectedEntries.length === 0 ? (
            <p className="text-xs text-gray-400">An diesem Tag wurde nichts erfasst.</p>
          ) : (
            <ul className="space-y-1.5">
              {selectedEntries.map((entry) => (
                <li key={entry.id}>
                  <button
                    type="button"
                    onClick={() => onEditEntry(entry)}
                    className="w-full flex items-center justify-between gap-3 text-left px-3 py-2 rounded-lg bg-gray-50 hover:bg-gray-100 transition-colors cursor-pointer"
                  >
                    <span className="text-xs text-gray-800 truncate">
                      {entry.title || 'Ohne Titel'}
                    </span>
                    <span className="text-xs font-semibold text-gray-900 tabular-nums shrink-0">
                      {formatDurationHuman(netMs(entry, now))}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
};
