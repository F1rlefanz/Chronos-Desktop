import React from 'react';
import { Summary } from '../domain/stats';
import { formatDurationHuman } from '../utils/timeFormatters';

interface StatCardsProps {
  summary: Summary;
}

const CARDS: { key: keyof Summary; label: string }[] = [
  { key: 'today', label: 'Heute' },
  { key: 'week', label: 'Diese Woche' },
  { key: 'month', label: 'Dieser Monat' },
  { key: 'year', label: 'Dieses Jahr' },
  { key: 'allTime', label: 'Gesamt' },
];

/**
 * The five headline totals.
 *
 * These are stat tiles rather than a chart on purpose: five unrelated
 * single numbers have no shape to compare, and plotting them would invite a
 * reading — "the year is bigger than the month" — that is arithmetic, not
 * insight. The figures nest by definition.
 */
export const StatCards: React.FC<StatCardsProps> = ({ summary }) => {
  return (
    <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
      {CARDS.map(({ key, label }) => (
        <div
          key={key}
          className="bg-white rounded-2xl border border-gray-200/90 shadow-2xs px-4 py-3.5"
        >
          <span className="block text-[0.625rem] font-semibold uppercase tracking-wider text-gray-400">
            {label}
          </span>
          <span className="block mt-1 text-lg font-semibold text-gray-900 tabular-nums">
            {summary[key] === 0 ? (
              <span className="text-gray-300">—</span>
            ) : (
              formatDurationHuman(summary[key])
            )}
          </span>
        </div>
      ))}
    </div>
  );
};
