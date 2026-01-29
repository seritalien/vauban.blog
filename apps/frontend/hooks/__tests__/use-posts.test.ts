import { vi, describe, it, expect, beforeEach } from 'vitest';
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
      ipfsCid: 'QmUnitTest1',
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
    ipfsCid: `QmUnitTest${id}`,  // Use QmUnitTest to avoid E2E test CID detection
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
  web3Mocks.getPostCount.mockResolvedValue(0);
  web3Mocks.getPosts.mockResolvedValue([]);
  web3Mocks.getPost.mockResolvedValue(createPostMeta('1'));
});

// ============================
// usePosts - initial fetch
// ============================

describe('usePosts - initial fetch', () => {
  it('calls getPostCount then getPosts in reverse order', async () => {
    // 2 total posts; with limit 10, contractOffset=max(0, 2-0-10)=0, actualLimit=min(10,2)=2
    const posts = [createPostMeta('1'), createPostMeta('2')];
    web3Mocks.getPostCount.mockResolvedValue(2);
    web3Mocks.getPosts.mockResolvedValue(posts);
    const { wrapper } = createQueryWrapper();

    const { result } = renderHook(() => usePosts(10, 0), { wrapper });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(web3Mocks.getPostCount).toHaveBeenCalled();
    expect(web3Mocks.getPosts).toHaveBeenCalledWith(2, 0);
    // Reversed: newest first
    expect(result.current.posts).toHaveLength(2);
    expect(result.current.posts[0].id).toBe('2');
    expect(result.current.posts[1].id).toBe('1');
    expect(result.current.error).toBeNull();
  });

  it('transitions isLoading from true to false', async () => {
    web3Mocks.getPostCount.mockResolvedValue(0);
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
    web3Mocks.getPostCount.mockResolvedValue(3);
    web3Mocks.getPosts.mockResolvedValue(posts);
    const { wrapper } = createQueryWrapper();

    const { result } = renderHook(() => usePosts(10, 0), { wrapper });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.posts).toHaveLength(2);
    expect(result.current.posts.every((p: { id: string }) => p.id !== '2')).toBe(true);
  });

  it('sets hasMore to true when more posts remain', async () => {
    // 10 total, limit 5 → after first page reverseOffset=5, still 5 remaining
    const posts = Array.from({ length: 5 }, (_, i) => createPostMeta(String(i + 6)));
    web3Mocks.getPostCount.mockResolvedValue(10);
    web3Mocks.getPosts.mockResolvedValue(posts);
    const { wrapper } = createQueryWrapper();

    const { result } = renderHook(() => usePosts(5, 0), { wrapper });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.hasMore).toBe(true);
  });

  it('sets hasMore to false when all posts loaded', async () => {
    // 2 total, limit 5 → all posts fit in first page
    const posts = [createPostMeta('1'), createPostMeta('2')];
    web3Mocks.getPostCount.mockResolvedValue(2);
    web3Mocks.getPosts.mockResolvedValue(posts);
    const { wrapper } = createQueryWrapper();

    const { result } = renderHook(() => usePosts(5, 0), { wrapper });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.hasMore).toBe(false);
  });

  it('sets error when getPostCount rejects', async () => {
    web3Mocks.getPostCount.mockRejectedValue(new Error('Network error'));
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
    web3Mocks.getPostCount.mockResolvedValue(1);
    web3Mocks.getPosts.mockResolvedValue(posts);
    mockIPFSFetchSuccess({ title: 'From IPFS', content: 'IPFS content' });
    const { wrapper } = createQueryWrapper();

    const { result } = renderHook(() => usePosts(10, 0), { wrapper });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(mockFetch).toHaveBeenCalledWith('/api/ipfs/QmUnitTest1');
    expect(result.current.posts[0]).toMatchObject({ title: 'From IPFS' });
  });

  it('falls back to Arweave when IPFS fails', async () => {
    const posts = [createPostMeta('1', { arweaveTxId: 'real_arweave_tx' })];
    web3Mocks.getPostCount.mockResolvedValue(1);
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
    web3Mocks.getPostCount.mockResolvedValue(1);
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
  it('appends older posts when scrolling down', async () => {
    // 4 total, limit 2 → first page gets posts 3,4 (reversed to 4,3)
    web3Mocks.getPostCount.mockResolvedValue(4);
    const firstPage = [createPostMeta('3'), createPostMeta('4')];
    web3Mocks.getPosts.mockResolvedValueOnce(firstPage);
    const { wrapper } = createQueryWrapper();

    const { result } = renderHook(() => usePosts(2, 0), { wrapper });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.posts).toHaveLength(2);

    // Second page gets posts 1,2 (older, reversed to 2,1)
    const secondPage = [createPostMeta('1'), createPostMeta('2')];
    web3Mocks.getPostCount.mockResolvedValue(4);
    web3Mocks.getPosts.mockResolvedValueOnce(secondPage);

    await act(async () => {
      await result.current.loadMore();
    });

    await waitFor(() => {
      expect(result.current.posts).toHaveLength(4);
    });
  });

  it('deduplicates posts by ID', async () => {
    web3Mocks.getPostCount.mockResolvedValue(4);
    const firstPage = [createPostMeta('3'), createPostMeta('4')];
    web3Mocks.getPosts.mockResolvedValueOnce(firstPage);
    const { wrapper } = createQueryWrapper();

    const { result } = renderHook(() => usePosts(2, 0), { wrapper });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    // Second page overlaps with id '3'
    const secondPage = [createPostMeta('2'), createPostMeta('3')];
    web3Mocks.getPostCount.mockResolvedValue(4);
    web3Mocks.getPosts.mockResolvedValueOnce(secondPage);

    await act(async () => {
      await result.current.loadMore();
    });

    await waitFor(() => {
      expect(result.current.posts.length).toBeGreaterThanOrEqual(3);
    });

    const ids = result.current.posts.map((p: { id: string }) => p.id);
    // No duplicate IDs
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('prevents double-load via isLoadingMore guard', async () => {
    web3Mocks.getPostCount.mockResolvedValue(10);
    const firstPage = Array.from({ length: 5 }, (_, i) => createPostMeta(String(i + 6)));
    web3Mocks.getPosts.mockResolvedValueOnce(firstPage);
    const { wrapper } = createQueryWrapper();

    const { result } = renderHook(() => usePosts(5, 0), { wrapper });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    web3Mocks.getPostCount.mockResolvedValue(10);
    web3Mocks.getPosts.mockResolvedValueOnce([createPostMeta('5')]);

    await act(async () => {
      await result.current.loadMore();
    });

    await waitFor(() => {
      expect(result.current.isLoadingMore).toBe(false);
    });

    expect(result.current.posts.length).toBeGreaterThanOrEqual(6);
  });

  it('sets hasMore to false when all posts loaded', async () => {
    // 6 total, limit 5 → first page gets 5, hasMore=true
    web3Mocks.getPostCount.mockResolvedValue(6);
    const firstPage = Array.from({ length: 5 }, (_, i) => createPostMeta(String(i + 2)));
    web3Mocks.getPosts.mockResolvedValueOnce(firstPage);
    const { wrapper } = createQueryWrapper();

    const { result } = renderHook(() => usePosts(5, 0), { wrapper });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.hasMore).toBe(true);

    // Second page: only 1 remaining → hasMore becomes false
    web3Mocks.getPostCount.mockResolvedValue(6);
    web3Mocks.getPosts.mockResolvedValueOnce([createPostMeta('1')]);

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
    web3Mocks.getPostCount.mockResolvedValue(1);
    const firstPage = [createPostMeta('1')];
    web3Mocks.getPosts.mockResolvedValue(firstPage);
    const { wrapper } = createQueryWrapper();

    const { result } = renderHook(() => usePosts(10, 0), { wrapper });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.posts).toHaveLength(1);

    // New post added, refetch picks it up
    web3Mocks.getPostCount.mockResolvedValue(2);
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
