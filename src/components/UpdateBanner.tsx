import React, { useCallback, useState } from 'react';
import { Download, X } from 'lucide-react';
import { AvailableUpdate } from '../utils/update';
import { bulletsFrom } from '../utils/update/notes';

interface UpdateBannerProps {
  update: AvailableUpdate;
  /** On a phone this ends at Android's installer, not at a restart. */
  handsOverToSystem: boolean;
  onDismiss: () => void;
}

/**
 * "There is a newer version, here is what is in it, here is the button."
 *
 * Deliberately a banner and not a dialog that appears over the app at startup:
 * an update is never more urgent than what the user opened the app to do, and
 * a modal that greets you before your own stopwatch is a mechanism serving
 * itself. It can also be dismissed, and stays dismissed for the session.
 */
export const UpdateBanner: React.FC<UpdateBannerProps> = ({
  update,
  handsOverToSystem,
  onDismiss,
}) => {
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<number | null>(null);
  const [failure, setFailure] = useState<string | null>(null);

  const bullets = bulletsFrom(update.notes);

  const install = useCallback(async () => {
    setBusy(true);
    setFailure(null);

    try {
      await update.install(setProgress);
    } catch (error) {
      setFailure(error instanceof Error ? error.message : String(error));
      setBusy(false);
    }
  }, [update]);

  return (
    <div
      role="status"
      className="flex flex-col gap-3 rounded-2xl border border-blue-200 bg-blue-50/80 p-4 px-5 text-sm text-blue-950 sm:flex-row sm:items-start sm:justify-between"
    >
      <div className="min-w-0">
        <p>
          <strong className="font-semibold">Version {update.version} ist da.</strong>{' '}
          {handsOverToSystem
            ? 'Chronos lädt sie herunter; installieren musst du sie dann in Androids eigenem Dialog.'
            : 'Chronos installiert sie und startet sich danach neu.'}
        </p>

        {bullets.length > 0 && (
          <ul className="mt-2 list-disc space-y-0.5 pl-5 text-[0.6875rem] text-blue-900/80">
            {bullets.slice(0, 4).map((bullet, index) => (
              <li key={index}>{bullet}</li>
            ))}
            {bullets.length > 4 && (
              <li>
                {bullets.length === 5
                  ? '… und eine weitere Änderung.'
                  : `… und ${bullets.length - 4} weitere Änderungen.`}
              </li>
            )}
          </ul>
        )}

        {failure && <p className="mt-2 text-[0.6875rem] text-rose-700">{failure}</p>}
      </div>

      <div className="flex shrink-0 items-center gap-2">
        <button
          type="button"
          onClick={() => void install()}
          disabled={busy}
          className="flex items-center gap-1.5 rounded-full bg-[#2D5BFF] px-3.5 py-1.5 text-xs font-bold whitespace-nowrap text-white transition-colors hover:bg-blue-600 disabled:cursor-default disabled:bg-blue-300"
        >
          <Download className="h-3.5 w-3.5 shrink-0" />
          <span>
            {busy
              ? // A length the server did not send is not a number to invent:
                // the bar would have to lie about how far along it is.
                progress === null
                ? 'Lädt…'
                : `${Math.round(progress * 100)} %`
              : 'Jetzt aktualisieren'}
          </span>
        </button>
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Hinweis schließen"
          className="rounded-full px-2 text-blue-500 transition-colors hover:text-blue-800"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
};
