import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Wifi, X } from 'lucide-react';
import { useBodyScrollLock } from '../hooks/useBodyScrollLock';
import {
  DEFAULT_PORT,
  Listening,
  exchange,
  newPairingCode,
  parseTarget,
  startListening,
  stopListening,
  takeReceived,
} from '../utils/sync/lan';

interface LanSyncModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** This device's records, in the shape the other side reads. */
  buildPayload: () => string;
  /** Merges what the other device sent; resolves to what to tell the user. */
  onReceive: (payload: string) => Promise<string>;
}

function messageOf(error: unknown): string {
  if (typeof error === 'object' && error !== null && 'message' in error) {
    return String((error as { message: unknown }).message);
  }
  return String(error);
}

/**
 * Two devices on one network, without a folder in between.
 *
 * One side waits and shows an address and a code; the other types them. Whoever
 * connects sends their records and gets the other's back in the same breath, so
 * one action leaves both devices holding the same thing.
 *
 * The listener lives exactly as long as this dialog: opening starts it, closing
 * stops it. Nothing is reachable from the network while nobody is looking.
 */
export const LanSyncModal: React.FC<LanSyncModalProps> = ({
  isOpen,
  onClose,
  buildPayload,
  onReceive,
}) => {
  const [listening, setListening] = useState<Listening | null>(null);
  const [target, setTarget] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<{ kind: 'ok' | 'bad'; text: string } | null>(null);

  useBodyScrollLock(isOpen);

  // Kept in refs so the polling effect can be set up once and still call the
  // current handlers rather than the ones this render happened to close over.
  const buildRef = useRef(buildPayload);
  const receiveRef = useRef(onReceive);

  useEffect(() => {
    buildRef.current = buildPayload;
    receiveRef.current = onReceive;
  }, [buildPayload, onReceive]);

  /** Starts answering, and stops again when the dialog goes away. */
  useEffect(() => {
    if (!isOpen) return;

    let live = true;

    void (async () => {
      try {
        const where = await startListening(newPairingCode(), buildRef.current());
        if (live) setListening(where);
        else void stopListening();
      } catch (error) {
        if (live) {
          setListening(null);
          setStatus({ kind: 'bad', text: messageOf(error) });
        }
      }
    })();

    // Cleared on the way out rather than on the way in: the dialog is not
    // unmounted when it closes, so a report from the last exchange would
    // otherwise still be sitting there the next time it opens.
    return () => {
      live = false;
      setListening(null);
      setStatus(null);
      void stopListening();
    };
  }, [isOpen]);

  /** Collects what a peer pushed while this was open. */
  useEffect(() => {
    if (!isOpen || !listening) return;

    const timer = setInterval(() => {
      void (async () => {
        try {
          const payload = await takeReceived();
          if (!payload) return;

          const summary = await receiveRef.current(payload);
          setStatus({ kind: 'ok', text: summary });
        } catch (error) {
          setStatus({ kind: 'bad', text: messageOf(error) });
        }
      })();
    }, 1000);

    return () => clearInterval(timer);
  }, [isOpen, listening]);

  const connect = useCallback(async () => {
    const parsed = parseTarget(target);
    if (!parsed) {
      setStatus({ kind: 'bad', text: 'Das ist keine Adresse — erwartet wird etwa 192.168.1.42.' });
      return;
    }

    setBusy(true);
    setStatus(null);

    try {
      const theirs = await exchange(parsed.address, parsed.port, code.trim(), buildRef.current());
      setStatus({ kind: 'ok', text: await receiveRef.current(theirs) });
    } catch (error) {
      setStatus({ kind: 'bad', text: messageOf(error) });
    } finally {
      setBusy(false);
    }
  }, [target, code]);

  if (!isOpen) return null;

  const where = listening
    ? listening.port === DEFAULT_PORT
      ? listening.address
      : `${listening.address}:${listening.port}`
    : null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/30 backdrop-blur-xs animate-fade-in">
      <div className="bg-white border border-gray-200/90 rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden max-h-[90vh] flex flex-col text-gray-900">
        <div className="flex items-center justify-between px-6 py-4 bg-gray-50/80 border-b border-gray-200 shrink-0">
          <div className="flex items-center gap-2 text-[#2D5BFF] font-semibold text-base">
            <Wifi className="w-5 h-5" />
            <span>Im selben Netz abgleichen</span>
          </div>
          <button
            onClick={onClose}
            aria-label="Schließen"
            className="p-1 rounded-full text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-5 overflow-y-auto overscroll-contain custom-scrollbar">
          <p className="text-[0.6875rem] text-gray-500">
            Beide Geräte müssen im selben WLAN sein und Chronos offen haben. Ein Gerät wartet, das
            andere verbindet sich — danach haben beide denselben Stand. Es geht nichts ins Internet
            und nichts durch fremde Hände.
          </p>

          <section className="space-y-2 p-3.5 rounded-2xl bg-gray-50 border border-gray-200/80">
            <h3 className="text-xs font-bold uppercase tracking-wider text-gray-400">
              Dieses Gerät wartet
            </h3>

            {where ? (
              <>
                <p className="text-[0.6875rem] text-gray-500">Am anderen Gerät eingeben:</p>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-mono text-sm font-semibold bg-white border border-gray-200 rounded-xl px-3 py-2">
                    {where}
                  </span>
                  <span className="font-mono text-sm font-semibold tracking-[0.2em] bg-white border border-gray-200 rounded-xl px-3 py-2">
                    {listening?.code}
                  </span>
                </div>
              </>
            ) : (
              <p className="text-[0.6875rem] text-gray-400">
                {status?.kind === 'bad' ? 'Warten nicht möglich.' : 'Wird gestartet…'}
              </p>
            )}
          </section>

          <section className="space-y-2 p-3.5 rounded-2xl bg-gray-50 border border-gray-200/80">
            <h3 className="text-xs font-bold uppercase tracking-wider text-gray-400">
              Oder mit einem wartenden Gerät verbinden
            </h3>

            <div className="flex flex-col gap-2 sm:flex-row">
              <input
                value={target}
                onChange={(e) => setTarget(e.target.value)}
                placeholder="192.168.1.42"
                inputMode="decimal"
                aria-label="Adresse des anderen Geräts"
                className="flex-1 bg-white border border-gray-200 rounded-full px-4 py-2 text-xs font-mono text-gray-800 placeholder-gray-400 focus:outline-none focus:border-[#2D5BFF]"
              />
              <input
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="123456"
                inputMode="numeric"
                maxLength={6}
                aria-label="Code des anderen Geräts"
                className="w-full sm:w-28 bg-white border border-gray-200 rounded-full px-4 py-2 text-xs font-mono tracking-[0.2em] text-gray-800 placeholder-gray-400 focus:outline-none focus:border-[#2D5BFF]"
              />
              <button
                onClick={() => void connect()}
                disabled={busy}
                className="px-4 py-2 rounded-full bg-[#2D5BFF] hover:bg-blue-600 disabled:bg-blue-300 disabled:cursor-default text-white font-bold text-xs cursor-pointer shrink-0"
              >
                {busy ? 'Verbinde…' : 'Abgleichen'}
              </button>
            </div>
          </section>

          {status && (
            <p
              role="status"
              className={`text-[0.6875rem] ${status.kind === 'bad' ? 'text-rose-600' : 'text-emerald-700'}`}
            >
              {status.text}
            </p>
          )}
        </div>

        <div className="p-4 bg-gray-50/80 border-t border-gray-200 flex justify-end shrink-0">
          <button
            onClick={onClose}
            className="px-6 py-2 rounded-full bg-[#2D5BFF] hover:bg-blue-600 text-white font-bold text-xs cursor-pointer"
          >
            Fertig
          </button>
        </div>
      </div>
    </div>
  );
};
