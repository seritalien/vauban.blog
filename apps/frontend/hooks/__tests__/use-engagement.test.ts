import { vi, type Mock } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ALICE } from '@/__tests__/helpers/test-users';

// ---------------------------------------------------------------------------
// Hoisted mocks
// ---------------------------------------------------------------------------

const { mockHasLikedPost, mockLikePost, mockUnlikePost, walletState } = vi.hoisted(() => {
  return {
    mockHasLikedPost: vi.fn().mockResolvedValue(false),
    mockLikePost: vi.fn().mockResolvedValue(undefined),
    mockUnlikePost: vi.fn().mockResolvedValue(undefined),
    walletState: {
      account: null as Record<string, unknown> | null,
    },
  };
});

vi.mock('@/providers/wallet-provider', () => ({
  useWallet: () => walletState,
}));

vi.mock('@vauban/web3-utils', () => ({
  hasLikedPost: mockHasLikedPost,
  likePost: mockLikePost,
  unlikePost: mockUnlikePost,
  initStarknetProvider: vi.fn(),
  setContractAddresses: vi.fn(),
  calculateContentHash: vi.fn().mockResolvedValue('0x' + 'ab'.repeat(32)),
  getPosts: vi.fn().mockResolvedValue([]),
  getPost: vi.fn(),
}));

// Mock fetch for batch endpoint
const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

// ---------------------------------------------------------------------------
// Imports after mocks
// ---------------------------------------------------------------------------

import {
  useBatchEngagement,
  usePostEngagement,
  useUserLikeStatus,
  useLikeMutation,
} from '@/hooks/use-engagement';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createQueryWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      mutations: { retry: false },
    },
  });
  function Wrapper({ children }: { children: React.ReactNode }) {
    return React.createElement(QueryClientProvider, { client: queryClient }, children);
  }
  return { Wrapper, queryClient };
}

function mockFetchResponse(data: Record<string, unknown>, status = 200) {
  mockFetch.mockResolvedValueOnce({
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(data),
  });
}

function setConnected() {
  walletState.account = {
    address: ALICE.address,
  };
}

function setDisconnected() {
  walletState.account = null;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.clearAllMocks();
  setDisconnected();
});

// ===== useBatchEngagement =====

describe('useBatchEngagement', () => {
  it('fetches engagement data for multiple post IDs', async () => {
    const responseData = {
      'post-1': { likes: 10, comments: 3 },
      'post-2': { likes: 5, comments: 1 },
    };
    mockFetchResponse(responseData);

    const { Wrapper } = createQueryWrapper();
    const { result } = renderHook(
      () => useBatchEngagement(['post-1', 'post-2']),
      { wrapper: Wrapper },
    );

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data).toEqual(responseData);
    expect(mockFetch).toHaveBeenCalledWith(
      '/api/engagement/batch',
      expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      }),
    );
  });

  it('sorts IDs for stable cache key', async () => {
    mockFetchResponse({});

    const { Wrapper } = createQueryWrapper();
    renderHook(
      () => useBatchEngagement(['z-post', 'a-post', 'm-post']),
      { wrapper: Wrapper },
    );

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalled();
    });

    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.postIds).toEqual(['a-post', 'm-post', 'z-post']);
  });

  it('does not fetch when postIds is empty', async () => {
    const { Wrapper } = createQueryWrapper();
    const { result } = renderHook(
      () => useBatchEngagement([]),
      { wrapper: Wrapper },
    );

    // Should not trigger a fetch — the query is disabled
    await waitFor(() => {
      expect(result.current.fetchStatus).toBe('idle');
    });

    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('throws on non-ok response', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
      json: () => Promise.resolve({ error: 'Internal error' }),
    });

    const { Wrapper } = createQueryWrapper();
    const { result } = renderHook(
      () => useBatchEngagement(['post-1']),
      { wrapper: Wrapper },
    );

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    expect(result.current.error).toBeInstanceOf(Error);
    expect(result.current.error?.message).toContain('500');
  });
});

// ===== usePostEngagement =====

describe('usePostEngagement', () => {
  it('fetches engagement for a single post', async () => {
    mockFetchResponse({ 'post-42': { likes: 7, comments: 2 } });

    const { Wrapper } = createQueryWrapper();
    const { result } = renderHook(
      () => usePostEngagement('post-42'),
      { wrapper: Wrapper },
    );

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data).toEqual({ likes: 7, comments: 2 });
  });

  it('returns zeros when post not found in response', async () => {
    mockFetchResponse({});

    const { Wrapper } = createQueryWrapper();
    const { result } = renderHook(
      () => usePostEngagement('nonexistent'),
      { wrapper: Wrapper },
    );

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data).toEqual({ likes: 0, comments: 0 });
  });
});

// ===== useUserLikeStatus =====

describe('useUserLikeStatus', () => {
  it('returns false when user is not connected', async () => {
    setDisconnected();

    const { Wrapper } = createQueryWrapper();
    const { result } = renderHook(
      () => useUserLikeStatus('post-1'),
      { wrapper: Wrapper },
    );

    // Query should be disabled (not fetching)
    await waitFor(() => {
      expect(result.current.fetchStatus).toBe('idle');
    });

    expect(mockHasLikedPost).not.toHaveBeenCalled();
  });

  it('calls hasLikedPost when connected', async () => {
    setConnected();
    mockHasLikedPost.mockResolvedValueOnce(true);

    const { Wrapper } = createQueryWrapper();
    const { result } = renderHook(
      () => useUserLikeStatus('post-1'),
      { wrapper: Wrapper },
    );

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(mockHasLikedPost).toHaveBeenCalledWith('post-1', ALICE.address);
    expect(result.current.data).toBe(true);
  });

  it('returns false when hasLikedPost returns false', async () => {
    setConnected();
    mockHasLikedPost.mockResolvedValueOnce(false);

    const { Wrapper } = createQueryWrapper();
    const { result } = renderHook(
      () => useUserLikeStatus('post-1'),
      { wrapper: Wrapper },
    );

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data).toBe(false);
  });
});

