import { logError, logInfo } from './logging/logger';

/**
 * Where a generated file goes.
 *
 * The browser can be handed a file through an `<a download>` click; a Tauri
 * WebView cannot — it ignores the click entirely, which is why every export
 * button silently did nothing on the desktop. The desktop build installs a sink
 * that writes the file itself and shows the user where it landed.
 */
export interface FileSink {
  /** Writes the file and resolves to the path it was written to. */
  write(name: string, bytes: Uint8Array): Promise<string>;
  /** Shows the folder the exports live in. */
  reveal(): Promise<void>;
}

export type DeliveryResult =
  | { ok: true; where: 'download' }
  | { ok: true; where: 'file'; path: string }
  | { ok: false; message: string };

let sink: FileSink | null = null;

/** Installed by `main.tsx` for the desktop build; the browser has none. */
export function setFileSink(next: FileSink | null): void {
  sink = next;
}

export function writesFilesItself(): boolean {
  return sink !== null;
}

/**
 * Hands a generated file to the browser as a download.
 *
 * Blob URLs are used instead of `data:` URIs because the latter must be
 * percent-encoded in full: an un-escaped `#` in a session title would
 * otherwise truncate the file at that point and silently drop every row
 * after it.
 */
function downloadBlob(bytes: Uint8Array, name: string, mimeType: string): void {
  // A fresh copy, because Blob wants an ArrayBuffer and the caller's view may
  // be a slice of a larger one.
  const blob = new Blob([bytes.slice().buffer as ArrayBuffer], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Delivers a generated file the way this build can.
 *
 * Failures come back as a value rather than an exception: an export that could
 * not be written is something the user has to be told about, and the export
 * dialog is where they are looking.
 */
export async function deliverFile(
  name: string,
  bytes: Uint8Array,
  mimeType: string
): Promise<DeliveryResult> {
  if (!sink) {
    downloadBlob(bytes, name, mimeType);
    return { ok: true, where: 'download' };
  }

  try {
    const path = await sink.write(name, bytes);
    logInfo(`[Export] Wrote ${name} (${bytes.byteLength} bytes).`);
    return { ok: true, where: 'file', path };
  } catch (error) {
    logError(`[Export] Could not write ${name}:`, error);

    const message =
      typeof error === 'object' && error !== null && 'message' in error
        ? String((error as { message: unknown }).message)
        : 'Die Datei konnte nicht geschrieben werden.';

    return { ok: false, message };
  }
}

/** Shows the export folder. Does nothing in a build that downloads instead. */
export async function revealExports(): Promise<void> {
  await sink?.reveal();
}

/** Text helper: the two text formats encode the same way. */
export function encodeText(text: string): Uint8Array {
  return new TextEncoder().encode(text);
}
