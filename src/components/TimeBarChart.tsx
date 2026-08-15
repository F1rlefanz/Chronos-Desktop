import React, { useId, useState } from 'react';
import { SeriesPoint } from '../domain/stats';
import { formatDurationHuman } from '../utils/timeFormatters';

interface TimeBarChartProps {
  title: string;
  points: SeriesPoint[];
  /** Shown when every value is zero — a flat chart explains nothing. */
  emptyHint?: string;
}

const BAR_COLOR = '#2D5BFF';
const PLOT_HEIGHT = 120;

/**
 * A single-series bar chart of net time, drawn as inline SVG.
 *
 * Inline rather than a charting library: the whole job is one measure over a
 * dozen or so ordered buckets, and a dependency for that would be a lot of
 * bundle for a `<rect>`. One series means no legend — the title names what is
 * plotted — and no categorical palette to validate; the bars carry magnitude,
 * so they are all one hue.
 *
 * Values are read on hover rather than printed on every bar, which would turn
 * the chart back into a table.
 */
export const TimeBarChart: React.FC<TimeBarChartProps> = ({ title, points, emptyHint }) => {
  const [hovered, setHovered] = useState<number | null>(null);
  const titleId = useId();

  const max = Math.max(...points.map((p) => p.value), 0);
  const hasData = max > 0;

  return (
    <figure className="bg-white rounded-2xl border border-gray-200/90 shadow-2xs p-5 m-0">
      <figcaption
        id={titleId}
        className="text-xs font-bold uppercase tracking-wider text-gray-800 mb-4"
      >
        {title}
      </figcaption>

      {!hasData ? (
        <p className="text-xs text-gray-400 py-8 text-center">
          {emptyHint ?? 'In diesem Zeitraum wurde noch nichts erfasst.'}
        </p>
      ) : (
        <div className="relative">
          {/* The tooltip lives outside the SVG so it can use ordinary text
              styling and never be clipped by the viewBox. */}
          {hovered !== null && (
            <div
              role="status"
              className="absolute -top-1 left-1/2 -translate-x-1/2 z-10 rounded-lg bg-gray-900 text-white text-[0.6875rem] px-2.5 py-1 shadow-lg pointer-events-none whitespace-nowrap"
            >
              <strong className="font-semibold">{points[hovered].label}</strong>
              {' — '}
              {formatDurationHuman(points[hovered].value)}
            </div>
          )}

          <div
            className="flex items-end gap-[2px]"
            style={{ height: PLOT_HEIGHT }}
            onMouseLeave={() => setHovered(null)}
          >
            {points.map((point, index) => {
              const ratio = point.value / max;
              // Anything recorded keeps a visible sliver, so "a little" never
              // renders identically to "nothing".
              const height = point.value > 0 ? Math.max(3, ratio * PLOT_HEIGHT) : 0;
              const active = hovered === index;

              return (
                <button
                  type="button"
                  key={`${point.label}-${index}`}
                  onMouseEnter={() => setHovered(index)}
                  onFocus={() => setHovered(index)}
                  onBlur={() => setHovered(null)}
                  // The hit target is the full column height, not the bar: a
                  // near-empty bucket would otherwise be a few pixels tall.
                  className="group flex-1 h-full flex items-end cursor-default focus:outline-none"
                  aria-label={`${point.label}: ${formatDurationHuman(point.value)}`}
                >
                  <span
                    className="w-full rounded-t transition-opacity"
                    style={{
                      height: `${height}px`,
                      backgroundColor: BAR_COLOR,
                      opacity: hovered === null || active ? 1 : 0.35,
                    }}
                  />
                </button>
              );
            })}
          </div>

          {/* Baseline: recessive, and the only rule on the plot. */}
          <div className="h-px bg-gray-200" />

          <div className="flex gap-[2px] mt-1.5">
            {points.map((point, index) => (
              <span
                key={`${point.label}-label-${index}`}
                className={`flex-1 text-center text-[0.5625rem] tabular-nums truncate ${
                  hovered === index ? 'text-gray-900 font-semibold' : 'text-gray-400'
                }`}
              >
                {point.label}
              </span>
            ))}
          </div>
        </div>
      )}
    </figure>
  );
};
