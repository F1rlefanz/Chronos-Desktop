import { describe, it, expect, afterEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useBodyScrollLock } from './useBodyScrollLock';

afterEach(() => {
  document.body.style.overflow = '';
});

describe('useBodyScrollLock', () => {
  it('does nothing while inactive', () => {
    renderHook(() => useBodyScrollLock(false));

    expect(document.body.style.overflow).toBe('');
  });

  it('stops the page scrolling while active', () => {
    renderHook(() => useBodyScrollLock(true));

    expect(document.body.style.overflow).toBe('hidden');
  });

  it('lets the page scroll again once unmounted', () => {
    const { unmount } = renderHook(() => useBodyScrollLock(true));
    unmount();

    expect(document.body.style.overflow).toBe('');
  });

  it('releases when the modal closes without unmounting', () => {
    const { rerender } = renderHook(({ open }) => useBodyScrollLock(open), {
      initialProps: { open: true },
    });

    rerender({ open: false });

    expect(document.body.style.overflow).toBe('');
  });

  // Modals overlap — the export dialog opens over the settings dialog — and a
  // per-modal cleanup would release the page while one is still on screen.
  it('keeps the page locked until the last modal closes', () => {
    const first = renderHook(() => useBodyScrollLock(true));
    const second = renderHook(() => useBodyScrollLock(true));

    first.unmount();
    expect(document.body.style.overflow).toBe('hidden');

    second.unmount();
    expect(document.body.style.overflow).toBe('');
  });

  it('restores whatever the page had set before', () => {
    document.body.style.overflow = 'scroll';

    const { unmount } = renderHook(() => useBodyScrollLock(true));
    expect(document.body.style.overflow).toBe('hidden');

    unmount();
    expect(document.body.style.overflow).toBe('scroll');
  });
});
