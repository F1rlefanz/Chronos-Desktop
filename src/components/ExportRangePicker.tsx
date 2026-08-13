import React from 'react';
import { EXPORT_RANGE_LABELS, ExportRangeKind, ExportRangeSelection } from '../domain/exportRange';
import { MONTH_LABELS } from '../domain/stats';

interface ExportRangePickerProps {
  value: ExportRangeSelection;
  onChange: (next: ExportRangeSelection) => void;
  /** Years with entries, plus the current one — never empty, so this
      component needs no clock of its own. */
  availableYears: number[];
}

const FIELD =
  'w-full bg-gray-50 border border-gray-200 rounded-full px-3.5 py-2 text-xs text-gray-700 ' +
  'focus:outline-none focus:border-[#2D5BFF] focus:bg-white';

const ORDER: ExportRangeKind[] = [
  'this-month',
  'specific-month',
  'this-year',
  'specific-year',
  'this-week',
  'today',
  'custom',
  'all',
];

/**
 * Chooses the period an export covers.
 *
 * "A specific month" is the option this exists for. Everything else is
 * convenience; a timesheet is almost always about one named month that has
 * already ended, which a rolling "past 30 days" cannot express.
 */
export const ExportRangePicker: React.FC<ExportRangePickerProps> = ({
  value,
  onChange,
  availableYears,
}) => {
  return (
    <div className="space-y-2">
      <label htmlFor="export-range" className="block text-xs font-semibold text-gray-700">
        Zeitraum
      </label>
      <select
        id="export-range"
        value={value.kind}
        onChange={(e) => onChange({ ...value, kind: e.target.value as ExportRangeKind })}
        className={`${FIELD} cursor-pointer`}
      >
        {ORDER.map((kind) => (
          <option key={kind} value={kind}>
            {EXPORT_RANGE_LABELS[kind]}
          </option>
        ))}
      </select>

      {value.kind === 'specific-month' && (
        <div className="grid grid-cols-2 gap-2">
          <select
            aria-label="Monat"
            value={value.month}
            onChange={(e) => onChange({ ...value, month: Number(e.target.value) })}
            className={`${FIELD} cursor-pointer`}
          >
            {MONTH_LABELS.map((label, index) => (
              <option key={label} value={index}>
                {label}
              </option>
            ))}
          </select>
          <select
            aria-label="Jahr"
            value={value.year}
            onChange={(e) => onChange({ ...value, year: Number(e.target.value) })}
            className={`${FIELD} cursor-pointer`}
          >
            {availableYears.map((year) => (
              <option key={year} value={year}>
                {year}
              </option>
            ))}
          </select>
        </div>
      )}

      {value.kind === 'specific-year' && (
        <select
          aria-label="Jahr"
          value={value.year}
          onChange={(e) => onChange({ ...value, year: Number(e.target.value) })}
          className={`${FIELD} cursor-pointer`}
        >
          {availableYears.map((year) => (
            <option key={year} value={year}>
              {year}
            </option>
          ))}
        </select>
      )}

      {value.kind === 'custom' && (
        <div className="grid grid-cols-2 gap-2">
          <input
            type="date"
            aria-label="Von"
            value={value.from}
            onChange={(e) => onChange({ ...value, from: e.target.value })}
            className={FIELD}
          />
          <input
            type="date"
            aria-label="Bis"
            value={value.to}
            onChange={(e) => onChange({ ...value, to: e.target.value })}
            className={FIELD}
          />
        </div>
      )}
    </div>
  );
};
