import { describe, it, expect, vi, beforeEach, afterEach, type Mock } from 'vitest';
import { renderHook } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createElement, type ReactNode } from 'react';
import { useEventStream } from '@/hooks/use-event-stream';

// ---------------------------------------------------------------------------
// Mock EventSource
// ---------------------------------------------------------------------------

type ESListener = (event: MessageEvent) => void;

let mockListeners: Record<string, ESListener[]>;
let mockClose: Mock<() => void>;

class MockEventSource {
  static instances: MockEventSource[] = [];
  url: string;
  readyState = 0; // CONNECTING

  constructor(url: string) {
    this.url = url;
    mockListeners = {};
    MockEventSource.instances.push(this);
  }

  addEventListener(event: string, handler: ESListener): void {
    if (!mockListeners[event]) mockListeners[event] = [];
    mockListeners[event].push(handler);
  }

  removeEventListener(event: string, handler: ESListener): void {
    if (mockListeners[event]) {
      mockListeners[event] = mockListeners[event].filter(h => h !== handler);
    }
  }

  close(): void {
    mockClose();
  }
}

// Install mock before each test
beforeEach(() => {
  mockClose = vi.fn();
  MockEventSource.instances = [];
  mockListeners = {};
  vi.stubGlobal('EventSource', MockEventSource);
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true }));
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const wrapper = ({ children }: { children: ReactNode }) =>
    createElement(QueryClientProvider, { client: queryClient }, children);
  return { wrapper, queryClient };
}

/** Simulate the server emitting an SSE event. */
function emitSSE(event: string, data: unknown): void {
  const listeners = mockListeners[event] ?? [];
  const messageEvent = new MessageEvent(event, {
    data: JSON.stringify(data),
  });
  for (const listener of listeners) {
    listener(messageEvent);
  }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('useEventStream', () => {
  it('opens an EventSource to /api/events/stream', () => {
    const { wrapper } = createWrapper();
    renderHook(() => useEventStream(), { wrapper });

    expect(MockEventSource.instances).toHaveLength(1);
    expect(MockEventSource.instances[0].url).toBe('/api/events/stream');
  });

  it('closes EventSource on unmount', () => {
    const { wrapper } = createWrapper();
    const { unmount } = renderHook(() => useEventStream(), { wrapper });

    unmount();

    expect(mockClose).toHaveBeenCalledOnce();
  });

  it('invalidates posts.all on post:published', async () => {
    const { wrapper, queryClient } = createWrapper();
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    renderHook(() => useEventStream(), { wrapper });

    emitSSE('post:published', { postId: '1', slug: 'test' });

    // Wait for the async fetch + invalidateQueries chain
    await vi.waitFor(() => {
      expect(invalidateSpy).toHaveBeenCalledWith(
        expect.objectContaining({ queryKey: ['posts'] }),
      );
    });
  });

  it('invalidates posts.all on post:scheduled', () => {
    const { wrapper, queryClient } = createWrapper();
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    renderHook(() => useEventStream(), { wrapper });

    emitSSE('post:scheduled', { postId: '5', scheduledAt: '2025-06-01T00:00:00Z' });

    expect(invalidateSpy).toHaveBeenCalledWith(
      expect.objectContaining({ queryKey: ['posts'] }),
    );
  });

  it('invalidates comments for a specific post on comment:added', () => {
    const { wrapper, queryClient } = createWrapper();
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    renderHook(() => useEventStream(), { wrapper });

    emitSSE('comment:added', { postId: '7', commentId: 'c1' });

    expect(invalidateSpy).toHaveBeenCalledWith(
      expect.objectContaining({ queryKey: ['comments', 'forPost', '7'] }),
    );
  });

  it('invalidates all comments on malformed comment:added payload', () => {
    const { wrapper, queryClient } = createWrapper();
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    renderHook(() => useEventStream(), { wrapper });

    // Emit with a non-JSON payload by directly calling with bad data
    const listeners = mockListeners['comment:added'] ?? [];
    const badEvent = new MessageEvent('comment:added', { data: 'not-json' });
    for (const listener of listeners) {
      listener(badEvent);
    }

    expect(invalidateSpy).toHaveBeenCalledWith(
      expect.objectContaining({ queryKey: ['comments'] }),
    );
  });

  it('calls DELETE /api/rpc on post:published to bust cache', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal('fetch', fetchMock);

    const { wrapper } = createWrapper();
    renderHook(() => useEventStream(), { wrapper });

    emitSSE('post:published', { postId: '1' });

    await vi.waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith('/api/rpc', { method: 'DELETE' });
    });
  });
});
