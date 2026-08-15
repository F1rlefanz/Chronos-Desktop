import React from 'react';
import { Code2, X, Layers, ShieldCheck, Clock } from 'lucide-react';
import { useBodyScrollLock } from '../hooks/useBodyScrollLock';

interface ArchitectureModalProps {
  isOpen: boolean;
  onClose: () => void;
}

/**
 * A short, honest description of how the app works.
 *
 * The previous version was marketing copy inherited from the generator that
 * produced the first draft — and it had quietly become false: it pointed at a
 * hook that no longer exists, advertised the frame-accumulating "drift-free
 * precision engine" that was deliberately removed for undercounting a minimised
 * window, and offered to wrap the app in Tauri, which is what it already ships
 * as. A page describing the architecture is worse than no page when it
 * describes a different program.
 */
export const ArchitectureModal: React.FC<ArchitectureModalProps> = ({ isOpen, onClose }) => {
  useBodyScrollLock(isOpen);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/30 backdrop-blur-xs animate-fade-in">
      <div className="bg-white border border-gray-200/90 rounded-3xl w-full max-w-2xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col text-gray-900">
        <div className="flex items-center justify-between px-6 py-4 bg-gray-50/80 border-b border-gray-200 shrink-0">
          <div className="flex items-center gap-2 text-[#2D5BFF] font-semibold text-base">
            <Code2 className="w-5 h-5" />
            <span>Wie Chronos arbeitet</span>
          </div>
          <button
            onClick={onClose}
            aria-label="Schließen"
            className="p-1 rounded-full text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-5 overflow-y-auto overscroll-contain custom-scrollbar text-gray-600 text-xs leading-relaxed">
          <section className="space-y-2">
            <h3 className="font-bold text-gray-900 text-sm flex items-center gap-2">
              <Clock className="w-4 h-4 text-[#2D5BFF]" />
              <span>Ein Eintrag ist ein Zeitraum, keine Zahl</span>
            </h3>
            <p>
              Gespeichert wird, <strong>wann</strong> gearbeitet wurde: ein Beginn, ein Ende und die
              Pausen dazwischen — jede mit eigenem Anfang und Ende. Wie lange es war, wird daraus
              jedes Mal neu gerechnet und nirgends abgelegt. Deshalb kann keine gespeicherte Dauer
              den Zeitstempeln widersprechen, und eine nachträgliche Korrektur bewegt Tages-,
              Wochen- und Monatssumme sowie jedes Diagramm gleichzeitig.
            </p>
            <p>
              Ein Eintrag ohne Ende ist eine laufende Erfassung. Genau das macht sie absturzsicher:
              sie liegt ab dem Startklick auf der Festplatte, nicht im Arbeitsspeicher.
            </p>
          </section>

          <section className="space-y-2">
            <h3 className="font-bold text-gray-900 text-sm flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-[#2D5BFF]" />
              <span>Die Daten bleiben hier</span>
            </h3>
            <p>
              Kein Konto, kein Server, keine Cloud. Die Desktop-Version legt alles unter{' '}
              <code>%LOCALAPPDATA%\Chronos</code> ab und schreibt über eine temporäre Datei, damit
              ein Absturz mitten im Speichern nicht die einzige Kopie zerreißt. Zusätzlich entsteht
              täglich eine Sicherung — und immer vor dem Löschen aller Einträge und vor einem
              Import.
            </p>
            <p>
              Schlägt ein Speichervorgang fehl, erscheint ein Hinweis im Fenster. Ein stiller Fehler
              wäre der schlimmste Fall: die Änderung wäre nach einem Neustart weg, ohne dass es
              jemand bemerkt.
            </p>
            <p>
              Wer zwei Geräte abgleicht, hat die Wahl zwischen zwei Wegen — beide ohne Konto und
              ohne Server. Entweder ein Ordner, den du selbst wählst: Chronos legt dort eine kleine
              Datei je Gerät ab und liest die der anderen. Oder direkt im selben WLAN, ohne Ordner
              und ohne fremden Dienst — ein Gerät wartet, das andere verbindet sich mit Adresse und
              Code. Wer beides nicht nutzt, gibt nichts heraus.
            </p>
          </section>

          <section className="space-y-2">
            <h3 className="font-bold text-gray-900 text-sm flex items-center gap-2">
              <Layers className="w-4 h-4 text-[#2D5BFF]" />
              <span>Aufbau</span>
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 font-mono text-[0.6875rem]">
              <div className="p-3 rounded-2xl bg-gray-50 border border-gray-200/80">
                <span className="text-[#2D5BFF] font-bold block mb-1">/src/domain</span>
                <span className="font-sans">
                  Die Rechenregeln: Dauer, Pausen, Prüfungen, Auswertungen, Exportzeiträume. Reine
                  Funktionen ohne Oberfläche — der Teil, der Tests am meisten bringt.
                </span>
              </div>
              <div className="p-3 rounded-2xl bg-gray-50 border border-gray-200/80">
                <span className="text-[#2D5BFF] font-bold block mb-1">/src/utils/storage</span>
                <span className="font-sans">
                  Ein Adapter je Ablageort — Browser oder Dateisystem. Nur hier wird tatsächlich
                  geschrieben, und Fehler kommen als Wert zurück statt als Ausnahme.
                </span>
              </div>
              <div className="p-3 rounded-2xl bg-gray-50 border border-gray-200/80">
                <span className="text-purple-600 font-bold block mb-1">/src/hooks</span>
                <span className="font-sans">
                  Die laufende Anzeige. Neu gezeichnet wird im Takt der Bildwiederholung, gezählt
                  wird nach der Wanduhr — Bilder sind kein Maß für vergangene Zeit.
                </span>
              </div>
              <div className="p-3 rounded-2xl bg-gray-50 border border-gray-200/80">
                <span className="text-emerald-600 font-bold block mb-1">/src/utils/sync</span>
                <span className="font-sans">
                  Der Abgleich — über einen Ordner oder direkt im Netz. Zusammengeführt wird in
                  beiden Fällen nach derselben reinen Regel: die neuere Fassung gewinnt, gelöscht
                  bleibt gelöscht, und zweimal abgleichen ändert nichts mehr.
                </span>
              </div>
              <div className="p-3 rounded-2xl bg-gray-50 border border-gray-200/80">
                <span className="text-amber-600 font-bold block mb-1">/src/utils</span>
                <span className="font-sans">
                  Export nach PDF, CSV und JSON. Was in eine Datei kommt, entscheidet der Zeitraum
                  vorher — die Exporter formatieren nur noch.
                </span>
              </div>
            </div>
          </section>
        </div>

        <div className="p-4 bg-gray-50/80 border-t border-gray-200 flex justify-end shrink-0">
          <button
            onClick={onClose}
            className="px-6 py-2 rounded-full bg-[#2D5BFF] hover:bg-blue-600 text-white font-bold text-xs cursor-pointer"
          >
            Schließen
          </button>
        </div>
      </div>
    </div>
  );
};
