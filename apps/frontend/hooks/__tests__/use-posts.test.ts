import { vi } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// ---------------------------------------------------------------------------
// Hoisted mocks
// ---------------------------------------------------------------------------

const { web3Mocks, mockFetch } = vi.hoisted(() => {
  const web3Mocks = {
    initStarknetProvider: vi.fn(),
    getProvider: vi.fn(() => ({ getBlock: vi.fn() })),
    setContractAddresses: vi.fn(),
    calculateContentHash: vi.fn().mockResolvedValue('0x' + 'ab'.repeat(32)),
    getPosts: vi.fn().mockResolvedValue([]),
    getPost: vi.fn().mockResolvedValue({
      id: '1',
      author: '0x123',
      arweaveTxId: 'ar_tx1',
      ipfsCid: 'QmTest1',
      contentHash: '0x' + 'ab'.repeat(32),
      price: '0',
      isEncrypted: false,
      createdAt: Math.floor(Date.now() / 1000),
      updatedAt: Math.floor(Date.now() / 1000),
      isDeleted: false,
      postType: 0,
    }),
    getPostCount: vi.fn().mockResolvedValue(0),
    followsAbi: [],
    publishPost: vi.fn(),
    publishTweet: vi.fn(),
  };

  const mockFetch = vi.fn();

  return { web3Mocks, mockFetch };
});

vi.mock('@vauban/web3-utils', () => web3Mocks);

vi.mock('@vauban/shared-types', () => ({
  PostOutput: {},
}));

// Import hooks after mocks
import { usePosts, usePost } from '@/hooks/use-posts';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const NOW_SECONDS = Math.floor(Date.now() / 1000);

function createQueryWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: 0,
        staleTime: 0,
      },
    },
  });
  function Wrapper({ children }: { children: React.ReactNode }) {
    return React.createElement(QueryClientProvider, { client: queryClient }, children);
  }
  return { wrapper: Wrapper, queryClient };
}

function createPostMeta(id: string, overrides: Record<string, unknown> = {}) {
  return {
    id,
    author: '0x123',
    arweaveTxId: `ar_tx_${id}`,
    ipfsCid: `QmTest${id}`,
    contentHash: '0x' + 'ab'.repeat(32),
    price: '0',
    isEncrypted: false,
    createdAt: NOW_SECONDS - Number(id) * 3600,
    updatedAt: NOW_SECONDS - Number(id) * 3600,
    isDeleted: false,
    postType: 0,
    ...overrides,
  };
}

function mockIPFSFetchSuccess(content: Record<string, unknown> = { title: 'Test', content: 'Hello' }) {
  mockFetch.mockImplementation((url: string) => {
    if (typeof url === 'string' && url.startsWith('/api/ipfs/')) {
      return Promise.resolve({
        ok: true,
        text: () => Promise.resolve(JSON.stringify(content)),
      });
    }
    if (typeof url === 'string' && url.startsWith('/api/arweave/')) {
      return Promise.resolve({
        ok: true,
        text: () => Promise.resolve(JSON.stringify(content)),
      });
    }
    return Promise.resolve({ ok: false, status: 404 });
  });
}

function mockIPFSFailArweaveSuccess(content: Record<string, unknown> = { title: 'From Arweave', content: 'Fallback' }) {
  mockFetch.mockImplementation((url: string) => {
    if (typeof url === 'string' && url.startsWith('/api/ipfs/')) {
      return Promise.resolve({ ok: false, status: 500 });
    }
    if (typeof url === 'string' && url.startsWith('/api/arweave/')) {
      return Promise.resolve({
        ok: true,
        text: () => Promise.resolve(JSON.stringify(content)),
      });
    }
    return Promise.resolve({ ok: false, status: 404 });
  });
}

function mockBothFail() {
  mockFetch.mockImplementation((url: string) => {
    if (typeof url === 'string' && url.startsWith('/api/ipfs/')) {
      return Promise.resolve({ ok: false, status: 500 });
    }
    if (typeof url === 'string' && url.startsWith('/api/arweave/')) {
      return Promise.resolve({ ok: false, status: 500 });
    }
    return Promise.resolve({ ok: false, status: 404 });
  });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.clearAllMocks();
  globalThis.fetch = mockFetch;
  mockIPFSFetchSuccess();
  web3Mocks.calculateContentHash.mockResolvedValue('0x' + 'ab'.repeat(32));
  web3Mocks.getPosts.mockResolvedValue([]);
  web3Mocks.getPost.mockResolvedValue(createPostMeta('1'));
});

