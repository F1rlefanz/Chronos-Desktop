import React from 'react';
import { FocusPhase, FocusSignal } from '../domain/focus';
import { formatDurationHuman } from '../utils/timeFormatters';

interface FocusNoticeProps {
  signal: FocusSignal | null;
  phase: FocusPhase | null;
  calm?: boolean;
  onFlow: () => void;
  onBreak: () => void;
  onResume: () => void;
  onNotYet: () => void;
}

/**
 * What the rhythm asks when a block or a pause has run its course.
 *
 * An in-app message beside the controls it is about, never a browser dialog —
 * those draw nothing in the Android WebView. It does not go away by itself: a
 * question that vanished after a few seconds would be one the user could miss
 * by looking at something else for a moment.
 *
 * `break-due` has no notice. In `fixed` mode the pause has already begun by the
 * time this would show, and the ring saying "Pause" is the news.
 */
export const FocusNotice: React.FC<FocusNoticeProps> = ({
  signal,
  phase,
  calm = false,
  onFlow,
  onBreak,
  onResume,
  onNotYet,
}) => {
  if (!phase || !signal || signal === 'break-due') return null;

  const breakLabel =
    phase.kind === 'focus' ? `Pause (${formatDurationHuman(phase.suggestedBreakMs)})` : 'Pause';

  let text: string;
  let actions: { label: string; onClick: () => void; primary?: boolean }[];

  if (signal === 'goal-reached' && phase.kind === 'focus') {
    text = `Ziel erreicht: ${formatDurationHuman(phase.targetMs ?? phase.elapsedMs)} Im Fluss bleiben oder Pause machen?`;
    actions = [
      { label: 'Weiter im Fluss (+10 Min.)', onClick: onFlow, primary: true },
      { label: breakLabel, onClick: onBreak },
    ];
  } else if (signal === 'long-run') {
    text = `Seit ${formatDurationHuman(phase.elapsedMs)} am Stück. Zeit für eine Pause?`;
    actions = [
      { label: breakLabel, onClick: onBreak, primary: true },
      { label: 'Noch nicht', onClick: onNotYet },
    ];
  } else {
    text = 'Die Pause ist vorbei. Bereit für den nächsten Block?';
    actions = [{ label: 'Nächster Block', onClick: onResume, primary: true }];
  }

  const tone = signal === 'break-over' ? 'amber' : 'emerald';
  const surface = calm
    ? tone === 'amber'
      ? 'bg-[#2A2110] text-[#E9ECF5]'
      : 'bg-[#15241F] text-[#E9ECF5]'
    : tone === 'amber'
      ? 'bg-amber-50 text-gray-800'
      : 'bg-emerald-50 text-gray-800';

  return (
    <div role="status" className={`mt-6 rounded-2xl px-4 py-3.5 space-y-3 text-sm ${surface}`}>
      <p>{text}</p>
      <div className="flex flex-wrap gap-2">
        {actions.map((action) => (
          <button
            key={action.label}
            type="button"
            onClick={action.onClick}
            className={`px-4 py-2 rounded-full text-sm font-semibold cursor-pointer transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#2D5BFF] ${
              action.primary
                ? tone === 'amber'
                  ? 'bg-[#2D5BFF] text-white hover:bg-blue-600'
                  : 'bg-emerald-600 text-white hover:bg-emerald-700'
                : calm
                  ? 'bg-white/10 text-[#E9ECF5] hover:bg-white/20'
                  : 'bg-white text-gray-700 border border-gray-200 hover:bg-gray-50'
            }`}
          >
            {action.label}
          </button>
        ))}
      </div>
    </div>
  );
};
