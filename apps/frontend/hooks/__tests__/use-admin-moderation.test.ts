import { vi, describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const mockDeleteComment = vi.fn();
const mockBanUser = vi.fn();
const mockUnbanUser = vi.fn();
const mockIsBanned = vi.fn();
const mockGetReportCount = vi.fn();
const mockAccount = { waitForTransaction: vi.fn() };

vi.mock('@/providers/wallet-provider', () => ({
  useWallet: () => ({ account: mockAccount, address: '0xmod', isConnected: true }),
}));

vi.mock('@vauban/web3-utils', () => ({
  deleteComment: (...args: unknown[]) => mockDeleteComment(...args),
  banUser: (...args: unknown[]) => mockBanUser(...args),
  unbanUser: (...args: unknown[]) => mockUnbanUser(...args),
  isBanned: (...args: unknown[]) => mockIsBanned(...args),
  getReportCount: (...args: unknown[]) => mockGetReportCount(...args),
  initStarknetProvider: vi.fn(),
  getProvider: vi.fn(),
  setContractAddresses: vi.fn(),
  calculateContentHash: vi.fn(),
  getPosts: vi.fn().mockResolvedValue([]),
  getPost: vi.fn(),
  followsAbi: [],
  roleRegistryAbi: [],
}));

const mockFetch = vi.fn().mockResolvedValue(new Response('{"ok":true}'));
vi.stubGlobal('fetch', mockFetch);

import { useAdminModeration } from '@/hooks/use-admin-moderation';

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return React.createElement(QueryClientProvider, { client: queryClient }, children);
  };
}

describe('useAdminModeration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('calls deleteComment on resolveReport', async () => {
    mockDeleteComment.mockResolvedValue('0xtx');

    const { result } = renderHook(() => useAdminModeration(), { wrapper: createWrapper() });

    await act(async () => {
      await result.current.resolveReport('comment-42');
    });

    expect(mockDeleteComment).toHaveBeenCalledWith(mockAccount, 'comment-42');
  });

  it('calls banUser contract and emits SSE event', async () => {
    mockBanUser.mockResolvedValue('0xtx');

    const { result } = renderHook(() => useAdminModeration(), { wrapper: createWrapper() });

    await act(async () => {
      await result.current.banUser('0xbadactor');
    });

    expect(mockBanUser).toHaveBeenCalledWith(mockAccount, '0xbadactor');
    expect(mockFetch).toHaveBeenCalledWith('/api/events/emit', expect.objectContaining({
      method: 'POST',
      body: JSON.stringify({ type: 'user:banned', data: { address: '0xbadactor' } }),
    }));
  });

  it('calls unbanUser contract and emits SSE event', async () => {
    mockUnbanUser.mockResolvedValue('0xtx');

    const { result } = renderHook(() => useAdminModeration(), { wrapper: createWrapper() });

    await act(async () => {
      await result.current.unbanUser('0xreformed');
    });

    expect(mockUnbanUser).toHaveBeenCalledWith(mockAccount, '0xreformed');
    expect(mockFetch).toHaveBeenCalledWith('/api/events/emit', expect.objectContaining({
      method: 'POST',
      body: JSON.stringify({ type: 'user:unbanned', data: { address: '0xreformed' } }),
    }));
  });

  it('checkBanned delegates to isBanned', async () => {
    mockIsBanned.mockResolvedValue(true);

    const { result } = renderHook(() => useAdminModeration(), { wrapper: createWrapper() });

    const banned = await result.current.checkBanned('0xbad');
    expect(banned).toBe(true);
    expect(mockIsBanned).toHaveBeenCalledWith('0xbad');
  });

  it('getReports delegates to getReportCount', async () => {
    mockGetReportCount.mockResolvedValue(3);

    const { result } = renderHook(() => useAdminModeration(), { wrapper: createWrapper() });

    const count = await result.current.getReports('c-123');
    expect(count).toBe(3);
    expect(mockGetReportCount).toHaveBeenCalledWith('c-123');
  });
});
