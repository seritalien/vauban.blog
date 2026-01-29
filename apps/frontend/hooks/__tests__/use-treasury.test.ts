import { vi, describe, it, expect, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const mockGetEarnings = vi.fn();
const mockGetRevenueConfig = vi.fn();
const mockWithdrawEarnings = vi.fn();
const mockAccount = { waitForTransaction: vi.fn() };

vi.mock('@/providers/wallet-provider', () => ({
  useWallet: () => ({ account: mockAccount, address: '0xabc', isConnected: true }),
}));

vi.mock('@vauban/web3-utils', () => ({
  getEarnings: (...args: unknown[]) => mockGetEarnings(...args),
  getRevenueConfig: (...args: unknown[]) => mockGetRevenueConfig(...args),
  withdrawEarnings: (...args: unknown[]) => mockWithdrawEarnings(...args),
  initStarknetProvider: vi.fn(),
  getProvider: vi.fn(),
  setContractAddresses: vi.fn(),
  calculateContentHash: vi.fn(),
  getPosts: vi.fn().mockResolvedValue([]),
  getPost: vi.fn(),
  followsAbi: [],
  roleRegistryAbi: [],
}));

import { useTreasury } from '@/hooks/use-treasury';

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return React.createElement(QueryClientProvider, { client: queryClient }, children);
  };
}

describe('useTreasury', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetEarnings.mockResolvedValue({
      totalEarned: 1000000000000000000n,
      totalWithdrawn: 500000000000000000n,
      pending: 500000000000000000n,
    });
    mockGetRevenueConfig.mockResolvedValue({
      platformFeeBps: 500,
      referralFeeBps: 200,
      minWithdrawal: 100000000000000000n,
    });
  });

  it('returns loading state initially', () => {
    mockGetEarnings.mockReturnValue(new Promise(() => {}));
    const { result } = renderHook(() => useTreasury('0xabc'), { wrapper: createWrapper() });
    expect(result.current.isLoading).toBe(true);
    expect(result.current.earnings).toBeNull();
  });

  it('returns earnings data after fetch', async () => {
    const { result } = renderHook(() => useTreasury('0xabc'), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.earnings).not.toBeNull();
    expect(result.current.earnings!.totalEarned).toBe(1000000000000000000n);
    expect(result.current.earnings!.pending).toBe(500000000000000000n);
    expect(result.current.config).not.toBeNull();
    expect(result.current.config!.platformFeeBps).toBe(500);
  });

  it('calls withdrawEarnings on withdraw', async () => {
    mockWithdrawEarnings.mockResolvedValue('0xtxhash');

    const { result } = renderHook(() => useTreasury('0xabc'), { wrapper: createWrapper() });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => {
      await result.current.withdraw();
    });

    expect(mockWithdrawEarnings).toHaveBeenCalledWith(mockAccount);
  });

  it('does not fetch when address is null', () => {
    const { result } = renderHook(() => useTreasury(null), { wrapper: createWrapper() });
    expect(result.current.earnings).toBeNull();
    expect(mockGetEarnings).not.toHaveBeenCalled();
  });
});
