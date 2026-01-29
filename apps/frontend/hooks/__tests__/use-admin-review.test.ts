import { vi, describe, it, expect, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const mockGetPostsByStatus = vi.fn();
const mockGetPendingReviewCount = vi.fn();
const mockApprovePost = vi.fn();
const mockRejectPost = vi.fn();
const mockAccount = { waitForTransaction: vi.fn() };

vi.mock('@/providers/wallet-provider', () => ({
  useWallet: () => ({ account: mockAccount, address: '0xadmin', isConnected: true }),
}));

vi.mock('@vauban/web3-utils', () => ({
  getPostsByStatus: (...args: unknown[]) => mockGetPostsByStatus(...args),
  getPendingReviewCount: (...args: unknown[]) => mockGetPendingReviewCount(...args),
  approvePost: (...args: unknown[]) => mockApprovePost(...args),
  rejectPost: (...args: unknown[]) => mockRejectPost(...args),
  POST_STATUS_PENDING_REVIEW: 1,
  initStarknetProvider: vi.fn(),
  getProvider: vi.fn(),
  setContractAddresses: vi.fn(),
  calculateContentHash: vi.fn(),
  getPosts: vi.fn().mockResolvedValue([]),
  getPost: vi.fn(),
  followsAbi: [],
  roleRegistryAbi: [],
}));

// Mock fetch for SSE event emission
const mockFetch = vi.fn().mockResolvedValue(new Response('{"ok":true}'));
vi.stubGlobal('fetch', mockFetch);

import { useAdminReview } from '@/hooks/use-admin-review';

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return React.createElement(QueryClientProvider, { client: queryClient }, children);
  };
}

describe('useAdminReview', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetPostsByStatus.mockResolvedValue([
      {
        id: '1',
        author: '0xauthor1',
        arweaveTxId: 'ar-tx-1',
        ipfsCid: 'ipfs-cid-1',
        contentHash: '0xhash1',
        createdAt: 1700000000,
        updatedAt: 1700000000,
        postType: 2,
      },
      {
        id: '2',
        author: '0xauthor2',
        arweaveTxId: 'ar-tx-2',
        ipfsCid: 'ipfs-cid-2',
        contentHash: '0xhash2',
        createdAt: 1700001000,
        updatedAt: 1700001000,
        postType: 2,
      },
    ]);
    mockGetPendingReviewCount.mockResolvedValue(5);
  });

  it('fetches pending posts and count', async () => {
    const { result } = renderHook(() => useAdminReview(), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.pendingPosts).toHaveLength(2);
    expect(result.current.pendingCount).toBe(5);
    expect(result.current.pendingPosts[0].id).toBe('1');
    expect(result.current.pendingPosts[0].author).toBe('0xauthor1');
  });

  it('calls approvePost contract wrapper on approve', async () => {
    mockApprovePost.mockResolvedValue('0xtx-approve');

    const { result } = renderHook(() => useAdminReview(), { wrapper: createWrapper() });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => {
      await result.current.approvePost('1');
    });

    expect(mockApprovePost).toHaveBeenCalledWith(mockAccount, '1');
  });

  it('calls rejectPost contract wrapper on reject', async () => {
    mockRejectPost.mockResolvedValue('0xtx-reject');

    const { result } = renderHook(() => useAdminReview(), { wrapper: createWrapper() });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => {
      await result.current.rejectPost('2');
    });

    expect(mockRejectPost).toHaveBeenCalledWith(mockAccount, '2');
  });

  it('emits SSE event after approve', async () => {
    mockApprovePost.mockResolvedValue('0xtx');

    const { result } = renderHook(() => useAdminReview(), { wrapper: createWrapper() });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => {
      await result.current.approvePost('1');
    });

    expect(mockFetch).toHaveBeenCalledWith('/api/events/emit', expect.objectContaining({
      method: 'POST',
      body: JSON.stringify({ type: 'post:approved', data: { postId: '1' } }),
    }));
  });

  it('shows loading state while fetching', () => {
    mockGetPostsByStatus.mockReturnValue(new Promise(() => {}));
    const { result } = renderHook(() => useAdminReview(), { wrapper: createWrapper() });
    expect(result.current.isLoading).toBe(true);
    expect(result.current.pendingPosts).toEqual([]);
  });
});
