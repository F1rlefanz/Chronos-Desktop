import React from 'react';
import { AlertTriangle } from 'lucide-react';
import { useBodyScrollLock } from '../hooks/useBodyScrollLock';

export interface ConfirmRequest {
  title: string;
  /** One paragraph per line. Kept as strings so a caller cannot smuggle markup in. */
  lines: string[];
  confirmLabel: string;
  cancelLabel?: string;
  /** `danger` when the confirming action destroys something. */
  tone?: 'danger' | 'neutral';
}

interface ConfirmPromptProps {
  request: ConfirmRequest;
  onConfirm: () => void;
  onCancel: () => void;
}

/**
 * The app's one way of asking a yes-or-no question.
 *
 * It exists because `window.confirm` **does not work here**. In the Android
 * WebView it returns `true` without drawing anything, so every guard written
 * with it silently answered yes: discarding a running measurement, clearing the
 * whole history, saving an entry over a validation warning, and proceeding
 * after a backup had failed. Verified on a Fairphone 6 — the running
 * measurement was gone 500ms after the tap, with no dialog in between.
 *
 * So: never `window.confirm`, `alert` or `prompt` anywhere in this app. A
 * browser dialog is not a feature of the platform Chronos ships on.
 *
 * Cancelling is the default action — the button that keeps things as they are
 * comes first and carries the weight, because a person tapping past a dialog
 * should land on the harmless side of it.
 */
export const ConfirmPrompt: React.FC<ConfirmPromptProps> = ({ request, onConfirm, onCancel }) => {
  // Mounted only while a question is open, as RecoveryPrompt and
  // DeletionPrompt are, so there is no isOpen prop to get wrong.
  useBodyScrollLock(true);

  const danger = request.tone !== 'neutral';

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/40 backdrop-blur-xs animate-fade-in"
    >
      <div className="bg-white border border-gray-200/90 rounded-3xl w-full max-w-md shadow-2xl overflow-hidden max-h-[90vh] flex flex-col text-gray-900">
        <div
          className={`flex items-center gap-2 px-6 py-4 border-b shrink-0 ${
            danger
              ? 'bg-amber-50 border-amber-200 text-amber-800'
              : 'bg-gray-50 border-gray-200 text-gray-700'
          }`}
        >
          <AlertTriangle className="w-5 h-5 shrink-0" />
          <h2 id="confirm-title" className="font-semibold text-base">
            {request.title}
          </h2>
        </div>

        <div className="p-6 space-y-4 overflow-y-auto overscroll-contain custom-scrollbar">
          {request.lines.map((line) => (
            <p key={line} className="text-xs text-gray-500">
              {line}
            </p>
          ))}

          <div className="flex flex-col gap-2">
            <button
              onClick={onCancel}
              className="px-5 py-3 rounded-full bg-[#2D5BFF] hover:bg-blue-600 text-white font-semibold text-sm shadow-md shadow-blue-500/20 transition-colors cursor-pointer"
            >
              {request.cancelLabel ?? 'Abbrechen'}
            </button>
            <button
              onClick={onConfirm}
              className={`px-4 py-2.5 rounded-full bg-white border font-semibold text-xs transition-colors cursor-pointer ${
                danger
                  ? 'hover:bg-rose-50 text-rose-700 border-rose-200'
                  : 'hover:bg-gray-50 text-gray-700 border-gray-200'
              }`}
            >
              {request.confirmLabel}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