// ===== useLikeMutation =====

describe('useLikeMutation', () => {
  it('calls likePost on action "like"', async () => {
    setConnected();
    // Seed engagement data so optimistic update has something to work with
    mockFetchResponse({ 'post-1': { likes: 5, comments: 0 } });

    const { Wrapper } = createQueryWrapper();
    const { result } = renderHook(
      () => ({
        mutation: useLikeMutation('post-1'),
        engagement: usePostEngagement('post-1'),
      }),
      { wrapper: Wrapper },
    );

    // Wait for engagement to load
    await waitFor(() => {
      expect(result.current.engagement.isSuccess).toBe(true);
    });

    // Mock the refetch after mutation settles
    mockFetchResponse({ 'post-1': { likes: 6, comments: 0 } });

    await act(async () => {
      await result.current.mutation.mutateAsync({ action: 'like' });
    });

    expect(mockLikePost).toHaveBeenCalledWith(walletState.account, 'post-1');
  });

  it('calls unlikePost on action "unlike"', async () => {
    setConnected();
    mockFetchResponse({ 'post-1': { likes: 5, comments: 0 } });

    const { Wrapper } = createQueryWrapper();
    const { result } = renderHook(
      () => ({
        mutation: useLikeMutation('post-1'),
        engagement: usePostEngagement('post-1'),
      }),
      { wrapper: Wrapper },
    );

    await waitFor(() => {
      expect(result.current.engagement.isSuccess).toBe(true);
    });

    mockFetchResponse({ 'post-1': { likes: 4, comments: 0 } });

    await act(async () => {
      await result.current.mutation.mutateAsync({ action: 'unlike' });
    });

    expect(mockUnlikePost).toHaveBeenCalledWith(walletState.account, 'post-1');
  });

  it('throws when wallet is not connected', async () => {
    setDisconnected();

    const { Wrapper } = createQueryWrapper();
    const { result } = renderHook(
      () => useLikeMutation('post-1'),
      { wrapper: Wrapper },
    );

    await expect(
      act(async () => {
        await result.current.mutateAsync({ action: 'like' });
      }),
    ).rejects.toThrow('Wallet not connected');
  });

  it('performs optimistic update on like (+1)', async () => {
    setConnected();
    mockFetchResponse({ 'post-1': { likes: 10, comments: 2 } });

    const { Wrapper, queryClient } = createQueryWrapper();
    const { result } = renderHook(
      () => ({
        mutation: useLikeMutation('post-1'),
        engagement: usePostEngagement('post-1'),
      }),
      { wrapper: Wrapper },
    );

    await waitFor(() => {
      expect(result.current.engagement.data?.likes).toBe(10);
    });

    // Make likePost hang so we can observe the optimistic state
    let resolveLike!: () => void;
    mockLikePost.mockReturnValueOnce(new Promise<void>((resolve) => { resolveLike = resolve; }));

    // Don't await — we want to observe mid-mutation
    act(() => {
      result.current.mutation.mutate({ action: 'like' });
    });

    // Optimistic update should show 11
    await waitFor(() => {
      expect(result.current.engagement.data?.likes).toBe(11);
    });

    // Resolve and let it settle
    mockFetchResponse({ 'post-1': { likes: 11, comments: 2 } });
    await act(async () => {
      resolveLike();
    });
  });

  it('rolls back on mutation error', async () => {
    setConnected();
    mockFetchResponse({ 'post-1': { likes: 10, comments: 2 } });

    const { Wrapper } = createQueryWrapper();
    const { result } = renderHook(
      () => ({
        mutation: useLikeMutation('post-1'),
        engagement: usePostEngagement('post-1'),
      }),
      { wrapper: Wrapper },
    );

    await waitFor(() => {
      expect(result.current.engagement.data?.likes).toBe(10);
    });

    // Make likePost fail
    mockLikePost.mockRejectedValueOnce(new Error('Transaction reverted'));

    // Refetch after rollback + onSettled
    mockFetchResponse({ 'post-1': { likes: 10, comments: 2 } });

    try {
      await act(async () => {
        await result.current.mutation.mutateAsync({ action: 'like' });
      });
    } catch {
      // Expected to throw
    }

    // After rollback, should be back to 10
    await waitFor(() => {
      expect(result.current.engagement.data?.likes).toBe(10);
    });
  });

  it('likes count does not go below 0 on unlike', async () => {
    setConnected();
    mockFetchResponse({ 'post-1': { likes: 0, comments: 0 } });

    const { Wrapper } = createQueryWrapper();
    const { result } = renderHook(
      () => ({
        mutation: useLikeMutation('post-1'),
        engagement: usePostEngagement('post-1'),
      }),
      { wrapper: Wrapper },
    );

    await waitFor(() => {
      expect(result.current.engagement.data?.likes).toBe(0);
    });

    // Trigger unlike optimistic update
    let resolveUnlike!: () => void;
    mockUnlikePost.mockReturnValueOnce(new Promise<void>((resolve) => { resolveUnlike = resolve; }));

    act(() => {
      result.current.mutation.mutate({ action: 'unlike' });
    });

    // Should stay at 0, not go to -1
    await waitFor(() => {
      expect(result.current.engagement.data?.likes).toBe(0);
    });

    mockFetchResponse({ 'post-1': { likes: 0, comments: 0 } });
    await act(async () => {
      resolveUnlike();
    });
  });
});
