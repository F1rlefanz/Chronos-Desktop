import React, { useId, useState } from 'react';
import { AppSettings } from '../types';
import { FOCUS_LIMITS } from '../constants/defaultConfig';
import { clampMinutes } from '../domain/focus';

type Lengths = Pick<AppSettings, 'focusMinutes' | 'breakMinutes'>;

interface FocusLengthsProps {
  settings: Lengths;
  onChange: (change: Partial<Lengths>) => void;
  /** Show only the block length, as in a pause where the next block is what is left to decide. */
  only?: 'block';
  blockLabel?: string;
  /** Hide the block length, in `open` mode where there is no block. */
  hideBlock?: boolean;
}

/**
 * How long a block and a pause last — whatever the user wants them to.
 *
 * Presets are shortcuts and not the list of allowed values: any whole number of
 * minutes within the limits can be typed or stepped to. What is entered is the
 * user's default from then on, so "thirty minutes before the meeting" is one
 * edit away when coming back from a pause and still there at the next start.
 */
export const FocusLengths: React.FC<FocusLengthsProps> = ({
  settings,
  onChange,
  only,
  blockLabel = 'Block',
  hideBlock = false,
}) => (
  <div className="flex flex-wrap gap-x-6 gap-y-3 text-sm text-gray-700">
    {!hideBlock && (
      <MinutesField
        label={blockLabel}
        value={settings.focusMinutes}
        limits={FOCUS_LIMITS.focusMinutes}
        step={5}
        onCommit={(focusMinutes) => onChange({ focusMinutes })}
      />
    )}
    {only !== 'block' && (
      <MinutesField
        label="Pause"
        value={settings.breakMinutes}
        limits={FOCUS_LIMITS.breakMinutes}
        step={1}
        onCommit={(breakMinutes) => onChange({ breakMinutes })}
      />
    )}
  </div>
);

interface MinutesFieldProps {
  label: string;
  value: number;
  limits: { min: number; max: number };
  step: number;
  onCommit: (minutes: number) => void;
}

const stepButton =
  'w-8 h-8 rounded-full border border-gray-200 bg-gray-50 hover:bg-gray-100 text-base leading-none cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-[#2D5BFF] disabled:opacity-40 disabled:cursor-not-allowed';

/**
 * A number the user can step or type.
 *
 * Typing keeps its own draft and is committed on blur or Enter: committing on
 * every keystroke would clamp "2" up to the minimum before the "5" of "25" was
 * typed. An entry that is not a number is dropped and the old value comes back.
 */
const MinutesField: React.FC<MinutesFieldProps> = ({ label, value, limits, step, onCommit }) => {
  const id = useId();
  const [draft, setDraft] = useState<string | null>(null);

  const commit = () => {
    if (draft !== null) {
      const parsed = Number.parseInt(draft, 10);
      if (Number.isFinite(parsed)) onCommit(clampMinutes(parsed, limits));
    }
    setDraft(null);
  };

  const by = (delta: number) => onCommit(clampMinutes(value + delta, limits));

  return (
    <span className="inline-flex items-center gap-2">
      <label htmlFor={id}>{label}</label>
      <button
        type="button"
        className={stepButton}
        onClick={() => by(-step)}
        disabled={value <= limits.min}
        aria-label={`${label} kürzer`}
      >
        −
      </button>
      <input
        id={id}
        type="text"
        inputMode="numeric"
        value={draft ?? String(value)}
        onChange={(e) => setDraft(e.target.value.replace(/[^\d]/g, ''))}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') commit();
        }}
        className="w-14 rounded-lg border border-gray-200 bg-white py-1 text-center font-semibold tabular-nums focus:outline-none focus-visible:ring-2 focus-visible:ring-[#2D5BFF]"
      />
      <span aria-hidden="true">Min.</span>
      <button
        type="button"
        className={stepButton}
        onClick={() => by(step)}
        disabled={value >= limits.max}
        aria-label={`${label} länger`}
      >
        +
      </button>
    </span>
  );
};
