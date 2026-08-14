/**
 * What to show a person instead of what the system stored.
 *
 * On the desktop the setting holds a path, and a path is already readable. On
 * Android it holds the permission the picker handed back:
 *
 *   content://com.android.externalstorage.documents/tree/primary%3ADocuments%2FChronos
 *
 * Showing that would be honest and useless. The readable part is at the end —
 * the volume, a colon, and the folder inside it — so this decodes the last
 * segment and drops the volume when it is the built-in one, which is the only
 * case where naming it tells the reader nothing.
 *
 * A pure function rather than a second stored field: the label has exactly one
 * source, and a setting that has to be kept in step with another setting is a
 * setting that will not be.
 */
export function describeSyncFolder(folder: string): string {
  if (!folder.startsWith('content://')) return folder;

  const marker = '/tree/';
  const start = folder.indexOf(marker);
  if (start === -1) return folder;

  let documentId: string;
  try {
    documentId = decodeURIComponent(folder.slice(start + marker.length));
  } catch {
    // A URI that will not decode is not one we should be guessing at.
    return folder;
  }

  // Some providers append a second segment for the document inside the tree.
  const treeId = documentId.split('/document/')[0];
  const colon = treeId.indexOf(':');
  if (colon === -1) return treeId || folder;

  const volume = treeId.slice(0, colon);
  const path = treeId.slice(colon + 1);

  if (!path) return volume === 'primary' ? 'Interner Speicher' : volume;
  // An SD card or a cloud provider keeps its volume: which of two folders
  // called "Chronos" this is, is the whole question there.
  return volume === 'primary' ? path : `${volume}:${path}`;
}