// ============================
// usePosts - initial fetch
// ============================

describe('usePosts - initial fetch', () => {
  it('calls getPosts and sets posts', async () => {
    const posts = [createPostMeta('1'), createPostMeta('2')];
    web3Mocks.getPosts.mockResolvedValue(posts);
    const { wrapper } = createQueryWrapper();

    const { result } = renderHook(() => usePosts(10, 0), { wrapper });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(web3Mocks.getPosts).toHaveBeenCalledWith(10, 0);
    expect(result.current.posts).toHaveLength(2);
    expect(result.current.error).toBeNull();
  });

  it('transitions isLoading from true to false', async () => {
    web3Mocks.getPosts.mockResolvedValue([]);
    const { wrapper } = createQueryWrapper();

    const { result } = renderHook(() => usePosts(10, 0), { wrapper });

    // Initially loading
    expect(result.current.isLoading).toBe(true);

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });
  });

  it('filters out deleted posts', async () => {
    const posts = [
      createPostMeta('1'),
      createPostMeta('2', { isDeleted: true }),
      createPostMeta('3'),
    ];
    web3Mocks.getPosts.mockResolvedValue(posts);
    const { wrapper } = createQueryWrapper();

    const { result } = renderHook(() => usePosts(10, 0), { wrapper });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.posts).toHaveLength(2);
    expect(result.current.posts.every((p: { id: string }) => p.id !== '2')).toBe(true);
  });

  it('sets hasMore to true when getPosts returns full limit', async () => {
    const posts = Array.from({ length: 5 }, (_, i) => createPostMeta(String(i + 1)));
    web3Mocks.getPosts.mockResolvedValue(posts);
    const { wrapper } = createQueryWrapper();

    const { result } = renderHook(() => usePosts(5, 0), { wrapper });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.hasMore).toBe(true);
  });

  it('sets hasMore to false when getPosts returns fewer than limit', async () => {
    const posts = [createPostMeta('1'), createPostMeta('2')];
    web3Mocks.getPosts.mockResolvedValue(posts);
    const { wrapper } = createQueryWrapper();

    const { result } = renderHook(() => usePosts(5, 0), { wrapper });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.hasMore).toBe(false);
  });

  it('sets error when getPosts rejects', async () => {
    web3Mocks.getPosts.mockRejectedValue(new Error('Network error'));
    const { wrapper } = createQueryWrapper();

    const { result } = renderHook(() => usePosts(10, 0), { wrapper });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.error).toBe('Network error');
    expect(result.current.posts).toHaveLength(0);
  });
});

// ============================
// usePosts - content fetching
// ============================

describe('usePosts - content fetching', () => {
  it('tries IPFS first via /api/ipfs/CID', async () => {
    const posts = [createPostMeta('1')];
    web3Mocks.getPosts.mockResolvedValue(posts);
    mockIPFSFetchSuccess({ title: 'From IPFS', content: 'IPFS content' });
    const { wrapper } = createQueryWrapper();

    const { result } = renderHook(() => usePosts(10, 0), { wrapper });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(mockFetch).toHaveBeenCalledWith('/api/ipfs/QmTest1');
    expect(result.current.posts[0]).toMatchObject({ title: 'From IPFS' });
  });

  it('falls back to Arweave when IPFS fails', async () => {
    const posts = [createPostMeta('1', { arweaveTxId: 'real_arweave_tx' })];
    web3Mocks.getPosts.mockResolvedValue(posts);
    mockIPFSFailArweaveSuccess({ title: 'From Arweave', content: 'Arweave content' });
    const { wrapper } = createQueryWrapper();

    const { result } = renderHook(() => usePosts(10, 0), { wrapper });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.posts[0]).toMatchObject({ title: 'From Arweave' });
  });

  it('uses placeholder content when both IPFS and Arweave fail', async () => {
    const posts = [createPostMeta('1')];
    web3Mocks.getPosts.mockResolvedValue(posts);
    mockBothFail();
    const { wrapper } = createQueryWrapper();

    const { result } = renderHook(() => usePosts(10, 0), { wrapper });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.posts).toHaveLength(1);
    expect(result.current.posts[0].verificationError).toBeTruthy();
  });
});

// ============================
// usePosts - loadMore
// ============================

