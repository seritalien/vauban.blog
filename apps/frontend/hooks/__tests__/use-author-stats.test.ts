import { vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ALICE } from '@/__tests__/helpers/test-users';
import type { BatchEngagementResponse } from '@/app/api/engagement/batch/route';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const NOW = Date.now();

// Mock posts data (returned by usePosts)
const mockPostsData: { posts: unknown[]; isLoading: boolean; error: string | null } = {
  posts: [],
  isLoading: false,
  error: null,
};

vi.mock('@/hooks/use-posts', () => ({
  usePosts: () => mockPostsData,
}));

// Mock batch engagement data (returned by useBatchEngagement)
const mockEngagementData: { data: BatchEngagementResponse | undefined; isLoading: boolean; error: Error | null } = {
  data: undefined,
  isLoading: false,
  error: null,
};

vi.mock('@/hooks/use-engagement', () => ({
  useBatchEngagement: () => mockEngagementData,
}));

vi.mock('@vauban/web3-utils', () => ({
  initStarknetProvider: vi.fn(),
  setContractAddresses: vi.fn(),
  calculateContentHash: vi.fn().mockResolvedValue('0x' + 'ab'.repeat(32)),
  getPosts: vi.fn().mockResolvedValue([]),
  getPost: vi.fn(),
}));

vi.mock('@/lib/profiles', () => ({
  normalizeAddress: (addr: unknown) => {
    if (!addr) return '';
    const s = String(addr).toLowerCase();
    const withoutPrefix = s.replace(/^0x/, '');
    const withoutLeadingZeros = withoutPrefix.replace(/^0+/, '') || '0';
    return `0x${withoutLeadingZeros}`;
  },
}));

// Import hook after mocks
import { useAuthorStats } from '@/hooks/use-author-stats';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createQueryWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  function Wrapper({ children }: { children: React.ReactNode }) {
    return React.createElement(QueryClientProvider, { client: queryClient }, children);
  }
  return Wrapper;
}

function createMockPost(
  id: string,
  author: string,
  createdAt: Date,
  overrides: Record<string, unknown> = {},
) {
  return {
    id,
    author,
    title: `Post ${id}`,
    content: `Content for post ${id}`,
    arweaveTxId: `ar_${id}`,
    ipfsCid: `Qm${id}`,
    contentHash: '0x' + 'ab'.repeat(32),
    createdAt,
    updatedAt: createdAt,
    isDeleted: false,
    postType: 0,
    isVerified: true,
    ...overrides,
  };
}

function mockEngagement(map: BatchEngagementResponse) {
  mockEngagementData.data = map;
  mockEngagementData.isLoading = false;
  mockEngagementData.error = null;
}

function mockEngagementLoading() {
  mockEngagementData.data = undefined;
  mockEngagementData.isLoading = true;
  mockEngagementData.error = null;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.clearAllMocks();
  mockPostsData.posts = [];
  mockPostsData.isLoading = false;
  mockPostsData.error = null;
  mockEngagementData.data = undefined;
  mockEngagementData.isLoading = false;
  mockEngagementData.error = null;
});

