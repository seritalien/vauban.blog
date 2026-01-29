import { vi, describe, it, expect, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
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
    getPost: vi.fn(),
    getPostCount: vi.fn().mockResolvedValue(0),
    followsAbi: [],
    publishPost: vi.fn(),
    publishTweet: vi.fn(),
  };
  const mockFetch = vi.fn();
  return { web3Mocks, mockFetch };
});

vi.mock('@vauban/web3-utils', () => web3Mocks);
vi.mock('@vauban/shared-types', () => ({ PostOutput: {} }));

import { useAvailableTags, type TagWithCount } from '@/hooks/use-tags';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const NOW_SECONDS = Math.floor(Date.now() / 1000);

function createQueryWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0, staleTime: 0 },
    },
  });
  function Wrapper({ children }: { children: React.ReactNode }) {
    return React.createElement(QueryClientProvider, { client: queryClient }, children);
  }
  return { wrapper: Wrapper, queryClient };
}

function createPostMeta(id: string, _tags: string[] = []) {
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
  };
}

function mockIPFSSuccess(content: Record<string, unknown>) {
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

// Creates IPFS mock that returns specific tags per CID
function mockIPFSWithTags(postTagsMap: Record<string, string[]>) {
  mockFetch.mockImplementation((url: string) => {
    if (typeof url === 'string' && url.startsWith('/api/ipfs/')) {
      const cid = url.replace('/api/ipfs/', '');
      // Find the id from the CID pattern QmUnitTestN
      const id = cid.replace('QmUnitTest', '');
      const tags = postTagsMap[id] ?? [];
      const content = { title: `Post ${id}`, content: `Content ${id}`, tags };
      return Promise.resolve({
        ok: true,
        text: () => Promise.resolve(JSON.stringify(content)),
      });
    }
    if (typeof url === 'string' && url.startsWith('/api/arweave/')) {
      return Promise.resolve({ ok: false, status: 404 });
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
  web3Mocks.calculateContentHash.mockResolvedValue('0x' + 'ab'.repeat(32));
  web3Mocks.getPostCount.mockResolvedValue(0);
  web3Mocks.getPosts.mockResolvedValue([]);
});

describe('useAvailableTags', () => {
  it('returns empty tags when no posts exist', async () => {
    web3Mocks.getPosts.mockResolvedValue([]);
    mockIPFSSuccess({ title: 'Empty', content: 'None' });
    const { wrapper } = createQueryWrapper();

    const { result } = renderHook(() => useAvailableTags(), { wrapper });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.tags).toEqual([]);
    expect(result.current.error).toBeNull();
  });

  it('extracts unique tags from posts with counts', async () => {
    const posts = [
      createPostMeta('1'),
      createPostMeta('2'),
      createPostMeta('3'),
    ];
    web3Mocks.getPostCount.mockResolvedValue(3);
    web3Mocks.getPosts.mockResolvedValue(posts);
    mockIPFSWithTags({
      '1': ['react', 'typescript'],
      '2': ['react', 'nextjs'],
      '3': ['react', 'typescript', 'starknet'],
    });
    const { wrapper } = createQueryWrapper();

    const { result } = renderHook(() => useAvailableTags(), { wrapper });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    // react=3, typescript=2, nextjs=1, starknet=1
    expect(result.current.tags).toHaveLength(4);
    expect(result.current.tags[0]).toEqual({ name: 'react', count: 3 });
    expect(result.current.tags[1]).toEqual({ name: 'typescript', count: 2 });
    // nextjs and starknet both have count=1, sorted alphabetically
    expect(result.current.tags[2]).toEqual({ name: 'nextjs', count: 1 });
    expect(result.current.tags[3]).toEqual({ name: 'starknet', count: 1 });
  });

  it('handles posts with no tags gracefully', async () => {
    const posts = [createPostMeta('1')];
    web3Mocks.getPostCount.mockResolvedValue(1);
    web3Mocks.getPosts.mockResolvedValue(posts);
    // Return content without tags field
    mockIPFSSuccess({ title: 'No Tags', content: 'Content' });
    const { wrapper } = createQueryWrapper();

    const { result } = renderHook(() => useAvailableTags(), { wrapper });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.tags).toEqual([]);
  });

  it('trims and ignores empty tag strings', async () => {
    const posts = [createPostMeta('1')];
    web3Mocks.getPostCount.mockResolvedValue(1);
    web3Mocks.getPosts.mockResolvedValue(posts);
    mockIPFSWithTags({ '1': ['react', '  ', '', ' typescript '] });
    const { wrapper } = createQueryWrapper();

    const { result } = renderHook(() => useAvailableTags(), { wrapper });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    // Only 'react' and 'typescript' (trimmed) should survive
    expect(result.current.tags).toHaveLength(2);
    const tagNames = result.current.tags.map((t: TagWithCount) => t.name);
    expect(tagNames).toContain('react');
    expect(tagNames).toContain('typescript');
  });

  it('propagates loading state from usePosts', async () => {
    // Slow resolve to verify loading state
    web3Mocks.getPosts.mockImplementation(
      () => new Promise((resolve) => setTimeout(() => resolve([]), 100))
    );
    mockIPFSSuccess({ title: 'Test', content: 'Test' });
    const { wrapper } = createQueryWrapper();

    const { result } = renderHook(() => useAvailableTags(), { wrapper });

    expect(result.current.isLoading).toBe(true);

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });
  });

  it('propagates error state from usePosts', async () => {
    web3Mocks.getPostCount.mockRejectedValue(new Error('Network failure'));
    const { wrapper } = createQueryWrapper();

    const { result } = renderHook(() => useAvailableTags(), { wrapper });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.error).toBe('Network failure');
    expect(result.current.tags).toEqual([]);
  });
});