describe('usePosts - loadMore', () => {
  it('appends new posts to existing ones', async () => {
    const firstPage = [createPostMeta('1'), createPostMeta('2')];
    web3Mocks.getPosts.mockResolvedValueOnce(firstPage);
    const { wrapper } = createQueryWrapper();

    const { result } = renderHook(() => usePosts(2, 0), { wrapper });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.posts).toHaveLength(2);

    // Mock second page
    const secondPage = [createPostMeta('3'), createPostMeta('4')];
    web3Mocks.getPosts.mockResolvedValueOnce(secondPage);

    await act(async () => {
      await result.current.loadMore();
    });

    await waitFor(() => {
      expect(result.current.posts).toHaveLength(4);
    });
  });

  it('deduplicates posts by ID', async () => {
    const firstPage = [createPostMeta('1'), createPostMeta('2')];
    web3Mocks.getPosts.mockResolvedValueOnce(firstPage);
    const { wrapper } = createQueryWrapper();

    const { result } = renderHook(() => usePosts(2, 0), { wrapper });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    // Second page includes duplicate
    const secondPage = [createPostMeta('2'), createPostMeta('3')];
    web3Mocks.getPosts.mockResolvedValueOnce(secondPage);

    await act(async () => {
      await result.current.loadMore();
    });

    await waitFor(() => {
      expect(result.current.posts.length).toBeGreaterThanOrEqual(3);
    });

    const ids = result.current.posts.map((p: { id: string }) => p.id);
    expect(ids).toEqual(['1', '2', '3']);
  });

  it('prevents double-load via isLoadingMore guard', async () => {
    const firstPage = Array.from({ length: 5 }, (_, i) => createPostMeta(String(i + 1)));
    web3Mocks.getPosts.mockResolvedValueOnce(firstPage);
    const { wrapper } = createQueryWrapper();

    const { result } = renderHook(() => usePosts(5, 0), { wrapper });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    // Start loadMore and wait for isLoadingMore to become true
    web3Mocks.getPosts.mockResolvedValueOnce([createPostMeta('6')]);

    await act(async () => {
      await result.current.loadMore();
    });

    await waitFor(() => {
      expect(result.current.isLoadingMore).toBe(false);
    });

    // All loaded posts should be present (initial 5 + 1 more)
    expect(result.current.posts).toHaveLength(6);
  });

  it('updates hasMore based on returned count', async () => {
    const firstPage = Array.from({ length: 5 }, (_, i) => createPostMeta(String(i + 1)));
    web3Mocks.getPosts.mockResolvedValueOnce(firstPage);
    const { wrapper } = createQueryWrapper();

    const { result } = renderHook(() => usePosts(5, 0), { wrapper });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.hasMore).toBe(true);

    // Return fewer than limit
    web3Mocks.getPosts.mockResolvedValueOnce([createPostMeta('6')]);

    await act(async () => {
      await result.current.loadMore();
    });

    await waitFor(() => {
      expect(result.current.hasMore).toBe(false);
    });
  });
});

// ============================
// usePosts - refetch
// ============================

describe('usePosts - refetch', () => {
  it('resets posts and offset, then re-fetches', async () => {
    const firstPage = [createPostMeta('1')];
    web3Mocks.getPosts.mockResolvedValue(firstPage);
    const { wrapper } = createQueryWrapper();

    const { result } = renderHook(() => usePosts(10, 0), { wrapper });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.posts).toHaveLength(1);

    // Updated data on refetch
    const refreshedPage = [createPostMeta('1'), createPostMeta('2')];
    web3Mocks.getPosts.mockResolvedValue(refreshedPage);

    await act(async () => {
      result.current.refetch();
    });

    await waitFor(() => {
      expect(result.current.posts).toHaveLength(2);
    });
  });
});

// ============================
// usePost
// ============================

describe('usePost', () => {
  it('fetches a single post and includes content', async () => {
    web3Mocks.getPost.mockResolvedValue(createPostMeta('42'));
    mockIPFSFetchSuccess({ title: 'Single Post', content: 'Detailed content' });
    const { wrapper } = createQueryWrapper();

    const { result } = renderHook(() => usePost('42'), { wrapper });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.post).not.toBeNull();
    expect(result.current.post?.id).toBe('42');
    expect(result.current.post).toMatchObject({ title: 'Single Post' });
    expect(result.current.error).toBeNull();
  });

  it('sets error when post is deleted', async () => {
    web3Mocks.getPost.mockResolvedValue(createPostMeta('42', { isDeleted: true }));
    const { wrapper } = createQueryWrapper();

    const { result } = renderHook(() => usePost('42'), { wrapper });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.error).toBe('Post has been deleted');
    expect(result.current.post).toBeNull();
  });
});
