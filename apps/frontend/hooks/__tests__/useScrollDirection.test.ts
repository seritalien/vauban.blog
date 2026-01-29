import { vi, describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

// ---------------------------------------------------------------------------
// Imports
// ---------------------------------------------------------------------------

import { useScrollDirection } from '@/hooks/useScrollDirection';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function setScrollY(value: number) {
  Object.defineProperty(window, 'scrollY', { value, writable: true, configurable: true });
}

function fireScroll() {
  window.dispatchEvent(new Event('scroll'));
}

function scrollTo(y: number) {
  setScrollY(y);
  fireScroll();
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.clearAllMocks();
  setScrollY(0);
});

describe('useScrollDirection', () => {
  it('returns "top" initially when scrollY is 0', () => {
    const { result } = renderHook(() => useScrollDirection());

    expect(result.current).toBe('top');
  });

  it('returns "down" when scrolling down past threshold', () => {
    const { result } = renderHook(() => useScrollDirection());

    // Scroll down past the default threshold (50)
    act(() => {
      scrollTo(100);
    });

    expect(result.current).toBe('down');
  });

  it('returns "up" when scrolling up after scrolling down', () => {
    const { result } = renderHook(() => useScrollDirection());

    // First scroll down past threshold
    act(() => {
      scrollTo(200);
    });
    expect(result.current).toBe('down');

    // Then scroll up (but still above threshold)
    act(() => {
      scrollTo(100);
    });
    expect(result.current).toBe('up');
  });

  it('returns "top" when scrolled back near top (below threshold)', () => {
    const { result } = renderHook(() => useScrollDirection());

    // Scroll down
    act(() => {
      scrollTo(200);
    });
    expect(result.current).toBe('down');

    // Scroll back near top (below default threshold of 50)
    act(() => {
      scrollTo(10);
    });
    expect(result.current).toBe('top');
  });

  it('respects custom threshold parameter', () => {
    const customThreshold = 100;
    const { result } = renderHook(() => useScrollDirection(customThreshold));

    // Scroll to 60 - below custom threshold but above default (50)
    act(() => {
      scrollTo(60);
    });
    // At 60 with threshold 100, should still be "top"
    expect(result.current).toBe('top');

    // Scroll past the custom threshold
    act(() => {
      scrollTo(150);
    });
    expect(result.current).toBe('down');
  });

  it('does not change direction when scrolling in same direction', () => {
    const { result } = renderHook(() => useScrollDirection());

    act(() => {
      scrollTo(100);
    });
    expect(result.current).toBe('down');

    act(() => {
      scrollTo(200);
    });
    // Should remain 'down'
    expect(result.current).toBe('down');

    act(() => {
      scrollTo(300);
    });
    expect(result.current).toBe('down');
  });

  it('transitions through all three states: top -> down -> up -> top', () => {
    const { result } = renderHook(() => useScrollDirection());

    // Start at top
    expect(result.current).toBe('top');

    // Scroll down
    act(() => {
      scrollTo(200);
    });
    expect(result.current).toBe('down');

    // Scroll up (still above threshold)
    act(() => {
      scrollTo(100);
    });
    expect(result.current).toBe('up');

    // Scroll back to top
    act(() => {
      scrollTo(0);
    });
    expect(result.current).toBe('top');
  });

  it('cleans up scroll listener on unmount', () => {
    const addSpy = vi.spyOn(window, 'addEventListener');
    const removeSpy = vi.spyOn(window, 'removeEventListener');

    const { unmount } = renderHook(() => useScrollDirection());

    expect(addSpy).toHaveBeenCalledWith('scroll', expect.any(Function), { passive: true });

    unmount();

    expect(removeSpy).toHaveBeenCalledWith('scroll', expect.any(Function));

    addSpy.mockRestore();
    removeSpy.mockRestore();
  });
});
