import { describe, it, expect } from 'vitest';
import { describeSyncFolder } from './folderLabel';

describe('describeSyncFolder', () => {
  it('leaves a desktop path alone', () => {
    expect(describeSyncFolder('D:\\OneDrive\\Chronos')).toBe('D:\\OneDrive\\Chronos');
    expect(describeSyncFolder('/home/christoph/Chronos')).toBe('/home/christoph/Chronos');
    expect(describeSyncFolder('')).toBe('');
  });

  it('reads the folder out of an Android tree permission', () => {
    expect(
      describeSyncFolder(
        'content://com.android.externalstorage.documents/tree/primary%3ADocuments%2FChronos'
      )
    ).toBe('Documents/Chronos');
  });

  it('keeps the volume when it is not the built-in one', () => {
    // Two folders called Chronos on two cards is exactly when the volume is
    // the part that answers the question.
    expect(
      describeSyncFolder('content://com.android.externalstorage.documents/tree/1AE3-5F09%3AChronos')
    ).toBe('1AE3-5F09:Chronos');
  });

  it('names the whole of internal storage rather than showing nothing', () => {
    expect(
      describeSyncFolder('content://com.android.externalstorage.documents/tree/primary%3A')
    ).toBe('Interner Speicher');
  });

  it('ignores the document half some providers append', () => {
    expect(
      describeSyncFolder(
        'content://com.android.externalstorage.documents/tree/primary%3ASync/document/primary%3ASync%2Fchronos.json'
      )
    ).toBe('Sync');
  });

  it('gives back what it got when the URI makes no sense', () => {
    expect(describeSyncFolder('content://something/else')).toBe('content://something/else');
    expect(describeSyncFolder('content://x/tree/%E0%A4%A')).toBe('content://x/tree/%E0%A4%A');
  });
});
