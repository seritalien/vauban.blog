import { vi, describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

// ---------------------------------------------------------------------------
// Imports
// ---------------------------------------------------------------------------

import { useCommandPalette } from '@/hooks/use-command-palette';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function dispatchKeydown(options: Partial<KeyboardEventInit> = {}) {
  const event = new KeyboardEvent('keydown', {
    bubbles: true,
    cancelable: true,
    ...options,
  });
  document.dispatchEvent(event);
  return event;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.clearAllMocks();
});

describe('useCommandPalette', () => {
  it('starts closed (isOpen=false)', () => {
    const { result } = renderHook(() => useCommandPalette());

    expect(result.current.isOpen).toBe(false);
  });

  it('open() sets isOpen to true', () => {
    const { result } = renderHook(() => useCommandPalette());

    act(() => {
      result.current.open();
    });

    expect(result.current.isOpen).toBe(true);
  });

  it('close() sets isOpen to false', () => {
    const { result } = renderHook(() => useCommandPalette());

    // Open first
    act(() => {
      result.current.open();
    });
    expect(result.current.isOpen).toBe(true);

    // Close
    act(() => {
      result.current.close();
    });
    expect(result.current.isOpen).toBe(false);
  });

  it('toggle() flips state from false to true and back', () => {
    const { result } = renderHook(() => useCommandPalette());

    expect(result.current.isOpen).toBe(false);

    act(() => {
      result.current.toggle();
    });
    expect(result.current.isOpen).toBe(true);

    act(() => {
      result.current.toggle();
    });
    expect(result.current.isOpen).toBe(false);
  });

  it('Cmd+K toggles isOpen (metaKey=true, key="k")', () => {
    const { result } = renderHook(() => useCommandPalette());

    expect(result.current.isOpen).toBe(false);

    // First press opens
    act(() => {
      dispatchKeydown({ metaKey: true, key: 'k' });
    });
    expect(result.current.isOpen).toBe(true);

    // Second press closes
    act(() => {
      dispatchKeydown({ metaKey: true, key: 'k' });
    });
    expect(result.current.isOpen).toBe(false);
  });

  it('Ctrl+K toggles isOpen (ctrlKey=true, key="k")', () => {
    const { result } = renderHook(() => useCommandPalette());

    expect(result.current.isOpen).toBe(false);

    act(() => {
      dispatchKeydown({ ctrlKey: true, key: 'k' });
    });
    expect(result.current.isOpen).toBe(true);

    act(() => {
      dispatchKeydown({ ctrlKey: true, key: 'k' });
    });
    expect(result.current.isOpen).toBe(false);
  });

  it('"k" without modifier does nothing', () => {
    const { result } = renderHook(() => useCommandPalette());

    act(() => {
      dispatchKeydown({ key: 'k' });
    });

    expect(result.current.isOpen).toBe(false);
  });

  it('Cmd+other key does nothing', () => {
    const { result } = renderHook(() => useCommandPalette());

    act(() => {
      dispatchKeydown({ metaKey: true, key: 'j' });
    });
    expect(result.current.isOpen).toBe(false);

    act(() => {
      dispatchKeydown({ metaKey: true, key: 'a' });
    });
    expect(result.current.isOpen).toBe(false);

    act(() => {
      dispatchKeydown({ ctrlKey: true, key: 'z' });
    });
    expect(result.current.isOpen).toBe(false);
  });

  it('cleans up event listener on unmount', () => {
    const addSpy = vi.spyOn(document, 'addEventListener');
    const removeSpy = vi.spyOn(document, 'removeEventListener');

    const { unmount } = renderHook(() => useCommandPalette());

    expect(addSpy).toHaveBeenCalledWith('keydown', expect.any(Function));

    unmount();

    expect(removeSpy).toHaveBeenCalledWith('keydown', expect.any(Function));

    addSpy.mockRestore();
    removeSpy.mockRestore();
  });
});