describe('useAvailableTags - getSuggestions', () => {
  it('returns all tags for empty query', async () => {
    const posts = [createPostMeta('1')];
    web3Mocks.getPostCount.mockResolvedValue(1);
    web3Mocks.getPosts.mockResolvedValue(posts);
    mockIPFSWithTags({ '1': ['react', 'redux'] });
    const { wrapper } = createQueryWrapper();

    const { result } = renderHook(() => useAvailableTags(), { wrapper });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    const suggestions = result.current.getSuggestions('');
    expect(suggestions).toHaveLength(2);
  });

  it('returns all tags for whitespace-only query', async () => {
    const posts = [createPostMeta('1')];
    web3Mocks.getPostCount.mockResolvedValue(1);
    web3Mocks.getPosts.mockResolvedValue(posts);
    mockIPFSWithTags({ '1': ['react', 'redux'] });
    const { wrapper } = createQueryWrapper();

    const { result } = renderHook(() => useAvailableTags(), { wrapper });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    const suggestions = result.current.getSuggestions('   ');
    expect(suggestions).toHaveLength(2);
  });

  it('prioritizes prefix matches over contains matches', async () => {
    const posts = [createPostMeta('1'), createPostMeta('2')];
    web3Mocks.getPostCount.mockResolvedValue(2);
    web3Mocks.getPosts.mockResolvedValue(posts);
    mockIPFSWithTags({
      '1': ['react', 'preact'],
      '2': ['react-native'],
    });
    const { wrapper } = createQueryWrapper();

    const { result } = renderHook(() => useAvailableTags(), { wrapper });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    const suggestions = result.current.getSuggestions('react');
    // 'react' and 'react-native' start with 'react' → prefix matches
    // 'preact' contains 'react' → contains match
    const names = suggestions.map((s: TagWithCount) => s.name);
    expect(names.indexOf('react')).toBeLessThan(names.indexOf('preact'));
    expect(names.indexOf('react-native')).toBeLessThan(names.indexOf('preact'));
  });

  it('performs case-insensitive matching', async () => {
    const posts = [createPostMeta('1')];
    web3Mocks.getPostCount.mockResolvedValue(1);
    web3Mocks.getPosts.mockResolvedValue(posts);
    mockIPFSWithTags({ '1': ['React', 'TypeScript'] });
    const { wrapper } = createQueryWrapper();

    const { result } = renderHook(() => useAvailableTags(), { wrapper });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    const suggestions = result.current.getSuggestions('re');
    const names = suggestions.map((s: TagWithCount) => s.name);
    expect(names).toContain('React');
  });

  it('returns empty array when no tags match', async () => {
    const posts = [createPostMeta('1')];
    web3Mocks.getPostCount.mockResolvedValue(1);
    web3Mocks.getPosts.mockResolvedValue(posts);
    mockIPFSWithTags({ '1': ['react', 'typescript'] });
    const { wrapper } = createQueryWrapper();

    const { result } = renderHook(() => useAvailableTags(), { wrapper });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    const suggestions = result.current.getSuggestions('zzz');
    expect(suggestions).toEqual([]);
  });
});