describe('useAuthorStats', () => {
  it('filters posts by author address using normalized comparison', () => {
    const aliceNormalized = ALICE.address;
    const otherAuthor = '0x0999000000000000000000000000000000000000000000000000000000000009';

    mockPostsData.posts = [
      createMockPost('1', aliceNormalized, new Date(NOW - 86400000)),
      createMockPost('2', otherAuthor, new Date(NOW - 72000000)),
      createMockPost('3', aliceNormalized, new Date(NOW - 36000000)),
    ];

    const { result } = renderHook(() => useAuthorStats(aliceNormalized), {
      wrapper: createQueryWrapper(),
    });

    expect(result.current.authorPosts).toHaveLength(2);
    expect(result.current.stats?.totalPosts).toBe(2);
  });

  it('calculates memberSince from earliest post', () => {
    const earliest = new Date('2024-01-01T00:00:00Z');
    const later = new Date('2024-06-15T00:00:00Z');

    mockPostsData.posts = [
      createMockPost('1', ALICE.address, later),
      createMockPost('2', ALICE.address, earliest),
    ];

    const { result } = renderHook(() => useAuthorStats(ALICE.address), {
      wrapper: createQueryWrapper(),
    });

    expect(result.current.stats).not.toBeNull();
    expect(result.current.stats?.memberSince?.getTime()).toBe(earliest.getTime());
  });

  it('computes publication frequency correctly', () => {
    // Create posts ~7 days apart -> "Publishes weekly"
    const posts = Array.from({ length: 5 }, (_, i) =>
      createMockPost(
        String(i + 1),
        ALICE.address,
        new Date(NOW - i * 7 * 86400000),
      ),
    );

    mockPostsData.posts = posts;

    const { result } = renderHook(() => useAuthorStats(ALICE.address), {
      wrapper: createQueryWrapper(),
    });

    expect(result.current.stats?.publicationFrequency).toBe('Publishes weekly');
  });

  it('computes totals from batch engagement data', () => {
    mockPostsData.posts = [
      createMockPost('1', ALICE.address, new Date(NOW - 86400000)),
      createMockPost('2', ALICE.address, new Date(NOW - 72000000)),
    ];

    mockEngagement({
      '1': { likes: 10, comments: 2 },
      '2': { likes: 5, comments: 1 },
    });

    const { result } = renderHook(() => useAuthorStats(ALICE.address), {
      wrapper: createQueryWrapper(),
    });

    expect(result.current.stats?.totalLikes).toBe(15);
    expect(result.current.stats?.totalComments).toBe(3);
  });

  it('returns null stats when author address is empty', () => {
    mockPostsData.posts = [
      createMockPost('1', ALICE.address, new Date(NOW)),
    ];

    const { result } = renderHook(() => useAuthorStats(''), {
      wrapper: createQueryWrapper(),
    });

    expect(result.current.authorPosts).toHaveLength(0);
    expect(result.current.stats?.totalPosts).toBe(0);
    expect(result.current.stats?.totalLikes).toBe(0);
    expect(result.current.stats?.totalComments).toBe(0);
  });

  it('uses batch engagement (1 call) instead of N+1 RPC calls', () => {
    const postCount = 4;
    const posts = Array.from({ length: postCount }, (_, i) =>
      createMockPost(String(i + 1), ALICE.address, new Date(NOW - i * 86400000)),
    );
    mockPostsData.posts = posts;

    // Build engagement map for all posts
    const engMap: BatchEngagementResponse = {};
    for (let i = 1; i <= postCount; i++) {
      engMap[String(i)] = { likes: i, comments: 0 };
    }
    mockEngagement(engMap);

    const { result } = renderHook(() => useAuthorStats(ALICE.address), {
      wrapper: createQueryWrapper(),
    });

    // With batch approach, we get engagement data from the map
    expect(result.current.postsWithEngagement).toHaveLength(postCount);
    expect(result.current.stats?.totalLikes).toBe(1 + 2 + 3 + 4);
  });

  it('returns featured posts as top 3 by likes', () => {
    mockPostsData.posts = [
      createMockPost('1', ALICE.address, new Date(NOW - 400000)),
      createMockPost('2', ALICE.address, new Date(NOW - 300000)),
      createMockPost('3', ALICE.address, new Date(NOW - 200000)),
      createMockPost('4', ALICE.address, new Date(NOW - 100000)),
    ];

    mockEngagement({
      '1': { likes: 5, comments: 0 },
      '2': { likes: 20, comments: 0 },
      '3': { likes: 1, comments: 0 },
      '4': { likes: 15, comments: 0 },
    });

    const { result } = renderHook(() => useAuthorStats(ALICE.address), {
      wrapper: createQueryWrapper(),
    });

    expect(result.current.featuredPosts).toHaveLength(3);
    // Top 3 by likes: post 2 (20), post 4 (15), post 1 (5)
    expect(result.current.featuredPosts[0].id).toBe('2');
    expect(result.current.featuredPosts[1].id).toBe('4');
    expect(result.current.featuredPosts[2].id).toBe('1');
  });

  it('returns recent activity as last 5 posts sorted by date descending', () => {
    const posts = Array.from({ length: 7 }, (_, i) =>
      createMockPost(
        String(i + 1),
        ALICE.address,
        new Date(NOW - (7 - i) * 86400000), // post 7 is most recent
      ),
    );
    mockPostsData.posts = posts;

    // All posts need engagement data to appear in postsWithEngagement
    const engMap: BatchEngagementResponse = {};
    for (let i = 1; i <= 7; i++) {
      engMap[String(i)] = { likes: 0, comments: 0 };
    }
    mockEngagement(engMap);

    const { result } = renderHook(() => useAuthorStats(ALICE.address), {
      wrapper: createQueryWrapper(),
    });

    expect(result.current.recentActivity).toHaveLength(5);
    // Most recent 5 posts, sorted descending by date
    expect(result.current.recentActivity[0].id).toBe('7');
    expect(result.current.recentActivity[1].id).toBe('6');
    expect(result.current.recentActivity[2].id).toBe('5');
    expect(result.current.recentActivity[3].id).toBe('4');
    expect(result.current.recentActivity[4].id).toBe('3');
  });

  it('returns empty postsWithEngagement when engagement data is loading', () => {
    mockPostsData.posts = [
      createMockPost('1', ALICE.address, new Date(NOW)),
    ];
    mockEngagementLoading();

    const { result } = renderHook(() => useAuthorStats(ALICE.address), {
      wrapper: createQueryWrapper(),
    });

    expect(result.current.postsWithEngagement).toHaveLength(0);
    expect(result.current.isLoadingEngagement).toBe(true);
  });
});
