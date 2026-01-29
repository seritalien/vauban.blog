import { vi, describe, it, expect, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const mockGetUserReputation = vi.fn();

vi.mock('@vauban/web3-utils', () => ({
  getUserReputation: (...args: unknown[]) => mockGetUserReputation(...args),
  BADGE_INFO: {
    first_post: { name: 'First Post', description: 'Published first post', icon: '📝' },
    prolific_writer: { name: 'Prolific Writer', description: 'Published 10+ posts', icon: '✍️' },
  },
  LEVEL_NAMES: { 0: 'Newcomer', 1: 'Contributor', 2: 'Active', 3: 'Veteran', 4: 'Legend' },
  BADGE_FIRST_POST: 1n,
  BADGE_PROLIFIC_WRITER: 2n,
  initStarknetProvider: vi.fn(),
  getProvider: vi.fn(),
  setContractAddresses: vi.fn(),
  calculateContentHash: vi.fn(),
  getPosts: vi.fn().mockResolvedValue([]),
  getPost: vi.fn(),
  followsAbi: [],
  roleRegistryAbi: [],
}));

import { useReputation } from '@/hooks/use-reputation';

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return React.createElement(QueryClientProvider, { client: queryClient }, children);
  };
}

describe('useReputation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns loading state initially', () => {
    mockGetUserReputation.mockReturnValue(new Promise(() => {}));
    const { result } = renderHook(() => useReputation('0xabc'), { wrapper: createWrapper() });
    expect(result.current.isLoading).toBe(true);
    expect(result.current.reputation).toBeNull();
  });

  it('returns reputation data after fetch', async () => {
    mockGetUserReputation.mockResolvedValue({
      totalPoints: 500,
      level: 2,
      badges: 3n,
      badgeList: ['first_post', 'prolific_writer'],
      joinedAt: 1700000000,
      postCount: 15,
      commentCount: 42,
    });

    const { result } = renderHook(() => useReputation('0xabc'), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.points).toBe(500);
    expect(result.current.level).toBe(2);
    expect(result.current.badges).toHaveLength(2);
    expect(result.current.badges[0].name).toBe('First Post');
    expect(result.current.hasBadge('first_post')).toBe(true);
    expect(result.current.hasBadge('nonexistent')).toBe(false);
  });

  it('does not fetch when address is null', () => {
    const { result } = renderHook(() => useReputation(null), { wrapper: createWrapper() });
    expect(result.current.isLoading).toBe(false);
    expect(mockGetUserReputation).not.toHaveBeenCalled();
  });

  it('returns default values when reputation not found', async () => {
    mockGetUserReputation.mockResolvedValue({
      totalPoints: 0,
      level: 0,
      badges: 0n,
      badgeList: [],
      joinedAt: 0,
      postCount: 0,
      commentCount: 0,
    });

    const { result } = renderHook(() => useReputation('0xnew'), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.points).toBe(0);
    expect(result.current.levelName).toBe('Newcomer');
    expect(result.current.badges).toHaveLength(0);
  });
});
